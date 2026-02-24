import type { InputAdapter } from './InputAdapter';
import type { InputMapConfig } from './InputMap';

/**
 * Gamepad API input adapter.
 * Polls connected gamepads each tick and maps buttons/axes to abstract actions.
 */
export class GamepadAdapter implements InputAdapter {
  readonly id = 'gamepad';
  private connected = false;
  private buttonMap: Record<string, string[]>;
  private deadzone = 0.3;

  constructor(mapConfig: InputMapConfig) {
    this.buttonMap = mapConfig.gamepad ?? {};
  }

  connect(): void {
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
  }

  isConnected(): boolean {
    if (!this.connected) return false;
    const gamepads = navigator.getGamepads();
    return gamepads.some((gp) => gp !== null);
  }

  poll(): Set<string> {
    const actions = new Set<string>();
    const gamepads = navigator.getGamepads();

    for (const gp of gamepads) {
      if (!gp) continue;

      // Buttons
      for (let i = 0; i < gp.buttons.length; i++) {
        if (gp.buttons[i].pressed) {
          const key = `button${i}`;
          const mapped = this.buttonMap[key];
          if (mapped) {
            for (const a of mapped) actions.add(a);
          }
        }
      }

      // D-pad (buttons 12-15 on standard mapping)
      if (gp.buttons[12]?.pressed) this.addMapped('dpadUp', actions);
      if (gp.buttons[13]?.pressed) this.addMapped('dpadDown', actions);
      if (gp.buttons[14]?.pressed) this.addMapped('dpadLeft', actions);
      if (gp.buttons[15]?.pressed) this.addMapped('dpadRight', actions);

      // Left stick axes
      if (gp.axes.length >= 2) {
        if (gp.axes[0] < -this.deadzone) this.addMapped('axisLeft-', actions);
        if (gp.axes[0] > this.deadzone) this.addMapped('axisLeft+', actions);
        if (gp.axes[1] < -this.deadzone) this.addMapped('axisUp-', actions);
        if (gp.axes[1] > this.deadzone) this.addMapped('axisUp+', actions);
      }
    }

    return actions;
  }

  private addMapped(key: string, actions: Set<string>): void {
    const mapped = this.buttonMap[key];
    if (mapped) {
      for (const a of mapped) actions.add(a);
    }
  }

  updateMap(mapConfig: InputMapConfig): void {
    this.buttonMap = mapConfig.gamepad ?? {};
  }
}
