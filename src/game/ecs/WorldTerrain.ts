/**
 * World-space terrain queries.
 * Wraps the raw TerrainData (integer height grid) and provides
 * lookups in world coordinates.
 */

import type { TerrainData } from '../data/terrain';
import { TERRAIN_COLS } from '../data/terrain';
import { CELL_SIZE, Z_UNIT } from './Components';

export class WorldTerrain {
  private data: TerrainData;

  constructor(data: TerrainData) {
    this.data = data;
  }

  /** Get terrain Z height at a world (x, y) position */
  getHeight(worldX: number, worldY: number): number {
    const col = Math.floor(worldX / CELL_SIZE);
    const row = Math.floor(worldY / CELL_SIZE);
    if (col < 0 || col >= TERRAIN_COLS || row < 0 || row >= this.data.rows.length) {
      return 4 * Z_UNIT; // OOB = wall
    }
    return (this.data.rows[row][col] ?? 0) * Z_UNIT;
  }

  /** Check if entity at (x, y, z) with given half-width collides with terrain */
  checkCollision(worldX: number, worldY: number, worldZ: number, halfW: number): boolean {
    const row = Math.floor(worldY / CELL_SIZE);
    const minCol = Math.floor((worldX - halfW) / CELL_SIZE);
    const maxCol = Math.floor((worldX + halfW) / CELL_SIZE);

    for (const r of [row, Math.min(row + 1, this.data.rows.length - 1)]) {
      if (r < 0 || r >= this.data.rows.length) continue;
      for (let c = minCol; c <= maxCol; c++) {
        if (c < 0 || c >= TERRAIN_COLS) {
          if (worldZ < 4 * Z_UNIT) return true; // OOB wall
          continue;
        }
        const terrainZ = (this.data.rows[r][c] ?? 0) * Z_UNIT;
        if (terrainZ > worldZ) return true;
      }
    }
    return false;
  }

  /** Level length in world Y units */
  get levelWorldLength(): number {
    return this.data.rows.length * CELL_SIZE;
  }

  /** Access raw terrain data (for renderers) */
  get raw(): TerrainData {
    return this.data;
  }
}
