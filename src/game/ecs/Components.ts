/**
 * ECS component types and world-space constants.
 *
 * World coordinate system:
 *   X: horizontal (0 to TERRAIN_COLS × CELL_SIZE), terrain-relative
 *   Y: depth/forward (0 = level start, positive = forward)
 *   Z: height/altitude (0 = ground, 400 = max)
 *
 * 1 terrain cell = CELL_SIZE × CELL_SIZE world units (square in world space).
 * 1 terrain height level = Z_UNIT world Z units.
 */

import { TERRAIN_COLS } from '../data/terrain';

// ── World-space constants ──────────────────────────────────────

/** World units per terrain cell (X width and Y depth) */
export const CELL_SIZE = 28;

/** World Z units per terrain height level (height 0-4 → Z 0-400) */
export const Z_UNIT = 100;

/** Total terrain width in world units */
export const TERRAIN_WORLD_W = TERRAIN_COLS * CELL_SIZE;

/** Iso view: screen pixels per altitude level */
export const ISO_ALT_PX = 3;

/** Player's fixed world-Y distance ahead of camera */
export const PLAYER_AHEAD = 80; // (240 - 200) / 14 * 28

// ── Game constants in world units ──────────────────────────────

export const PLAYER_SPEED_X = 100;       // horizontal, world units/s
export const PLAYER_SPEED_Z = 300;       // altitude, world Z units/s
export const PLAYER_MAX_Z = 400;         // max altitude
export const PLAYER_HALF_W = 7;          // half-width for collision

export const CAMERA_BASE_SPEED = 70;     // world Y units/s (≈ 2.5 rows/s)

export const BULLET_SPEED = 400;         // world Y units/s forward
export const BULLET_LIFE = 2.0;          // seconds
export const FIRE_COOLDOWN = 0.2;        // seconds between shots

export const MISSILE_SPEED = 350;        // world units/s magnitude
export const MISSILE_SPREAD_ANGLE = 0.6; // radians total fan
export const MISSILE_COUNT = 5;
export const MISSILE_COOLDOWN_TIME = 10.0;
export const MISSILE_LIFE = 1.5;

export const ENEMY_BULLET_SPEED = 150;   // world units/s magnitude
export const ENEMY_FIRE_RATE = 3.0;      // seconds between shots
export const ENEMY_TURRET_HP = 2;
export const ENEMY_TURRET_SCORE = 100;

export const BOOST_FUEL_MAX = 1.0;
export const BOOST_BURN_RATE = 0.4;
export const BOOST_RECHARGE_RATE = 0.1;
export const BOOST_SPEED_MULT = 2.5;
export const BOOST_MIN_FUEL = 0.05;

export const HIT_RADIUS = 15;             // world-space collision radius
export const PROJ_CULL_BEHIND = 100;       // world Y behind camera
export const PROJ_CULL_AHEAD = 800;        // world Y ahead of camera
export const ENEMY_ACTIVATE_DIST = 600;    // world Y ahead of camera
export const ENEMY_CULL_BEHIND = 100;      // world Y behind camera

export const EXPLOSION_DURATION = 1.5;
export const RESPAWN_DELAY = 2.0;
export const PARTICLE_GRAVITY = 400;       // world Z units/s²

// ── Component interfaces ───────────────────────────────────────

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Velocity {
  vx: number;
  vy: number;
  vz: number;
}

export type Collider =
  | { type: 'point' }
  | { type: 'sphere'; radius: number }
  | { type: 'box'; halfW: number; halfD: number; halfH: number };

export type ProjectileType = 'bullet' | 'missile' | 'enemy';

export interface ProjectileTag {
  fromPlayer: boolean;
  pType: ProjectileType;
  life: number;
}

export type EnemyType = 'turret';

export interface EnemyAI {
  eType: EnemyType;
  fireCooldown: number;
  active: boolean;
}

export interface Health {
  hp: number;
  maxHp: number;
}

// ── Render properties (for views) ──────────────────────────────

export const ENEMY_RENDER: Record<EnemyType, { color: string; size: number }> = {
  turret: { color: '#cc4444', size: 8 },
};
