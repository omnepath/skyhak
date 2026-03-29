// Engine public API
export { Engine, type InputMode } from './Engine';
export { GameLoop } from './GameLoop';
export { ModeManager } from './ModeManager';
export { EventBus } from './events/EventBus';
export { DataRegistry } from './data/DataRegistry';
export { InputManager } from './input/InputManager';
export { InputSnapshot } from './input/InputSnapshot';
export { Canvas2DRenderer } from './render/Canvas2DRenderer';
export { CanvasManager, type ScaleMode } from './render/CanvasManager';

// Types & Interfaces
export type { EngineAPI, GameMode, GameModule, ModeManagerAPI } from './interfaces';
export type { Renderer } from './render/Renderer';
export type { InputAdapter } from './input/InputAdapter';
export { TouchAdapter } from './input/TouchAdapter';
export { DEFAULT_TOUCH_LAYOUT, type TouchOverlayLayout } from './input/TouchLayout';
export type { Vec2, Vec3, Rect, Color, SpriteRef, DrawOpts, EngineConfig } from './types';
export { DEFAULT_ENGINE_CONFIG } from './types';

// Math
export * from './math/Vec2';
export * from './math/Vec3';
export * from './math/MathUtils';
