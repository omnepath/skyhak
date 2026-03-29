/**
 * Touch input adapter with multi-touch support.
 *
 * Handles a D-pad region (directional input from drag) and
 * discrete button hit regions. Each active touch is tracked
 * independently so simultaneous d-pad + fire works.
 *
 * Hit-testing uses getBoundingClientRect() on DOM overlay elements
 * for pixel-accurate positions in any orientation/screen size.
 * All touch events flow through the viewport element — DOM overlay
 * elements have pointer-events: none.
 */

import type { InputAdapter } from './InputAdapter';
import type { GameAction } from './InputMap';
import type { TouchOverlayLayout, TouchButtonDef } from './TouchLayout';
import { TouchOverlayRenderer, type OverlayElements } from './TouchOverlayRenderer';

interface ActiveTouch {
  id: number;
  /** What this touch is bound to: 'dpad', a button id, or 'none' */
  target: string;
  /** Current client pixel position */
  cx: number;
  cy: number;
}

export class TouchAdapter implements InputAdapter {
  readonly id = 'touch';

  private layout: TouchOverlayLayout;
  private renderer: TouchOverlayRenderer;
  private connected = false;
  private element: HTMLElement | null = null;
  private activeTouches = new Map<number, ActiveTouch>();
  private currentActions = new Set<string>();
  private activeVisualIds = new Set<string>();

  // Bound handlers for cleanup
  private handleStart: (e: TouchEvent) => void;
  private handleMove: (e: TouchEvent) => void;
  private handleEnd: (e: TouchEvent) => void;

  constructor(layout: TouchOverlayLayout) {
    this.layout = layout;
    this.renderer = new TouchOverlayRenderer(layout);

    this.handleStart = (e) => this.onTouchStart(e);
    this.handleMove = (e) => this.onTouchMove(e);
    this.handleEnd = (e) => this.onTouchEnd(e);
  }

  /** Attach to a DOM element (the viewport container) */
  attachTo(element: HTMLElement): void {
    this.element = element;
    this.renderer.mount(element);
    // Ensure the element catches touch events
    element.style.touchAction = 'none';
    element.style.userSelect = 'none';
    (element.style as any).webkitUserSelect = 'none';
  }

  connect(): void {
    if (this.connected || !this.element) return;
    this.element.addEventListener('touchstart', this.handleStart, { passive: false });
    this.element.addEventListener('touchmove', this.handleMove, { passive: false });
    this.element.addEventListener('touchend', this.handleEnd, { passive: false });
    this.element.addEventListener('touchcancel', this.handleEnd, { passive: false });
    this.connected = true;
  }

  disconnect(): void {
    if (!this.element) return;
    this.element.removeEventListener('touchstart', this.handleStart);
    this.element.removeEventListener('touchmove', this.handleMove);
    this.element.removeEventListener('touchend', this.handleEnd);
    this.element.removeEventListener('touchcancel', this.handleEnd);
    this.activeTouches.clear();
    this.currentActions.clear();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  poll(): Set<string> {
    this.currentActions.clear();
    this.activeVisualIds.clear();

    for (const touch of this.activeTouches.values()) {
      if (touch.target === 'dpad') {
        this.resolveDPad(touch);
      } else if (touch.target !== 'none') {
        this.resolveButton(touch);
      }
    }

    // Update overlay visuals
    this.renderer.setActiveIds(this.activeVisualIds);
    this.renderer.render();

    return new Set(this.currentActions);
  }

  setOpacity(opacity: number): void {
    this.layout.opacity = opacity;
    this.renderer.setOpacity(opacity);
  }

  dispose(): void {
    this.disconnect();
    this.renderer.unmount();
  }

  // ── Touch event handlers ───────────────────────────────────

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const target = this.hitTest(t.clientX, t.clientY);

      // Tap in center gap → reveal start/select
      if (target === 'center_tap') {
        this.renderer.revealCenter();
        continue;
      }

      this.activeTouches.set(t.identifier, {
        id: t.identifier,
        target,
        cx: t.clientX,
        cy: t.clientY,
      });
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const existing = this.activeTouches.get(t.identifier);
      if (existing) {
        existing.cx = t.clientX;
        existing.cy = t.clientY;
        // D-pad and button touches stay locked to their target
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      this.activeTouches.delete(e.changedTouches[i].identifier);
    }
  }

  // ── Hit testing (pixel-based via DOM rects) ────────────────

