/**
 * Title screen — press START to begin.
 *
 * Uses physical button names from the engine input system.
 */

import type { EngineAPI, GameMode } from '../../engine/interfaces';
import type { GameState } from '../GameState';

/** Physical buttons that trigger "start game" */
const START_BUTTONS = ['start', 'A'] as const;

export class TitleMode implements GameMode {
  readonly id = 'title';

  private gameState: GameState;
  private time = 0;
  private stars: { x: number; y: number; speed: number; brightness: number }[] = [];

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  enter(engine: EngineAPI): void {
    this.time = 0;
    this.gameState.reset();

    // Starfield
    this.stars = [];
    for (let i = 0; i < 50; i++) {
      this.stars.push({
        x: Math.random() * engine.config.width,
        y: Math.random() * engine.config.height,
        speed: 10 + Math.random() * 40,
        brightness: 100 + Math.random() * 155,
      });
    }
  }

  update(engine: EngineAPI, dt: number): void {
    this.time += dt;

    // Scroll stars
    for (const star of this.stars) {
      star.y += star.speed * dt;
      if (star.y > engine.config.height) {
        star.y = 0;
        star.x = Math.random() * engine.config.width;
      }
    }

    if (START_BUTTONS.some((b) => engine.input.isPressed(b))) {
      engine.setMode('isometric');
    }
  }

  render(engine: EngineAPI, _alpha: number): void {
    const r = engine.renderer;
    const w = engine.config.width;
    const h = engine.config.height;

    r.clear('#060612');

    // Stars
    for (const star of this.stars) {
      const b = Math.floor(star.brightness);
      r.fillRect(star.x, star.y, 1, 1, `rgb(${b},${b},${b})`);
    }

    // Title
    const pulse = Math.sin(this.time * 3) * 0.3 + 0.7;
    const titleY = 60 + Math.sin(this.time * 1.5) * 3;
    r.drawText('CAPTAIN', 72, titleY, '#88aaff', 16);
    r.drawText('SKYHAWK', 68, titleY + 22, '#ffcc44', 20);

    // Subtitle
    r.drawText('A SkyHak Engine Production', 42, 120, '#445566', 8);

    // Jet silhouette
    const jx = w / 2;
    const jy = 155;
    r.fillPoly([
      { x: jx, y: jy - 12 },
      { x: jx + 10, y: jy + 3 },
      { x: jx, y: jy + 10 },
      { x: jx - 10, y: jy + 3 },
    ], '#4466aa');
    r.fillPoly([
      { x: jx, y: jy - 6 },
      { x: jx + 4, y: jy + 1 },
      { x: jx, y: jy + 5 },
      { x: jx - 4, y: jy + 1 },
    ], '#6688cc');

    // Prompt
    if (Math.floor(this.time * 2) % 2 === 0) {
      r.drawText('PRESS START', 88, h - 50, `rgba(200,200,200,${pulse})`, 10);
    }

    // Credits
    r.drawText('INSPIRED BY RARE (1990)', 62, h - 20, '#333344', 8);
  }

  exit(_engine: EngineAPI): void {
    // nothing
  }
}
