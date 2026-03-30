/**
 * Isometric flight mode — the primary gameplay of Captain Skyhawk.
 *
 * Player pilots the F-14VTS over scrolling terrain, avoiding mountains
 * by adjusting horizontal position and altitude. Enemies spawn and fire.
 *
 * This mode owns all game logic (movement, combat, collision, explosions).
 * Rendering is delegated to the active FlightView (isometric or first-person).
 * Press Select to toggle views.
 */

import type { EngineAPI, GameMode } from '../../engine/interfaces';
import { clamp } from '../../engine/math/MathUtils';
import { IsometricCamera } from '../isometric/IsometricCamera';
import { TerrainCollision } from '../isometric/TerrainCollision';
import type { GameState } from '../GameState';
import type { MissionDef } from '../data/levels';
import { MISSIONS } from '../data/levels';
import { TERRAIN_TILE_W, TERRAIN_TILE_H, TERRAIN_COLS, generateTerrain, LEVEL_TERRAIN_CONFIGS } from '../data/terrain';
import { getPalette } from '../data/palettes';
import type { Projectile, Enemy } from '../entities/Entities';
import {
  ENEMY_DEFS, PLAYER_BULLET_SPEED, PLAYER_FIRE_COOLDOWN, PROJECTILE_LIFETIME,
  MISSILE_SPREAD_COUNT, MISSILE_SPEED, MISSILE_SPREAD_ANGLE, MISSILE_COOLDOWN, MISSILE_LIFETIME,
  BOOST_FUEL_MAX, BOOST_BURN_RATE, BOOST_RECHARGE_RATE, BOOST_SPEED_MULTIPLIER, BOOST_MIN_FUEL,
} from '../entities/Entities';
import { FlightState } from '../flight/FlightState';
import type { FlightView } from '../flight/FlightView';
import { IsometricView } from '../flight/IsometricView';
import { FirstPersonView } from '../flight/FirstPersonView';

// Player constants
const PLAYER_SCREEN_Y = 200;
const PLAYER_SPEED_X = 100;
const PLAYER_ALTITUDE_SPEED = 3;
const PLAYER_MIN_ALTITUDE = 0;
const PLAYER_MAX_ALTITUDE = 4;
const PLAYER_WIDTH = 14;
const JET_HEIGHT = 16;

const EXPLOSION_DURATION = 1.5;
const RESPAWN_DELAY = 2.0;

export class IsometricMode implements GameMode {
  readonly id = 'isometric';

  private gameState: GameState;
  private state: FlightState;
  private terrainCollision!: TerrainCollision;

  // Views
  private isoView = new IsometricView();
  private fpvView = new FirstPersonView();
  private activeView: FlightView;

  constructor(gameState: GameState) {
    this.gameState = gameState;
    this.state = new FlightState(gameState);
    this.activeView = this.isoView;
  }

  enter(engine: EngineAPI): void {
    const s = this.state;
    s.screenWidth = engine.config.width;
    s.screenHeight = engine.config.height;

    const missionIndex = this.gameState.currentMission;
    s.mission = MISSIONS[missionIndex] ?? MISSIONS[0];

    const terrainConfig = LEVEL_TERRAIN_CONFIGS[s.mission.terrainConfigIndex] ?? LEVEL_TERRAIN_CONFIGS[0];
    s.terrain = generateTerrain(terrainConfig.length, terrainConfig.seed, terrainConfig.difficulty);
    s.palette = getPalette(s.mission.paletteIndex);

    s.camera = new IsometricCamera(s.screenHeight, s.terrain.rows.length, s.mission.scrollSpeed);
    this.terrainCollision = new TerrainCollision(s.terrain, s.screenWidth);
    s.updateTerrainOffset();

    s.playerX = s.screenWidth / 2;
    s.prevPlayerX = s.playerX;
    s.playerAltitude = this.gameState.altitude;
    s.prevAltitude = s.playerAltitude;
    s.alive = true;
    s.exploding = false;
    s.levelComplete = false;
    s.levelCompleteTimer = 0;
    s.invincibleTimer = 2.0;

    // Combat reset
    s.projectiles = [];
    s.enemies = [];
    s.playerFireCooldown = 0;
    s.missileCooldown = 0;
    s.boostFuel = BOOST_FUEL_MAX;
    s.boosting = false;
    s.baseScrollSpeed = s.mission.scrollSpeed;
    this.spawnEnemies();

    // Activate current view
    this.activeView.activate(s);
  }

