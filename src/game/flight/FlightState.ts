/**
 * Shared flight state — holds ECS world, camera, and game data.
 * Updated by IsometricMode, read by view renderers.
 */

import type { TerrainData } from '../data/terrain';
import type { LevelPalette } from '../data/palettes';
import type { MissionDef } from '../data/levels';
import type { GameState } from '../GameState';
import type { IsometricCamera } from '../isometric/IsometricCamera';
import { World } from '../ecs/World';
import type { WorldTerrain } from '../ecs/WorldTerrain';
import {
  CELL_SIZE, BOOST_FUEL_MAX, CAMERA_BASE_SPEED, TERRAIN_WORLD_W,
} from '../ecs/Components';

export interface ExplosionParticle {
  x: number;  // world X
  y: number;  // world Y
  z: number;  // world Z
  vx: number;
  vy: number;
  vz: number;
  life: number;
  color: string;
}

export class FlightState {
  // ── ECS ────────────────────────────────────────────────────
  world = new World();
  playerId = 0;
  terrain!: WorldTerrain;

  // ── Camera (world space) ───────────────────────────────────
  cameraWorldY = 0;
  cameraSpeed = CAMERA_BASE_SPEED;
  cameraPaused = false;

  // ── Iso camera (synced for terrain rendering) ──────────────
  isoCamera!: IsometricCamera;

  // ── Level data ─────────────────────────────────────────────
  rawTerrain!: TerrainData;
  palette!: LevelPalette;
  mission!: MissionDef;
  gameState: GameState;

  // ── Player-specific state ──────────────────────────────────
  prevPlayerX = TERRAIN_WORLD_W / 2;
  prevPlayerZ = 200;
  alive = true;
  invincibleTimer = 0;
  fireCD = 0;
  missileCD = 0;
  boostFuel = BOOST_FUEL_MAX;
  boosting = false;
  baseSpeed = CAMERA_BASE_SPEED;

  // ── Explosion ──────────────────────────────────────────────
  exploding = false;
  explosionTimer = 0;
  explosionParticles: ExplosionParticle[] = [];
  respawnTimer = 0;

  // ── Level ──────────────────────────────────────────────────
  levelComplete = false;
  levelCompleteTimer = 0;

  // ── Screen ─────────────────────────────────────────────────
  screenWidth = 256;
  screenHeight = 240;
  terrainOffsetX = 0;
  engineTime = 0;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /** Sync iso camera from world-space camera position */
  syncIsoCamera(): void {
    this.isoCamera.scrollY = this.cameraWorldY / CELL_SIZE;
  }

  /** Compute terrain offset for screen centering */
  updateTerrainOffset(): void {
    this.terrainOffsetX = (this.screenWidth - TERRAIN_WORLD_W) / 2;
  }
}
