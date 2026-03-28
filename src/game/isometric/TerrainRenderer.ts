/**
 * Renders isometric terrain as colored polygons on canvas.
 *
 * Each terrain cell is drawn as a diamond (top face) with side faces
 * for elevated terrain, creating a 3D block appearance.
 *
 * Draw order: back-to-front (far rows first, near rows last) so
 * nearer terrain correctly overlaps side faces of farther mountains.
 */

import type { Renderer } from '../../engine/render/Renderer';
import type { LevelPalette } from '../data/palettes';
import type { TerrainData } from '../data/terrain';
import { TERRAIN_TILE_W, TERRAIN_TILE_H, TERRAIN_HEIGHT_SCALE } from '../data/terrain';
import type { IsometricCamera } from './IsometricCamera';

export class TerrainRenderer {
  private terrain: TerrainData;
  private palette: LevelPalette;
  private screenWidth: number;

  /** Horizontal offset to center the terrain grid on screen */
  private offsetX: number;

  constructor(terrain: TerrainData, palette: LevelPalette, screenWidth: number) {
    this.terrain = terrain;
    this.palette = palette;
    this.screenWidth = screenWidth;
    this.offsetX = (screenWidth - terrain.width * TERRAIN_TILE_W) / 2;
  }

  render(renderer: Renderer, camera: IsometricCamera): void {
    const { minRow, maxRow } = camera.getVisibleRows();
    const halfW = TERRAIN_TILE_W / 2;
    const halfH = TERRAIN_TILE_H / 2;

    // Draw back-to-front: highest row (farthest) first
    for (let row = maxRow; row >= minRow; row--) {
      if (row < 0 || row >= this.terrain.rows.length) continue;
      const terrainRow = this.terrain.rows[row];
      const baseScreenY = camera.rowToScreenY(row);

      for (let col = 0; col < this.terrain.width; col++) {
        const height = terrainRow[col];
        const baseX = col * TERRAIN_TILE_W + this.offsetX;

        // Center of the tile diamond at ground level
        const cx = baseX + halfW;
        const groundY = baseScreenY;

        if (height <= 0) {
          // Flat ground or water
          this.drawFlatTile(renderer, cx, groundY, halfW, halfH, height);
        } else {
          // Raised mountain block
          this.drawRaisedTile(renderer, cx, groundY, halfW, halfH, height);
        }
      }
    }
  }

  private drawFlatTile(
    renderer: Renderer,
    cx: number, cy: number,
    halfW: number, halfH: number,
    height: number,
  ): void {
    const isWater = height < 0;
    // Checkerboard pattern using position
    const col = Math.floor((cx - this.offsetX) / TERRAIN_TILE_W);
    const row = Math.floor(cy / TERRAIN_TILE_H);
    const alt = (col + row) % 2 === 0;

    const color = isWater
      ? (alt ? this.palette.water : this.palette.waterAlt)
      : (alt ? this.palette.groundFlat : this.palette.groundAlt);

    // Diamond shape
    renderer.fillPoly([
      { x: cx, y: cy - halfH },          // top
      { x: cx + halfW, y: cy },           // right
      { x: cx, y: cy + halfH },           // bottom
      { x: cx - halfW, y: cy },           // left
    ], color);
  }

  private drawRaisedTile(
    renderer: Renderer,
    cx: number, groundY: number,
    halfW: number, halfH: number,
    height: number,
  ): void {
    const h = Math.min(height, 4);
    const lift = h * TERRAIN_HEIGHT_SCALE;
    const topY = groundY - lift;

    // Height-indexed colors (0-based, so subtract 1)
    const ci = h - 1;
    const topColor = this.palette.mountainTop[ci] ?? this.palette.mountainTop[0];
    const leftColor = this.palette.mountainLeft[ci] ?? this.palette.mountainLeft[0];
    const rightColor = this.palette.mountainRight[ci] ?? this.palette.mountainRight[0];

    // Left (south-west) side face
    renderer.fillPoly([
      { x: cx - halfW, y: topY },         // top-left of top face
      { x: cx, y: topY + halfH },         // bottom of top face
      { x: cx, y: groundY + halfH },      // bottom at ground level
      { x: cx - halfW, y: groundY },      // left at ground level
    ], leftColor);

    // Right (south-east) side face
    renderer.fillPoly([
      { x: cx + halfW, y: topY },         // top-right of top face
      { x: cx, y: topY + halfH },         // bottom of top face
      { x: cx, y: groundY + halfH },      // bottom at ground level
      { x: cx + halfW, y: groundY },      // right at ground level
    ], rightColor);

    // Top face (diamond)
    renderer.fillPoly([
      { x: cx, y: topY - halfH },         // top
      { x: cx + halfW, y: topY },         // right
      { x: cx, y: topY + halfH },         // bottom
      { x: cx - halfW, y: topY },         // left
    ], topColor);
  }

  /** Get the pixel offset of a column's center X on screen */
  getColumnScreenX(col: number): number {
    return col * TERRAIN_TILE_W + this.offsetX + TERRAIN_TILE_W / 2;
  }

  /** Get column index from a screen X position */
  screenXToColumn(screenX: number): number {
    return (screenX - this.offsetX) / TERRAIN_TILE_W;
  }

  updatePalette(palette: LevelPalette): void {
    this.palette = palette;
  }

  updateTerrain(terrain: TerrainData): void {
    this.terrain = terrain;
    this.offsetX = (this.screenWidth - terrain.width * TERRAIN_TILE_W) / 2;
  }
}
