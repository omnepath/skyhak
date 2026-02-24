import type { EngineConfig } from '../types';

/**
 * Creates and manages the game canvas element.
 * Handles CSS scaling to display the logical resolution at the configured pixel scale.
 * Maintains aspect ratio and supports fullscreen-like scaling.
 */
export class CanvasManager {
  private canvas: HTMLCanvasElement;
  private config: EngineConfig;

  constructor(config: EngineConfig) {
    this.config = config;
    this.canvas = document.createElement('canvas');
    this.canvas.width = config.canvasWidth;
    this.canvas.height = config.canvasHeight;

    // Pixel-perfect scaling via CSS
    this.canvas.style.imageRendering = 'pixelated';
    this.canvas.style.imageRendering = 'crisp-edges';
    this.canvas.style.display = 'block';

    this.updateScale();
    window.addEventListener('resize', () => this.updateScale());
  }

  /** Mount the canvas into a DOM container */
  mount(container: HTMLElement): void {
    container.appendChild(this.canvas);
    this.updateScale();
  }

  /** Remove the canvas from the DOM */
  unmount(): void {
    this.canvas.remove();
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /** Recalculate CSS dimensions to fill available space while maintaining aspect ratio */
  private updateScale(): void {
    const parent = this.canvas.parentElement;
    const maxW = parent ? parent.clientWidth : window.innerWidth;
    const maxH = parent ? parent.clientHeight : window.innerHeight;

    const aspect = this.config.canvasWidth / this.config.canvasHeight;
    let w = maxW;
    let h = maxW / aspect;
    if (h > maxH) {
      h = maxH;
      w = maxH * aspect;
    }

    // Snap to integer multiples for pixel-perfect rendering
    const scale = Math.max(1, Math.floor(Math.min(w / this.config.canvasWidth, h / this.config.canvasHeight)));
    this.canvas.style.width = `${this.config.canvasWidth * scale}px`;
    this.canvas.style.height = `${this.config.canvasHeight * scale}px`;
  }
}
