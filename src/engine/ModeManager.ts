import type { EngineAPI, GameMode, ModeManagerAPI } from './interfaces';

/**
 * Manages game modes — a state machine where exactly one mode is active.
 * Handles enter/exit lifecycle, and delegates update/render to the active mode.
 */
export class ModeManager implements ModeManagerAPI {
  private modes = new Map<string, GameMode>();
  private activeMode: GameMode | null = null;
  private pendingModeId: string | null = null;
  private initialModeId: string | null = null;

  registerMode(mode: GameMode): void {
    if (this.modes.has(mode.id)) {
      console.warn(`ModeManager: overwriting mode '${mode.id}'`);
    }
    this.modes.set(mode.id, mode);
  }

  setInitialMode(modeId: string): void {
    this.initialModeId = modeId;
  }

  /** Queue a mode transition (applied at start of next update) */
  requestMode(modeId: string): void {
    this.pendingModeId = modeId;
  }

  /** Enter the initial mode. Call once after all modes are registered. */
  start(engine: EngineAPI): void {
    if (this.initialModeId) {
      this.transitionTo(this.initialModeId, engine);
    }
  }

  get currentModeId(): string | null {
    return this.activeMode?.id ?? null;
  }

  update(engine: EngineAPI, dt: number): void {
    if (this.pendingModeId) {
      this.transitionTo(this.pendingModeId, engine);
      this.pendingModeId = null;
    }
    this.activeMode?.update(engine, dt);
  }

  render(engine: EngineAPI, alpha: number): void {
    this.activeMode?.render(engine, alpha);
  }

  private transitionTo(modeId: string, engine: EngineAPI): void {
    const next = this.modes.get(modeId);
    if (!next) {
      console.error(`ModeManager: unknown mode '${modeId}'`);
      return;
    }

    if (this.activeMode) {
      this.activeMode.exit(engine);
    }
    this.activeMode = next;
    this.activeMode.enter(engine);
  }
}
