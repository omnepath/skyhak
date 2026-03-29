/**
 * Game Over screen — shown when all lives and continues are exhausted.
 */

import type { EngineAPI, GameMode } from '../../engine/interfaces';
import type { GameState } from '../GameState';

export class GameOverMode implements GameMode {
  readonly id = 'gameover';

  private gameState: GameState;
  private time = 0;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  enter(_engine: EngineAPI): void {
    this.time = 0;
  }

  update(engine: EngineAPI, dt: number): void {
    this.time += dt;

    // Return to title after input or timeout
    const anyStart = engine.input.isPressed('confirm') || engine.input.isPressed('fire') || engine.input.isPressed('pause');
    if (this.time > 2.0 && anyStart) {
      engine.setMode('title');
    }
    if (this.time > 10.0) {
      engine.setMode('title');
    }
  }

  render(engine: EngineAPI, _alpha: number): void {
    const r = engine.renderer;
    const w = engine.config.width;
    const h = engine.config.height;

    r.clear('#0a0008');

    // Fade in
    const fadeAlpha = Math.min(1, this.time / 1.5);

    r.drawText('GAME OVER', 75, h / 2 - 10, `rgba(255,50,50,${fadeAlpha})`, 16);
    r.drawText(`FINAL SCORE: ${this.gameState.score}`, 70, h / 2 + 20, `rgba(200,200,200,${fadeAlpha})`, 10);
    r.drawText(`MISSION: ${this.gameState.currentMission + 1}`, 90, h / 2 + 40, `rgba(150,150,150,${fadeAlpha})`, 8);

    if (this.time > 2.0 && Math.floor(this.time * 2) % 2 === 0) {
      r.drawText('PRESS START', 85, h - 40, '#666666', 8);
    }
  }

  exit(_engine: EngineAPI): void {
    // nothing
  }
}
