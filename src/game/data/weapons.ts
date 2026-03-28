/**
 * Weapon definitions for Captain Skyhawk.
 *
 * Four weapon types:
 * - Cannon: unlimited ammo, upgradeable (levels 1-3)
 * - Phoenix: air-to-air missiles (dogfight only)
 * - Maverick: air-to-ground missiles (isometric levels)
 * - Hawk Bomb: powerful ground bomb (isometric levels)
 */

export interface WeaponDef {
  id: string;
  name: string;
  description: string;
  maxAmmo: number;       // -1 = unlimited
  damage: number;
  fireRate: number;      // shots per second
  speed: number;         // projectile speed (pixels/sec)
  cost: number;          // credits per purchase (buys a pack)
  packSize: number;      // ammo per purchase
  usableIn: ('isometric' | 'dogfight')[];
}

export interface CannonLevel {
  level: number;
  name: string;
  damage: number;
  fireRate: number;
  speed: number;
  upgradeCost: number;
  color: string;
}

export const CANNON_LEVELS: CannonLevel[] = [
  { level: 1, name: 'Cannon Mk.I',   damage: 1, fireRate: 5,  speed: 300, upgradeCost: 0,  color: '#ffff66' },
  { level: 2, name: 'Cannon Mk.II',  damage: 2, fireRate: 7,  speed: 350, upgradeCost: 10, color: '#ffaa33' },
  { level: 3, name: 'Cannon Mk.III', damage: 3, fireRate: 10, speed: 400, upgradeCost: 20, color: '#ff6600' },
];

export const WEAPONS: Record<string, WeaponDef> = {
  phoenix: {
    id: 'phoenix',
    name: 'Phoenix Missile',
    description: 'Air-to-air interceptor. Dogfight only.',
    maxAmmo: 99,
    damage: 5,
    fireRate: 2,
    speed: 400,
    cost: 3,
    packSize: 5,
    usableIn: ['dogfight'],
  },
  maverick: {
    id: 'maverick',
    name: 'Maverick Missile',
    description: 'Air-to-ground precision strike.',
    maxAmmo: 99,
    damage: 4,
    fireRate: 2,
    speed: 250,
    cost: 4,
    packSize: 3,
    usableIn: ['isometric'],
  },
  hawk: {
    id: 'hawk',
    name: 'Hawk Bomb',
    description: 'Heavy ground bomb. Wide blast radius.',
    maxAmmo: 99,
    damage: 8,
    fireRate: 1,
    speed: 200,
    cost: 6,
    packSize: 2,
    usableIn: ['isometric'],
  },
};
