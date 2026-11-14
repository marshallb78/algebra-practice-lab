import { CursorDefinition, FROST_CRATE_CURSORS, NORMAL_CRATE_CURSORS } from './cursors';
import { getSkinById, Skin } from './skins';

export type CrateType = 'normal' | 'frost';

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
    name: 'Normal Crate',
    subtitle: '50 Gems • Normal Shop Skins (Rarest: Void Emperor Matthew) & 5 Cursors (Rarest: Fire Cursor!)',
    image: './images/s2/crates/normal_crate.png',
    gemCost: 50,
    duplicateRefundGems: 20,
    cursorDropChance: 0.55,
    rarestSkinId: 'void_emperor_matthew',
    rarestCursorId: 'fire_cursor',
    skins: [
      { skinId: 'potato_matthew', weight: 22 },
      { skinId: 'fries_matthew', weight: 18 },
      { skinId: 'pizza_matthew', weight: 14 },
      { skinId: 'strawberry_matthew', weight: 12 },
      { skinId: 'burger_matthew', weight: 10 },
      { skinId: 'girl_matthew', weight: 8 },
      { skinId: 'anime_matthew', weight: 7 },
      { skinId: 'chocolate_matthew', weight: 6 },
      { skinId: 'naruto_matthew', weight: 4.5 },
      { skinId: 'cyberpunk_matthew', weight: 4 },
      { skinId: 'gigachad_matthew', weight: 2.5 },
      { skinId: 'glitched_matthew', weight: 2 },
      { skinId: 'void_emperor_matthew', weight: 1.5, isRarest: true },
    ],
    cursors: NORMAL_CRATE_CURSORS,
  },
  frost: {
    id: 'frost',
    name: 'Frost Crate',
    subtitle: '75 Gems • All Winter, Zombie & Apocalypse Skins (Rarest: Apocalypse Matthew) & 5 Ice Cursors (Rarest: Frosty Cursor!)',
    image: './images/s2/crates/frost_crate.png',
    gemCost: 75,
    duplicateRefundGems: 30,
    cursorDropChance: 0.55,
    rarestSkinId: 'apocalypse_matthew',
    rarestCursorId: 'frosty_cursor',
    skins: [
      { skinId: 'snowy_matthew', weight: 28 },
      { skinId: 'snowman_matthew', weight: 24 },
      { skinId: 'ice_cube_matthew', weight: 18 },
      { skinId: 'mathjew', weight: 12 },
      { skinId: 'minecraft_matthew', weight: 8 },
      { skinId: 'zombie_matthew', weight: 5 },
      { skinId: 'ghost_matthew', weight: 3 },
      { skinId: 'apocalypse_matthew', weight: 2, isRarest: true },
    ],
    cursors: FROST_CRATE_CURSORS,
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
  const spec = CRATE_DEFINITIONS[crateType];
  const rollCursor = rng() < spec.cursorDropChance;

  if (rollCursor) {
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

