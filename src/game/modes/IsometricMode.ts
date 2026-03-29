/**
 * Isometric flight mode — the primary gameplay of Captain Skyhawk.
 *
 * Player pilots the F-14VTS over scrolling isometric terrain,
 * avoiding mountains by adjusting horizontal position and altitude.
 * Terrain auto-scrolls forward. Crashing into terrain = death.
 *
 * Enemies spawn at predefined terrain rows and fire projectiles.
 * Player fires forward with the A button.
 */

import type { EngineAPI, GameMode } from '../../engine/interfaces';
import type { Renderer } from '../../engine/render/Renderer';
import { clamp } from '../../engine/math/MathUtils';
import { IsometricCamera } from '../isometric/IsometricCamera';
import { TerrainRenderer } from '../isometric/TerrainRenderer';
import { TerrainCollision } from '../isometric/TerrainCollision';
import type { GameState } from '../GameState';
import type { MissionDef } from '../data/levels';
import { MISSIONS } from '../data/levels';
import type { TerrainData } from '../data/terrain';
import { TERRAIN_TILE_W, TERRAIN_COLS, generateTerrain, LEVEL_TERRAIN_CONFIGS } from '../data/terrain';
import { getPalette, type LevelPalette } from '../data/palettes';
import type { Projectile, Enemy } from '../entities/Entities';
import {
  ENEMY_DEFS, PLAYER_BULLET_SPEED, PLAYER_FIRE_COOLDOWN, PROJECTILE_LIFETIME,
} from '../entities/Entities';

// Player constants
const PLAYER_SCREEN_Y = 200;
const PLAYER_SPEED_X = 100;
const PLAYER_ALTITUDE_SPEED = 3;
const PLAYER_MIN_ALTITUDE = 0;
const PLAYER_MAX_ALTITUDE = 4;
const PLAYER_WIDTH = 14;
const JET_WIDTH = 16;
const JET_HEIGHT = 16;

const EXPLOSION_DURATION = 1.5;
const RESPAWN_DELAY = 2.0;

interface ExplosionParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export class IsometricMode implements GameMode {
  readonly id = 'isometric';

  private gameState: GameState;
  private camera!: IsometricCamera;
  private terrainRenderer!: TerrainRenderer;
  private terrainCollision!: TerrainCollision;
  private terrain!: TerrainData;
  private palette!: LevelPalette;
  private mission!: MissionDef;

  private playerX = 128;
  private prevPlayerX = 128;
  private playerAltitude = 2;
  private prevAltitude = 2;
  private alive = true;
  private invincibleTimer = 0;

  private exploding = false;
  private explosionTimer = 0;
  private explosionParticles: ExplosionParticle[] = [];
  private respawnTimer = 0;

  private levelComplete = false;
  private levelCompleteTimer = 0;

  private screenWidth = 256;
  private screenHeight = 240;
  private terrainOffsetX = 0;
  private engineTime = 0;

  // Combat
  private projectiles: Projectile[] = [];
  private enemies: Enemy[] = [];
  private playerFireCooldown = 0;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  enter(engine: EngineAPI): void {
    this.screenWidth = engine.config.width;
    this.screenHeight = engine.config.height;

    const missionIndex = this.gameState.currentMission;
    this.mission = MISSIONS[missionIndex] ?? MISSIONS[0];

    const terrainConfig = LEVEL_TERRAIN_CONFIGS[this.mission.terrainConfigIndex] ?? LEVEL_TERRAIN_CONFIGS[0];
    this.terrain = generateTerrain(terrainConfig.length, terrainConfig.seed, terrainConfig.difficulty);
    this.palette = getPalette(this.mission.paletteIndex);

    this.camera = new IsometricCamera(this.screenHeight, this.terrain.rows.length, this.mission.scrollSpeed);
    this.terrainRenderer = new TerrainRenderer(this.terrain, this.palette, this.screenWidth);
    this.terrainCollision = new TerrainCollision(this.terrain, this.screenWidth);
    this.terrainOffsetX = (this.screenWidth - TERRAIN_COLS * TERRAIN_TILE_W) / 2;

    this.playerX = this.screenWidth / 2;
    this.prevPlayerX = this.playerX;
    this.playerAltitude = this.gameState.altitude;
    this.prevAltitude = this.playerAltitude;
    this.alive = true;
    this.exploding = false;
    this.levelComplete = false;
    this.levelCompleteTimer = 0;
    this.invincibleTimer = 2.0;

    // Combat reset
    this.projectiles = [];
    this.enemies = [];
    this.playerFireCooldown = 0;
    this.spawnEnemies();
  }

