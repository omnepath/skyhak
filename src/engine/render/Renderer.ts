import type { Vec2, SpriteRef, DrawOpts } from '../types';

/**
 * Abstract renderer interface.
 *
 * Game modes call these methods — never the underlying canvas/WebGL context
 * directly. This allows swapping Canvas2D → WebGL2 → WebGPU without touching
 * any game code.
 */
export interface Renderer {
  /** Clear the entire viewport */
  clear(color?: string): void;

  /** Draw a filled rectangle */
  fillRect(x: number, y: number, w: number, h: number, color: string): void;

  /** Draw a stroked rectangle */
  strokeRect(x: number, y: number, w: number, h: number, color: string, lineWidth?: number): void;

  /** Draw a filled polygon from an array of points */
  fillPoly(points: Vec2[], color: string): void;

  /** Draw a stroked polygon */
  strokePoly(points: Vec2[], color: string, lineWidth?: number): void;

  /** Draw a filled circle */
  fillCircle(x: number, y: number, radius: number, color: string): void;

  /** Draw a line between two points */
  drawLine(x1: number, y1: number, x2: number, y2: number, color: string, lineWidth?: number): void;

  /** Draw a sprite */
  drawSprite(sprite: SpriteRef, x: number, y: number, opts?: DrawOpts): void;

  /** Draw text */
  drawText(text: string, x: number, y: number, color: string, size?: number, font?: string): void;

  /** Set camera offset (world → screen translation) */
  setCamera(x: number, y: number): void;

  /** Reset camera to origin */
  resetCamera(): void;

  /** Save the current transform state */
  save(): void;

  /** Restore the last saved transform state */
  restore(): void;

  /** Apply a translation to the current transform */
  translate(x: number, y: number): void;

  /** Apply a rotation (radians) to the current transform */
  rotate(angle: number): void;

  /** Apply a scale to the current transform */
  scale(sx: number, sy: number): void;

  /** Get the underlying canvas element (for DOM mounting) */
  getCanvas(): HTMLCanvasElement;

  /** Get the logical (game) resolution */
  getWidth(): number;
  getHeight(): number;
}