  update(engine: EngineAPI, dt: number): void {
    const s = this.state;

    // View toggle on Select press
    if (engine.input.isPressed('select')) {
      this.toggleView();
    }

    if (s.levelComplete) {
      s.levelCompleteTimer += dt;
      if (s.levelCompleteTimer > 3.0) {
        if (s.mission.hasDogfight) {
          engine.setMode('dogfight');
        } else if (s.mission.hasDocking) {
          engine.setMode('docking');
        } else {
          engine.setMode('title');
        }
      }
      return;
    }

    if (s.exploding) {
      this.updateExplosion(engine, dt);
      return;
    }

    s.prevPlayerX = s.playerX;
    s.prevAltitude = s.playerAltitude;

    const input = engine.input;
    if (input.isHeld('dpadLeft'))  s.playerX -= PLAYER_SPEED_X * dt;
    if (input.isHeld('dpadRight')) s.playerX += PLAYER_SPEED_X * dt;
    if (input.isHeld('dpadUp'))    s.playerAltitude += PLAYER_ALTITUDE_SPEED * dt;
    if (input.isHeld('dpadDown'))  s.playerAltitude -= PLAYER_ALTITUDE_SPEED * dt;

    const minX = s.terrainOffsetX + JET_HEIGHT / 2;
    const maxX = s.terrainOffsetX + TERRAIN_COLS * TERRAIN_TILE_W - JET_HEIGHT / 2;
    s.playerX = clamp(s.playerX, minX, maxX);
    s.playerAltitude = clamp(s.playerAltitude, PLAYER_MIN_ALTITUDE, PLAYER_MAX_ALTITUDE);

    // Player fire (A button)
    s.playerFireCooldown = Math.max(0, s.playerFireCooldown - dt);
    if (input.isHeld('A') && s.playerFireCooldown <= 0) {
      this.spawnPlayerBullet();
      s.playerFireCooldown = PLAYER_FIRE_COOLDOWN;
    }

    // Missile spread (B button)
    s.missileCooldown = Math.max(0, s.missileCooldown - dt);
    if (input.isPressed('B') && s.missileCooldown <= 0) {
      this.spawnMissileSpread();
      s.missileCooldown = MISSILE_COOLDOWN;
    }

    // Boost (C button)
    s.boosting = input.isHeld('C') && s.boostFuel > BOOST_MIN_FUEL;
    if (s.boosting) {
      s.boostFuel = Math.max(0, s.boostFuel - BOOST_BURN_RATE * dt);
      s.camera.scrollSpeed = s.baseScrollSpeed * BOOST_SPEED_MULTIPLIER;
      if (s.boostFuel <= 0) s.boosting = false;
    } else {
      s.boostFuel = Math.min(BOOST_FUEL_MAX, s.boostFuel + BOOST_RECHARGE_RATE * dt);
      s.camera.scrollSpeed = s.baseScrollSpeed;
    }

    s.camera.update(dt);

    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.checkPlayerBulletHits();

    if (s.invincibleTimer <= 0) {
      this.checkEnemyBulletHits();
    }

    if (s.invincibleTimer > 0) {
      s.invincibleTimer -= dt;
    }

    // Terrain collision
    if (s.invincibleTimer <= 0) {
      const playerRow = s.camera.screenYToRow(PLAYER_SCREEN_Y);
      const collision = this.terrainCollision.check(
        s.playerX, playerRow, s.playerAltitude, PLAYER_WIDTH,
      );
      if (collision.collided) {
        this.startExplosion();
        return;
      }
    }

    if (s.camera.atEnd) {
      s.levelComplete = true;
      s.levelCompleteTimer = 0;
      this.gameState.altitude = s.playerAltitude;
    }

    this.gameState.altitude = s.playerAltitude;
  }

