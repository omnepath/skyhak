/**
 * Typed key-value data store.
 *
 * Game data (levels, enemies, weapons, etc.) is registered here.
 * Initially loaded from hard-coded TS modules, but the interface
 * supports swapping to external sources (fetch, WASM file system).
 */
export class DataRegistry {
  private store = new Map<string, unknown>();

  /** Register data under a namespaced key */
  set<T>(key: string, value: T): void {
    this.store.set(key, value);
  }

  /** Retrieve data by key */
  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  /** Retrieve data, throwing if not found */
  require<T>(key: string): T {
    const value = this.store.get(key);
    if (value === undefined) {
      throw new Error(`DataRegistry: missing required key '${key}'`);
    }
    return value as T;
  }

  /** Check if a key exists */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /** Remove a key */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /** List all registered keys */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  clear(): void {
    this.store.clear();
  }
}
