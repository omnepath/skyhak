/**
 * ECS systems — pure functions that operate on World state.
 * Called by IsometricMode each frame in a fixed order.
 */

import { World } from './World';
import type { WorldTerrain } from './WorldTerrain';
import type { Position } from './Components';
import {
  CELL_SIZE, TERRAIN_WORLD_W,
  BULLET_SPEED, BULLET_LIFE, MISSILE_SPEED, MISSILE_SPREAD_ANGLE,
  MISSILE_COUNT, MISSILE_LIFE, ENEMY_BULLET_SPEED, ENEMY_FIRE_RATE,
  ENEMY_TURRET_HP, ENEMY_TURRET_SCORE, HIT_RADIUS,
  PROJ_CULL_BEHIND, PROJ_CULL_AHEAD,
  ENEMY_ACTIVATE_DIST, ENEMY_CULL_BEHIND,
} from './Components';

// ── Movement ───────────────────────────────────────────────────

/** Apply velocity to position for all entities with both */
export function movementSystem(world: World, dt: number): void {
  for (const [id, vel] of world.vel) {
    const pos = world.pos.get(id);
    if (!pos) continue;
    pos.x += vel.vx * dt;
    pos.y += vel.vy * dt;
    pos.z += vel.vz * dt;
  }
}

// ── Projectile lifecycle ───────────────────────────────────────

/** Decrement life, cull expired and out-of-bounds projectiles */
export function projectileSystem(world: World, cameraWorldY: number, dt: number): void {
  for (const [id, proj] of world.proj) {
    proj.life -= dt;
    if (proj.life <= 0) {
      world.markDead(id);
      continue;
    }

    const pos = world.pos.get(id);
    if (!pos) continue;

    if (pos.y > cameraWorldY + PROJ_CULL_AHEAD ||
        pos.y < cameraWorldY - PROJ_CULL_BEHIND) {
      world.markDead(id);
      continue;
    }

    if (pos.x < -50 || pos.x > TERRAIN_WORLD_W + 50) {
      world.markDead(id);
    }
  }
}

// ── Enemy AI ───────────────────────────────────────────────────

/** Activate enemies near camera, manage fire cooldowns, cull far-behind */
export function enemySystem(
  world: World,
  cameraWorldY: number,
  playerPos: Position,
  dt: number,
): void {
  for (const [id, eai] of world.eai) {
    const pos = world.pos.get(id);
    if (!pos) continue;

    const aheadDist = pos.y - cameraWorldY;

    // Activate when scrolled into view
    if (aheadDist >= 0 && aheadDist < ENEMY_ACTIVATE_DIST) {
      eai.active = true;
    }

    // Cull if far behind camera
    if (aheadDist < -ENEMY_CULL_BEHIND) {
      world.markDead(id);
      continue;
    }

    if (!eai.active) continue;

    eai.fireCooldown -= dt;
    if (eai.fireCooldown <= 0) {
      spawnEnemyBullet(world, pos, playerPos);
      eai.fireCooldown = ENEMY_FIRE_RATE + (Math.random() - 0.5) * 1.0;
    }
  }
}

function spawnEnemyBullet(world: World, origin: Position, target: Position): void {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < 1) return;

  const id = world.spawn();
  world.pos.set(id, { x: origin.x, y: origin.y, z: origin.z });
  world.vel.set(id, {
    vx: (dx / dist) * ENEMY_BULLET_SPEED,
    vy: (dy / dist) * ENEMY_BULLET_SPEED,
    vz: (dz / dist) * ENEMY_BULLET_SPEED,
  });
  world.col.set(id, { type: 'point' });
  world.proj.set(id, { fromPlayer: false, pType: 'enemy', life: BULLET_LIFE });
}

// ── Player firing ──────────────────────────────────────────────

/** Spawn a player bullet entity */
export function spawnPlayerBullet(world: World, playerPos: Position): void {
  const id = world.spawn();
  world.pos.set(id, { x: playerPos.x, y: playerPos.y, z: playerPos.z });
  world.vel.set(id, { vx: 0, vy: BULLET_SPEED, vz: 0 });
  world.col.set(id, { type: 'point' });
  world.proj.set(id, { fromPlayer: true, pType: 'bullet', life: BULLET_LIFE });
}

