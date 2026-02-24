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
  | 'fire'
  | 'altFire'
  | 'special'
  | 'pause'
  | 'confirm'
  | 'cancel';

export interface InputMapConfig {
  keyboard: Record<string, GameAction[]>;
  gamepad?: Record<string, GameAction[]>;
}

/** Default keyboard mapping */
export const DEFAULT_INPUT_MAP: InputMapConfig = {
  keyboard: {
    'ArrowLeft': ['moveLeft'],
    'ArrowRight': ['moveRight'],
    'ArrowUp': ['moveUp'],
    'ArrowDown': ['moveDown'],
    'KeyA': ['moveLeft'],
    'KeyD': ['moveRight'],
    'KeyW': ['moveUp'],
    'KeyS': ['moveDown'],
    'Space': ['fire'],
    'KeyZ': ['fire'],
    'KeyX': ['altFire'],
    'KeyC': ['special'],
    'Escape': ['pause'],
    'Enter': ['confirm', 'pause'],
    'Backspace': ['cancel'],
  },
  gamepad: {
    'button0': ['fire', 'confirm'],
    'button1': ['altFire', 'cancel'],
    'button2': ['special'],
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
