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
 *
 * Two independent visual controls:
 * - **Base opacity**: how visible the idle controls are (0-1).
 *   User can set this to 0 for fully invisible controls.
 * - **Highlight opacity**: additive glow on press/hold (0-1).
 *   User can set this independently so even invisible controls
 *   flash on touch for UX feedback.
 */

import type { TouchOverlayLayout } from './TouchLayout';

/** Map of element IDs → live DOM elements, used by TouchAdapter for hit-testing */
export interface OverlayElements {
  dpad: HTMLElement;
  dpadDirections: Map<string, HTMLElement>;
  buttons: Map<string, HTMLElement>;
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

  /** Independent highlight opacity (0-1). Additive glow on press. */
  private highlightOpacity = 0.6;
  /** Whether highlight effect is enabled */
  private highlightEnabled = true;

  /** Whether center buttons (start/select) are currently awake/visible */
  private centerAwake = false;
  private centerFadeTimer: ReturnType<typeof setTimeout> | null = null;
  /** How long center buttons stay visible after wake (ms) */
  private centerFadeDuration = 4000;
  /** Fade-out CSS transition duration (ms) — must match CSS transition below */
  private centerFadeTransition = 600;

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
    if (this.centerFadeTimer) {
      clearTimeout(this.centerFadeTimer);
      this.centerFadeTimer = null;
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
      this.root.style.setProperty('--base-opacity', String(opacity));
    }
  }

  setHighlightOpacity(opacity: number): void {
    this.highlightOpacity = Math.max(0, Math.min(1, opacity));
    if (this.root) {
      this.root.style.setProperty('--highlight-opacity', String(this.highlightOpacity));
    }
  }

  setHighlightEnabled(enabled: boolean): void {
    this.highlightEnabled = enabled;
  }

  /** Wake all hidden UI — center buttons become visible and operable */
  wakeUI(): void {
    if (!this.centerContainer) return;

    this.centerAwake = true;
    // Immediate snap to visible
    this.centerContainer.style.transition = 'none';
    this.centerContainer.style.opacity = '1';
    // Re-enable transition for the upcoming fade
    requestAnimationFrame(() => {
      if (this.centerContainer) {
        this.centerContainer.style.transition = `opacity ${this.centerFadeTransition}ms ease`;
      }
    });

    // Reset fade timer
    if (this.centerFadeTimer) clearTimeout(this.centerFadeTimer);
    this.centerFadeTimer = setTimeout(() => {
      if (this.centerContainer) {
        this.centerContainer.style.opacity = '0';
      }
      // Mark as not awake after the CSS transition completes
      this.centerFadeTimer = setTimeout(() => {
        this.centerAwake = false;
      }, this.centerFadeTransition);
    }, this.centerFadeDuration);
  }

  /** Whether center buttons are currently visible and operable */
  get isCenterAwake(): boolean {
    return this.centerAwake;
  }

  render(): void {
    const base = this.layout.opacity;
    const hlEnabled = this.highlightEnabled;
    const hlAlpha = this.highlightOpacity;

    // D-pad directions
    for (const [dir, el] of this.dpadDirs) {
      const active = this.activeIds.has(`dpad_${dir}`);
      if (active && hlEnabled) {
        el.style.opacity = String(Math.min(1, base + hlAlpha));
        el.style.textShadow = `0 0 ${2}vmin rgba(255,255,255,${hlAlpha})`;
      } else {
        el.style.opacity = String(base * 0.6);
        el.style.textShadow = 'none';
      }
    }

    // D-pad background
    if (this.dpadEl) {
      const anyDpad = ['up', 'down', 'left', 'right'].some(
        (d) => this.activeIds.has(`dpad_${d}`),
      );
      if (anyDpad && hlEnabled) {
        this.dpadEl.style.background = `rgba(255,255,255,${base * 0.12 + hlAlpha * 0.08})`;
        this.dpadEl.style.boxShadow = `inset 0 0 3vmin rgba(255,255,255,${hlAlpha * 0.15})`;
      } else {
        this.dpadEl.style.background = `rgba(255,255,255,${base * 0.08})`;
        this.dpadEl.style.boxShadow = 'none';
      }
    }

    // Buttons (action + center)
    for (const [id, el] of this.buttonEls) {
      const active = this.activeIds.has(id);
      if (active && hlEnabled) {
        el.style.opacity = String(Math.min(1, base + hlAlpha));
        el.style.boxShadow = `0 0 2vmin rgba(255,255,255,${hlAlpha * 0.5}), inset 0 0 1.5vmin rgba(255,255,255,${hlAlpha * 0.2})`;
        el.style.borderColor = `rgba(255,255,255,${Math.min(1, 0.4 + hlAlpha * 0.4)})`;
        el.style.background = `rgba(255,255,255,${0.08 + hlAlpha * 0.12})`;
      } else {
        el.style.opacity = String(base * 0.6);
        el.style.boxShadow = 'none';
        el.style.borderColor = 'rgba(255,255,255,0.4)';
        el.style.background = 'rgba(255,255,255,0.08)';
      }
    }
  }

  // ── DOM construction ────────────────────────────────────

  private buildDOM(): void {
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
    this.root.style.setProperty('--base-opacity', String(this.layout.opacity));
    this.root.style.setProperty('--highlight-opacity', String(this.highlightOpacity));

    this.buildDPad();
    this.buildButtons();
    this.buildCenterButtons();
    this.injectStyles();

    document.body.appendChild(this.root);
  }

  private buildDPad(): void {
    if (!this.root) return;

    // D-pad container — anchored bottom-left, raised above corner UI
    this.dpadContainer = document.createElement('div');
    this.dpadContainer.className = 'touch-dpad-container';
    Object.assign(this.dpadContainer.style, {
      position: 'fixed',
      bottom: '14vmin',
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
      transition: 'background 0.1s ease, box-shadow 0.1s ease',
      pointerEvents: 'none',
    });
    this.dpadContainer.appendChild(this.dpadEl);

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
        opacity: ${this.layout.opacity * 0.6};
        transition: opacity 0.08s ease, text-shadow 0.08s ease;
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

    // Buttons container — anchored bottom-right, raised above corner UI
    this.buttonsContainer = document.createElement('div');
    this.buttonsContainer.className = 'touch-buttons-container';
    Object.assign(this.buttonsContainer.style, {
      position: 'fixed',
      bottom: '14vmin',
      right: '3vmin',
      width: '30vmin',
      height: '30vmin',
      pointerEvents: 'none',
    });

    const actionButtons = this.layout.buttons.filter(
      (b) => b.id !== 'start' && b.id !== 'select',
    );

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
          opacity: String(this.layout.opacity * 0.6),
          transition: 'opacity 0.08s ease, box-shadow 0.15s ease, background 0.08s ease, border-color 0.08s ease',
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

    // Center container for start/select — hidden by default, tap screen to wake
    this.centerContainer = document.createElement('div');
    this.centerContainer.className = 'touch-center-container';
    Object.assign(this.centerContainer.style, {
      position: 'fixed',
      bottom: '10vmin',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '3vmin',
      opacity: '0',
      transition: `opacity ${this.centerFadeTransition}ms ease`,
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
        opacity: String(this.layout.opacity * 0.6),
        transition: 'opacity 0.08s ease, box-shadow 0.15s ease, background 0.08s ease, border-color 0.08s ease',
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
    const style = document.createElement('style');
    style.textContent = `
      .touch-overlay-root * { box-sizing: border-box; }
    `;
    this.root?.appendChild(style);
  }
}
