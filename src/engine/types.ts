/** Shared types for the SkyHak engine */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/** Sprite reference: identifies a sprite in an atlas or standalone */
export interface SpriteRef {
  id: string;
  atlasId?: string;
  srcRect?: Rect;
  width: number;
  height: number;
}

/** Options for drawing a sprite */
export interface DrawOpts {
  flipX?: boolean;
  flipY?: boolean;
  rotation?: number;
  alpha?: number;
  scaleX?: number;
  scaleY?: number;
  tint?: string;
}

/** Engine configuration */
export interface EngineConfig {
  canvasWidth: number;
  canvasHeight: number;
  targetFps: number;
  pixelScale: number;
  rendererType: 'canvas2d' | 'webgl2';
}

/** Default engine configuration matching NES resolution */
export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  canvasWidth: 256,
  canvasHeight: 240,
  targetFps: 60,
  pixelScale: 3,
  rendererType: 'canvas2d',
};
