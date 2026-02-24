import type { InputAdapter } from './InputAdapter';
import type { InputMapConfig } from './InputMap';

/**
 * Keyboard input adapter.
 * Listens for keydown/keyup events and maps physical keys to abstract actions
 * using the provided InputMapConfig.
 */
export class KeyboardAdapter implements InputAdapter {
  readonly id = 'keyboard';
  private keysDown = new Set<string>();
  private keyMap: Record<string, string[]>;
  private connected = false;

  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;

  constructor(mapConfig: InputMapConfig) {
    this.keyMap = mapConfig.keyboard;

    this.onKeyDown = (e: KeyboardEvent) => {
      if (this.keyMap[e.code]) {
        e.preventDefault();
        this.keysDown.add(e.code);
      }
    };

    this.onKeyUp = (e: KeyboardEvent) => {
      this.keysDown.delete(e.code);
    };
  }

  connect(): void {
    if (this.connected) return;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.connected = true;
  }

  disconnect(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.keysDown.clear();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  poll(): Set<string> {
    const actions = new Set<string>();
    for (const code of this.keysDown) {
      const mapped = this.keyMap[code];
      if (mapped) {
        for (const action of mapped) {
          actions.add(action);
        }
      }
    }
    return actions;
  }

  /** Update the key mapping at runtime */
  updateMap(mapConfig: InputMapConfig): void {
    this.keyMap = mapConfig.keyboard;
  }
}
