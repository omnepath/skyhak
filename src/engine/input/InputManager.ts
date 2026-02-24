import type { InputAdapter } from './InputAdapter';
import { InputSnapshot } from './InputSnapshot';

/**
 * Orchestrates input adapters and produces InputSnapshots each tick.
 *
 * Composites results from all active adapters (keyboard, gamepad, etc.).
 * Tracks held/pressed/released state transitions between ticks.
 */
export class InputManager {
  private adapters: InputAdapter[] = [];
  private prevActions = new Set<string>();
  private currentSnapshot: InputSnapshot = InputSnapshot.empty();

  addAdapter(adapter: InputAdapter): void {
    this.adapters.push(adapter);
    adapter.connect();
  }

  removeAdapter(adapterId: string): void {
    const idx = this.adapters.findIndex((a) => a.id === adapterId);
    if (idx !== -1) {
      this.adapters[idx].disconnect();
      this.adapters.splice(idx, 1);
    }
  }

  /** Call once per tick to produce a new snapshot */
  poll(): InputSnapshot {
    const held = new Set<string>();

    for (const adapter of this.adapters) {
      if (!adapter.isConnected()) continue;
      const actions = adapter.poll();
      for (const a of actions) held.add(a);
    }

    const pressed = new Set<string>();
    const released = new Set<string>();

    for (const a of held) {
      if (!this.prevActions.has(a)) pressed.add(a);
    }
    for (const a of this.prevActions) {
      if (!held.has(a)) released.add(a);
    }

    this.prevActions = held;
    this.currentSnapshot = new InputSnapshot(held, pressed, released);
    return this.currentSnapshot;
  }

  /** Get the most recent snapshot without polling */
  getSnapshot(): InputSnapshot {
    return this.currentSnapshot;
  }

  dispose(): void {
    for (const adapter of this.adapters) {
      adapter.disconnect();
    }
    this.adapters = [];
  }
}
