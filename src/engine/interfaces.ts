import type { Renderer } from './render/Renderer';
import type { InputSnapshot } from './input/InputSnapshot';
import type { InputConfig } from './input/InputMap';
import type { TouchOverlayLayout } from './input/TouchLayout';
import type { EventBus } from './events/EventBus';

/**
 * API surface that the engine exposes to game modes and modules.
 * Game code talks to the engine exclusively through this interface.
 *
 * Input uses physical button names (A, B, X, Y, C, L, R, dpadUp, etc.).
 * Game modules map these to game-specific actions in their own code.
 */
export interface EngineAPI {
  readonly renderer: Renderer;
  readonly input: InputSnapshot;
  readonly events: EventBus;
  readonly config: { width: number; height: number; targetFps: number };

  /** Request a mode transition */
  setMode(modeId: string): void;

  /** Get current elapsed game time in seconds */
  getTime(): number;

  /** Get frame delta in seconds */
  getDelta(): number;

  /**
   * Override input configuration. Game modules call this during
   * register() or init() to customize controls.
   *
   * Config hierarchy: engine defaults → game module → external override
   */
  configureInput(overrides: {
    keyboard?: Partial<InputConfig['keyboard']>;
    gamepad?: Partial<InputConfig['gamepad']>;
    touch?: Partial<TouchOverlayLayout>;
  }): void;
}

/**
 * A game mode represents a distinct gameplay state (e.g., isometric level,
 * dogfight, docking, weapon shop, title screen).
 *
 * Each mode has a complete lifecycle and receives the engine API on each tick.
 */
export interface GameMode {
  readonly id: string;

  /** Called once when the mode is first entered */
  enter(engine: EngineAPI): void;

  /** Called every fixed-timestep tick */
  update(engine: EngineAPI, dt: number): void;

  /** Called every render frame (may differ from update rate). alpha is interpolation factor [0,1] */
  render(engine: EngineAPI, alpha: number): void;

  /** Called when leaving this mode */
  exit(engine: EngineAPI): void;
}

/**
 * A game module is a self-contained game that plugs into the engine.
 * Captain Skyhawk is one such module.
 *
 * Modules register their modes, data, and assets with the engine.
 */
export interface GameModule {
  readonly id: string;
  readonly name: string;

  /** Register all modes, data, and assets with the engine */
  register(engine: EngineAPI, modeManager: ModeManagerAPI): void;

  /** Called once after registration, for any setup that needs engine context */
  init(engine: EngineAPI): void;

  /** Cleanup on unload */
  dispose(): void;
}

/**
 * Mode manager API exposed to game modules for registration.
 */
export interface ModeManagerAPI {
  /** Register a game mode */
  registerMode(mode: GameMode): void;

  /** Set the initial mode to enter */
  setInitialMode(modeId: string): void;
}
