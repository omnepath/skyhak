/**
 * Touch input adapter with multi-touch support.
 *
 * Handles a D-pad region (directional input from drag) and
 * discrete button hit regions. Each active touch is tracked
 * independently so simultaneous d-pad + fire works.
 *
 * Coordinates are normalized (0-1) relative to the touch target
 * element, so they work at any screen size.
 */

import type { InputAdapter } from './InputAdapter';
import type { GameAction } from './InputMap';
import type { TouchOverlayLayout, DPadDef, TouchButtonDef } from './TouchLayout';
import { TouchOverlayRenderer } from './TouchOverlayRenderer';

interface ActiveTouch {
  id: number;
  /** What this touch is bound to: 'dpad' or a button id */
  target: string;
  /** Current normalized position */
  nx: number;
  ny: number;
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
    // Recompute actions from active touches
    this.currentActions.clear();
    this.activeVisualIds.clear();

    for (const touch of this.activeTouches.values()) {
      if (touch.target === 'dpad') {
        this.resolveDPad(touch);
      } else {
        this.resolveButton(touch);
      }
    }

    // Re-render overlay with current state
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
      const [nx, ny] = this.normalize(t);
      const target = this.hitTest(nx, ny);

      this.activeTouches.set(t.identifier, {
        id: t.identifier,
        target,
        nx,
        ny,
      });
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const existing = this.activeTouches.get(t.identifier);
      if (existing) {
        const [nx, ny] = this.normalize(t);
        existing.nx = nx;
        existing.ny = ny;
        // D-pad touches stay locked to d-pad (don't re-hit-test on move)
        // Button touches stay locked to their button
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      this.activeTouches.delete(e.changedTouches[i].identifier);
    }
  }

  // ── Hit testing ────────────────────────────────────────────

  private hitTest(nx: number, ny: number): string {
    // Check d-pad first
    const dpad = this.layout.dpad;
    const ddx = nx - dpad.nx;
    const ddy = ny - dpad.ny;
    const dDist = Math.sqrt(ddx * ddx + ddy * ddy);
    if (dDist < dpad.radius * 1.3) {
      return 'dpad';
    }

    // Check buttons (closest within radius)
    let closestBtn: TouchButtonDef | null = null;
    let closestDist = Infinity;

    for (const btn of this.layout.buttons) {
      const bx = nx - btn.nx;
      const by = ny - btn.ny;
      const bDist = Math.sqrt(bx * bx + by * by);
      const hitRadius = btn.shape === 'rect'
        ? Math.max(btn.width ?? 0.06, btn.height ?? 0.03) * 0.8
        : btn.radius * 1.5;

      if (bDist < hitRadius && bDist < closestDist) {
        closestBtn = btn;
        closestDist = bDist;
      }
    }

    if (closestBtn) return closestBtn.id;

    // Fallback: if in left half, treat as d-pad; right half, ignore
    if (nx < 0.4) return 'dpad';

    return 'none';
  }

  // ── Action resolution ──────────────────────────────────────

  private resolveDPad(touch: ActiveTouch): void {
    const dpad = this.layout.dpad;
    const dx = touch.nx - dpad.nx;
    const dy = touch.ny - dpad.ny;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Inside dead zone = no direction
    if (dist < dpad.radius * dpad.deadZone) return;

    // Normalize direction
    const angle = Math.atan2(dy, dx);

    // 8-way directional mapping with 45-degree sectors
    // Right = 0, Down = PI/2, Left = PI, Up = -PI/2
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

  // ── Coordinate normalization ───────────────────────────────

  private normalize(touch: Touch): [number, number] {
    if (!this.element) return [0, 0];
    const rect = this.element.getBoundingClientRect();
    return [
      (touch.clientX - rect.left) / rect.width,
      (touch.clientY - rect.top) / rect.height,
    ];
  }
}
