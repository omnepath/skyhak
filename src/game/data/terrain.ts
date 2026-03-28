/**
 * Terrain generation for isometric levels.
 *
 * Each level is a 2D height map: rows (depth) x columns (width).
 * Height values: 0 = flat ground, 1-4 = increasing mountain height.
 * -1 = water
 *
 * The terrain is generated procedurally from parameters rather than
 * hand-coded, but the generator is deterministic — same seed, same terrain.
 * This keeps data compact and editable.
 */

export const TERRAIN_COLS = 9;
export const TERRAIN_TILE_W = 28;
export const TERRAIN_TILE_H = 14;
export const TERRAIN_HEIGHT_SCALE = 10;

export interface TerrainData {
  rows: number[][];
  width: number;
}

/** Simple seeded pseudo-random for deterministic terrain */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Generate terrain for a level.
 *
 * @param length - Number of rows
 * @param seed - Random seed for deterministic generation
 * @param difficulty - 0-1 affects canyon width and obstacle density
 */
export function generateTerrain(
  length: number,
  seed: number,
  difficulty: number,
): TerrainData {
  const rand = seededRandom(seed);
  const rows: number[][] = [];
  const width = TERRAIN_COLS;

  // Canyon parameters that evolve over the level
  let canyonCenter = (width - 1) / 2; // start centered
  let canyonWidth = 5 - difficulty * 1.5; // wider at lower difficulty

  for (let r = 0; r < length; r++) {
    const progress = r / length; // 0 to 1 through the level
    const row: number[] = [];

    // Evolve canyon shape
    canyonCenter += (rand() - 0.5) * 0.6;
    canyonCenter = Math.max(2.5, Math.min(width - 3.5, canyonCenter));

    // Canyon narrows and widens periodically
    const widthOscillation = Math.sin(r * 0.04) * 1.2 + Math.sin(r * 0.02) * 0.8;
    const effectiveWidth = Math.max(2, canyonWidth + widthOscillation - progress * 0.8);

    for (let c = 0; c < width; c++) {
      const distFromCenter = Math.abs(c - canyonCenter);
      const halfPath = effectiveWidth / 2;

      if (distFromCenter < halfPath) {
        // Inside the flight path — flat ground
        // Occasionally add small obstacles in the path
        if (progress > 0.15 && rand() < 0.03 * difficulty && distFromCenter > halfPath * 0.3) {
          row.push(1); // low obstacle
        } else {
          row.push(0);
        }
      } else {
        // Mountain wall — height increases with distance from path
        const wallDist = distFromCenter - halfPath;
        let height = Math.min(4, Math.floor(wallDist * 1.5) + 1);

        // Add some variation
        height = Math.max(1, height + Math.floor((rand() - 0.3) * 1.5));
        height = Math.min(4, height);

        row.push(height);
      }
    }

    rows.push(row);
  }

  // Clear the first 8 rows for a safe start
  for (let r = 0; r < Math.min(8, length); r++) {
    for (let c = 0; c < width; c++) {
      rows[r][c] = 0;
    }
  }

  // Build walls on the first 8 rows gradually
  for (let r = 0; r < Math.min(15, length); r++) {
    for (let c = 0; c < width; c++) {
      if (c <= 1 || c >= width - 2) {
        rows[r][c] = Math.min(rows[r][c], Math.max(0, Math.floor((r - 6) * 0.8)));
      }
    }
  }

  // Boss zone: last 10 rows open up
  for (let r = Math.max(0, length - 10); r < length; r++) {
    for (let c = 0; c < width; c++) {
      const distFromCenter = Math.abs(c - (width - 1) / 2);
      if (distFromCenter < 3) {
        rows[r][c] = 0;
      }
    }
  }

  return { rows, width };
}

/** Pre-defined level terrain configs */
export interface LevelTerrainConfig {
  length: number;
  seed: number;
  difficulty: number;
}

export const LEVEL_TERRAIN_CONFIGS: LevelTerrainConfig[] = [
  { length: 150, seed: 42,    difficulty: 0.2 },  // Level 1: Easy, wide canyon
  { length: 160, seed: 137,   difficulty: 0.35 }, // Level 2: Slightly harder
  { length: 170, seed: 256,   difficulty: 0.5 },  // Level 3: Medium
  { length: 175, seed: 404,   difficulty: 0.6 },  // Level 4: Medium-hard
  { length: 180, seed: 512,   difficulty: 0.7 },  // Level 5: Hard
  { length: 185, seed: 666,   difficulty: 0.8 },  // Level 6: Harder
  { length: 190, seed: 777,   difficulty: 0.85 }, // Level 7: Very hard
  { length: 200, seed: 1337,  difficulty: 0.95 }, // Level 8: Near max
  { length: 100, seed: 9999,  difficulty: 1.0 },  // Level 9: Final (short, brutal)
];
