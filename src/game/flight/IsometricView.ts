/**
 * Isometric (top-down) view renderer for flight mode.
 * Projects world-space entity positions to isometric screen coordinates.
 * Terrain rendering delegated to TerrainRenderer (using synced iso camera).
 */

import type { Renderer } from '../../engine/render/Renderer';
import type { FlightState } from './FlightState';
import type { FlightView, ViewMode } from './FlightView';
import type { Position } from '../ecs/Components';
import {
  CELL_SIZE, Z_UNIT, ISO_ALT_PX, PLAYER_AHEAD,
  ENEMY_RENDER, MISSILE_COOLDOWN_TIME,
} from '../ecs/Components';
import { TERRAIN_TILE_H } from '../data/terrain';
import { TerrainRenderer } from '../isometric/TerrainRenderer';

// Player is always at this screen Y (derived from PLAYER_AHEAD)
const PLAYER_SCREEN_Y = 200; // 240 - (80/28) * 14
const JET_WIDTH = 16;
const JET_HEIGHT = 16;

/** Project a world position to isometric screen coordinates */
function toScreen(
  pos: Position,
  cameraWorldY: number,
  terrainOffsetX: number,
  screenHeight: number,
): { sx: number; sy: number } {
  const sx = pos.x + terrainOffsetX;
  const rowsAhead = (pos.y - cameraWorldY) / CELL_SIZE;
  const screenY = screenHeight - rowsAhead * TERRAIN_TILE_H;
  const altPx = (pos.z / Z_UNIT) * ISO_ALT_PX;
  return { sx, sy: screenY - altPx };
}

export class IsometricView implements FlightView {
  readonly mode: ViewMode = 'isometric';
  private terrainRenderer!: TerrainRenderer;

  activate(state: FlightState): void {
    this.terrainRenderer = new TerrainRenderer(
      state.rawTerrain, state.palette, state.screenWidth,
    );
  }