  update(engine: EngineAPI, dt: number): void {
    if (this.levelComplete) {
      this.levelCompleteTimer += dt;
      if (this.levelCompleteTimer > 3.0) {
        if (this.mission.hasDogfight) {
          engine.setMode('dogfight');
        } else if (this.mission.hasDocking) {
          engine.setMode('docking');
        } else {
          engine.setMode('title');
        }
      }
      return;
    }

    if (this.exploding) {
      this.updateExplosion(engine, dt);
      return;
    }

    this.prevPlayerX = this.playerX;
    this.prevAltitude = this.playerAltitude;

    const input = engine.input;
    if (input.isHeld('moveLeft'))  this.playerX -= PLAYER_SPEED_X * dt;
    if (input.isHeld('moveRight')) this.playerX += PLAYER_SPEED_X * dt;
    if (input.isHeld('moveUp'))    this.playerAltitude += PLAYER_ALTITUDE_SPEED * dt;
    if (input.isHeld('moveDown'))  this.playerAltitude -= PLAYER_ALTITUDE_SPEED * dt;

    const minX = this.terrainOffsetX + JET_WIDTH / 2;
    const maxX = this.terrainOffsetX + TERRAIN_COLS * TERRAIN_TILE_W - JET_WIDTH / 2;
    this.playerX = clamp(this.playerX, minX, maxX);
    this.playerAltitude = clamp(this.playerAltitude, PLAYER_MIN_ALTITUDE, PLAYER_MAX_ALTITUDE);

    // Player fire
    this.playerFireCooldown = Math.max(0, this.playerFireCooldown - dt);
    if (input.isHeld('fire') && this.playerFireCooldown <= 0) {
      this.spawnPlayerBullet();
      this.playerFireCooldown = PLAYER_FIRE_COOLDOWN;
    }

    this.camera.update(dt);

    // Update enemies
    this.updateEnemies(dt);

    // Update projectiles
    this.updateProjectiles(dt);

    // Collision: player projectiles vs enemies
    this.checkPlayerBulletHits();

    // Collision: enemy projectiles vs player
    if (this.invincibleTimer <= 0) {
      this.checkEnemyBulletHits();
    }

    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
    }

    // Terrain collision
    if (this.invincibleTimer <= 0) {
      const playerRow = this.camera.screenYToRow(PLAYER_SCREEN_Y);
      const collision = this.terrainCollision.check(
        this.playerX, playerRow, this.playerAltitude, PLAYER_WIDTH,
      );
      if (collision.collided) {
        this.startExplosion();
        return;
      }
    }

    if (this.camera.atEnd) {
      this.levelComplete = true;
      this.levelCompleteTimer = 0;
      this.gameState.altitude = this.playerAltitude;
    }