  render(engine: EngineAPI, alpha: number): void {
    this.state.engineTime = engine.getTime();
    this.activeView.render(engine.renderer, this.state, alpha);
    this.activeView.renderHUD(engine.renderer, this.state);
  }

  exit(_engine: EngineAPI): void {
    // cleanup
  }

  // ── View toggle ──────────────────────────────────────────────

  private toggleView(): void {
    if (this.activeView === this.isoView) {
      this.activeView = this.fpvView;
    } else {
      this.activeView = this.isoView;
    }
    this.activeView.activate(this.state);
  }

  // ── Enemy spawning ───────────────────────────────────────────

  private spawnEnemies(): void {
    const s = this.state;
    const totalRows = s.terrain.rows.length;
    const spacing = Math.max(12, Math.floor(totalRows / 10));

    for (let i = spacing; i < totalRows - 10; i += spacing) {
      const row = s.terrain.rows[i];
      if (!row) continue;

      let bestCol = -1;
      for (let c = 2; c < TERRAIN_COLS - 2; c++) {
        if (row[c] === 0) { bestCol = c; break; }
      }
      if (bestCol === -1) {
        for (let c = TERRAIN_COLS - 3; c >= 2; c--) {
          if (row[c] === 0) { bestCol = c; break; }
        }
      }
      if (bestCol === -1) continue;

      const enemyX = s.terrainOffsetX + bestCol * TERRAIN_TILE_W + TERRAIN_TILE_W / 2;

      s.enemies.push({
        x: enemyX,
        row: i,
        altitude: 0,
        health: ENEMY_DEFS.turret.health,
        type: 'turret',
        fireCooldown: 1.0 + Math.random() * 2.0,
        active: false,
        dead: false,
      });
    }
  }

  // ── Enemy update ─────────────────────────────────────────────

  private updateEnemies(dt: number): void {
    const s = this.state;
    const visible = s.camera.getVisibleRows();

    for (const enemy of s.enemies) {
      if (enemy.dead) continue;

      if (enemy.row >= visible.minRow && enemy.row <= visible.maxRow + 3) {
        enemy.active = true;
      }

      if (!enemy.active) continue;

      const def = ENEMY_DEFS[enemy.type];
      enemy.fireCooldown -= dt;
      if (enemy.fireCooldown <= 0) {
        this.spawnEnemyBullet(enemy);
        enemy.fireCooldown = def.fireRate + (Math.random() - 0.5) * 1.0;
      }

      const screenY = s.camera.rowToScreenY(enemy.row);
      if (screenY > s.screenHeight + 50) {
        enemy.dead = true;
      }
    }

    s.enemies = s.enemies.filter((e) => !e.dead);
  }

  // ── Projectiles ──────────────────────────────────────────────

  private spawnPlayerBullet(): void {
    const s = this.state;
    const altOffset = s.playerAltitude * 3;
    s.projectiles.push({
      x: s.playerX,
      y: PLAYER_SCREEN_Y - altOffset - JET_HEIGHT / 2,
      altitude: s.playerAltitude,
      vx: 0,
      vy: -PLAYER_BULLET_SPEED,
      fromPlayer: true,
      type: 'bullet',
      life: PROJECTILE_LIFETIME,
    });
  }

  private spawnMissileSpread(): void {
    const s = this.state;
    const altOffset = s.playerAltitude * 3;
    const originY = PLAYER_SCREEN_Y - altOffset - JET_HEIGHT / 2;
    const halfSpread = MISSILE_SPREAD_ANGLE / 2;

    for (let i = 0; i < MISSILE_SPREAD_COUNT; i++) {
      const count = MISSILE_SPREAD_COUNT;
      const t = count <= 1 ? 0 : (i / (count - 1)) * 2 - 1;
      const angle = -Math.PI / 2 + t * halfSpread;
      s.projectiles.push({
        x: s.playerX,
        y: originY,
        altitude: s.playerAltitude,
        vx: Math.cos(angle) * MISSILE_SPEED,
        vy: Math.sin(angle) * MISSILE_SPEED,
        fromPlayer: true,
        type: 'missile',
        life: MISSILE_LIFETIME,
      });
    }
  }

