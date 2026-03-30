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
import { TouchAdapter } from './input/TouchAdapter';
import { DEFAULT_INPUT_CONFIG } from './input/InputMap';
import type { InputConfig } from './input/InputMap';
import { DEFAULT_TOUCH_LAYOUT } from './input/TouchLayout';
import type { TouchOverlayLayout } from './input/TouchLayout';
import { InputSnapshot } from './input/InputSnapshot';
import { EventBus } from './events/EventBus';
import { DataRegistry } from './data/DataRegistry';

export type InputMode = 'auto' | 'keyboard' | 'touch' | 'gamepad';

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

  private touchAdapter: TouchAdapter | null = null;
  private keyboardAdapter: KeyboardAdapter;
  private gamepadAdapter: GamepadAdapter;
  private _inputMode: InputMode = 'auto';
  private _isMobile: boolean;
  private _viewportElement: HTMLElement | null = null;

  // Input configuration — defaults can be overridden by game modules
  private _inputConfig: InputConfig;
  private _touchLayout: TouchOverlayLayout;

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

    // Detect mobile
    this._isMobile = this.detectMobile();

    // Input config (defaults, overridable by game modules)
    this._inputConfig = { ...DEFAULT_INPUT_CONFIG };
    this._touchLayout = { ...DEFAULT_TOUCH_LAYOUT, buttons: [...DEFAULT_TOUCH_LAYOUT.buttons] };

    // Input adapters
    this.keyboardAdapter = new KeyboardAdapter(this._inputConfig);
    this.gamepadAdapter = new GamepadAdapter(this._inputConfig);
    this.inputManager = new InputManager();

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

  get inputMode(): InputMode {
    return this._inputMode;
  }

  get isMobile(): boolean {
    return this._isMobile;
  }

  get touchEnabled(): boolean {
    return this.touchAdapter !== null && this.touchAdapter.isConnected();
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

  /** Mount the canvas to a container element */
  mount(container: HTMLElement): void {
    this._viewportElement = container;
    this.canvasManager.mount(container);
    this.applyInputMode(this._inputMode);
  }

  /** Switch input mode at runtime */
  setInputMode(mode: InputMode): void {
    this._inputMode = mode;
    if (this._viewportElement) {
      this.applyInputMode(mode);
    }
  }

  /**
   * Override input configuration. Game modules call this during
   * register() or init() to customize controls.
   *
   * Partial overrides are merged with defaults — provide only what
   * you want to change.
   *
   * Config hierarchy: engine defaults → game module → external override
   */
  configureInput(overrides: {
    keyboard?: Partial<InputConfig['keyboard']>;
    gamepad?: Partial<InputConfig['gamepad']>;
    touch?: Partial<TouchOverlayLayout>;
  }): void {
    if (overrides.keyboard) {
      this._inputConfig.keyboard = { ...this._inputConfig.keyboard, ...overrides.keyboard };
      this.keyboardAdapter.updateMap(this._inputConfig);
    }
    if (overrides.gamepad) {
      this._inputConfig.gamepad = { ...this._inputConfig.gamepad, ...overrides.gamepad };
      this.gamepadAdapter.updateMap(this._inputConfig);
    }
    if (overrides.touch) {
      if (overrides.touch.buttons) {
        this._touchLayout.buttons = overrides.touch.buttons;
      }
      if (overrides.touch.dpad) {
        this._touchLayout.dpad = overrides.touch.dpad;
      }
      if (overrides.touch.opacity !== undefined) {
        this._touchLayout.opacity = overrides.touch.opacity;
      }
      // Re-apply if touch is active
      if (this.touchAdapter && this._viewportElement) {
        this.touchAdapter.dispose();
        this.inputManager.removeAdapter('touch');
        this.touchAdapter = new TouchAdapter(this._touchLayout);
        this.touchAdapter.attachTo(this._viewportElement);
        this.inputManager.addAdapter(this.touchAdapter);
      }
    }
    this.events.emit('input:config-changed', { config: this._inputConfig });
  }

  /**
   * Apply an external input config override (e.g. controller profile).
   * Same as configureInput but emits a different event for tracking.
   */
  applyInputOverride(overrides: Parameters<Engine['configureInput']>[0]): void {
    this.configureInput(overrides);
    this.events.emit('input:override-applied', { overrides });
  }

  /** Set touch overlay opacity (0 = hidden, 1 = fully visible) */
  setTouchOpacity(opacity: number): void {
    this.touchAdapter?.setOpacity(opacity);
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
    this.touchAdapter?.dispose();
    this.inputManager.dispose();
    this.canvasManager.unmount();
    this.events.clear();
    this.data.clear();
  }

  // ── Input mode management ────────────────────────────────

  private applyInputMode(mode: InputMode): void {
    // Remove all adapters first
    this.inputManager.removeAdapter('keyboard');
    this.inputManager.removeAdapter('gamepad');
    this.inputManager.removeAdapter('touch');
    this.touchAdapter?.dispose();
    this.touchAdapter = null;

    const enableTouch = mode === 'touch' || (mode === 'auto' && this._isMobile);
    const enableKeyboard = mode === 'keyboard' || mode === 'auto';
    const enableGamepad = mode === 'gamepad' || mode === 'auto';

    if (enableKeyboard) {
      this.inputManager.addAdapter(this.keyboardAdapter);
    }

    if (enableGamepad) {
      this.inputManager.addAdapter(this.gamepadAdapter);
    }

    if (enableTouch && this._viewportElement) {
      this.touchAdapter = new TouchAdapter(DEFAULT_TOUCH_LAYOUT);
      this.touchAdapter.attachTo(this._viewportElement);
      this.inputManager.addAdapter(this.touchAdapter);
    }

    this.events.emit('input:mode-changed', { mode, touchEnabled: enableTouch });
  }

  private detectMobile(): boolean {
    if (typeof window === 'undefined') return false;
    // Check for touch capability + small screen
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const smallScreen = window.innerWidth < 800;
    // Also check user agent for common mobile patterns
    const mobileUA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
    return hasTouch && (smallScreen || mobileUA);
  }
}
