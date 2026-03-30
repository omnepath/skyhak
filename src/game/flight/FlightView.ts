/**
 * Interface for flight mode view renderers.
 * Both the isometric top-down view and the first-person cockpit view
 * implement this interface, reading from the same FlightState.
 */

import type { Renderer } from '../../engine/render/Renderer';
import type { FlightState } from './FlightState';

export type ViewMode = 'isometric' | 'firstperson';

export interface FlightView {
  readonly mode: ViewMode;

  /** Called when the view becomes active (e.g., to set up sub-renderers) */
  activate(state: FlightState): void;

  /** Render the game world */
  render(r: Renderer, state: FlightState, alpha: number): void;

  /** Render the HUD overlay */
  renderHUD(r: Renderer, state: FlightState): void;
}