  private spawnEnemyBullet(enemy: Enemy): void {
    const s = this.state;
    const def = ENEMY_DEFS[enemy.type];
    const screenY = s.camera.rowToScreenY(enemy.row);
    const altOffset = enemy.altitude * 3;

    const dx = s.playerX - enemy.x;
    const dy = PLAYER_SCREEN_Y - screenY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const speed = def.projectileSpeed;
    s.projectiles.push({
      x: enemy.x,
      y: screenY - altOffset,
      altitude: enemy.altitude,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      fromPlayer: false,
      type: 'enemy',
      life: PROJECTILE_LIFETIME,
    });
  }

  private updateProjectiles(dt: number): void {
    const s = this.state;
    for (const p of s.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }

    s.projectiles = s.projectiles.filter(
      (p) => p.life > 0 && p.y > -20 && p.y < s.screenHeight + 20
             && p.x > -20 && p.x < s.screenWidth + 20,
    );
  }

  private checkPlayerBulletHits(): void {
    const s = this.state;
    const hitRadius = 10;

    for (const p of s.projectiles) {
      if (!p.fromPlayer) continue;

      for (const enemy of s.enemies) {
        if (enemy.dead) continue;

        const screenY = s.camera.rowToScreenY(enemy.row);
        const dx = p.x - enemy.x;
        const dy = p.y - screenY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < hitRadius) {
          enemy.health--;
          p.life = 0;

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
    const s = this.state;
    const hitRadius = 10;
    const playerScreenY = PLAYER_SCREEN_Y - s.playerAltitude * 3;

    for (const p of s.projectiles) {
      if (p.fromPlayer) continue;

      const dx = p.x - s.playerX;
      const dy = p.y - playerScreenY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < hitRadius) {
        p.life = 0;
        this.startExplosion();
        return;
      }
    }
  }

  // ── Explosion ─────────────────────────────────────────────────

  private spawnSmallExplosion(x: number, y: number): void {
    const s = this.state;
    const colors = ['#ff4400', '#ff8800', '#ffcc00', '#ffffff'];
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 50;
      s.explosionParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15,
        life: 0.3 + Math.random() * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  private startExplosion(): void {
    const s = this.state;
    s.alive = false;
    s.exploding = true;
    s.explosionTimer = 0;
    s.respawnTimer = 0;
    s.camera.pause();

    const colors = ['#ff4400', '#ff8800', '#ffcc00', '#ffffff', '#ff2200'];
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 80;
      s.explosionParticles.push({
        x: s.playerX,
        y: PLAYER_SCREEN_Y - s.playerAltitude * 3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 0.5 + Math.random() * 1.0,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  private updateExplosion(engine: EngineAPI, dt: number): void {
    const s = this.state;
    s.explosionTimer += dt;

    for (const p of s.explosionParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt;
      p.life -= dt;
    }
    s.explosionParticles = s.explosionParticles.filter((p) => p.life > 0);

    if (s.explosionTimer > EXPLOSION_DURATION) {
      s.respawnTimer += dt;
      if (s.respawnTimer > RESPAWN_DELAY) {
        const canContinue = this.gameState.loseLife();
        if (canContinue) {
          this.respawn();
        } else {
          engine.setMode('gameover');
        }
      }
    }
  }

  private respawn(): void {
    const s = this.state;
    s.playerX = s.screenWidth / 2;
    s.prevPlayerX = s.playerX;
    s.playerAltitude = 2;
    s.prevAltitude = 2;
    s.alive = true;
    s.exploding = false;
    s.explosionTimer = 0;
    s.respawnTimer = 0;
    s.invincibleTimer = 2.0;
    s.resetCombat();
    s.camera.scrollSpeed = s.baseScrollSpeed;
    s.camera.resume();
  }
}
