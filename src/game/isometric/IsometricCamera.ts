/**
 * Camera for the isometric scrolling view.
 *
 * The camera auto-scrolls forward through the terrain (increasing row index).
 * On screen, terrain scrolls downward toward the player.
 *
 * Coordinate system:
 * - Camera Y (scrollY) = progress through the level in row units
 * - screenY for a terrain row = screenHeight - (row - scrollY) * tileH
 * - Higher rows are further ahead (top of screen)
 * - Lower rows are behind (bottom of screen)
 */

import { TERRAIN_TILE_H } from '../data/terrain';

export class IsometricCamera {
  scrollY = 0;            // current scroll position in row units
  scrollSpeed = 2.5;      // rows per second
  private paused = false;
  private screenHeight: number;
  private levelLength: number;

  constructor(screenHeight: number, levelLength: number, scrollSpeed: number) {
    this.screenHeight = screenHeight;
    this.levelLength = levelLength;
    this.scrollSpeed = scrollSpeed;
  }

  update(dt: number): void {
    if (this.paused) return;
    this.scrollY += this.scrollSpeed * dt;

    // Stop at end of level
    if (this.scrollY >= this.levelLength - 5) {
      this.scrollY = this.levelLength - 5;
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  /** Convert a terrain row index to a screen Y position */
  rowToScreenY(row: number): number {
    return this.screenHeight - (row - this.scrollY) * TERRAIN_TILE_H;
  }

  /** Get the range of visible rows (inclusive) */
  getVisibleRows(): { minRow: number; maxRow: number } {
    // The bottom of the screen corresponds to scrollY
    // The top corresponds to scrollY + screenHeight / tileH
    const visibleRows = Math.ceil(this.screenHeight / TERRAIN_TILE_H) + 4;
    const minRow = Math.max(0, Math.floor(this.scrollY) - 2);
    const maxRow = Math.min(this.levelLength - 1, minRow + visibleRows);
    return { minRow, maxRow };
  }

  /** What terrain row is under a given screen Y position */
  screenYToRow(screenY: number): number {
    return this.scrollY + (this.screenHeight - screenY) / TERRAIN_TILE_H;
  }

  /** Progress through the level as 0-1 */
  get progress(): number {
    return this.scrollY / this.levelLength;
  }

  /** Has the camera reached the end of the level */
  get atEnd(): boolean {
    return this.scrollY >= this.levelLength - 5;
  }

  reset(scrollSpeed: number, levelLength: number): void {
    this.scrollY = 0;
    this.scrollSpeed = scrollSpeed;
    this.levelLength = levelLength;
    this.paused = false;
  }
}
