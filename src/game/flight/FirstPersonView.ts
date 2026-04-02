/**
 * First-person cockpit view renderer for flight mode.
 *
 * Pseudo-3D rendering using layered distance scaling.
 * Now reads entity world positions directly (no screen-space conversion).
 */

import type { Renderer } from '../../engine/render/Renderer';
import type { FlightState } from './FlightState';
import type { FlightView, ViewMode } from './FlightView';
import {
  CELL_SIZE, Z_UNIT, TERRAIN_WORLD_W, ENEMY_RENDER,
  MISSILE_COOLDOWN_TIME,
} from '../ecs/Components';
import { TERRAIN_COLS } from '../data/terrain';

// FPV constants
const MAX_DRAW_DIST = 25;
const COCKPIT_HEIGHT = 28;
const WALL_SCALE = 22;
const BASE_HORIZON = 72;
const ALTITUDE_SHIFT = 12;

export class FirstPersonView implements FlightView {
  readonly mode: ViewMode = 'firstperson';

  activate(_state: FlightState): void {
    // No special setup
  }

  render(r: Renderer, state: FlightState, _alpha: number): void {
    const sw = state.screenWidth;
    const sh = state.screenHeight;
    const playerPos = state.world.pos.get(state.playerId);
    if (!playerPos) return;

    const altitude = playerPos.z / Z_UNIT;
    const groundBottom = sh - COCKPIT_HEIGHT;
    const horizonY = BASE_HORIZON - (altitude - 2) * ALTITUDE_SHIFT;
    const groundH = groundBottom - horizonY;
    const centerX = sw / 2;

    this.renderSky(r, state, sw, horizonY);
    this.renderTerrain(r, state, sw, horizonY, groundH, groundBottom, centerX, playerPos.x);
    this.renderEnemies(r, state, horizonY, groundH, centerX, playerPos.x);
    this.renderProjectiles(r, state, horizonY, groundH, centerX, playerPos.x);

    if (state.exploding) {
      this.renderExplosion(r, state, sw, sh);
    }

    if (state.alive && !state.exploding) {
      this.renderReticle(r, horizonY, groundH, centerX);
    }

    this.renderCockpit(r, state, sw, sh, altitude);

    // Boost speed lines
    if (state.boosting) {
      const t = state.engineTime * 8;
      for (let i = 0; i < 6; i++) {
        const ly = (t * 40 + i * 45) % sh;
        r.drawLine(0, ly, 12, ly + 8, 'rgba(68,221,255,0.2)', 1);
        r.drawLine(sw, ly, sw - 12, ly + 8, 'rgba(68,221,255,0.2)', 1);
      }
    }
  }

  renderHUD(r: Renderer, state: FlightState): void {
    const sw = state.screenWidth;

    r.fillRect(0, 0, sw, 14, 'rgba(0,0,0,0.6)');
    r.drawText(`M${state.mission.id}: ${state.mission.name}`, 4, 10, '#88aacc', 8);
    r.drawText(`SCORE: ${state.gameState.score}`, 170, 10, '#cccccc', 8);

    if (state.levelComplete) {
      r.fillRect(0, 90, sw, 60, 'rgba(0,0,0,0.7)');
      r.drawText('MISSION COMPLETE', 65, 118, '#ffcc00', 12);
      r.drawText(`SCORE: ${state.gameState.score}`, 90, 135, '#cccccc', 8);
    }
  }

  // ── Sky ─────────────────────────────────────────────────────

  private renderSky(r: Renderer, state: FlightState, sw: number, horizonY: number): void {
    r.clear(state.palette.background);
    const bands = 8;
    const bandH = Math.max(1, horizonY / bands);
    for (let i = 0; i < bands; i++) {
      const t = i / bands;
      const b = Math.floor(8 + t * 18);
      r.fillRect(0, i * bandH, sw, bandH + 1, `rgb(${b},${b},${b + 15})`);
    }
    if (horizonY > 0 && horizonY < state.screenHeight) {
      r.fillRect(0, horizonY - 1, sw, 2, 'rgba(80,90,120,0.3)');
    }
  }

  // ── Terrain ─────────────────────────────────────────────────

