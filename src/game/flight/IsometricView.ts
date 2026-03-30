/**
 * Isometric (top-down) view renderer for flight mode.
 * Extracted from IsometricMode — renders terrain, enemies, projectiles,
 * player jet, explosions, and HUD from the classic overhead perspective.
 */

import type { Renderer } from '../../engine/render/Renderer';
import type { FlightState, ExplosionParticle } from './FlightState';
import type { FlightView, ViewMode } from './FlightView';
import type { Projectile, Enemy } from '../entities/Entities';
import { ENEMY_DEFS, MISSILE_COOLDOWN, BOOST_FUEL_MAX } from '../entities/Entities';
import { TerrainRenderer } from '../isometric/TerrainRenderer';

const PLAYER_SCREEN_Y = 200;
const JET_WIDTH = 16;
const JET_HEIGHT = 16;

export class IsometricView implements FlightView {
  readonly mode: ViewMode = 'isometric';
  private terrainRenderer!: TerrainRenderer;

  activate(state: FlightState): void {
    this.terrainRenderer = new TerrainRenderer(
      state.terrain, state.palette, state.screenWidth,
    );
  }

  render(r: Renderer, state: FlightState, alpha: number): void {
    r.clear(state.palette.background);
    this.terrainRenderer.render(r, state.camera);
    this.renderEnemies(r, state);
    this.renderProjectiles(r, state);

    if (state.alive && !state.exploding) {
      this.renderPlayer(r, state, alpha);
    }
    if (state.exploding) {
      this.renderExplosion(r, state);
    }
  }

  renderHUD(r: Renderer, state: FlightState): void {
    const sw = state.screenWidth;
    const sh = state.screenHeight;

    // Top bar
    r.fillRect(0, 0, sw, 14, 'rgba(0,0,0,0.6)');
    r.drawText(`M${state.mission.id}: ${state.mission.name}`, 4, 10, '#88aacc', 8);
    r.drawText(`SCORE: ${state.gameState.score}`, 170, 10, '#cccccc', 8);

    // Bottom bar
    r.fillRect(0, sh - 18, sw, 18, 'rgba(0,0,0,0.6)');
    r.drawText(`LIVES: ${state.gameState.lives}`, 4, sh - 8, '#cccccc', 8);

    // Altitude bar
    const altBarX = 62;
    const altBarW = 30;
    const barH = 5;
    const barY = sh - 12;
    r.drawText('ALT', 47, sh - 8, '#88cc88', 7);
    r.strokeRect(altBarX, barY, altBarW, barH, '#446644', 1);
    r.fillRect(altBarX, barY, (state.playerAltitude / 4) * altBarW, barH, '#88cc88');

    // Missile cooldown
    const mslReady = state.missileCooldown <= 0;
    const mslColor = mslReady ? '#ffaa22' : '#554422';
    r.drawText('MSL', 100, sh - 8, mslColor, 7);
    if (!mslReady) {
      const mslBarX = 118;
      const mslPct = 1 - state.missileCooldown / MISSILE_COOLDOWN;
      r.strokeRect(mslBarX, barY, altBarW, barH, '#443322', 1);
      r.fillRect(mslBarX, barY, mslPct * altBarW, barH, '#886633');
    } else {
      r.drawText('RDY', 118, sh - 8, '#ffaa22', 7);
    }

    // Boost fuel gauge
    const boostColor = state.boosting ? '#44ddff' : '#447788';
    r.drawText('BST', 155, sh - 8, boostColor, 7);
    const bstBarX = 173;
    const bstBarW = 30;
    r.strokeRect(bstBarX, barY, bstBarW, barH, '#334455', 1);
    r.fillRect(bstBarX, barY, state.boostFuel * bstBarW, barH, state.boosting ? '#44ddff' : '#447788');

    // Progress
    r.drawText(`${Math.floor(state.camera.progress * 100)}%`, sw - 30, sh - 8, '#888888', 8);

    // Boost screen effect
    if (state.boosting) {
      r.fillRect(0, 0, sw, 2, 'rgba(68,221,255,0.15)');
      r.fillRect(0, sh - 2, sw, 2, 'rgba(68,221,255,0.15)');
    }

    // Controls hint
    if (state.camera.scrollY < 5) {
      r.drawText('A:Fire  B:Missile  C:Boost  SEL:View', 8, sh - 26, '#556677', 8);
    }

    // Level complete overlay
    if (state.levelComplete) {
      r.fillRect(0, 90, sw, 60, 'rgba(0,0,0,0.7)');
      r.drawText('MISSION COMPLETE', 65, 118, '#ffcc00', 12);
      r.drawText(`SCORE: ${state.gameState.score}`, 90, 135, '#cccccc', 8);
    }
  }

  // ── Player ──────────────────────────────────────────────────

