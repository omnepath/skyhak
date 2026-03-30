/**
 * Shared flight state — holds all game data for the flight mode.
 * Updated by IsometricMode (the game logic owner), read by view renderers.
 *
 * This is a pure data container — no update logic.
 */

import type { IsometricCamera } from '../isometric/IsometricCamera';
import type { TerrainData } from '../data/terrain';
import type { LevelPalette } from '../data/palettes';
import type { MissionDef } from '../data/levels';
import type { GameState } from '../GameState';
import type { Projectile, Enemy } from '../entities/Entities';
import { BOOST_FUEL_MAX } from '../entities/Entities';
import { TERRAIN_TILE_W, TERRAIN_COLS } from '../data/terrain';

export interface ExplosionParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export class FlightState {
  // Core references (set during enter())
  camera!: IsometricCamera;
  terrain!: TerrainData;
  palette!: LevelPalette;
  mission!: MissionDef;
  gameState: GameState;

  // Player
  playerX = 128;
  prevPlayerX = 128;
  playerAltitude = 2;
  prevAltitude = 2;
  alive = true;
  invincibleTimer = 0;

  // Explosion
  exploding = false;
  explosionTimer = 0;
  explosionParticles: ExplosionParticle[] = [];
  respawnTimer = 0;

  // Level
  levelComplete = false;
  levelCompleteTimer = 0;

  // Screen
  screenWidth = 256;
  screenHeight = 240;
  terrainOffsetX = 0;
  engineTime = 0;

  // Combat
  projectiles: Projectile[] = [];
  enemies: Enemy[] = [];
  playerFireCooldown = 0;
  missileCooldown = 0;

  // Boost
  boostFuel = BOOST_FUEL_MAX;
  boosting = false;
  baseScrollSpeed = 0;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /** Recalculate terrain horizontal offset */
  updateTerrainOffset(): void {
    this.terrainOffsetX = (this.screenWidth - TERRAIN_COLS * TERRAIN_TILE_W) / 2;
  }

  /** Reset combat state for respawn */
  resetCombat(): void {
    this.projectiles = [];
    this.boosting = false;
    this.boostFuel = BOOST_FUEL_MAX;
  }
}
