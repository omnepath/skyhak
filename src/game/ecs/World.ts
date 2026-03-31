/**
 * Simple ECS world — entity IDs and component maps.
 * For the small entity counts of a retro shooter, Maps are fine.
 */

import type {
  Position, Velocity, Collider, ProjectileTag, EnemyAI, Health,
} from './Components';

export class World {
  private nextId = 1;

  /** All living entity IDs */
  alive = new Set<number>();

  /** Entities pending removal */
  private pendingDead: number[] = [];

  // ── Component maps ─────────────────────────────────────────

  pos = new Map<number, Position>();
  vel = new Map<number, Velocity>();
  col = new Map<number, Collider>();
  proj = new Map<number, ProjectileTag>();
  eai = new Map<number, EnemyAI>();
  hp = new Map<number, Health>();

  // ── Lifecycle ──────────────────────────────────────────────

  spawn(): number {
    const id = this.nextId++;
    this.alive.add(id);
    return id;
  }

  markDead(id: number): void {
    this.pendingDead.push(id);
  }

  /** Remove all dead entities from component maps */
  sweep(): void {
    for (const id of this.pendingDead) {
      this.alive.delete(id);
      this.pos.delete(id);
      this.vel.delete(id);
      this.col.delete(id);
      this.proj.delete(id);
      this.eai.delete(id);
      this.hp.delete(id);
    }
    this.pendingDead.length = 0;
  }

  /** Wipe everything */
  clear(): void {
    this.alive.clear();
    this.pendingDead.length = 0;
    this.pos.clear();
    this.vel.clear();
    this.col.clear();
    this.proj.clear();
    this.eai.clear();
    this.hp.clear();
    this.nextId = 1;
  }
}