/** Spawn a missile fan from player position */
export function spawnMissileSpread(world: World, playerPos: Position): void {
  const halfSpread = MISSILE_SPREAD_ANGLE / 2;
  const count = MISSILE_COUNT;

  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0 : (i / (count - 1)) * 2 - 1;
    // Spread in XY plane: angle 0 = straight forward (+Y)
    const spreadAngle = t * halfSpread;
    const vx = Math.sin(spreadAngle) * MISSILE_SPEED;
    const vy = Math.cos(spreadAngle) * MISSILE_SPEED;

    const id = world.spawn();
    world.pos.set(id, { x: playerPos.x, y: playerPos.y, z: playerPos.z });
    world.vel.set(id, { vx, vy, vz: 0 });
    world.col.set(id, { type: 'point' });
    world.proj.set(id, { fromPlayer: true, pType: 'missile', life: MISSILE_LIFE });
  }
}

// ── Collision ──────────────────────────────────────────────────

export interface HitEvent {
  enemyId: number;
  pos: Position;
  score: number;
}

/** Check player projectiles vs enemies. Returns kill events. */
export function bulletEnemyCollision(world: World): HitEvent[] {
  const kills: HitEvent[] = [];

  for (const [pid, proj] of world.proj) {
    if (!proj.fromPlayer || proj.life <= 0) continue;
    const ppos = world.pos.get(pid);
    if (!ppos) continue;

    for (const [eid, _eai] of world.eai) {
      const epos = world.pos.get(eid);
      if (!epos) continue;
      const hp = world.hp.get(eid);
      if (!hp || hp.hp <= 0) continue;

      const dx = ppos.x - epos.x;
      const dy = ppos.y - epos.y;
      const dz = ppos.z - epos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < HIT_RADIUS) {
        hp.hp--;
        proj.life = 0;
        world.markDead(pid);

        if (hp.hp <= 0) {
          world.markDead(eid);
          kills.push({
            enemyId: eid,
            pos: { x: epos.x, y: epos.y, z: epos.z },
            score: ENEMY_TURRET_SCORE,
          });
        }
        break; // bullet consumed
      }
    }
  }

  return kills;
}

/** Check enemy projectiles vs player. Returns true if player hit. */
export function bulletPlayerCollision(world: World, playerId: number): boolean {
  const playerPos = world.pos.get(playerId);
  if (!playerPos) return false;

  for (const [pid, proj] of world.proj) {
    if (proj.fromPlayer || proj.life <= 0) continue;
    const ppos = world.pos.get(pid);
    if (!ppos) continue;

    const dx = ppos.x - playerPos.x;
    const dy = ppos.y - playerPos.y;
    const dz = ppos.z - playerPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < HIT_RADIUS) {
      proj.life = 0;
      world.markDead(pid);
      return true;
    }
  }

  return false;
}

// ── Enemy spawning ─────────────────────────────────────────────

/** Spawn turret enemies at flat terrain positions */
export function spawnEnemies(
  world: World,
  terrainRows: number[][],
  terrainWidth: number,
): void {
  const totalRows = terrainRows.length;
  const spacing = Math.max(12, Math.floor(totalRows / 10));

  for (let i = spacing; i < totalRows - 10; i += spacing) {
    const row = terrainRows[i];
    if (!row) continue;

    let bestCol = -1;
    for (let c = 2; c < terrainWidth - 2; c++) {
      if (row[c] === 0) { bestCol = c; break; }
    }
    if (bestCol === -1) {
      for (let c = terrainWidth - 3; c >= 2; c--) {
        if (row[c] === 0) { bestCol = c; break; }
      }
    }
    if (bestCol === -1) continue;

    const id = world.spawn();
    world.pos.set(id, {
      x: bestCol * CELL_SIZE + CELL_SIZE / 2,
      y: i * CELL_SIZE,
      z: 0,
    });
    world.col.set(id, { type: 'sphere', radius: 12 });
    world.hp.set(id, { hp: ENEMY_TURRET_HP, maxHp: ENEMY_TURRET_HP });
    world.eai.set(id, {
      eType: 'turret',
      fireCooldown: 1.0 + Math.random() * 2.0,
      active: false,
    });
  }
}
