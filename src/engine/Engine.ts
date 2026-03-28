import type { EngineAPI, GameModule, GameMode } from './interfaces';
import type { Renderer } from './render/Renderer';
import type { EngineConfig } from './types';
import { DEFAULT_ENGINE_CONFIG } from './types';
import { GameLoop } from './GameLoop';
import { ModeManager } from './ModeManager';
import { CanvasManager } from './render/CanvasManager';
import { Canvas2DRenderer } from './render/Canvas2DRenderer';
import { InputManager } from './input/InputManager';
import { KeyboardAdapter } from './input/KeyboardAdapter';
import { GamepadAdapter } from './input/GamepadAdapter';
import { DEFAULT_INPUT_MAP } from './input/InputMap';
import { InputSnapshot } from './input/InputSnapshot';
import { EventBus } from './events/EventBus';
import { DataRegistry } from './data/DataRegistry';

/**
 * Top-level engine orchestrator.
 *
 * Creates and owns all subsystems (renderer, input, audio, modes).
 * Implements EngineAPI so it can be passed to game modes.
 */
export class Engine implements EngineAPI {
  readonly renderer: Renderer;
  readonly events: EventBus;
  readonly data: DataRegistry;
  readonly config: { width: number; height: number; targetFps: number };
  readonly canvasManager: CanvasManager;
  private inputManager: InputManager;
  private modeManager: ModeManager;
  private gameLoop: GameLoop;
  private _input: InputSnapshot = InputSnapshot.empty();
  private _time = 0;
  private _delta = 0;

  constructor(engineConfig: Partial<EngineConfig> = {}) {
    const cfg = { ...DEFAULT_ENGINE_CONFIG, ...engineConfig };
    this.config = {
      width: cfg.canvasWidth,
      height: cfg.canvasHeight,
      targetFps: cfg.targetFps,
    };

    // Canvas & Renderer
    this.canvasManager = new CanvasManager(cfg);
    this.renderer = new Canvas2DRenderer(this.canvasManager.getCanvas());

    // Input
    this.inputManager = new InputManager();
    this.inputManager.addAdapter(new KeyboardAdapter(DEFAULT_INPUT_MAP));
    this.inputManager.addAdapter(new GamepadAdapter(DEFAULT_INPUT_MAP));

    // Events & Data
    this.events = new EventBus();
    this.data = new DataRegistry();

    // Modes
    this.modeManager = new ModeManager();

    // Game Loop
    this.gameLoop = new GameLoop(
      cfg.targetFps,
      (dt) => this.update(dt),
      (alpha) => this.render(alpha),
    );
  }

  get input(): InputSnapshot {
    return this._input;
  }

  getTime(): number {
    return this._time;
  }

  getDelta(): number {
    return this._delta;
  }

  setMode(modeId: string): void {
    this.modeManager.requestMode(modeId);
  }

  /** Mount the canvas to a container element and load a game module */
  mount(container: HTMLElement): void {
    this.canvasManager.mount(container);
  }

  /** Load a game module: register its modes and init */
  loadModule(module: GameModule): void {
    module.register(this, this.modeManager);
    module.init(this);
    this.events.emit('module:loaded', { moduleId: module.id });
  }

  /** Start the game loop */
  start(): void {
    this.modeManager.start(this);
    this.gameLoop.start();
    this.events.emit('engine:started');
  }

  /** Stop the game loop */
  stop(): void {
    this.gameLoop.stop();
    this.events.emit('engine:stopped');
  }

  private update(dt: number): void {
    this._delta = dt;
    this._time = this.gameLoop.time;
    this._input = this.inputManager.poll();
    this.modeManager.update(this, dt);
  }

  private render(alpha: number): void {
    this.renderer.clear('#000');
    this.modeManager.render(this, alpha);
  }

  dispose(): void {
    this.stop();
    this.inputManager.dispose();
    this.canvasManager.unmount();
    this.events.clear();
    this.data.clear();
  }
}
