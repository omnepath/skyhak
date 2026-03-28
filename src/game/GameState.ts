/**
 * Player game state — lives, score, weapons, progression.
 * Persists across modes within a play session.
 */

export interface WeaponAmmo {
  phoenix: number;
  maverick: number;
  hawk: number;
}

export class GameState {
  lives = 4;
  continues = 3;
  score = 0;
  credits = 0;
  cannonLevel = 1;    // 1-3
  ammo: WeaponAmmo = { phoenix: 0, maverick: 0, hawk: 0 };
  currentMission = 0; // index into MISSIONS
  altitude = 2;       // player altitude (0-4), starts at mid-level

  reset(): void {
    this.lives = 4;
    this.continues = 3;
    this.score = 0;
    this.credits = 0;
    this.cannonLevel = 1;
    this.ammo = { phoenix: 0, maverick: 0, hawk: 0 };
    this.currentMission = 0;
    this.altitude = 2;
  }

  loseLife(): boolean {
    this.lives--;
    if (this.lives < 0) {
      if (this.continues > 0) {
        this.continues--;
        this.lives = 4;
        return true; // continued
      }
      return false; // game over
    }
    return true; // still alive
  }

  addScore(points: number): void {
    this.score += points;
  }

  addCredits(amount: number): void {
    this.credits += amount;
  }

  spendCredits(amount: number): boolean {
    if (this.credits >= amount) {
      this.credits -= amount;
      return true;
    }
    return false;
  }
}
