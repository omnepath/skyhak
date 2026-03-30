import type { EngineAPI, GameMode, GameModule, ModeManagerAPI } from '../engine/interfaces';
import { clamp } from '../engine/math/MathUtils';

/**
 * Demo module — proves the engine pipeline works.
 *
 * Renders a colored rectangle (the "jet") that responds to arrow key input
 * over a scrolling starfield background. This will be replaced by
 * CaptainSkyhawkModule once the engine is verified.
 */
class DemoMode implements GameMode {
  readonly id = 'demo';

  private jetX = 128;
  private jetY = 180;
  private prevJetX = 128;
  private prevJetY = 180;
  private jetSpeed = 80; // pixels per second
  private stars: { x: number; y: number; speed: number; brightness: string }[] = [];
  private scrollY = 0;

  enter(_engine: EngineAPI): void {
    this.jetX = 128;
    this.jetY = 180;
    this.prevJetX = this.jetX;
    this.prevJetY = this.jetY;

    // Generate starfield
    this.stars = [];
    for (let i = 0; i < 40; i++) {
      this.stars.push({
        x: Math.random() * 256,
        y: Math.random() * 240,
        speed: 20 + Math.random() * 60,
        brightness: `rgb(${100 + Math.random() * 155}, ${100 + Math.random() * 155}, ${100 + Math.random() * 155})`,
      });
    }
  }

  update(engine: EngineAPI, dt: number): void {
    const input = engine.input;
    this.prevJetX = this.jetX;
    this.prevJetY = this.jetY;

    let dx = 0;
    let dy = 0;
    if (input.isHeld('dpadLeft')) dx -= 1;
    if (input.isHeld('dpadRight')) dx += 1;
    if (input.isHeld('dpadUp')) dy -= 1;
    if (input.isHeld('dpadDown')) dy += 1;

    this.jetX += dx * this.jetSpeed * dt;
    this.jetY += dy * this.jetSpeed * dt;

    // Clamp to screen bounds
    this.jetX = clamp(this.jetX, 4, 256 - 20);
    this.jetY = clamp(this.jetY, 4, 240 - 20);

    // Scroll stars
    this.scrollY += 40 * dt;
    for (const star of this.stars) {
      star.y += star.speed * dt;
      if (star.y > 240) {
        star.y -= 240;
        star.x = Math.random() * 256;
      }
    }
  }

  render(engine: EngineAPI, alpha: number): void {
    const r = engine.renderer;

    // Background
    r.clear('#0a0a1a');

    // Stars
    for (const star of this.stars) {
      r.fillRect(star.x, star.y, 1, 1, star.brightness);
    }

    // Interpolate jet position for smooth rendering
    const jx = this.prevJetX + (this.jetX - this.prevJetX) * alpha;
    const jy = this.prevJetY + (this.jetY - this.prevJetY) * alpha;

    // Jet body (isometric-ish diamond shape)
    r.fillPoly([
      { x: jx + 8, y: jy },        // nose
      { x: jx + 16, y: jy + 10 },   // right wing
      { x: jx + 8, y: jy + 16 },    // tail
      { x: jx, y: jy + 10 },        // left wing
    ], '#4488ff');

    // Jet highlight
    r.fillPoly([
      { x: jx + 8, y: jy + 2 },
      { x: jx + 12, y: jy + 8 },
      { x: jx + 8, y: jy + 12 },
      { x: jx + 4, y: jy + 8 },
    ], '#66aaff');

    // Engine glow
    const flicker = Math.sin(engine.getTime() * 20) * 0.3 + 0.7;
    const glowAlpha = Math.floor(flicker * 255).toString(16).padStart(2, '0');
    r.fillRect(jx + 6, jy + 14, 4, 3, `#ff6622${glowAlpha}`);

    // HUD text
    r.drawText('SKYHAK ENGINE v0.1', 4, 12, '#446688', 8);
    r.drawText(`POS: ${Math.floor(this.jetX)}, ${Math.floor(this.jetY)}`, 4, 232, '#335566', 8);
    r.drawText('ARROWS / WASD TO MOVE', 70, 232, '#335566', 8);
  }

  exit(_engine: EngineAPI): void {
    // cleanup
  }
}

export class DemoModule implements GameModule {
  readonly id = 'demo';
  readonly name = 'Engine Demo';

  register(_engine: EngineAPI, modeManager: ModeManagerAPI): void {
    modeManager.registerMode(new DemoMode());
    modeManager.setInitialMode('demo');
  }

  init(_engine: EngineAPI): void {
    // nothing to init
  }

  dispose(): void {
    // nothing to dispose
  }
}