  render(r: Renderer, state: FlightState, alpha: number): void {
    r.clear(state.palette.background);
    this.terrainRenderer.render(r, state.isoCamera);
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
    const playerPos = state.world.pos.get(state.playerId);
    const altitude = playerPos ? playerPos.z / Z_UNIT : 0;

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
    r.fillRect(altBarX, barY, (altitude / 4) * altBarW, barH, '#88cc88');

    // Missile cooldown
    const mslReady = state.missileCD <= 0;
    const mslColor = mslReady ? '#ffaa22' : '#554422';
    r.drawText('MSL', 100, sh - 8, mslColor, 7);
    if (!mslReady) {
      const mslBarX = 118;
      const mslPct = 1 - state.missileCD / MISSILE_COOLDOWN_TIME;
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
    const progress = state.isoCamera.progress;
    r.drawText(`${Math.floor(progress * 100)}%`, sw - 30, sh - 8, '#888888', 8);

    // Boost screen effect
    if (state.boosting) {
      r.fillRect(0, 0, sw, 2, 'rgba(68,221,255,0.15)');
      r.fillRect(0, sh - 2, sw, 2, 'rgba(68,221,255,0.15)');
    }

    // Controls hint at start
    if (state.cameraWorldY < 5 * CELL_SIZE) {
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
    const pos = state.world.pos.get(state.playerId)!;

    // Interpolate
    const wx = state.prevPlayerX + (pos.x - state.prevPlayerX) * alpha;
    const wz = state.prevPlayerZ + (pos.z - state.prevPlayerZ) * alpha;

    const sx = wx + state.terrainOffsetX;
    const altPx = (wz / Z_UNIT) * ISO_ALT_PX;
    const jetY = PLAYER_SCREEN_Y - altPx;

    // Invincibility blink
    if (state.invincibleTimer > 0 && Math.floor(state.invincibleTimer * 10) % 2 === 0) {
      return;
    }

    // Shadow at ground level
    const altLevel = wz / Z_UNIT;
    const shadowAlpha = Math.max(0.1, 0.4 - altLevel * 0.08);
    const shadowScale = 1 + altLevel * 0.1;
    r.fillPoly([
      { x: sx, y: PLAYER_SCREEN_Y - 3 },
      { x: sx + JET_WIDTH / 2 * shadowScale, y: PLAYER_SCREEN_Y + 2 },
      { x: sx, y: PLAYER_SCREEN_Y + 5 },
      { x: sx - JET_WIDTH / 2 * shadowScale, y: PLAYER_SCREEN_Y + 2 },
    ], `rgba(0,0,0,${shadowAlpha})`);

    // Jet body
    r.fillPoly([
      { x: sx, y: jetY - JET_HEIGHT / 2 },
      { x: sx + JET_WIDTH / 2, y: jetY + 2 },
      { x: sx, y: jetY + JET_HEIGHT / 2 },
      { x: sx - JET_WIDTH / 2, y: jetY + 2 },
    ], state.palette.playerJet);

    // Cockpit
    r.fillPoly([
      { x: sx, y: jetY - 4 },
      { x: sx + 3, y: jetY + 1 },
      { x: sx, y: jetY + 4 },
      { x: sx - 3, y: jetY + 1 },
    ], state.palette.playerHighlight);

    // Engine glow
    const flicker = Math.sin(state.engineTime * 20) * 0.5 + 0.5;
    r.fillRect(sx - 2, jetY + JET_HEIGHT / 2 - 1, 4, 2 + flicker * 2, state.palette.playerEngine);

    // Altitude ticks
    for (let i = 0; i < Math.floor(altLevel); i++) {
      const wy = jetY + 1 - i;
      r.drawLine(sx - 6, wy, sx - 4, wy, '#ffffff', 1);
      r.drawLine(sx + 4, wy, sx + 6, wy, '#ffffff', 1);
    }
  }

  // ── Enemies ─────────────────────────────────────────────────

  private renderEnemies(r: Renderer, state: FlightState): void {
    const world = state.world;

    for (const [id, eai] of world.eai) {
      if (!eai.active) continue;
      const pos = world.pos.get(id);
      if (!pos) continue;

      const { sx, sy } = toScreen(pos, state.cameraWorldY, state.terrainOffsetX, state.screenHeight);
      if (sy < -20 || sy > state.screenHeight + 20) continue;

      const rend = ENEMY_RENDER[eai.eType];
      const s = rend.size;

      r.fillPoly([
        { x: sx, y: sy - s },
        { x: sx + s, y: sy },
        { x: sx, y: sy + s * 0.6 },
        { x: sx - s, y: sy },
      ], rend.color);

      r.fillPoly([
        { x: sx, y: sy - s * 0.5 },
        { x: sx + s * 0.4, y: sy },
        { x: sx, y: sy + s * 0.3 },
        { x: sx - s * 0.4, y: sy },
      ], '#ff8866');

      // Health pip
      const hp = world.hp.get(id);
      if (hp && hp.hp < hp.maxHp) {
        r.fillRect(sx - 4, sy - s - 4, 8, 2, '#440000');
        r.fillRect(sx - 4, sy - s - 4, 8 * (hp.hp / hp.maxHp), 2, '#ff4444');
      }
    }
  }

  // ── Projectiles ─────────────────────────────────────────────

  private renderProjectiles(r: Renderer, state: FlightState): void {
    const world = state.world;

    for (const [id, proj] of world.proj) {
      if (proj.life <= 0) continue;
      const pos = world.pos.get(id);
      if (!pos) continue;

      const { sx, sy } = toScreen(pos, state.cameraWorldY, state.terrainOffsetX, state.screenHeight);
      if (sy < -20 || sy > state.screenHeight + 20) continue;

      if (proj.pType === 'bullet') {
        r.fillRect(sx - 1, sy - 3, 2, 6, '#88eeff');
        r.fillRect(sx, sy - 2, 1, 4, '#ffffff');
      } else if (proj.pType === 'missile') {
        r.fillRect(sx - 1.5, sy - 2, 3, 5, '#ffaa22');
        r.fillRect(sx - 0.5, sy - 1, 1, 3, '#ffee88');
        r.fillRect(sx - 1, sy + 3, 2, 2, 'rgba(200,200,200,0.4)');
      } else {
        r.fillRect(sx - 1.5, sy - 1.5, 3, 3, '#ff6644');
        r.fillRect(sx - 0.5, sy - 0.5, 1, 1, '#ffcc88');
      }
    }
  }

  // ── Explosion ───────────────────────────────────────────────

  private renderExplosion(r: Renderer, state: FlightState): void {
    for (const p of state.explosionParticles) {
      const { sx, sy } = toScreen(
        { x: p.x, y: p.y, z: Math.max(0, p.z) },
        state.cameraWorldY,
        state.terrainOffsetX,
        state.screenHeight,
      );
      const size = Math.max(1, 3 * (p.life / 1.0));
      r.fillRect(sx - size / 2, sy - size / 2, size, size, p.color);
    }
  }
}
