/**
 * Configurable mapping from physical inputs to abstract actions.
 * Supports multiple keys per action and multiple actions per key.
 */

/** Standard game actions */
export type GameAction =
  | 'moveLeft'
  | 'moveRight'
  | 'moveUp'
  | 'moveDown'
  | 'fire'       // A button
  | 'altFire'    // B button
  | 'special'    // C button
  | 'actionX'    // X button
  | 'actionY'    // Y button
  | 'bumperL'    // L bumper
  | 'bumperR'    // R bumper
  | 'pause'
  | 'confirm'
  | 'cancel';

export interface InputMapConfig {
  keyboard: Record<string, GameAction[]>;
  gamepad?: Record<string, GameAction[]>;
}

/**
 * Default keyboard mapping.
 *
 * Left hand: WASD for movement.
 * Right hand: SNES-style diamond on JKL/I keys:
 *       I (X)
 *   J (Y)   L (A)
 *       K (B)
 * Plus: U = C (special), O = R bumper, Q/Tab = L bumper
 *
 * Legacy: arrows for movement, Space/Z = fire
 */
export const DEFAULT_INPUT_MAP: InputMapConfig = {
  keyboard: {
    // Movement — left hand (WASD) + arrows
    'ArrowLeft': ['moveLeft'],
    'ArrowRight': ['moveRight'],
    'ArrowUp': ['moveUp'],
    'ArrowDown': ['moveDown'],
    'KeyA': ['moveLeft'],
    'KeyD': ['moveRight'],
    'KeyW': ['moveUp'],
    'KeyS': ['moveDown'],

    // Action buttons — right hand diamond (JKLI)
    'KeyL': ['fire'],         // A — right of diamond
    'KeyK': ['altFire'],      // B — bottom of diamond
    'KeyJ': ['actionY'],      // Y — left of diamond
    'KeyI': ['actionX'],      // X — top of diamond
    'KeyU': ['special'],      // C — above-left
    'KeyO': ['bumperR'],      // R bumper
    'KeyQ': ['bumperL'],      // L bumper

    // Legacy / convenience
    'Space': ['fire'],
    'KeyZ': ['fire'],
    'KeyX': ['altFire'],
    'KeyC': ['special'],

    // System
    'Escape': ['pause'],
    'Enter': ['confirm', 'pause'],
    'Backspace': ['cancel'],
  },
  gamepad: {
    'button0': ['fire', 'confirm'],     // A
    'button1': ['altFire', 'cancel'],   // B
    'button2': ['actionX'],             // X
    'button3': ['actionY'],             // Y
    'button4': ['bumperL'],             // L bumper
    'button5': ['bumperR'],             // R bumper
    'button9': ['pause'],
    'axisLeft-': ['moveLeft'],
    'axisLeft+': ['moveRight'],
    'axisUp-': ['moveUp'],
    'axisUp+': ['moveDown'],
    'dpadLeft': ['moveLeft'],
    'dpadRight': ['moveRight'],
    'dpadUp': ['moveUp'],
    'dpadDown': ['moveDown'],
  },
};
