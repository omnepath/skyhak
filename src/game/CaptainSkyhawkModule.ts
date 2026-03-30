/**
 * Captain Skyhawk game module.
 *
 * Registers all game modes, data, and assets with the engine.
 * This is THE game — the engine is the platform.
 *
 * Button → Game Action mapping (module-owned):
 *   A       → fire (primary weapon)
 *   B       → missile spread
 *   C       → boost
 *   X, Y    → (reserved for future weapons/abilities)
 *   L, R    → (reserved for future shoulder actions)
 *   dpad*   → movement + altitude
 *   start   → start / pause
 *   select  → (reserved)
 */

import type { EngineAPI, GameModule, ModeManagerAPI } from '../engine/interfaces';
import { GameState } from './GameState';
import { TitleMode } from './modes/TitleMode';
import { IsometricMode } from './modes/IsometricMode';
import { GameOverMode } from './modes/GameOverMode';

export class CaptainSkyhawkModule implements GameModule {
  readonly id = 'captain-skyhawk';
  readonly name = 'Captain Skyhawk';

  private gameState = new GameState();

  register(engine: EngineAPI, modeManager: ModeManagerAPI): void {
    modeManager.registerMode(new TitleMode(this.gameState));
    modeManager.registerMode(new IsometricMode(this.gameState));
    modeManager.registerMode(new GameOverMode(this.gameState));

    // Future modes (Phase 5-6):
    // modeManager.registerMode(new DogfightMode(this.gameState));
    // modeManager.registerMode(new DockingMode(this.gameState));
    // modeManager.registerMode(new ShopMode(this.gameState));
    // modeManager.registerMode(new BossMode(this.gameState));

    modeManager.setInitialMode('title');

    // Module can customize input mappings if needed.
    // Engine defaults are fine for now — override example:
    // engine.configureInput({
    //   keyboard: { 'KeyF': ['A'] },   // F key also fires
    //   touch: { opacity: 0.4 },
    // });
  }

  init(_engine: EngineAPI): void {
    // Future: register data with engine.data registry
    // engine.data.set('skyhawk:missions', MISSIONS);
    // engine.data.set('skyhawk:weapons', WEAPONS);
  }

  dispose(): void {
    // cleanup
  }
}
