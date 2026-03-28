/**
 * Isometric flight mode — the primary gameplay of Captain Skyhawk.
 *
 * Player pilots the F-14VTS over scrolling isometric terrain,
 * avoiding mountains by adjusting horizontal position and altitude.
 * Terrain auto-scrolls forward. Crashing into terrain = death.
 */

import type { EngineAPI, GameMode } from '../../engine/interfaces';
import type { Renderer } from '../../engine/render/Renderer';
import { clamp } from '../../engine/math/MathUtils';
import { IsometricCamera } from '../isometric/IsometricCamera';
import { TerrainRenderer } from '../isometric/TerrainRenderer';
import { TerrainCollision } from '../isometric/TerrainCollision';
import type { GameState } from '../GameState';
import type { MissionDef } from '../data/levels';
import { MISSIONS } from '../data/levels';
import type { TerrainData } from '../data/terrain';
import { TERRAIN_TILE_W, TERRAIN_COLS, generateTerrain, LEVEL_TERRAIN_CONFIGS } from '../data/terrain';
import { getPalette, type LevelPalette } from '../data/palettes';

// Player constants
const PLAYER_SCREEN_Y = 200;
const PLAYER_SPEED_X = 100;
const PLAYER_ALTITUDE_SPEED = 3;
const PLAYER_MIN_ALTITUDE = 0;
const PLAYER_MAX_ALTITUDE = 4;
const PLAYER_WIDTH = 14;
const JET_WIDTH = 16;
const JET_HEIGHT = 16;

const EXPLOSION_DURATION = 1.5;
const RESPAWN_DELAY = 2.0;

interface ExplosionParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export class IsometricMode implements GameMode {
  readonly id = 'isometric';

  private gameState: GameState;
  private camera!: IsometricCamera;
  private terrainRenderer!: TerrainRenderer;
  private terrainCollision!: TerrainCollision;
  private terrain!: TerrainData;
  private palette!: LevelPalette;
  private mission!: MissionDef;

  private playerX = 128;
  private prevPlayerX = 128;
  private playerAltitude = 2;
  private prevAltitude = 2;
  private alive = true;
  private invincibleTimer = 0;

  private exploding = false;
  private explosionTimer = 0;
  private explosionParticles: ExplosionParticle[] = [];
  private respawnTimer = 0;

  private levelComplete = false;
  private levelCompleteTimer = 0;

  private screenWidth = 256;
  private screenHeight = 240;
  private terrainOffsetX = 0;
  private engineTime = 0;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  enter(engine: EngineAPI): void {
    this.screenWidth = engine.config.width;
    this.screenHeight = engine.config.height;

    const missionIndex = this.gameState.currentMission;
    this.mission = MISSIONS[missionIndex] ?? MISSIONS[0];

    const terrainConfig = LEVEL_TERRAIN_CONFIGS[this.mission.terrainConfigIndex] ?? LEVEL_TERRAIN_CONFIGS[0];
    this.terrain = generateTerrain(terrainConfig.length, terrainConfig.seed, terrainConfig.difficulty);
    this.palette = getPalette(this.mission.paletteIndex);

    this.camera = new IsometricCamera(this.screenHeight, this.terrain.rows.length, this.mission.scrollSpeed);
    this.terrainRenderer = new TerrainRenderer(this.terrain, this.palette, this.screenWidth);
    this.terrainCollision = new TerrainCollision(this.terrain, this.screenWidth);
    this.terrainOffsetX = (this.screenWidth - TERRAIN_COLS * TERRAIN_TILE_W) / 2;

    this.playerX = this.screenWidth / 2;
    this.prevPlayerX = this.playerX;
    this.playerAltitude = this.gameState.altitude;
    this.prevAltitude = this.playerAltitude;
    this.alive = true;
    this.exploding = false;
    this.levelComplete = false;
    this.levelCompleteTimer = 0;
    this.invincibleTimer = 2.0;
  }