    this.gameState.altitude = this.playerAltitude;
  }

  render(engine: EngineAPI, alpha: number): void {
    const r = engine.renderer;
    this.engineTime = engine.getTime();

    r.clear(this.palette.background);
    this.terrainRenderer.render(r, this.camera);

    // Render enemies (behind player)
    this.renderEnemies(r);

    // Render projectiles
    this.renderProjectiles(r);

    if (this.alive && !this.exploding) {
      this.renderPlayer(r, alpha);
    }

    if (this.exploding) {
      this.renderExplosion(r);
    }

    this.renderHUD(r);

    if (this.levelComplete) {
      this.renderLevelComplete(r);
    }
  }

  exit(_engine: EngineAPI): void {
    // cleanup
  }

  // ── Enemy spawning ───────────────────────────────────────────

  private spawnEnemies(): void {
    // Place turrets at regular intervals through the level in open terrain
    const totalRows = this.terrain.rows.length;
    const spacing = Math.max(12, Math.floor(totalRows / 10));

    for (let i = spacing; i < totalRows - 10; i += spacing) {
      const row = this.terrain.rows[i];
      if (!row) continue;

      // Find a flat column (height 0) in the middle area
      let bestCol = -1;
      for (let c = 2; c < TERRAIN_COLS - 2; c++) {
        if (row.heights[c] === 0) {
          bestCol = c;
          break;
        }
      }
      // Try from the other side too
      if (bestCol === -1) {
        for (let c = TERRAIN_COLS - 3; c >= 2; c--) {
          if (row.heights[c] === 0) {
            bestCol = c;
            break;
          }
        }
      }
      if (bestCol === -1) continue;

      const enemyX = this.terrainOffsetX + bestCol * TERRAIN_TILE_W + TERRAIN_TILE_W / 2;

      this.enemies.push({
        x: enemyX,
        row: i,
        altitude: 0,
        health: ENEMY_DEFS.turret.health,
        type: 'turret',
        fireCooldown: 1.0 + Math.random() * 2.0, // stagger initial fire
        active: false,
        dead: false,
      });
    }
  }

  // ── Enemy update ─────────────────────────────────────────────

  private updateEnemies(dt: number): void {
    const visible = this.camera.getVisibleRows();

    for (const enemy of this.enemies) {
      if (enemy.dead) continue;

      // Activate when scrolled into view (with a buffer)
      if (enemy.row >= visible.minRow && enemy.row <= visible.maxRow + 3) {
        enemy.active = true;
      }

      if (!enemy.active) continue;

      // Fire at player
      const def = ENEMY_DEFS[enemy.type];
      enemy.fireCooldown -= dt;
      if (enemy.fireCooldown <= 0) {
        this.spawnEnemyBullet(enemy);
        enemy.fireCooldown = def.fireRate + (Math.random() - 0.5) * 1.0;
      }

      // Remove if scrolled well past the bottom of screen
      const screenY = this.camera.rowToScreenY(enemy.row);
      if (screenY > this.screenHeight + 50) {
        enemy.dead = true;
      }
    }

    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  // ── Projectiles ──────────────────────────────────────────────

  private spawnPlayerBullet(): void {
    const altOffset = this.playerAltitude * 3;
    this.projectiles.push({
      x: this.playerX,
      y: PLAYER_SCREEN_Y - altOffset - JET_HEIGHT / 2,
      altitude: this.playerAltitude,
      vx: 0,
      vy: -PLAYER_BULLET_SPEED,
      fromPlayer: true,
      life: PROJECTILE_LIFETIME,
    });
  }

  private spawnEnemyBullet(enemy: Enemy): void {
    const def = ENEMY_DEFS[enemy.type];
    const screenY = this.camera.rowToScreenY(enemy.row);
    const altOffset = enemy.altitude * 3;

    // Aim loosely toward player position
    const dx = this.playerX - enemy.x;
    const dy = PLAYER_SCREEN_Y - screenY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const speed = def.projectileSpeed;
    this.projectiles.push({
      x: enemy.x,
      y: screenY - altOffset,
      altitude: enemy.altitude,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      fromPlayer: false,
      life: PROJECTILE_LIFETIME,
    });
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }

    // Remove expired or off-screen
    this.projectiles = this.projectiles.filter(
      (p) => p.life > 0 && p.y > -20 && p.y < this.screenHeight + 20
             && p.x > -20 && p.x < this.screenWidth + 20,
    );
  }

  private checkPlayerBulletHits(): void {
    const hitRadius = 10;

    for (const p of this.projectiles) {
      if (!p.fromPlayer) continue;

      for (const enemy of this.enemies) {
        if (enemy.dead) continue;

        const screenY = this.camera.rowToScreenY(enemy.row);
        const dx = p.x - enemy.x;
        const dy = p.y - screenY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < hitRadius) {
          enemy.health--;
          p.life = 0; // consume bullet

          if (enemy.health <= 0) {
            enemy.dead = true;
            this.gameState.addScore(ENEMY_DEFS[enemy.type].score);
            this.spawnSmallExplosion(enemy.x, screenY);
          }
          break;
        }
      }
    }
  }

  private checkEnemyBulletHits(): void {
    const hitRadius = 10;
    const playerScreenY = PLAYER_SCREEN_Y - this.playerAltitude * 3;

    for (const p of this.projectiles) {
      if (p.fromPlayer) continue;

      const dx = p.x - this.playerX;
      const dy = p.y - playerScreenY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < hitRadius) {
        p.life = 0;
        this.startExplosion();
        return;
      }
    }
  }

  // ── Rendering ────────────────────────────────────────────────

  private renderEnemies(r: Renderer): void {
    for (const enemy of this.enemies) {
      if (enemy.dead || !enemy.active) continue;

      const def = ENEMY_DEFS[enemy.type];
      const screenY = this.camera.rowToScreenY(enemy.row);
      if (screenY < -20 || screenY > this.screenHeight + 20) continue;

      const s = def.size;
      const altOff = enemy.altitude * 3;
      const ey = screenY - altOff;

      // Turret: diamond shape with a darker center
      r.fillPoly([
        { x: enemy.x, y: ey - s },
        { x: enemy.x + s, y: ey },
        { x: enemy.x, y: ey + s * 0.6 },
        { x: enemy.x - s, y: ey },
      ], def.color);

      // Inner highlight
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

  private renderProjectiles(r: Renderer): void {
    for (const p of this.projectiles) {
      if (p.fromPlayer) {
        // Player bullet: small bright vertical line
        r.fillRect(p.x - 1, p.y - 3, 2, 6, '#88eeff');
        r.fillRect(p.x, p.y - 2, 1, 4, '#ffffff');
      } else {
        // Enemy bullet: small red dot
        r.fillRect(p.x - 1.5, p.y - 1.5, 3, 3, '#ff6644');
        r.fillRect(p.x - 0.5, p.y - 0.5, 1, 1, '#ffcc88');
      }
    }
  }

  private spawnSmallExplosion(x: number, y: number): void {
    const colors = ['#ff4400', '#ff8800', '#ffcc00', '#ffffff'];
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 50;
      this.explosionParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15,
        life: 0.3 + Math.random() * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  // ── Player rendering ──────────────────────────────────────────

  private renderPlayer(r: Renderer, alpha: number): void {
    const px = this.prevPlayerX + (this.playerX - this.prevPlayerX) * alpha;
    const alt = this.prevAltitude + (this.playerAltitude - this.prevAltitude) * alpha;
    const altOffset = alt * 3;
    const jetY = PLAYER_SCREEN_Y - altOffset;

    // Invincibility blink
    if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer * 10) % 2 === 0) {
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
    ], this.palette.playerJet);

    // Cockpit
    r.fillPoly([
      { x: px, y: jetY - 4 },
      { x: px + 3, y: jetY + 1 },
      { x: px, y: jetY + 4 },
      { x: px - 3, y: jetY + 1 },
    ], this.palette.playerHighlight);

    // Engine glow
    const flicker = Math.sin(this.engineTime * 20) * 0.5 + 0.5;
    r.fillRect(px - 2, jetY + JET_HEIGHT / 2 - 1, 4, 2 + flicker * 2, this.palette.playerEngine);

    // Altitude tick marks on wings
    for (let i = 0; i < Math.floor(alt); i++) {
      const wy = jetY + 1 - i;
      r.drawLine(px - 6, wy, px - 4, wy, '#ffffff', 1);
      r.drawLine(px + 4, wy, px + 6, wy, '#ffffff', 1);
    }
  }

  // ── Explosion ─────────────────────────────────────────────────

  private startExplosion(): void {
    this.alive = false;
    this.exploding = true;
    this.explosionTimer = 0;
    this.respawnTimer = 0;
    this.camera.pause();

    const colors = ['#ff4400', '#ff8800', '#ffcc00', '#ffffff', '#ff2200'];
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 80;
      this.explosionParticles.push({
        x: this.playerX,
        y: PLAYER_SCREEN_Y - this.playerAltitude * 3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 0.5 + Math.random() * 1.0,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  private updateExplosion(engine: EngineAPI, dt: number): void {
    this.explosionTimer += dt;

    for (const p of this.explosionParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt;
      p.life -= dt;
    }
    this.explosionParticles = this.explosionParticles.filter((p) => p.life > 0);

    if (this.explosionTimer > EXPLOSION_DURATION) {
      this.respawnTimer += dt;
      if (this.respawnTimer > RESPAWN_DELAY) {
        const canContinue = this.gameState.loseLife();
        if (canContinue) {
          this.respawn();
        } else {
          engine.setMode('gameover');
        }
      }
    }
  }

  private renderExplosion(r: Renderer): void {
    for (const p of this.explosionParticles) {
      const size = Math.max(1, 3 * (p.life / 1.0));
      r.fillRect(p.x - size / 2, p.y - size / 2, size, size, p.color);
    }
  }

  private respawn(): void {
    this.playerX = this.screenWidth / 2;
    this.prevPlayerX = this.playerX;
    this.playerAltitude = 2;
    this.prevAltitude = 2;
    this.alive = true;
    this.exploding = false;
    this.explosionTimer = 0;
    this.respawnTimer = 0;
    this.invincibleTimer = 2.0;
    this.projectiles = [];
    this.camera.resume();
  }

  // ── HUD ───────────────────────────────────────────────────────

  private renderHUD(r: Renderer): void {
    r.fillRect(0, 0, this.screenWidth, 14, 'rgba(0,0,0,0.6)');
    r.drawText(`M${this.mission.id}: ${this.mission.name}`, 4, 10, '#88aacc', 8);
    r.drawText(`SCORE: ${this.gameState.score}`, 170, 10, '#cccccc', 8);

    r.fillRect(0, this.screenHeight - 18, this.screenWidth, 18, 'rgba(0,0,0,0.6)');
    r.drawText(`LIVES: ${this.gameState.lives}`, 4, this.screenHeight - 8, '#cccccc', 8);

    const altLabel = `ALT: ${this.playerAltitude.toFixed(1)}`;
    r.drawText(altLabel, 80, this.screenHeight - 8, '#88cc88', 8);

    // Altitude bar
    const barX = 135;
    const barW = 40;
    const barH = 6;
    const barY = this.screenHeight - 13;
    r.strokeRect(barX, barY, barW, barH, '#446644', 1);
    r.fillRect(barX, barY, (this.playerAltitude / PLAYER_MAX_ALTITUDE) * barW, barH, '#88cc88');

    // Progress
    r.drawText(`${Math.floor(this.camera.progress * 100)}%`, this.screenWidth - 30, this.screenHeight - 8, '#888888', 8);

    // Controls hint
    if (this.camera.scrollY < 5) {
      r.drawText('LEFT/RIGHT: Move   UP/DOWN: Altitude   A: Fire', 4, this.screenHeight - 26, '#556677', 8);
    }
  }

  private renderLevelComplete(r: Renderer): void {
    r.fillRect(0, 90, this.screenWidth, 60, 'rgba(0,0,0,0.7)');
    r.drawText('MISSION COMPLETE', 65, 118, '#ffcc00', 12);
    r.drawText(`SCORE: ${this.gameState.score}`, 90, 135, '#cccccc', 8);
  }
}