  private renderTerrain(
    r: Renderer, state: FlightState,
    sw: number, horizonY: number, groundH: number, groundBottom: number,
    centerX: number, playerWorldX: number,
  ): void {
    const terrain = state.rawTerrain;
    const cameraRow = state.cameraWorldY / CELL_SIZE;
    const baseRow = Math.floor(cameraRow);
    const frac = cameraRow - baseRow;
    const palette = state.palette;

    for (let ahead = MAX_DRAW_DIST; ahead >= 1; ahead--) {
      const rowIdx = baseRow + ahead;
      if (rowIdx < 0 || rowIdx >= terrain.rows.length) continue;
      const row = terrain.rows[rowIdx];

      const dist = ahead - frac;
      if (dist < 0.5) continue;

      const nextDist = dist + 1;
      const stripTop = Math.max(horizonY, horizonY + groundH / nextDist);
      const stripBot = Math.min(groundBottom, horizonY + groundH / dist);
      const stripH = stripBot - stripTop;
      if (stripH < 0.5) continue;

      for (let col = 0; col < TERRAIN_COLS; col++) {
        const height = row[col] ?? 0;
        // Column center in world X
        const colWorldX = col * CELL_SIZE + CELL_SIZE / 2;
        const relX = colWorldX - playerWorldX;
        const sx = centerX + relX / dist;
        const colW = CELL_SIZE / dist;

        if (sx + colW / 2 < 0 || sx - colW / 2 > sw) continue;

        const checker = (col + rowIdx) % 2 === 0;
        let groundColor: string;
        if (height < 0) {
          groundColor = checker ? palette.water : palette.waterAlt;
        } else {
          groundColor = checker ? palette.groundFlat : palette.groundAlt;
        }

        r.fillRect(sx - colW / 2, stripTop, colW + 1, stripH + 1, groundColor);

        if (height > 0) {
          const h = Math.min(height, 4);
          const wallH = h * WALL_SCALE / dist;
          const wallTop = stripTop - wallH;
          const ci = h - 1;
          const frontColor = palette.mountainTop[ci] ?? palette.mountainTop[0];
          const topColor = palette.mountainLeft[ci] ?? palette.mountainLeft[0];

          r.fillRect(sx - colW / 2, Math.max(0, wallTop), colW + 1, stripTop - Math.max(0, wallTop), frontColor);
          if (wallTop > 0) {
            r.fillRect(sx - colW / 2, wallTop, colW + 1, Math.min(2, wallH), topColor);
          }
        }
      }
    }
  }

  // ── Enemies ─────────────────────────────────────────────────

  private renderEnemies(
    r: Renderer, state: FlightState,
    horizonY: number, groundH: number, centerX: number, playerWorldX: number,
  ): void {
    const world = state.world;
    const cameraWorldY = state.cameraWorldY;

    // Collect and sort by distance (far first)
    const visible: Array<{ id: number; dist: number }> = [];
    for (const [id, eai] of world.eai) {
      if (!eai.active) continue;
      const pos = world.pos.get(id);
      if (!pos) continue;
      const dist = (pos.y - cameraWorldY) / CELL_SIZE;
      if (dist > 0.5 && dist <= MAX_DRAW_DIST) {
        visible.push({ id, dist });
      }
    }
    visible.sort((a, b) => b.dist - a.dist);

    for (const { id, dist } of visible) {
      const pos = world.pos.get(id)!;
      const eai = world.eai.get(id)!;
      const rend = ENEMY_RENDER[eai.eType];

      const screenY = horizonY + groundH / dist;
      const relX = pos.x - playerWorldX;
      const screenX = centerX + relX / dist;
      const scale = 1 / dist;
      const size = rend.size * 3 * scale;
      if (size < 1) continue;

      const altOff = (pos.z / Z_UNIT) * WALL_SCALE * scale;
      const ey = screenY - altOff;

      r.fillPoly([
        { x: screenX, y: ey - size },
        { x: screenX + size * 0.8, y: ey },
        { x: screenX, y: ey + size * 0.4 },
        { x: screenX - size * 0.8, y: ey },
      ], rend.color);

      if (size > 3) {
        r.fillPoly([
          { x: screenX, y: ey - size * 0.5 },
          { x: screenX + size * 0.3, y: ey },
          { x: screenX, y: ey + size * 0.2 },
          { x: screenX - size * 0.3, y: ey },
        ], '#ff8866');
      }

      const hp = world.hp.get(id);
      if (hp && hp.hp < hp.maxHp && size > 2) {
        const barW = size * 1.5;
        r.fillRect(screenX - barW / 2, ey - size - 3, barW, 2, '#440000');
        r.fillRect(screenX - barW / 2, ey - size - 3, barW * (hp.hp / hp.maxHp), 2, '#ff4444');
      }
    }
  }

  // ── Projectiles ─────────────────────────────────────────────

  private renderProjectiles(
    r: Renderer, state: FlightState,
    horizonY: number, groundH: number, centerX: number, playerWorldX: number,
  ): void {
    const world = state.world;
    const cameraWorldY = state.cameraWorldY;

    for (const [id, proj] of world.proj) {
      if (proj.life <= 0) continue;
      const pos = world.pos.get(id);
      if (!pos) continue;

      // Distance in row-units from camera
      const dist = (pos.y - cameraWorldY) / CELL_SIZE;
      if (dist <= 0.3 || dist > MAX_DRAW_DIST) continue;

      const screenY = horizonY + groundH / dist;
      const relX = pos.x - playerWorldX;
      const screenX = centerX + relX / dist;
      const scale = 1 / dist;

      if (proj.pType === 'bullet') {
        const s = Math.max(1, 3 * scale);
        r.fillRect(screenX - s / 2, screenY - s, s, s * 2, '#88eeff');
        r.fillRect(screenX - 0.5, screenY - s * 0.5, 1, s, '#ffffff');
      } else if (proj.pType === 'missile') {
        const s = Math.max(1.5, 4 * scale);
        r.fillRect(screenX - s / 2, screenY - s, s, s * 1.5, '#ffaa22');
        r.fillRect(screenX - s * 0.3, screenY - s * 0.5, s * 0.6, s, '#ffee88');
      } else {
        const s = Math.max(2, 5 * scale);
        r.fillRect(screenX - s / 2, screenY - s / 2, s, s, '#ff6644');
        r.fillRect(screenX - s * 0.3, screenY - s * 0.3, s * 0.6, s * 0.6, '#ffcc88');
      }
    }
  }

