import type { Vec2, SpriteRef, DrawOpts } from '../types';
import type { Renderer } from './Renderer';

/**
 * Canvas 2D implementation of the Renderer interface.
 * Operates at the logical game resolution (256x240 by default).
 * CSS scaling is handled by CanvasManager.
 */
export class Canvas2DRenderer implements Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private cameraX = 0;
  private cameraY = 0;
  private spriteImages = new Map<string, HTMLImageElement>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
    // Disable image smoothing for pixel-perfect rendering
    this.ctx.imageSmoothingEnabled = false;
  }

  clear(color = '#000000'): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  fillRect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - this.cameraX, y - this.cameraY, w, h);
  }

  strokeRect(x: number, y: number, w: number, h: number, color: string, lineWidth = 1): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeRect(x - this.cameraX, y - this.cameraY, w, h);
  }

  fillPoly(points: Vec2[], color: string): void {
    if (points.length < 2) return;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x - this.cameraX, points[0].y - this.cameraY);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x - this.cameraX, points[i].y - this.cameraY);
    }
    this.ctx.closePath();
    this.ctx.fill();
  }

  strokePoly(points: Vec2[], color: string, lineWidth = 1): void {
    if (points.length < 2) return;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x - this.cameraX, points[0].y - this.cameraY);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x - this.cameraX, points[i].y - this.cameraY);
    }
    this.ctx.closePath();
    this.ctx.stroke();
  }

  fillCircle(x: number, y: number, radius: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x - this.cameraX, y - this.cameraY, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, color: string, lineWidth = 1): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(x1 - this.cameraX, y1 - this.cameraY);
    this.ctx.lineTo(x2 - this.cameraX, y2 - this.cameraY);
    this.ctx.stroke();
  }

  drawSprite(sprite: SpriteRef, x: number, y: number, opts?: DrawOpts): void {
    const img = this.spriteImages.get(sprite.id);
    if (!img) return;

    const dx = x - this.cameraX;
    const dy = y - this.cameraY;

    if (opts && (opts.flipX || opts.flipY || opts.rotation || opts.scaleX || opts.scaleY || opts.alpha !== undefined)) {
      this.ctx.save();
      this.ctx.translate(dx + sprite.width / 2, dy + sprite.height / 2);
      if (opts.rotation) this.ctx.rotate(opts.rotation);
      const sx = (opts.flipX ? -1 : 1) * (opts.scaleX ?? 1);
      const sy = (opts.flipY ? -1 : 1) * (opts.scaleY ?? 1);
      this.ctx.scale(sx, sy);
      if (opts.alpha !== undefined) this.ctx.globalAlpha = opts.alpha;
      if (sprite.srcRect) {
        this.ctx.drawImage(
          img,
          sprite.srcRect.x, sprite.srcRect.y, sprite.srcRect.width, sprite.srcRect.height,
          -sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height,
        );
      } else {
        this.ctx.drawImage(img, -sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
      }
      this.ctx.restore();
    } else {
      if (sprite.srcRect) {
        this.ctx.drawImage(
          img,
          sprite.srcRect.x, sprite.srcRect.y, sprite.srcRect.width, sprite.srcRect.height,
          dx, dy, sprite.width, sprite.height,
        );
      } else {
        this.ctx.drawImage(img, dx, dy, sprite.width, sprite.height);
      }
    }
  }

  drawText(text: string, x: number, y: number, color: string, size = 8, font = 'monospace'): void {
    this.ctx.fillStyle = color;
    this.ctx.font = `${size}px ${font}`;
    this.ctx.fillText(text, x - this.cameraX, y - this.cameraY);
  }

  setCamera(x: number, y: number): void {
    this.cameraX = x;
    this.cameraY = y;
  }

  resetCamera(): void {
    this.cameraX = 0;
    this.cameraY = 0;
  }

  save(): void {
    this.ctx.save();
  }

  restore(): void {
    this.ctx.restore();
  }

  translate(x: number, y: number): void {
    this.ctx.translate(x, y);
  }

  rotate(angle: number): void {
    this.ctx.rotate(angle);
  }

  scale(sx: number, sy: number): void {
    this.ctx.scale(sx, sy);
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getWidth(): number {
    return this.canvas.width;
  }

  getHeight(): number {
    return this.canvas.height;
  }

  /** Register a sprite image for later drawing */
  registerSprite(id: string, img: HTMLImageElement): void {
    this.spriteImages.set(id, img);
  }
}
