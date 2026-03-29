/**
 * DOM-based touch overlay renderer.
 *
 * Creates lightweight DOM elements for d-pad and buttons, positioned
 * with CSS fixed positioning and vmin units so they stay circular and
 * properly anchored in any orientation.
 *
 * All elements have pointer-events: none — touch events flow through
 * to the viewport and are handled by TouchAdapter. The DOM elements
 * serve as visual indicators AND as getBoundingClientRect() targets
 * for pixel-accurate hit-testing.
 */

import type { TouchOverlayLayout, TouchButtonDef } from './TouchLayout';

/** Map of element IDs → live DOM elements, used by TouchAdapter for hit-testing */
export interface OverlayElements {
  dpad: HTMLElement;
  dpadDirections: Map<string, HTMLElement>; // 'up','down','left','right'
  buttons: Map<string, HTMLElement>;        // button id → element
}

export class TouchOverlayRenderer {
  private layout: TouchOverlayLayout;
  private container: HTMLElement | null = null;

  // DOM containers
  private root: HTMLElement | null = null;
  private dpadContainer: HTMLElement | null = null;
  private buttonsContainer: HTMLElement | null = null;
  private centerContainer: HTMLElement | null = null;

  // Element references for hit-testing
  private dpadEl: HTMLElement | null = null;
  private dpadDirs = new Map<string, HTMLElement>();
  private buttonEls = new Map<string, HTMLElement>();

  private activeIds = new Set<string>();
  private centerRevealTimer: ReturnType<typeof setTimeout> | null = null;
  private centerVisible = false;

  constructor(layout: TouchOverlayLayout) {
    this.layout = layout;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    this.buildDOM();
  }

  unmount(): void {
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    if (this.centerRevealTimer) {
      clearTimeout(this.centerRevealTimer);
      this.centerRevealTimer = null;
    }
    this.dpadDirs.clear();
    this.buttonEls.clear();
  }

  /** Get live element references for hit-testing */
  getElements(): OverlayElements | null {
    if (!this.dpadEl) return null;
    return {
      dpad: this.dpadEl,
      dpadDirections: this.dpadDirs,
      buttons: this.buttonEls,
    };
  }

  setActiveIds(ids: Set<string>): void {
    this.activeIds = ids;
  }

  setOpacity(opacity: number): void {
    this.layout.opacity = opacity;
    if (this.root) {
      this.root.style.setProperty('--touch-opacity', String(opacity));
    }
  }

  render(): void {
    // Update active/pressed visual states
    const alpha = this.layout.opacity;

    // D-pad directions
    for (const [dir, el] of this.dpadDirs) {
      const active = this.activeIds.has(`dpad_${dir}`);
      el.style.opacity = String(active ? alpha * 0.85 : alpha * 0.3);
    }

    // Buttons
    for (const [id, el] of this.buttonEls) {
      const active = this.activeIds.has(id);
      el.style.opacity = String(active ? alpha * 0.8 : alpha * 0.3);
    }
  }

  /** Reveal center buttons (start/select) briefly on tap */
  revealCenter(): void {
    if (!this.centerContainer) return;
    this.centerVisible = true;
    this.centerContainer.style.opacity = String(this.layout.opacity * 0.6);
    this.centerContainer.style.pointerEvents = 'none';

    if (this.centerRevealTimer) clearTimeout(this.centerRevealTimer);
    this.centerRevealTimer = setTimeout(() => {
      if (this.centerContainer) {
        this.centerContainer.style.opacity = '0';
      }
      this.centerVisible = false;
    }, 3000);
  }

  get isCenterVisible(): boolean {
    return this.centerVisible;
  }

  // ── DOM construction ────────────────────────────────────

  private buildDOM(): void {
    // Root overlay — covers full screen, no pointer events
    this.root = document.createElement('div');
    this.root.className = 'touch-overlay-root';
    Object.assign(this.root.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '10',
      overflow: 'hidden',
    });
    this.root.style.setProperty('--touch-opacity', String(this.layout.opacity));

    // Build sections
    this.buildDPad();
    this.buildButtons();
    this.buildCenterButtons();

    // Inject stylesheet
    this.injectStyles();

