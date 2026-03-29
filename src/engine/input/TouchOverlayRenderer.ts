/**
 * Renders the touch overlay controls onto a canvas layer.
 * Separate from the game canvas — this is a transparent overlay.
 */

import type { TouchOverlayLayout, DPadDef, TouchButtonDef } from './TouchLayout';

export class TouchOverlayRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private layout: TouchOverlayLayout;
  private activeIds = new Set<string>(); // currently pressed button/direction IDs

  constructor(layout: TouchOverlayLayout) {
    this.layout = layout;
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none'; // touches go to the main overlay div
    this.canvas.style.zIndex = '5';
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create overlay canvas context');
    this.ctx = ctx;
  }

  mount(container: HTMLElement): void {
    container.appendChild(this.canvas);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  unmount(): void {
    this.canvas.remove();
  }

  setActiveIds(ids: Set<string>): void {
    this.activeIds = ids;
  }

  setOpacity(opacity: number): void {
    this.layout.opacity = opacity;
  }

  render(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    const alpha = this.layout.opacity;
    if (alpha <= 0) return;

    this.renderDPad(this.layout.dpad, w, h, alpha);

    for (const btn of this.layout.buttons) {
      this.renderButton(btn, w, h, alpha);
    }
  }

  private renderDPad(dpad: DPadDef, w: number, h: number, alpha: number): void {
    const cx = dpad.nx * w;
    const cy = dpad.ny * h;
    const r = dpad.radius * w;

    // Background circle
    this.ctx.fillStyle = `rgba(255,255,255,${alpha * 0.1})`;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.fill();

    // Direction arrows
    const arrowR = r * 0.4;
    const dirs: [string, number, number][] = [
      ['up',    0, -1],
      ['down',  0,  1],
      ['left', -1,  0],
      ['right', 1,  0],
    ];

    for (const [id, dx, dy] of dirs) {
      const active = this.activeIds.has(`dpad_${id}`);
      const baseAlpha = active ? alpha * 0.8 : alpha * 0.3;
      const ax = cx + dx * r * 0.55;
      const ay = cy + dy * r * 0.55;

      this.ctx.fillStyle = `rgba(255,255,255,${baseAlpha})`;
      this.ctx.beginPath();

      // Triangle pointing in direction
      if (dx === 0) {
        // vertical arrow
        const tip = ay + dy * arrowR * 0.6;
        this.ctx.moveTo(ax, tip);
        this.ctx.lineTo(ax - arrowR * 0.4, ay - dy * arrowR * 0.3);
        this.ctx.lineTo(ax + arrowR * 0.4, ay - dy * arrowR * 0.3);
      } else {
        // horizontal arrow
        const tip = ax + dx * arrowR * 0.6;
        this.ctx.moveTo(tip, ay);
        this.ctx.lineTo(ax - dx * arrowR * 0.3, ay - arrowR * 0.4);
        this.ctx.lineTo(ax - dx * arrowR * 0.3, ay + arrowR * 0.4);
      }

      this.ctx.closePath();
      this.ctx.fill();
    }
  }

  private renderButton(btn: TouchButtonDef, w: number, h: number, alpha: number): void {
    const cx = btn.nx * w;
    const cy = btn.ny * h;
    const active = this.activeIds.has(btn.id);
    const baseAlpha = active ? alpha * 0.7 : alpha * 0.25;

    if (btn.shape === 'circle') {
      const r = btn.radius * w;

      // Outer ring
      this.ctx.strokeStyle = `rgba(255,255,255,${baseAlpha})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.stroke();

      // Fill
      this.ctx.fillStyle = `rgba(255,255,255,${baseAlpha * 0.3})`;
      this.ctx.fill();
    } else {
      // Rect
      const bw = (btn.width ?? 0.06) * w;
      const bh = (btn.height ?? 0.03) * h;
      this.ctx.strokeStyle = `rgba(255,255,255,${baseAlpha})`;
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
      this.ctx.fillStyle = `rgba(255,255,255,${baseAlpha * 0.3})`;
      this.ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
    }

    // Label
    this.ctx.fillStyle = `rgba(255,255,255,${active ? alpha * 0.9 : alpha * 0.5})`;
    const fontSize = btn.shape === 'rect' ? Math.max(10, w * 0.022) : Math.max(12, w * 0.028);
    this.ctx.font = `bold ${fontSize}px monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(btn.label, cx, cy);
  }

  private resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight;
    this.render();
  }
}
