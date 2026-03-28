/**
 * NES-style color palettes for each level.
 * Captain Skyhawk uses different terrain color schemes per level.
 */

export interface LevelPalette {
  background: string;
  groundFlat: string;
  groundAlt: string;
  mountainTop: string[];   // indexed by height (1-4)
  mountainLeft: string[];  // left/south face (darker)
  mountainRight: string[]; // right/east face (darkest)
  water: string;
  waterAlt: string;
  playerJet: string;
  playerHighlight: string;
  playerEngine: string;
  shadow: string;
}

/** Level 1: Green canyon (inspired by original level 1) */
const PALETTE_GREEN_CANYON: LevelPalette = {
  background: '#0a0a1a',
  groundFlat: '#1a3a1a',
  groundAlt: '#1e3e1e',
  mountainTop: ['#2d6b2d', '#3a8a3a', '#4aaa4a', '#5bbb5b'],
  mountainLeft: ['#1a5a1a', '#247a24', '#2e9a2e', '#38aa38'],
  mountainRight: ['#104a10', '#1a6a1a', '#248a24', '#2e9a2e'],
  water: '#1a2a5a',
  waterAlt: '#1e2e6e',
  playerJet: '#aaccff',
  playerHighlight: '#ddeeff',
  playerEngine: '#ff6622',
  shadow: '#0a1a0a',
};

/** Level 2: Desert (sand/orange tones) */
const PALETTE_DESERT: LevelPalette = {
  background: '#1a1008',
  groundFlat: '#3a2a10',
  groundAlt: '#3e2e14',
  mountainTop: ['#8a6a30', '#aa8a40', '#bbaa50', '#ccbb60'],
  mountainLeft: ['#7a5a20', '#9a7a30', '#aa9a40', '#bbaa50'],
  mountainRight: ['#6a4a10', '#8a6a20', '#9a8a30', '#aa9a40'],
  water: '#1a2a5a',
  waterAlt: '#1e2e6e',
  playerJet: '#aaccff',
  playerHighlight: '#ddeeff',
  playerEngine: '#ff6622',
  shadow: '#1a1008',
};

/** Level 3: Ice/blue terrain */
const PALETTE_ICE: LevelPalette = {
  background: '#080818',
  groundFlat: '#1a2a3a',
  groundAlt: '#1e2e3e',
  mountainTop: ['#4a6a8a', '#5a7aaa', '#6a8abb', '#7a9acc'],
  mountainLeft: ['#3a5a7a', '#4a6a9a', '#5a7aaa', '#6a8abb'],
  mountainRight: ['#2a4a6a', '#3a5a8a', '#4a6a9a', '#5a7aaa'],
  water: '#0a1a3a',
  waterAlt: '#0e1e4e',
  playerJet: '#aaccff',
  playerHighlight: '#ddeeff',
  playerEngine: '#ff6622',
  shadow: '#0a0a18',
};

/** Level 4: Volcanic (red/dark) */
const PALETTE_VOLCANIC: LevelPalette = {
  background: '#1a0808',
  groundFlat: '#2a1010',
  groundAlt: '#2e1414',
  mountainTop: ['#6a2a2a', '#8a3a3a', '#aa4a4a', '#cc5a5a'],
  mountainLeft: ['#5a1a1a', '#7a2a2a', '#9a3a3a', '#aa4a4a'],
  mountainRight: ['#4a1010', '#6a1a1a', '#8a2a2a', '#9a3a3a'],
  water: '#3a1a0a',
  waterAlt: '#4e2a1a',
  playerJet: '#aaccff',
  playerHighlight: '#ddeeff',
  playerEngine: '#ff6622',
  shadow: '#1a0808',
};

export const PALETTES: LevelPalette[] = [
  PALETTE_GREEN_CANYON,
  PALETTE_DESERT,
  PALETTE_ICE,
  PALETTE_VOLCANIC,
];

export function getPalette(levelIndex: number): LevelPalette {
  return PALETTES[levelIndex % PALETTES.length];
}