    document.body.appendChild(this.root);
  }

  private buildDPad(): void {
    if (!this.root) return;

    // D-pad container — anchored bottom-left
    this.dpadContainer = document.createElement('div');
    this.dpadContainer.className = 'touch-dpad-container';
    Object.assign(this.dpadContainer.style, {
      position: 'fixed',
      bottom: '4vmin',
      left: '3vmin',
      width: '28vmin',
      height: '28vmin',
      pointerEvents: 'none',
    });

    // D-pad background circle
    this.dpadEl = document.createElement('div');
    this.dpadEl.className = 'touch-dpad';
    Object.assign(this.dpadEl.style, {
      position: 'absolute',
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      background: `rgba(255,255,255,${this.layout.opacity * 0.08})`,
      pointerEvents: 'none',
    });
    this.dpadContainer.appendChild(this.dpadEl);

    // Direction arrows
    const dirs: [string, string][] = [
      ['up', 'top: 12%; left: 50%; transform: translateX(-50%);'],
      ['down', 'bottom: 12%; left: 50%; transform: translateX(-50%);'],
      ['left', 'left: 12%; top: 50%; transform: translateY(-50%);'],
      ['right', 'right: 12%; top: 50%; transform: translateY(-50%);'],
    ];

    const arrowChars: Record<string, string> = {
      up: '\u25B2', down: '\u25BC', left: '\u25C0', right: '\u25B6',
    };

    for (const [dir, pos] of dirs) {
      const el = document.createElement('div');
      el.className = `touch-dpad-dir touch-dpad-${dir}`;
      el.setAttribute('style', `
        position: absolute; ${pos}
        width: 6vmin; height: 6vmin;
        display: flex; align-items: center; justify-content: center;
        font-size: 3.5vmin; color: white;
        opacity: ${this.layout.opacity * 0.3};
        pointer-events: none; user-select: none;
      `);
      el.textContent = arrowChars[dir];
      this.dpadContainer.appendChild(el);
      this.dpadDirs.set(dir, el);
    }

    this.root.appendChild(this.dpadContainer);
  }

  private buildButtons(): void {
    if (!this.root) return;

    // Buttons container — anchored bottom-right
    this.buttonsContainer = document.createElement('div');
    this.buttonsContainer.className = 'touch-buttons-container';
    Object.assign(this.buttonsContainer.style, {
      position: 'fixed',
      bottom: '4vmin',
      right: '3vmin',
      width: '30vmin',
      height: '30vmin',
      pointerEvents: 'none',
    });

    // Filter out start/select — they go in center
    const actionButtons = this.layout.buttons.filter(
      (b) => b.id !== 'start' && b.id !== 'select',
    );

    // Position action buttons within their container
    // Layout: A (main fire) bottom-right area, B left of A, C above A
    const btnPositions: Record<string, { right: string; bottom: string; size: string }> = {
      btnA: { right: '2vmin', bottom: '8vmin', size: '11vmin' },
      btnB: { right: '15vmin', bottom: '3vmin', size: '11vmin' },
      special: { right: '2vmin', bottom: '20vmin', size: '9vmin' },
    };

    for (const btn of actionButtons) {
      const pos = btnPositions[btn.id];
      if (!pos) continue;

      const el = document.createElement('div');
      el.className = `touch-btn touch-btn-${btn.id}`;
      el.dataset.btnId = btn.id;

      if (btn.shape === 'circle') {
        Object.assign(el.style, {
          position: 'absolute',
          right: pos.right,
          bottom: pos.bottom,
          width: pos.size,
          height: pos.size,
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.4)',
          background: 'rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: btn.id === 'special' ? '2.8vmin' : '3.5vmin',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          opacity: String(this.layout.opacity * 0.3),
          pointerEvents: 'none',
          userSelect: 'none',
        });
      }

      el.textContent = btn.label;
      this.buttonsContainer.appendChild(el);
      this.buttonEls.set(btn.id, el);
    }

    this.root.appendChild(this.buttonsContainer);
  }

  private buildCenterButtons(): void {
    if (!this.root) return;

    // Center container for start/select — hidden by default, tap to reveal
    this.centerContainer = document.createElement('div');
    this.centerContainer.className = 'touch-center-container';
    Object.assign(this.centerContainer.style, {
      position: 'fixed',
      bottom: '2vmin',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '3vmin',
      opacity: '0',
      transition: 'opacity 0.3s ease',
      pointerEvents: 'none',
    });

    const centerBtns = this.layout.buttons.filter(
      (b) => b.id === 'start' || b.id === 'select',
    );

    for (const btn of centerBtns) {
      const el = document.createElement('div');
      el.className = `touch-btn touch-btn-center touch-btn-${btn.id}`;
      el.dataset.btnId = btn.id;
      Object.assign(el.style, {
        padding: '1.5vmin 3vmin',
        borderRadius: '1vmin',
        border: '1px solid rgba(255,255,255,0.3)',
        background: 'rgba(255,255,255,0.06)',
        color: 'white',
        fontSize: '2.2vmin',
        fontFamily: 'monospace',
        fontWeight: 'bold',
        letterSpacing: '0.1em',
        pointerEvents: 'none',
        userSelect: 'none',
      });
      el.textContent = btn.label;
      this.centerContainer.appendChild(el);
      this.buttonEls.set(btn.id, el);
    }

    this.root.appendChild(this.centerContainer);
  }

  private injectStyles(): void {
    // Minimal keyframes for pressed feedback
    const style = document.createElement('style');
    style.textContent = `
      .touch-overlay-root * { box-sizing: border-box; }
    `;
    this.root?.appendChild(style);
  }
}