  private hitTest(cx: number, cy: number): string {
    const els = this.renderer.getElements();
    if (!els) return this.hitTestFallback(cx, cy);

    // Check d-pad region
    const dpadRect = els.dpad.getBoundingClientRect();
    // Expand d-pad hit zone slightly (1.2x)
    const dpadCx = dpadRect.left + dpadRect.width / 2;
    const dpadCy = dpadRect.top + dpadRect.height / 2;
    const dpadR = Math.max(dpadRect.width, dpadRect.height) / 2 * 1.2;
    const dDx = cx - dpadCx;
    const dDy = cy - dpadCy;
    if (Math.sqrt(dDx * dDx + dDy * dDy) < dpadR) {
      return 'dpad';
    }

    // Check action buttons (closest within hit radius)
    let closestBtn: string | null = null;
    let closestDist = Infinity;

    for (const [id, el] of els.buttons) {
      const rect = el.getBoundingClientRect();
      const bCx = rect.left + rect.width / 2;
      const bCy = rect.top + rect.height / 2;
      const bR = Math.max(rect.width, rect.height) / 2 * 1.4; // generous hit zone
      const dx = cx - bCx;
      const dy = cy - bCy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < bR && dist < closestDist) {
        closestBtn = id;
        closestDist = dist;
      }
    }

    if (closestBtn) return closestBtn;

    // Check center gap — if visible, check start/select directly
    // If not visible, a tap here reveals them
    const screenW = window.innerWidth;
    const centerZoneLeft = screenW * 0.3;
    const centerZoneRight = screenW * 0.7;
    const centerZoneTop = window.innerHeight * 0.7;

    if (cx > centerZoneLeft && cx < centerZoneRight && cy > centerZoneTop) {
      if (this.renderer.isCenterVisible) {
        // Check start/select buttons specifically
        for (const id of ['start', 'select']) {
          const el = els.buttons.get(id);
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          const bCx = rect.left + rect.width / 2;
          const bCy = rect.top + rect.height / 2;
          const bR = Math.max(rect.width, rect.height) / 2 * 1.5;
          const dx = cx - bCx;
          const dy = cy - bCy;
          if (Math.sqrt(dx * dx + dy * dy) < bR) return id;
        }
      }
      return 'center_tap';
    }

    // Fallback: left 40% → dpad
    if (cx < screenW * 0.4) return 'dpad';

    return 'none';
  }

  /** Fallback hit-testing if DOM elements aren't ready yet */
  private hitTestFallback(cx: number, cy: number): string {
    const screenW = window.innerWidth;
    if (cx < screenW * 0.4) return 'dpad';
    if (cx > screenW * 0.6) return 'btnA'; // default to fire
    return 'none';
  }

  // ── Action resolution ──────────────────────────────────────

  private resolveDPad(touch: ActiveTouch): void {
    const els = this.renderer.getElements();
    if (!els) return;

    const dpadRect = els.dpad.getBoundingClientRect();
    const centerX = dpadRect.left + dpadRect.width / 2;
    const centerY = dpadRect.top + dpadRect.height / 2;
    const radius = dpadRect.width / 2;

    const dx = touch.cx - centerX;
    const dy = touch.cy - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Dead zone
    if (dist < radius * this.layout.dpad.deadZone) return;

    // 8-way directional mapping
    const angle = Math.atan2(dy, dx);
    const absAngle = Math.abs(angle);

    if (absAngle < Math.PI * 3 / 8) {
      this.currentActions.add('moveRight');
      this.activeVisualIds.add('dpad_right');
    }
    if (absAngle > Math.PI * 5 / 8) {
      this.currentActions.add('moveLeft');
      this.activeVisualIds.add('dpad_left');
    }
    if (angle > Math.PI / 8 && angle < Math.PI * 7 / 8) {
      this.currentActions.add('moveDown');
      this.activeVisualIds.add('dpad_down');
    }
    if (angle < -Math.PI / 8 && angle > -Math.PI * 7 / 8) {
      this.currentActions.add('moveUp');
      this.activeVisualIds.add('dpad_up');
    }
  }

  private resolveButton(touch: ActiveTouch): void {
    const btn = this.layout.buttons.find((b) => b.id === touch.target);
    if (!btn) return;

    const actions = Array.isArray(btn.action) ? btn.action : [btn.action];
    for (const a of actions) {
      this.currentActions.add(a);
    }
    this.activeVisualIds.add(btn.id);
  }
}