  private renderPlayer(r: Renderer, state: FlightState, alpha: number): void {
    const px = state.prevPlayerX + (state.playerX - state.prevPlayerX) * alpha;
    const alt = state.prevAltitude + (state.playerAltitude - state.prevAltitude) * alpha;
    const altOffset = alt * 3;
    const jetY = PLAYER_SCREEN_Y - altOffset;

    // Invincibility blink
    if (state.invincibleTimer > 0 && Math.floor(state.invincibleTimer * 10) % 2 === 0) {
      return;
    }

    // Shadow
    const shadowAlpha = Math.max(0.1, 0.4 - alt * 0.08);
    const shadowScale = 1 + alt * 0.1;
    r.fillPoly([
      { x: px, y: PLAYER_SCREEN_Y - 3 },
      { x: px + JET_WIDTH / 2 * shadowScale, y: PLAYER_SCREEN_Y + 2 },
      { x: px, y: PLAYER_SCREEN_Y + 5 },
      { x: px - JET_WIDTH / 2 * shadowScale, y: PLAYER_SCREEN_Y + 2 },
    ], `rgba(0,0,0,${shadowAlpha})`);

    // Jet body
    r.fillPoly([
      { x: px, y: jetY - JET_HEIGHT / 2 },
      { x: px + JET_WIDTH / 2, y: jetY + 2 },
      { x: px, y: jetY + JET_HEIGHT / 2 },
      { x: px - JET_WIDTH / 2, y: jetY + 2 },
    ], state.palette.playerJet);

    // Cockpit
    r.fillPoly([
      { x: px, y: jetY - 4 },
      { x: px + 3, y: jetY + 1 },
      { x: px, y: jetY + 4 },
      { x: px - 3, y: jetY + 1 },
    ], state.palette.playerHighlight);

    // Engine glow
    const flicker = Math.sin(state.engineTime * 20) * 0.5 + 0.5;
    r.fillRect(px - 2, jetY + JET_HEIGHT / 2 - 1, 4, 2 + flicker * 2, state.palette.playerEngine);

    // Altitude tick marks
    for (let i = 0; i < Math.floor(alt); i++) {
      const wy = jetY + 1 - i;
      r.drawLine(px - 6, wy, px - 4, wy, '#ffffff', 1);
      r.drawLine(px + 4, wy, px + 6, wy, '#ffffff', 1);
    }
  }

  // ── Enemies ─────────────────────────────────────────────────

  private renderEnemies(r: Renderer, state: FlightState): void {
    for (const enemy of state.enemies) {
      if (enemy.dead || !enemy.active) continue;

      const def = ENEMY_DEFS[enemy.type];
      const screenY = state.camera.rowToScreenY(enemy.row);
      if (screenY < -20 || screenY > state.screenHeight + 20) continue;

      const s = def.size;
      const altOff = enemy.altitude * 3;
      const ey = screenY - altOff;

      r.fillPoly([
        { x: enemy.x, y: ey - s },
        { x: enemy.x + s, y: ey },
        { x: enemy.x, y: ey + s * 0.6 },
        { x: enemy.x - s, y: ey },
      ], def.color);

      r.fillPoly([
        { x: enemy.x, y: ey - s * 0.5 },
        { x: enemy.x + s * 0.4, y: ey },
        { x: enemy.x, y: ey + s * 0.3 },
        { x: enemy.x - s * 0.4, y: ey },
      ], '#ff8866');

      // Health pip
      if (enemy.health < ENEMY_DEFS[enemy.type].health) {
        r.fillRect(enemy.x - 4, ey - s - 4, 8, 2, '#440000');
        const hpPct = enemy.health / ENEMY_DEFS[enemy.type].health;
        r.fillRect(enemy.x - 4, ey - s - 4, 8 * hpPct, 2, '#ff4444');
      }
    }
  }

  // ── Projectiles ─────────────────────────────────────────────

  private renderProjectiles(r: Renderer, state: FlightState): void {
    for (const p of state.projectiles) {
      if (p.type === 'bullet') {
        r.fillRect(p.x - 1, p.y - 3, 2, 6, '#88eeff');
        r.fillRect(p.x, p.y - 2, 1, 4, '#ffffff');
      } else if (p.type === 'missile') {
        r.fillRect(p.x - 1.5, p.y - 2, 3, 5, '#ffaa22');
        r.fillRect(p.x - 0.5, p.y - 1, 1, 3, '#ffee88');
        r.fillRect(p.x - 1, p.y + 3, 2, 2, 'rgba(200,200,200,0.4)');
      } else {
        r.fillRect(p.x - 1.5, p.y - 1.5, 3, 3, '#ff6644');
        r.fillRect(p.x - 0.5, p.y - 0.5, 1, 1, '#ffcc88');
      }
    }
  }

  // ── Explosion ───────────────────────────────────────────────

  private renderExplosion(r: Renderer, state: FlightState): void {
    for (const p of state.explosionParticles) {
      const size = Math.max(1, 3 * (p.life / 1.0));
      r.fillRect(p.x - size / 2, p.y - size / 2, size, size, p.color);
    }
  }
}