  update(engine: EngineAPI, dt: number): void {
    if (this.levelComplete) {
      this.levelCompleteTimer += dt;
      if (this.levelCompleteTimer > 3.0) {
        if (this.mission.hasDogfight) {
          engine.setMode('dogfight');
        } else if (this.mission.hasDocking) {
          engine.setMode('docking');
        } else {
          engine.setMode('title');
        }
      }
      return;
    }

    if (this.exploding) {
      this.updateExplosion(engine, dt);
      return;
    }

    this.prevPlayerX = this.playerX;
    this.prevAltitude = this.playerAltitude;

    const input = engine.input;
    if (input.isHeld('moveLeft'))  this.playerX -= PLAYER_SPEED_X * dt;
    if (input.isHeld('moveRight')) this.playerX += PLAYER_SPEED_X * dt;
    if (input.isHeld('moveUp'))    this.playerAltitude += PLAYER_ALTITUDE_SPEED * dt;
    if (input.isHeld('moveDown'))  this.playerAltitude -= PLAYER_ALTITUDE_SPEED * dt;

    const minX = this.terrainOffsetX + JET_WIDTH / 2;
    const maxX = this.terrainOffsetX + TERRAIN_COLS * TERRAIN_TILE_W - JET_WIDTH / 2;
    this.playerX = clamp(this.playerX, minX, maxX);
    this.playerAltitude = clamp(this.playerAltitude, PLAYER_MIN_ALTITUDE, PLAYER_MAX_ALTITUDE);

    this.camera.update(dt);

    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
    }

    if (this.invincibleTimer <= 0) {
      const playerRow = this.camera.screenYToRow(PLAYER_SCREEN_Y);
      const collision = this.terrainCollision.check(
        this.playerX, playerRow, this.playerAltitude, PLAYER_WIDTH,
      );
      if (collision.collided) {
        this.startExplosion();
        return;
      }
    }

    if (this.camera.atEnd) {
      this.levelComplete = true;
      this.levelCompleteTimer = 0;
      this.gameState.altitude = this.playerAltitude;
    }