  // ── Explosion ───────────────────────────────────────────────

  private renderExplosion(r: Renderer, state: FlightState, sw: number, sh: number): void {
    const shakeAmt = Math.max(0, 1 - state.explosionTimer / 1.0) * 4;
    if (shakeAmt > 0.5) {
      r.save();
      r.translate((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt);
    }

    const flashAlpha = Math.max(0, 0.4 - state.explosionTimer * 0.4);
    if (flashAlpha > 0) {
      r.fillRect(0, 0, sw, sh, `rgba(255,60,20,${flashAlpha})`);
    }

    // Particles as forward-facing effects
    const cameraWorldY = state.cameraWorldY;
    for (const p of state.explosionParticles) {
      const dist = (p.y - cameraWorldY) / CELL_SIZE;
      if (dist <= 0.2 || dist > MAX_DRAW_DIST) continue;
      const size = Math.max(1, 4 * (p.life / 1.0) / dist);
      const px = sw / 2 + (p.x - (state.world.pos.get(state.playerId)?.x ?? sw / 2)) / dist;
      const py = BASE_HORIZON + 60 / dist;
      r.fillRect(px - size / 2, py - size / 2, size, size, p.color);
    }

    if (shakeAmt > 0.5) {
      r.restore();
    }
  }

  // ── Reticle ─────────────────────────────────────────────────

  private renderReticle(r: Renderer, horizonY: number, groundH: number, centerX: number): void {
    const reticleY = horizonY + groundH / 8;
    const color = 'rgba(136,255,170,0.35)';
    const bright = 'rgba(136,255,170,0.6)';

    r.drawLine(centerX - 10, reticleY, centerX - 4, reticleY, color, 1);
    r.drawLine(centerX + 4, reticleY, centerX + 10, reticleY, color, 1);
    r.drawLine(centerX, reticleY - 10, centerX, reticleY - 4, color, 1);
    r.drawLine(centerX, reticleY + 4, centerX, reticleY + 10, color, 1);
    r.fillRect(centerX - 0.5, reticleY - 0.5, 1, 1, bright);
  }

  // ── Cockpit panel ───────────────────────────────────────────

  private renderCockpit(r: Renderer, state: FlightState, sw: number, sh: number, altitude: number): void {
    const panelTop = sh - COCKPIT_HEIGHT;

    r.fillRect(0, panelTop, sw, COCKPIT_HEIGHT, '#0a0e14');
    r.drawLine(0, panelTop, sw, panelTop, '#2a3444', 1);
    r.drawLine(0, panelTop + 1, sw, panelTop + 1, '#1a2434', 1);

    // Canopy frame
    r.drawLine(0, panelTop, 20, 0, 'rgba(40,50,70,0.3)', 1);
    r.drawLine(sw, panelTop, sw - 20, 0, 'rgba(40,50,70,0.3)', 1);

    const ly = panelTop + 10;

    // Left: lives + alt
    r.drawText(`LIVES:${state.gameState.lives}`, 4, ly, '#889999', 7);
    r.drawText('ALT', 4, ly + 12, '#88cc88', 7);
    r.strokeRect(22, ly + 6, 28, 4, '#446644', 1);
    r.fillRect(22, ly + 6, (altitude / 4) * 28, 4, '#88cc88');

    // Center: progress
    const progress = Math.floor(state.isoCamera.progress * 100);
    r.drawText(`${progress}%`, sw / 2 - 8, ly, '#888888', 8);
    const speedLabel = state.boosting ? 'BOOST' : 'FWD';
    r.drawText(speedLabel, sw / 2 - 12, ly + 12, state.boosting ? '#44ddff' : '#667788', 7);

    // Right: weapons
    const rx = sw - 55;
    const mslReady = state.missileCD <= 0;
    r.drawText('MSL', rx, ly, mslReady ? '#ffaa22' : '#554422', 7);
    if (mslReady) {
      r.drawText('RDY', rx + 20, ly, '#ffaa22', 7);
    } else {
      const pct = 1 - state.missileCD / MISSILE_COOLDOWN_TIME;
      r.strokeRect(rx + 20, ly - 5, 28, 4, '#443322', 1);
      r.fillRect(rx + 20, ly - 5, pct * 28, 4, '#886633');
    }
    r.drawText('BST', rx, ly + 12, state.boosting ? '#44ddff' : '#447788', 7);
    r.strokeRect(rx + 20, ly + 7, 28, 4, '#334455', 1);
    r.fillRect(rx + 20, ly + 7, state.boostFuel * 28, 4, state.boosting ? '#44ddff' : '#447788');
  }
}
