/**
 * Flight mode — the primary gameplay of Captain Skyhawk.
 *
 * Owns all game logic (movement, combat, collision, explosions).
 * All physics operate in world coordinates.
 * Rendering delegated to the active FlightView (isometric or first-person).
 * Press Select to toggle views.
 */

import type { EngineAPI, GameMode } from '../../engine/interfaces';
import { clamp } from '../../engine/math/MathUtils';
import { IsometricCamera } from '../isometric/IsometricCamera';
import type { GameState } from '../GameState';
import { MISSIONS } from '../data/levels';
import { TERRAIN_COLS, generateTerrain, LEVEL_TERRAIN_CONFIGS } from '../data/terrain';
import { getPalette } from '../data/palettes';

import { World } from '../ecs/World';
import { WorldTerrain } from '../ecs/WorldTerrain';
import {
  CELL_SIZE, Z_UNIT, TERRAIN_WORLD_W, PLAYER_AHEAD,
  PLAYER_SPEED_X, PLAYER_SPEED_Z, PLAYER_MAX_Z, PLAYER_HALF_W,
  CAMERA_BASE_SPEED, FIRE_COOLDOWN, MISSILE_COOLDOWN_TIME,
  BOOST_FUEL_MAX, BOOST_BURN_RATE, BOOST_RECHARGE_RATE,
  BOOST_SPEED_MULT, BOOST_MIN_FUEL,
  EXPLOSION_DURATION, RESPAWN_DELAY, PARTICLE_GRAVITY,
} from '../ecs/Components';
import {
  movementSystem, projectileSystem, enemySystem,
  bulletEnemyCollision, bulletPlayerCollision,
  spawnPlayerBullet, spawnMissileSpread, spawnEnemies,
} from '../ecs/systems';

import { FlightState } from '../flight/FlightState';
import type { FlightView } from '../flight/FlightView';
import { IsometricView } from '../flight/IsometricView';
import { FirstPersonView } from '../flight/FirstPersonView';

export class IsometricMode implements GameMode {
  readonly id = 'isometric';

  private gameState: GameState;
  private state: FlightState;

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

    // Mission
    const mi = this.gameState.currentMission;
    s.mission = MISSIONS[mi] ?? MISSIONS[0];
    const tc = LEVEL_TERRAIN_CONFIGS[s.mission.terrainConfigIndex] ?? LEVEL_TERRAIN_CONFIGS[0];
    s.rawTerrain = generateTerrain(tc.length, tc.seed, tc.difficulty);
    s.palette = getPalette(s.mission.paletteIndex);

    // World terrain
    s.terrain = new WorldTerrain(s.rawTerrain);
    s.updateTerrainOffset();

    // Camera
    s.cameraWorldY = 0;
    s.cameraSpeed = CAMERA_BASE_SPEED;
    s.cameraPaused = false;
    s.baseSpeed = CAMERA_BASE_SPEED;

    // Iso camera (for terrain rendering)
    s.isoCamera = new IsometricCamera(s.screenHeight, s.rawTerrain.rows.length, s.mission.scrollSpeed);

    // ECS reset
    s.world.clear();

    // Spawn player
    const pid = s.world.spawn();
    s.playerId = pid;
    const startX = TERRAIN_WORLD_W / 2;
    const startZ = this.gameState.altitude * Z_UNIT;
    s.world.pos.set(pid, { x: startX, y: PLAYER_AHEAD, z: startZ });
    s.world.col.set(pid, { type: 'sphere', radius: PLAYER_HALF_W });
    s.prevPlayerX = startX;
    s.prevPlayerZ = startZ;

    // Player state
    s.alive = true;
    s.invincibleTimer = 2.0;
    s.fireCD = 0;
    s.missileCD = 0;
    s.boostFuel = BOOST_FUEL_MAX;
    s.boosting = false;
    s.exploding = false;
    s.levelComplete = false;
    s.levelCompleteTimer = 0;
    s.explosionParticles = [];