    this.gameState.altitude = this.playerAltitude;
  }

  render(engine: EngineAPI, alpha: number): void {
    const r = engine.renderer;
    this.engineTime = engine.getTime();

    r.clear(this.palette.background);
    this.terrainRenderer.render(r, this.camera);

    if (this.alive && !this.exploding) {
      this.renderPlayer(r, alpha);
    }

    if (this.exploding) {
      this.renderExplosion(r);
    }

    this.renderHUD(r);

    if (this.levelComplete) {
      this.renderLevelComplete(r);
    }
  }

  exit(_engine: EngineAPI): void {
    // cleanup
  }

  // ── Player rendering ──────────────────────────────────────────

  private renderPlayer(r: Renderer, alpha: number): void {
    const px = this.prevPlayerX + (this.playerX - this.prevPlayerX) * alpha;
    const alt = this.prevAltitude + (this.playerAltitude - this.prevAltitude) * alpha;
    const altOffset = alt * 3;
    const jetY = PLAYER_SCREEN_Y - altOffset;

    // Invincibility blink
    if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer * 10) % 2 === 0) {
      return;
    }

    // Shadow
    const shadowAlpha = Math.max(0.1, 0.4 - alt * 0.08);
    const shadowScale = 1 + alt * 0.1;
    r.fillPoly([
      { x: px, y: PLAYER_SCREEN_Y - 3 },
      { x: px + JET_WIDTH / 2 * shadowScale, y: PLAYER_SCREEN_Y + 2 },
      { x: px, y: PLAYER_SCREEN_Y + 5 },
      { x: px - JET_WIDTH / 2 * shadowScale, y: PLAYER_SCREEN_Y + 2 },
    ], `rgba(0,0,0,${shadowAlpha})`);

    // Jet body
    r.fillPoly([
      { x: px, y: jetY - JET_HEIGHT / 2 },
      { x: px + JET_WIDTH / 2, y: jetY + 2 },
      { x: px, y: jetY + JET_HEIGHT / 2 },
      { x: px - JET_WIDTH / 2, y: jetY + 2 },
    ], this.palette.playerJet);

    // Cockpit
    r.fillPoly([
      { x: px, y: jetY - 4 },
      { x: px + 3, y: jetY + 1 },
      { x: px, y: jetY + 4 },
      { x: px - 3, y: jetY + 1 },
    ], this.palette.playerHighlight);

    // Engine glow
    const flicker = Math.sin(this.engineTime * 20) * 0.5 + 0.5;
    r.fillRect(px - 2, jetY + JET_HEIGHT / 2 - 1, 4, 2 + flicker * 2, this.palette.playerEngine);

    // Altitude tick marks on wings
    for (let i = 0; i < Math.floor(alt); i++) {
      const wy = jetY + 1 - i;
      r.drawLine(px - 6, wy, px - 4, wy, '#ffffff', 1);
      r.drawLine(px + 4, wy, px + 6, wy, '#ffffff', 1);
    }
  }

  // ── Explosion ─────────────────────────────────────────────────

  private startExplosion(): void {
    this.alive = false;
    this.exploding = true;
    this.explosionTimer = 0;
    this.respawnTimer = 0;
    this.camera.pause();

    this.explosionParticles = [];
    const colors = ['#ff4400', '#ff8800', '#ffcc00', '#ffffff', '#ff2200'];
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 80;
      this.explosionParticles.push({
        x: this.playerX,
        y: PLAYER_SCREEN_Y - this.playerAltitude * 3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 0.5 + Math.random() * 1.0,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  private updateExplosion(engine: EngineAPI, dt: number): void {
    this.explosionTimer += dt;

    for (const p of this.explosionParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt;
      p.life -= dt;
    }
    this.explosionParticles = this.explosionParticles.filter((p) => p.life > 0);

    if (this.explosionTimer > EXPLOSION_DURATION) {
      this.respawnTimer += dt;
      if (this.respawnTimer > RESPAWN_DELAY) {
        const canContinue = this.gameState.loseLife();
        if (canContinue) {
          this.respawn();
        } else {
          engine.setMode('gameover');
        }
      }
    }
  }

  private renderExplosion(r: Renderer): void {
    for (const p of this.explosionParticles) {
      const size = Math.max(1, 3 * (p.life / 1.0));
      r.fillRect(p.x - size / 2, p.y - size / 2, size, size, p.color);
    }
  }

  private respawn(): void {
    this.playerX = this.screenWidth / 2;
    this.prevPlayerX = this.playerX;
    this.playerAltitude = 2;
    this.prevAltitude = 2;
    this.alive = true;
    this.exploding = false;
    this.explosionTimer = 0;
    this.respawnTimer = 0;
    this.invincibleTimer = 2.0;
    this.camera.resume();
  }

  // ── HUD ───────────────────────────────────────────────────────

  private renderHUD(r: Renderer): void {
    r.fillRect(0, 0, this.screenWidth, 14, 'rgba(0,0,0,0.6)');
    r.drawText(`M${this.mission.id}: ${this.mission.name}`, 4, 10, '#88aacc', 8);
    r.drawText(`SCORE: ${this.gameState.score}`, 170, 10, '#cccccc', 8);

    r.fillRect(0, this.screenHeight - 18, this.screenWidth, 18, 'rgba(0,0,0,0.6)');
    r.drawText(`LIVES: ${this.gameState.lives}`, 4, this.screenHeight - 8, '#cccccc', 8);

    const altLabel = `ALT: ${this.playerAltitude.toFixed(1)}`;
    r.drawText(altLabel, 80, this.screenHeight - 8, '#88cc88', 8);

    // Altitude bar
    const barX = 135;
    const barW = 40;
    const barH = 6;
    const barY = this.screenHeight - 13;
    r.strokeRect(barX, barY, barW, barH, '#446644', 1);
    r.fillRect(barX, barY, (this.playerAltitude / PLAYER_MAX_ALTITUDE) * barW, barH, '#88cc88');

    // Progress
    r.drawText(`${Math.floor(this.camera.progress * 100)}%`, this.screenWidth - 30, this.screenHeight - 8, '#888888', 8);

    // Controls hint
    if (this.camera.scrollY < 5) {
      r.drawText('LEFT/RIGHT: Move   UP/DOWN: Altitude', 20, this.screenHeight - 26, '#556677', 8);
    }
  }

  private renderLevelComplete(r: Renderer): void {
    r.fillRect(0, 90, this.screenWidth, 60, 'rgba(0,0,0,0.7)');
    r.drawText('MISSION COMPLETE', 65, 118, '#ffcc00', 12);
    r.drawText(`SCORE: ${this.gameState.score}`, 90, 135, '#cccccc', 8);
  }
}
