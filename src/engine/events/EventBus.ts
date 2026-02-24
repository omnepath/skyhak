/**
 * Typed publish/subscribe event bus.
 * Used for decoupled communication between engine subsystems and game modes.
 */

type Listener<T = unknown> = (data: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<Listener>>();

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<T = unknown>(event: string, listener: Listener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(listener as Listener);

    return () => {
      set.delete(listener as Listener);
      if (set.size === 0) this.listeners.delete(event);
    };
  }

  /** Subscribe to an event, but only fire once */
  once<T = unknown>(event: string, listener: Listener<T>): () => void {
    const unsub = this.on<T>(event, (data) => {
      unsub();
      listener(data);
    });
    return unsub;
  }

  /** Emit an event to all subscribers */
  emit<T = unknown>(event: string, data?: T): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      listener(data);
    }
  }

  /** Remove all listeners for a specific event, or all events */
  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
