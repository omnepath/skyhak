/**
 * Level/mission definitions for Captain Skyhawk.
 *
 * 9 missions total:
 * - Missions 1-7: isometric → dogfight → dock/shop
 * - Mission 8: isometric → dogfight (2 phases)
 * - Mission 9: final boss only
 */

export type MissionObjective = 'destroy_base' | 'drop_supplies' | 'rescue_scientist';

export interface MissionDef {
  id: number;
  name: string;
  briefing: string;
  paletteIndex: number;
  terrainConfigIndex: number;
  objective: MissionObjective;
  scrollSpeed: number;       // base terrain scroll speed (rows/sec)
  hasDogfight: boolean;
  hasDocking: boolean;
  isFinalBoss: boolean;
}

export const MISSIONS: MissionDef[] = [
  {
    id: 1,
    name: 'Operation Green Storm',
    briefing: 'Destroy the alien base in the canyon. Watch for terrain!',
    paletteIndex: 0,
    terrainConfigIndex: 0,
    objective: 'destroy_base',
    scrollSpeed: 2.5,
    hasDogfight: true,
    hasDocking: true,
    isFinalBoss: false,
  },
  {
    id: 2,
    name: 'Supply Run Alpha',
    briefing: 'Deliver critical supplies to the underground scientists.',
    paletteIndex: 0,
    terrainConfigIndex: 1,
    objective: 'drop_supplies',
    scrollSpeed: 2.8,
    hasDogfight: true,
    hasDocking: true,
    isFinalBoss: false,
  },
  {
    id: 3,
    name: 'Desert Extraction',
    briefing: 'Rescue the captured scientist from the desert outpost.',
    paletteIndex: 1,
    terrainConfigIndex: 2,
    objective: 'rescue_scientist',
    scrollSpeed: 3.0,
    hasDogfight: true,
    hasDocking: true,
    isFinalBoss: false,
  },
  {
    id: 4,
    name: 'Ice Fortress',
    briefing: 'Destroy the alien base hidden in the frozen mountains.',
    paletteIndex: 2,
    terrainConfigIndex: 3,
    objective: 'destroy_base',
    scrollSpeed: 3.2,
    hasDogfight: true,
    hasDocking: true,
    isFinalBoss: false,
  },
  {
    id: 5,
    name: 'Supply Run Beta',
    briefing: 'The scientists need more supplies. Navigate the narrow canyons.',
    paletteIndex: 2,
    terrainConfigIndex: 4,
    objective: 'drop_supplies',
    scrollSpeed: 3.4,
    hasDogfight: true,
    hasDocking: true,
    isFinalBoss: false,
  },
  {
    id: 6,
    name: 'Volcanic Rescue',
    briefing: 'A scientist is trapped in the volcanic region. Get them out!',
    paletteIndex: 3,
    terrainConfigIndex: 5,
    objective: 'rescue_scientist',
    scrollSpeed: 3.6,
    hasDogfight: true,
    hasDocking: true,
    isFinalBoss: false,
  },
  {
    id: 7,
    name: 'Final Canyon',
    briefing: 'Destroy the last surface base. The path to space awaits.',
    paletteIndex: 3,
    terrainConfigIndex: 6,
    objective: 'destroy_base',
    scrollSpeed: 3.8,
    hasDogfight: true,
    hasDocking: true,
    isFinalBoss: false,
  },
  {
    id: 8,
    name: 'Orbital Approach',
    briefing: 'Clear a path through the orbital defenses.',
    paletteIndex: 2,
    terrainConfigIndex: 7,
    objective: 'destroy_base',
    scrollSpeed: 4.0,
    hasDogfight: true,
    hasDocking: false,
    isFinalBoss: false,
  },
  {
    id: 9,
    name: 'The Eye',
    briefing: 'Destroy the alien mother station. This ends now.',
    paletteIndex: 3,
    terrainConfigIndex: 8,
    objective: 'destroy_base',
    scrollSpeed: 4.5,
    hasDogfight: false,
    hasDocking: false,
    isFinalBoss: true,
  },
];
