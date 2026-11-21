import {
  CursorDefinition,
  INFINITY_CRATE_CURSORS,
  NORMAL_CRATE_CURSORS,
  STARK_CRATE_CURSORS,
  WAKANDA_CRATE_CURSORS,
} from './cursors';
import { getSkinById, Skin } from './skins';

export type CrateType = 'normal' | 'stark' | 'wakanda' | 'infinity';

export interface CratePoolSkinEntry {
  skinId: string;
  weight: number;
  isRarest?: boolean;
}

export interface CrateDefinition {
  id: CrateType;
  name: string;
  subtitle: string;
  image: string;
  gemCost: number;
  duplicateRefundGems: number;
  cursorDropChance: number;
  rarestSkinId: string;
  rarestCursorId: string;
  skins: CratePoolSkinEntry[];
  cursors: CursorDefinition[];
}

export interface CrateOpenResult {
  crateType: CrateType;
  rewardKind: 'cursor' | 'skin';
  cursor: CursorDefinition | null;
  skin: Skin | null;
  isDuplicate: boolean;
  refundGems: number;
}

export const CRATE_DEFINITIONS: Record<CrateType, CrateDefinition> = {
  normal: {
    id: 'normal',
    name: 'Normal Avengers Crate',
    subtitle: '60 Gems • Common & Uncommon Heroes (Black Widow, Deadpool, Venom, Wolverine!) & Classic Cursors',
    image: './images/s3/crates/normal_crate.png',
    gemCost: 60,
    duplicateRefundGems: 24,
    cursorDropChance: 0.45,
    rarestSkinId: 'doctor_octopus_matthew',
    rarestCursorId: 'fire_cursor',
    skins: [
      { skinId: 'black_widow_matthew', weight: 18 },
      { skinId: 'hawkeye_matthew', weight: 16 },
      { skinId: 'ant_man_matthew', weight: 15 },
      { skinId: 'war_machine_matthew', weight: 14 },
      { skinId: 'falcon_matthew', weight: 12 },
      { skinId: 'black_panther_matthew', weight: 9 },
      { skinId: 'deadpool_matthew', weight: 7 },
      { skinId: 'wolverine_matthew', weight: 5 },
      { skinId: 'green_goblin_matthew', weight: 2.5 },
      { skinId: 'doctor_octopus_matthew', weight: 1.5, isRarest: true },
    ],
    cursors: NORMAL_CRATE_CURSORS,
  },
  stark: {
    id: 'stark',
    name: 'Stark Tech Crate',
    subtitle: '95 Gems • Rare Multiverse Suits (Mark 85, Rescue, Endgame Cap, Red Hulk!) & Stark Cursors',
    image: './images/s3/crates/stark_crate.png',
    gemCost: 95,
    duplicateRefundGems: 38,
    cursorDropChance: 0.5,
    rarestSkinId: 'red_hulk_matthew',
    rarestCursorId: 'vibranium_shield_cursor',
    skins: [
      { skinId: 'iron_man_mk85_matthew', weight: 28 },
      { skinId: 'rescue_matthew', weight: 24 },
      { skinId: 'thor_ragnarok_matthew', weight: 20 },
      { skinId: 'endgame_cap_matthew', weight: 16 },
      { skinId: 'red_hulk_matthew', weight: 12, isRarest: true },
    ],
    cursors: STARK_CRATE_CURSORS,
  },
  wakanda: {
    id: 'wakanda',
    name: 'Wakanda Vibranium Crate',
    subtitle: '150 Gems • Epic Mystic & Dark Variants (Strange Supreme, Kang, Loki!) & Magic Cursors',
    image: './images/s3/crates/wakanda_crate.png',
    gemCost: 150,
    duplicateRefundGems: 60,
    cursorDropChance: 0.5,
    rarestSkinId: 'loki_god_of_stories_matthew',
    rarestCursorId: 'chaos_hex_cursor',
    skins: [
      { skinId: 'dr_strange_supreme_matthew', weight: 26 },
      { skinId: 'zombie_iron_man_matthew', weight: 22 },
      { skinId: 'zombie_cap_matthew', weight: 20 },
      { skinId: 'kang_matthew', weight: 18 },
      { skinId: 'loki_god_of_stories_matthew', weight: 14, isRarest: true },
    ],
    cursors: WAKANDA_CRATE_CURSORS,
  },
  infinity: {
    id: 'infinity',
    name: 'Cosmic Infinity Crate',
    subtitle: '235 Gems • Legendary & MYTHIC Cosmic Gods (Rune King Thor, Doom, Beyonder, Infinity Ultron!) & Stormbreaker/Gauntlet Cursors',
    image: './images/s3/crates/infinity_crate.png',
    gemCost: 235,
    duplicateRefundGems: 95,
    cursorDropChance: 0.45,
    rarestSkinId: 'infinity_ultron_matthew',
    rarestCursorId: 'infinity_gauntlet_cursor',
    skins: [
      { skinId: 'rune_king_thor_matthew', weight: 32 },
      { skinId: 'god_emperor_doom_matthew', weight: 28 },
      { skinId: 'beyonder_matthew', weight: 22 },
      { skinId: 'one_above_all_matthew', weight: 13 },
      { skinId: 'infinity_ultron_matthew', weight: 5, isRarest: true },
    ],
    cursors: INFINITY_CRATE_CURSORS,
  },
};

function pickWeighted<T extends { weight?: number; dropWeight?: number }>(
  items: T[],
  rng: () => number
): T {
  const total = items.reduce((acc, item) => acc + (item.weight ?? item.dropWeight ?? 1), 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight ?? item.dropWeight ?? 1;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

export function rollCrateReward(
  crateType: CrateType,
  ownedSkins: string[],
  ownedCursors: string[],
  rng: () => number = Math.random
): CrateOpenResult {
  const spec = CRATE_DEFINITIONS[crateType] || CRATE_DEFINITIONS.normal;
  const rollCursor = rng() < spec.cursorDropChance;

  if (rollCursor && spec.cursors.length > 0) {
    const picked = pickWeighted(spec.cursors, rng);
    const isDuplicate = ownedCursors.includes(picked.id);
    return {
      crateType,
      rewardKind: 'cursor',
      cursor: picked,
      skin: null,
      isDuplicate,
      refundGems: isDuplicate ? spec.duplicateRefundGems : 0,
    };
  }

  const pickedSkinEntry = pickWeighted(spec.skins, rng);
  const skin = getSkinById(pickedSkinEntry.skinId);
  const isDuplicate = ownedSkins.includes(skin.id);
  return {
    crateType,
    rewardKind: 'skin',
    cursor: null,
    skin,
    isDuplicate,
    refundGems: isDuplicate ? spec.duplicateRefundGems : 0,
  };
}
