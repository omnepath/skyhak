import type { EngineConfig } from '../types';

export type ScaleMode = 'fit' | 'integer' | 'manual';

/**
 * Creates and manages the game canvas element.
 *
 * Scale modes:
 * - 'fit': fill available space, allow fractional scaling (default on small screens)
 * - 'integer': snap to integer multiples for pixel-perfect rendering (default on large screens)
 * - 'manual': user-controlled zoom level, canvas may overflow viewport (scrollable)
 */
export class CanvasManager {
  private canvas: HTMLCanvasElement;
  private config: EngineConfig;
  private scaleMode: ScaleMode = 'integer';
  private manualZoom = 2;
  private currentScale = 1;
  private onScaleChange?: (scale: number, mode: ScaleMode) => void;

  constructor(config: EngineConfig) {
    this.config = config;
    this.canvas = document.createElement('canvas');
    this.canvas.width = config.canvasWidth;
    this.canvas.height = config.canvasHeight;

    this.canvas.style.imageRendering = 'pixelated';
    this.canvas.style.imageRendering = 'crisp-edges';
    this.canvas.style.display = 'block';

    // Auto-detect: small screens get 'fit', large screens get 'integer'
    this.scaleMode = window.innerWidth < config.canvasWidth * 2 ? 'fit' : 'integer';

    this.updateScale();
    window.addEventListener('resize', () => this.updateScale());
  }

  mount(container: HTMLElement): void {
    container.appendChild(this.canvas);
    this.updateScale();
  }

  unmount(): void {
    this.canvas.remove();
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getScale(): number {
    return this.currentScale;
  }

  getScaleMode(): ScaleMode {
    return this.scaleMode;
  }

  setScaleMode(mode: ScaleMode): void {
    this.scaleMode = mode;
    this.updateScale();
  }

  /** Set manual zoom level (only applies in 'manual' mode) */
  setManualZoom(zoom: number): void {
    this.manualZoom = Math.max(0.5, Math.min(8, zoom));
    if (this.scaleMode === 'manual') {
      this.updateScale();
    }
  }

  getManualZoom(): number {
    return this.manualZoom;
  }

  /** Zoom in by a step */
  zoomIn(step = 0.5): void {
    this.scaleMode = 'manual';
    this.setManualZoom(this.manualZoom + step);
  }

  /** Zoom out by a step */
  zoomOut(step = 0.5): void {
    this.scaleMode = 'manual';
    this.setManualZoom(this.manualZoom - step);
  }

  /** Reset to auto-fit mode */
  zoomFit(): void {
    this.scaleMode = 'fit';
    this.updateScale();
  }

  /** Cycle through modes: fit → integer → manual → fit */
  cycleMode(): void {
    if (this.scaleMode === 'fit') {
      this.scaleMode = 'integer';
    } else if (this.scaleMode === 'integer') {
      this.scaleMode = 'manual';
      this.manualZoom = this.currentScale;
    } else {
      this.scaleMode = 'fit';
    }
    this.updateScale();
  }

  /** Register a callback for scale changes */
  onScale(cb: (scale: number, mode: ScaleMode) => void): void {
    this.onScaleChange = cb;
  }

  private updateScale(): void {
    const parent = this.canvas.parentElement;
    const maxW = parent ? parent.clientWidth : window.innerWidth;
    const maxH = parent ? parent.clientHeight : window.innerHeight;

    let scale: number;

    switch (this.scaleMode) {
      case 'fit': {
        // Fill available space, allow fractional
        const scaleW = maxW / this.config.canvasWidth;
        const scaleH = maxH / this.config.canvasHeight;
        scale = Math.min(scaleW, scaleH);
        scale = Math.max(0.5, scale); // minimum half-size
        break;
      }
      case 'integer': {
        // Snap to largest integer multiple that fits
        const scaleW = maxW / this.config.canvasWidth;
        const scaleH = maxH / this.config.canvasHeight;
        scale = Math.max(1, Math.floor(Math.min(scaleW, scaleH)));
        break;
      }
      case 'manual': {
        scale = this.manualZoom;
        break;
      }
    }

    this.currentScale = scale;
    this.canvas.style.width = `${this.config.canvasWidth * scale}px`;
    this.canvas.style.height = `${this.config.canvasHeight * scale}px`;

    this.onScaleChange?.(scale, this.scaleMode);
  }
}
