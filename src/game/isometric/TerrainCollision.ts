/**
 * Height-based terrain collision detection.
 *
 * The player crashes if their altitude is lower than the terrain
 * height at their position. Checks the terrain height under the
 * player's bounding area (not just a single point).
 */

import type { TerrainData } from '../data/terrain';
import { TERRAIN_TILE_W } from '../data/terrain';

export interface CollisionResult {
  collided: boolean;
  terrainHeight: number;  // height of the tallest terrain under the player
  gridCol: number;        // terrain column the player is in
  gridRow: number;        // terrain row the player is over
}

export class TerrainCollision {
  private terrain: TerrainData;
  private offsetX: number;

  constructor(terrain: TerrainData, screenWidth: number) {
    this.terrain = terrain;
    this.offsetX = (screenWidth - terrain.width * TERRAIN_TILE_W) / 2;
  }

  /**
   * Check if the player collides with terrain.
   *
   * @param playerScreenX - Player center X in screen pixels
   * @param playerRow - Terrain row the player is over (from camera)
   * @param playerAltitude - Player's current altitude (0-4)
   * @param playerWidth - Player hitbox width in pixels
   */
  check(
    playerScreenX: number,
    playerRow: number,
    playerAltitude: number,
    playerWidth: number,
  ): CollisionResult {
    // Map screen X to terrain column
    const centerCol = (playerScreenX - this.offsetX) / TERRAIN_TILE_W;
    const halfWidthCols = (playerWidth / 2) / TERRAIN_TILE_W;

    // Check columns that the player overlaps
    const minCol = Math.floor(centerCol - halfWidthCols);
    const maxCol = Math.floor(centerCol + halfWidthCols);
    const row = Math.floor(playerRow);

    let maxTerrainHeight = 0;

    for (let c = minCol; c <= maxCol; c++) {
      const h = this.getHeight(row, c);
      if (h > maxTerrainHeight) {
        maxTerrainHeight = h;
      }
      // Also check the row in front (row + 1) for border cases
      const hNext = this.getHeight(row + 1, c);
      if (hNext > maxTerrainHeight) {
        maxTerrainHeight = hNext;
      }
    }

    return {
      collided: maxTerrainHeight > playerAltitude,
      terrainHeight: maxTerrainHeight,
      gridCol: Math.floor(centerCol),
      gridRow: row,
    };
  }

  /** Get terrain height at a grid position, returning 4 for out-of-bounds (walls) */
  getHeight(row: number, col: number): number {
    if (row < 0 || row >= this.terrain.rows.length) return 0;
    if (col < 0 || col >= this.terrain.width) return 4; // out of bounds = wall
    return Math.max(0, this.terrain.rows[row][col]);
  }

  updateTerrain(terrain: TerrainData, screenWidth: number): void {
    this.terrain = terrain;
    this.offsetX = (screenWidth - terrain.width * TERRAIN_TILE_W) / 2;
  }
}
