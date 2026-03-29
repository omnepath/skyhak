/**
 * Simple entity types for the isometric flight mode.
 *
 * Enemies and projectiles are lightweight data objects managed
 * as arrays in IsometricMode. No ECS overhead — just update loops.
 */

export interface Projectile {
  x: number;
  y: number;         // screen Y
  altitude: number;  // for terrain collision
  vx: number;
  vy: number;        // screen velocity (negative = moves up-screen / forward)
  fromPlayer: boolean;
  life: number;      // seconds remaining
}

export interface Enemy {
  x: number;
  row: number;       // terrain row position (world space)
  altitude: number;
  health: number;
  type: EnemyType;
  /** Cooldown until next shot */
  fireCooldown: number;
  /** Whether this enemy has been activated (scrolled into view) */
  active: boolean;
  /** Dead flag — will be removed on next sweep */
  dead: boolean;
}

export type EnemyType = 'turret';

// ── Enemy type definitions ────────────────────────────────

export const ENEMY_DEFS: Record<EnemyType, {
  health: number;
  fireRate: number;       // seconds between shots
  projectileSpeed: number;
  score: number;
  color: string;
  size: number;
}> = {
  turret: {
    health: 2,
    fireRate: 3.0,        // one shot every 3 seconds
    projectileSpeed: 60,  // px/s — slower than player bullets
    score: 100,
    color: '#cc4444',
    size: 8,
  },
};

// ── Player weapon definitions ─────────────────────────────

export const PLAYER_BULLET_SPEED = 180; // px/s upward
export const PLAYER_FIRE_COOLDOWN = 0.2; // 5 shots per second
export const PROJECTILE_LIFETIME = 2.0;  // seconds
