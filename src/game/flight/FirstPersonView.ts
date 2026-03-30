/**
 * First-person cockpit view renderer for flight mode.
 *
 * Pseudo-3D rendering using layered distance scaling:
 * - Terrain rows are drawn as horizontal strips, near rows larger/lower
 * - Mountains are vertical blocks that scale with proximity
 * - Enemies and projectiles scale based on their distance from the player
 * - Horizon line shifts with player altitude
 * - Minimalist cockpit panel at screen bottom
 */

import type { Renderer } from '../../engine/render/Renderer';
import type { FlightState } from './FlightState';
import type { FlightView, ViewMode } from './FlightView';
import { ENEMY_DEFS, MISSILE_COOLDOWN } from '../entities/Entities';
import { TERRAIN_TILE_W, TERRAIN_COLS } from '../data/terrain';

// FPV constants
const MAX_DRAW_DIST = 25;
const COCKPIT_HEIGHT = 28;
const WALL_SCALE = 22;
const BASE_HORIZON = 72;
const ALTITUDE_SHIFT = 12;

export class FirstPersonView implements FlightView {
  readonly mode: ViewMode = 'firstperson';

  activate(_state: FlightState): void {
    // No special setup needed
  }

  render(r: Renderer, state: FlightState, _alpha: number): void {
    const sw = state.screenWidth;
    const sh = state.screenHeight;
    const groundBottom = sh - COCKPIT_HEIGHT;
    const horizonY = BASE_HORIZON - (state.playerAltitude - 2) * ALTITUDE_SHIFT;
    const groundH = groundBottom - horizonY;
    const centerX = sw / 2;

    // Sky
    this.renderSky(r, state, sw, horizonY);

    // Terrain (back-to-front)
    this.renderTerrain(r, state, sw, horizonY, groundH, groundBottom, centerX);

    // Enemies
    this.renderEnemies(r, state, horizonY, groundH, centerX);

    // Projectiles
    this.renderProjectiles(r, state, horizonY, groundH, centerX);

    // Explosion effect
    if (state.exploding) {
      this.renderExplosion(r, state, sw, sh);
    }

    // Targeting reticle
    if (state.alive && !state.exploding) {
      this.renderReticle(r, horizonY, groundH, centerX);
    }

    // Cockpit panel
    this.renderCockpit(r, state, sw, sh);

    // Boost screen effect
    if (state.boosting) {
      // Speed lines at edges
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

    // Top bar (shared with iso view)
    r.fillRect(0, 0, sw, 14, 'rgba(0,0,0,0.6)');
    r.drawText(`M${state.mission.id}: ${state.mission.name}`, 4, 10, '#88aacc', 8);
    r.drawText(`SCORE: ${state.gameState.score}`, 170, 10, '#cccccc', 8);

    // Level complete overlay
    if (state.levelComplete) {
      const sh = state.screenHeight;
      r.fillRect(0, 90, sw, 60, 'rgba(0,0,0,0.7)');
      r.drawText('MISSION COMPLETE', 65, 118, '#ffcc00', 12);
      r.drawText(`SCORE: ${state.gameState.score}`, 90, 135, '#cccccc', 8);
    }
  }

  // ── Sky ─────────────────────────────────────────────────────

  private renderSky(r: Renderer, state: FlightState, sw: number, horizonY: number): void {
    // Background fills entire screen first
    r.clear(state.palette.background);

    // Gradient sky bands above horizon
    const bands = 8;
    const bandH = Math.max(1, horizonY / bands);
    for (let i = 0; i < bands; i++) {
      const t = i / bands;
      const brightness = Math.floor(8 + t * 18);
      const y = i * bandH;
      r.fillRect(0, y, sw, bandH + 1, `rgb(${brightness},${brightness},${brightness + 15})`);
    }

    // Horizon glow line
    if (horizonY > 0 && horizonY < state.screenHeight) {
      r.fillRect(0, horizonY - 1, sw, 2, 'rgba(80,90,120,0.3)');
    }
  }

  // ── Terrain ─────────────────────────────────────────────────

  private renderTerrain(
    r: Renderer, state: FlightState,
    sw: number, horizonY: number, groundH: number, groundBottom: number, centerX: number,
  ): void {
    const terrain = state.terrain;
    const scrollY = state.camera.scrollY;
    const baseRow = Math.floor(scrollY);
    const frac = scrollY - baseRow;
    const playerX = state.playerX;
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
        const colWorldX = state.terrainOffsetX + col * TERRAIN_TILE_W + TERRAIN_TILE_W / 2;
        const relX = colWorldX - playerX;
        const sx = centerX + relX / dist;
        const colW = TERRAIN_TILE_W / dist;

        // Cull off-screen columns
        if (sx + colW / 2 < 0 || sx - colW / 2 > sw) continue;

        // Ground tile color
        const checker = (col + rowIdx) % 2 === 0;
        let groundColor: string;
        if (height < 0) {
          groundColor = checker ? palette.water : palette.waterAlt;
        } else if (height === 0) {
          groundColor = checker ? palette.groundFlat : palette.groundAlt;
        } else {
          // Mountain base uses ground color
          groundColor = checker ? palette.groundFlat : palette.groundAlt;
        }

        // Draw ground strip
        r.fillRect(sx - colW / 2, stripTop, colW + 1, stripH + 1, groundColor);

        // Mountain wall (extends upward from the strip top)
        if (height > 0) {
          const h = Math.min(height, 4);
          const wallH = h * WALL_SCALE / dist;
          const wallTop = stripTop - wallH;

          // Use palette mountain colors
          const ci = h - 1;
          const frontColor = palette.mountainTop[ci] ?? palette.mountainTop[0];
          const topColor = palette.mountainLeft[ci] ?? palette.mountainLeft[0];

          // Front face
          r.fillRect(
            sx - colW / 2, Math.max(0, wallTop),
            colW + 1, stripTop - Math.max(0, wallTop),
            frontColor,
          );

          // Top edge highlight (1px)
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
    horizonY: number, groundH: number, centerX: number,
  ): void {
    const scrollY = state.camera.scrollY;

    // Sort enemies by distance (far first for proper overlap)
    const visible = state.enemies
      .filter((e) => !e.dead && e.active)
      .map((e) => ({ enemy: e, dist: e.row - scrollY }))
      .filter((e) => e.dist > 0.5 && e.dist <= MAX_DRAW_DIST)
      .sort((a, b) => b.dist - a.dist);

    for (const { enemy, dist } of visible) {
      const def = ENEMY_DEFS[enemy.type];
      const screenY = horizonY + groundH / dist;
      const relX = enemy.x - state.playerX;
      const screenX = centerX + relX / dist;
      const scale = 1 / dist;
      const size = def.size * 3 * scale;

      if (size < 1) continue;

      const altOff = enemy.altitude * WALL_SCALE * scale;

      // Enemy body — diamond facing the player
      const ey = screenY - altOff;
      r.fillPoly([
        { x: screenX, y: ey - size },
        { x: screenX + size * 0.8, y: ey },
        { x: screenX, y: ey + size * 0.4 },
        { x: screenX - size * 0.8, y: ey },
      ], def.color);

      // Inner glow
      if (size > 3) {
        r.fillPoly([
          { x: screenX, y: ey - size * 0.5 },
          { x: screenX + size * 0.3, y: ey },
          { x: screenX, y: ey + size * 0.2 },
          { x: screenX - size * 0.3, y: ey },
        ], '#ff8866');
      }

      // Health pip
      if (enemy.health < def.health && size > 2) {
        const barW = size * 1.5;
        r.fillRect(screenX - barW / 2, ey - size - 3, barW, 2, '#440000');
        const hpPct = enemy.health / def.health;
        r.fillRect(screenX - barW / 2, ey - size - 3, barW * hpPct, 2, '#ff4444');
      }
    }
  }

  // ── Projectiles ─────────────────────────────────────────────

  private renderProjectiles(
    r: Renderer, state: FlightState,
    horizonY: number, groundH: number, centerX: number,
  ): void {
    const camera = state.camera;

    for (const p of state.projectiles) {
      // Convert screen-space Y to world row, then to FPV distance
      const worldRow = camera.screenYToRow(p.y);
      const dist = worldRow - camera.scrollY;

      if (dist <= 0.3 || dist > MAX_DRAW_DIST) continue;

      const screenY = horizonY + groundH / dist;
      const relX = p.x - state.playerX;
      const screenX = centerX + relX / dist;
      const scale = 1 / dist;

      if (p.type === 'bullet') {
        // Player bullet: recedes into distance, cyan dot
        const s = Math.max(1, 3 * scale);
        r.fillRect(screenX - s / 2, screenY - s, s, s * 2, '#88eeff');
        r.fillRect(screenX - 0.5, screenY - s * 0.5, 1, s, '#ffffff');
      } else if (p.type === 'missile') {
        // Missile: orange trail
        const s = Math.max(1.5, 4 * scale);
        r.fillRect(screenX - s / 2, screenY - s, s, s * 1.5, '#ffaa22');
        r.fillRect(screenX - s * 0.3, screenY - s * 0.5, s * 0.6, s, '#ffee88');
      } else {
        // Enemy bullet: grows as it approaches (more menacing)
        const s = Math.max(2, 5 * scale);
        r.fillRect(screenX - s / 2, screenY - s / 2, s, s, '#ff6644');
        r.fillRect(screenX - s * 0.3, screenY - s * 0.3, s * 0.6, s * 0.6, '#ffcc88');
      }
    }
  }

  // ── Explosion ───────────────────────────────────────────────

  private renderExplosion(r: Renderer, state: FlightState, sw: number, sh: number): void {
    // Screen shake effect
    const shakeAmt = Math.max(0, 1 - state.explosionTimer / 1.0) * 4;
    if (shakeAmt > 0.5) {
      const ox = (Math.random() - 0.5) * shakeAmt;
      const oy = (Math.random() - 0.5) * shakeAmt;
      r.translate(ox, oy);
    }

    // Red flash
    const flashAlpha = Math.max(0, 0.4 - state.explosionTimer * 0.4);
    if (flashAlpha > 0) {
      r.fillRect(0, 0, sw, sh, `rgba(255,60,20,${flashAlpha})`);
    }

    // Forward-facing explosion particles (rendered in screen space)
    for (const p of state.explosionParticles) {
      const size = Math.max(1, 4 * (p.life / 1.0));
      // Particles fly outward from center
      const px = sw / 2 + (p.x - state.playerX) * 2;
      const py = sh / 2 + (p.y - 200) * 1.5;
      r.fillRect(px - size / 2, py - size / 2, size, size, p.color);
    }

    if (shakeAmt > 0.5) {
      r.translate(0, 0);
    }
  }

  // ── Reticle ─────────────────────────────────────────────────

  private renderReticle(r: Renderer, horizonY: number, groundH: number, centerX: number): void {
    // Targeting reticle at a fixed forward distance (~8 rows ahead)
    const reticleY = horizonY + groundH / 8;
    const color = 'rgba(136,255,170,0.35)';
    const colorBright = 'rgba(136,255,170,0.6)';

    // Crosshair arms
    r.drawLine(centerX - 10, reticleY, centerX - 4, reticleY, color, 1);
    r.drawLine(centerX + 4, reticleY, centerX + 10, reticleY, color, 1);
    r.drawLine(centerX, reticleY - 10, centerX, reticleY - 4, color, 1);
    r.drawLine(centerX, reticleY + 4, centerX, reticleY + 10, color, 1);

    // Center dot
    r.fillRect(centerX - 0.5, reticleY - 0.5, 1, 1, colorBright);
  }

  // ── Cockpit panel ───────────────────────────────────────────

  private renderCockpit(r: Renderer, state: FlightState, sw: number, sh: number): void {
    const panelTop = sh - COCKPIT_HEIGHT;

    // Panel background
    r.fillRect(0, panelTop, sw, COCKPIT_HEIGHT, '#0a0e14');

    // Top edge highlight
    r.drawLine(0, panelTop, sw, panelTop, '#2a3444', 1);
    r.drawLine(0, panelTop + 1, sw, panelTop + 1, '#1a2434', 1);

    // Canopy frame lines at edges
    r.drawLine(0, panelTop, 20, 0, 'rgba(40,50,70,0.3)', 1);
    r.drawLine(sw, panelTop, sw - 20, 0, 'rgba(40,50,70,0.3)', 1);

    // ── Left instruments: ALT + LIVES ──
    const ly = panelTop + 10;

    r.drawText(`LIVES:${state.gameState.lives}`, 4, ly, '#889999', 7);

    // Altitude gauge
    r.drawText('ALT', 4, ly + 12, '#88cc88', 7);
    const altBarX = 22;
    const altBarW = 28;
    r.strokeRect(altBarX, ly + 6, altBarW, 4, '#446644', 1);
    r.fillRect(altBarX, ly + 6, (state.playerAltitude / 4) * altBarW, 4, '#88cc88');

    // ── Center: speed/progress ──
    const cx = sw / 2;
    const progress = Math.floor(state.camera.progress * 100);
    r.drawText(`${progress}%`, cx - 8, ly, '#888888', 8);

    // Speed indicator (scroll speed visual)
    const speedLabel = state.boosting ? 'BOOST' : 'FWD';
    const speedColor = state.boosting ? '#44ddff' : '#667788';
    r.drawText(speedLabel, cx - 12, ly + 12, speedColor, 7);

    // ── Right instruments: MSL + BST ──
    const rx = sw - 55;

    // Missile status
    const mslReady = state.missileCooldown <= 0;
    r.drawText('MSL', rx, ly, mslReady ? '#ffaa22' : '#554422', 7);
    if (mslReady) {
      r.drawText('RDY', rx + 20, ly, '#ffaa22', 7);
    } else {
      const mslPct = 1 - state.missileCooldown / MISSILE_COOLDOWN;
      r.strokeRect(rx + 20, ly - 5, 28, 4, '#443322', 1);
      r.fillRect(rx + 20, ly - 5, mslPct * 28, 4, '#886633');
    }

    // Boost fuel
    const boostColor = state.boosting ? '#44ddff' : '#447788';
    r.drawText('BST', rx, ly + 12, boostColor, 7);
    r.strokeRect(rx + 20, ly + 7, 28, 4, '#334455', 1);
    r.fillRect(rx + 20, ly + 7, state.boostFuel * 28, 4, state.boosting ? '#44ddff' : '#447788');
  }
}