    // Spawn enemies
    spawnEnemies(s.world, s.rawTerrain.rows, TERRAIN_COLS);

    // Activate view
    this.activeView.activate(s);
  }

  update(engine: EngineAPI, dt: number): void {
    const s = this.state;
    const input = engine.input;

    // View toggle
    if (input.isPressed('select')) this.toggleView();

    if (s.levelComplete) {
      s.levelCompleteTimer += dt;
      if (s.levelCompleteTimer > 3.0) {
        if (s.mission.hasDogfight) engine.setMode('dogfight');
        else if (s.mission.hasDocking) engine.setMode('docking');
        else engine.setMode('title');
      }
      return;
    }

    if (s.exploding) {
      this.updateExplosion(engine, dt);
      return;
    }

    const playerPos = s.world.pos.get(s.playerId)!;

    // Save prev for interpolation
    s.prevPlayerX = playerPos.x;
    s.prevPlayerZ = playerPos.z;

    // ── Player input ───────────────────────────────────────
    if (input.isHeld('dpadLeft'))  playerPos.x -= PLAYER_SPEED_X * dt;
    if (input.isHeld('dpadRight')) playerPos.x += PLAYER_SPEED_X * dt;
    if (input.isHeld('dpadUp'))    playerPos.z += PLAYER_SPEED_Z * dt;
    if (input.isHeld('dpadDown'))  playerPos.z -= PLAYER_SPEED_Z * dt;

    playerPos.x = clamp(playerPos.x, PLAYER_HALF_W, TERRAIN_WORLD_W - PLAYER_HALF_W);
    playerPos.z = clamp(playerPos.z, 0, PLAYER_MAX_Z);

    // Fire (A)
    s.fireCD = Math.max(0, s.fireCD - dt);
    if (input.isHeld('A') && s.fireCD <= 0) {
      spawnPlayerBullet(s.world, playerPos);
      s.fireCD = FIRE_COOLDOWN;
    }

    // Missile (B)
    s.missileCD = Math.max(0, s.missileCD - dt);
    if (input.isPressed('B') && s.missileCD <= 0) {
      spawnMissileSpread(s.world, playerPos);
      s.missileCD = MISSILE_COOLDOWN_TIME;
    }

    // Boost (C)
    s.boosting = input.isHeld('C') && s.boostFuel > BOOST_MIN_FUEL;
    if (s.boosting) {
      s.boostFuel = Math.max(0, s.boostFuel - BOOST_BURN_RATE * dt);
      s.cameraSpeed = s.baseSpeed * BOOST_SPEED_MULT;
      if (s.boostFuel <= 0) s.boosting = false;
    } else {
      s.boostFuel = Math.min(BOOST_FUEL_MAX, s.boostFuel + BOOST_RECHARGE_RATE * dt);
      s.cameraSpeed = s.baseSpeed;
    }

    // ── Camera advance ─────────────────────────────────────
    if (!s.cameraPaused) {
      s.cameraWorldY += s.cameraSpeed * dt;
      const maxY = s.terrain.levelWorldLength - 5 * CELL_SIZE;
      if (s.cameraWorldY >= maxY) s.cameraWorldY = maxY;
    }

    // Sync player Y with camera
    playerPos.y = s.cameraWorldY + PLAYER_AHEAD;

    // Sync iso camera
    s.syncIsoCamera();

    // ── ECS systems ────────────────────────────────────────
    movementSystem(s.world, dt);
    projectileSystem(s.world, s.cameraWorldY, dt);
    enemySystem(s.world, s.cameraWorldY, playerPos, dt);

    // ── Collision ──────────────────────────────────────────
    const kills = bulletEnemyCollision(s.world);
    for (const kill of kills) {
      this.gameState.addScore(kill.score);
      this.spawnSmallExplosion(kill.pos.x, kill.pos.y, kill.pos.z);
    }

    if (s.invincibleTimer <= 0) {
      if (bulletPlayerCollision(s.world, s.playerId)) {
        this.startExplosion();
        s.world.sweep();
        return;
      }
      if (s.terrain.checkCollision(playerPos.x, playerPos.y, playerPos.z, PLAYER_HALF_W)) {
        this.startExplosion();
        s.world.sweep();
        return;
      }
    }

    if (s.invincibleTimer > 0) s.invincibleTimer -= dt;

    // Sweep dead entities
    s.world.sweep();

    // Level end
    const endY = s.terrain.levelWorldLength - 5 * CELL_SIZE;
    if (s.cameraWorldY >= endY) {
      s.levelComplete = true;
      s.levelCompleteTimer = 0;
      this.gameState.altitude = playerPos.z / Z_UNIT;
    }

    this.gameState.altitude = playerPos.z / Z_UNIT;
  }

  render(engine: EngineAPI, alpha: number): void {
    this.state.engineTime = engine.getTime();
    this.activeView.render(engine.renderer, this.state, alpha);
    this.activeView.renderHUD(engine.renderer, this.state);
  }

  exit(_engine: EngineAPI): void {
    // cleanup
  }

  // ── View toggle ──────────────────────────────────────────

  private toggleView(): void {
    this.activeView = this.activeView === this.isoView ? this.fpvView : this.isoView;
    this.activeView.activate(this.state);
  }

  // ── Explosions ───────────────────────────────────────────

  private startExplosion(): void {
    const s = this.state;
    const pos = s.world.pos.get(s.playerId)!;
    s.alive = false;
    s.exploding = true;
    s.explosionTimer = 0;
    s.respawnTimer = 0;
    s.cameraPaused = true;

    const colors = ['#ff4400', '#ff8800', '#ffcc00', '#ffffff', '#ff2200'];
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const hSpeed = 30 + Math.random() * 80;
      s.explosionParticles.push({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(angle) * hSpeed,
        vy: Math.sin(angle) * hSpeed * 0.5,
        vz: 50 + Math.random() * 100,
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
      p.z += p.vz * dt;
      p.vz -= PARTICLE_GRAVITY * dt;
      p.life -= dt;
    }
    s.explosionParticles = s.explosionParticles.filter((p) => p.life > 0);

    if (s.explosionTimer > EXPLOSION_DURATION) {
      s.respawnTimer += dt;
      if (s.respawnTimer > RESPAWN_DELAY) {
        if (this.gameState.loseLife()) {
          this.respawn();
        } else {
          engine.setMode('gameover');
        }
      }
    }
  }

  private respawn(): void {
    const s = this.state;
    const pos = s.world.pos.get(s.playerId)!;
    pos.x = TERRAIN_WORLD_W / 2;
    pos.z = 200; // mid altitude
    s.prevPlayerX = pos.x;
    s.prevPlayerZ = pos.z;
    s.alive = true;
    s.exploding = false;
    s.explosionTimer = 0;
    s.respawnTimer = 0;
    s.invincibleTimer = 2.0;
    s.boostFuel = BOOST_FUEL_MAX;
    s.boosting = false;
    s.cameraSpeed = s.baseSpeed;
    s.cameraPaused = false;
    s.explosionParticles = [];

    // Remove all projectiles
    for (const [id] of s.world.proj) {
      s.world.markDead(id);
    }
    s.world.sweep();
  }

  private spawnSmallExplosion(x: number, y: number, z: number): void {
    const s = this.state;
    const colors = ['#ff4400', '#ff8800', '#ffcc00', '#ffffff'];
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const hSpeed = 20 + Math.random() * 50;
      s.explosionParticles.push({
        x, y, z,
        vx: Math.cos(angle) * hSpeed,
        vy: Math.sin(angle) * hSpeed * 0.3,
        vz: 30 + Math.random() * 60,
        life: 0.3 + Math.random() * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }
}
