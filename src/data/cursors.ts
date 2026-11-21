export type CursorCrateType = 'normal' | 'frost' | 'stark' | 'wakanda' | 'infinity' | 'starter';
export type CursorRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';

export interface CursorDefinition {
  id: string;
  name: string;
  crateType: CursorCrateType;
  rarity: CursorRarity;
  dropWeight: number;
  description: string;
  abilitySummary: string;
  image: string;
  accentColor: string;
  glowColor: string;
  cpsMultiplierBonus?: number;
  clickMultiplierBonus?: number;
  ascensionBonusPerShard?: number;
  critChanceBonus?: number;
  critMultiplierBonus?: number;
  freezeImmune?: boolean;
}

export const STARTER_CURSOR_ID = 'starter_cursor';

export const STARTER_CURSOR: CursorDefinition = {
  id: STARTER_CURSOR_ID,
  name: 'Classic Pointer',
  crateType: 'starter',
  rarity: 'Common',
  dropWeight: 0,
  description: 'Your starting in-game cursor. Unlock stronger cursors in Normal and Frost Crates!',
  abilitySummary: 'Starting In-Game Cursor',
  image: './images/cursors/starter_cursor.png',
  accentColor: '#38bdf8',
  glowColor: 'rgba(56, 189, 248, 0.5)',
};

export const CURSORS: CursorDefinition[] = [
  // ================= NORMAL CRATE CURSORS (5 TOTAL — SEASON 1 RARE TIERS + FIRE FINALE) =================
  {
    id: 'golden_cursor',
    name: 'Golden Cursor',
    crateType: 'normal',
    rarity: 'Common',
    dropWeight: 40,
    description: '24K Golden Matthew pointer for gleaming starter crits.',
    abilitySummary: '+15% Click Power • +12% CPS',
    image: './images/cursors/golden_cursor.png',
    accentColor: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.65)',
    clickMultiplierBonus: 0.15,
    cpsMultiplierBonus: 0.12,
  },
  {
    id: 'diamond_cursor',
    name: 'Diamond Cursor',
    crateType: 'normal',
    rarity: 'Uncommon',
    dropWeight: 28,
    description: 'Faceted Diamond Matthew crystal slicing through point quotas.',
    abilitySummary: '+24% Click Power • +22% CPS • +4% Crit',
    image: './images/cursors/diamond_cursor.png',
    accentColor: '#67e8f9',
    glowColor: 'rgba(103, 232, 249, 0.72)',
    clickMultiplierBonus: 0.24,
    cpsMultiplierBonus: 0.22,
    critChanceBonus: 0.04,
  },
  {
    id: 'galaxy_cursor',
    name: 'Galaxy Cursor',
    crateType: 'normal',
    rarity: 'Rare',
    dropWeight: 17,
    description: 'Cosmic nebula Galaxy Matthew pointer infused with starlight.',
    abilitySummary: '+36% Click Power • +35% CPS • +0.008/Shard Ascension',
    image: './images/cursors/galaxy_cursor.png',
    accentColor: '#c084fc',
    glowColor: 'rgba(192, 132, 252, 0.8)',
    clickMultiplierBonus: 0.36,
    cpsMultiplierBonus: 0.35,
    ascensionBonusPerShard: 0.008,
  },
  {
    id: 'god_cursor',
    name: 'God Cursor',
    crateType: 'normal',
    rarity: 'Epic',
    dropWeight: 11,
    description: 'Sacred solar-halo God Matthew pointer forged in pure divine light.',
    abilitySummary: '+52% Click Power • +48% CPS • +6% Crit • +0.012/Shard Ascension',
    image: './images/cursors/god_cursor.png',
    accentColor: '#fde047',
    glowColor: 'rgba(253, 224, 71, 0.88)',
    clickMultiplierBonus: 0.52,
    cpsMultiplierBonus: 0.48,
    critChanceBonus: 0.06,
    ascensionBonusPerShard: 0.012,
  },
  {
    id: 'fire_cursor',
    name: 'Fire Cursor',
    crateType: 'normal',
    rarity: 'Legendary',
    dropWeight: 4,
    description: 'Blazing inferno pointer forged to shatter frozen prisons.',
    abilitySummary: '+70% Click Power • +60% CPS • +7% Crit • Melts Screen Freeze!',
    image: './images/cursors/fire_cursor.png',
    accentColor: '#fb7185',
    glowColor: 'rgba(249, 115, 22, 0.92)',
    clickMultiplierBonus: 0.7,
    cpsMultiplierBonus: 0.6,
    critChanceBonus: 0.07,
    critMultiplierBonus: 0.45,
    freezeImmune: true,
  },

  // ================= FROST CRATE CURSORS (5 TOTAL — SEASON 2 RARE TIERS + FROSTY FINALE) =================
  {
    id: 'cyberpunk_cursor',
    name: 'Cyberpunk Cursor',
    crateType: 'frost',
    rarity: 'Common',
    dropWeight: 40,
    description: 'Neon Cyberpunk Matthew optic pointer accelerating passive winter ticks.',
    abilitySummary: '+18% CPS • +14% Click Power',
    image: './images/cursors/cyberpunk_cursor.png',
    accentColor: '#22d3ee',
    glowColor: 'rgba(34, 211, 238, 0.65)',
    cpsMultiplierBonus: 0.18,
    clickMultiplierBonus: 0.14,
  },
  {
    id: 'glitch_cursor',
    name: 'Glitched Cursor',
    crateType: 'frost',
    rarity: 'Uncommon',
    dropWeight: 28,
    description: 'Matrix-warping Glitched Matthew pointer exploiting critical hits.',
    abilitySummary: '+26% Click Power • +24% CPS • +5% Crit Chance',
    image: './images/cursors/glitch_cursor.png',
    accentColor: '#4ade80',
    glowColor: 'rgba(74, 222, 128, 0.75)',
    clickMultiplierBonus: 0.26,
    cpsMultiplierBonus: 0.24,
    critChanceBonus: 0.05,
  },
  {
    id: 'void_cursor',
    name: 'Void Emperor Cursor',
    crateType: 'frost',
    rarity: 'Rare',
    dropWeight: 17,
    description: 'Dark-matter Void Emperor Matthew relic amplifying Ascension Shards.',
    abilitySummary: '+38% CPS • +30% Click Power • +0.01/Shard Ascension',
    image: './images/cursors/void_cursor.png',
    accentColor: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.8)',
    cpsMultiplierBonus: 0.38,
    clickMultiplierBonus: 0.3,
    ascensionBonusPerShard: 0.01,
  },
  {
    id: 'gigachad_cursor',
    name: 'Giga-Chad Cursor',
    crateType: 'frost',
    rarity: 'Epic',
    dropWeight: 11,
    description: 'Peak Sigma Giga-Chad Matthew jawline cursor crushing crit multipliers.',
    abilitySummary: '+52% CPS • +44% Click Power • +0.65x Crit Damage',
    image: './images/cursors/gigachad_cursor.png',
    accentColor: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.85)',
    cpsMultiplierBonus: 0.52,
    clickMultiplierBonus: 0.44,
    critMultiplierBonus: 0.65,
  },
  {
    id: 'frosty_cursor',
    name: 'Frosty Cursor',
    crateType: 'frost',
    rarity: 'Legendary',
    dropWeight: 4,
    description: 'Supreme Cryo Crown pointer infused with Eternal Blizzard energy.',
    abilitySummary: '+75% CPS • +60% Click Power • +8% Crit • +0.016/Shard Ascension',
    image: './images/cursors/frosty_cursor.png',
    accentColor: '#67e8f9',
    glowColor: 'rgba(103, 232, 249, 0.95)',
    cpsMultiplierBonus: 0.75,
    clickMultiplierBonus: 0.6,
    critChanceBonus: 0.08,
    critMultiplierBonus: 0.75,
    ascensionBonusPerShard: 0.016,
  },

  // ================= SEASON 3: CUSTOM MARVEL CURSORS (GENERATED VIA COMFYUI) =================
  {
    id: 'web_shooter_cursor',
    name: 'Web-Shooter Gauntlet',
    crateType: 'stark',
    rarity: 'Common',
    dropWeight: 38,
    description: 'Mechanical Spider-Man wrist web-shooter snapping rapid clicks.',
    abilitySummary: '+20% Click Power • +16% CPS • +4% Crit',
    image: './images/s3/cursors/web_shooter_cursor.png',
    accentColor: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.75)',
    clickMultiplierBonus: 0.2,
    cpsMultiplierBonus: 0.16,
    critChanceBonus: 0.04,
  },
  {
    id: 'repulsor_cursor',
    name: 'Arc Repulsor Pointer',
    crateType: 'stark',
    rarity: 'Uncommon',
    dropWeight: 30,
    description: 'Mark 85 Arc Reactor palm blaster accelerating Stark production.',
    abilitySummary: '+30% Click Power • +28% CPS • +0.008/Shard Ascension',
    image: './images/s3/cursors/repulsor_cursor.png',
    accentColor: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.85)',
    clickMultiplierBonus: 0.3,
    cpsMultiplierBonus: 0.28,
    ascensionBonusPerShard: 0.008,
  },
  {
    id: 'vibranium_shield_cursor',
    name: 'Vibranium Star Shield',
    crateType: 'stark',
    rarity: 'Rare',
    dropWeight: 18,
    description: 'Unbreakable Captain America Vibranium shield bouncing across coins.',
    abilitySummary: '+42% Click Power • +38% CPS • +6% Crit',
    image: './images/s3/cursors/vibranium_shield_cursor.png',
    accentColor: '#60a5fa',
    glowColor: 'rgba(96, 165, 250, 0.85)',
    clickMultiplierBonus: 0.42,
    cpsMultiplierBonus: 0.38,
    critChanceBonus: 0.06,
  },
  {
    id: 'sling_ring_cursor',
    name: 'Mystic Sling Ring',
    crateType: 'wakanda',
    rarity: 'Rare',
    dropWeight: 32,
    description: 'Doctor Strange twin-loop mystic relic opening portal multipliers.',
    abilitySummary: '+48% CPS • +40% Click Power • +0.012/Shard Ascension',
    image: './images/s3/cursors/sling_ring_cursor.png',
    accentColor: '#fb923c',
    glowColor: 'rgba(251, 146, 60, 0.88)',
    cpsMultiplierBonus: 0.48,
    clickMultiplierBonus: 0.4,
    ascensionBonusPerShard: 0.012,
  },
  {
    id: 'mjolnir_cursor',
    name: 'Enchanted Mjolnir',
    crateType: 'wakanda',
    rarity: 'Epic',
    dropWeight: 22,
    description: 'Asgardian Uru hammer slamming lightning-charged critical strikes.',
    abilitySummary: '+62% Click Power • +52% CPS • +0.7x Crit Damage',
    image: './images/s3/cursors/mjolnir_cursor.png',
    accentColor: '#7dd3fc',
    glowColor: 'rgba(125, 211, 252, 0.9)',
    clickMultiplierBonus: 0.62,
    cpsMultiplierBonus: 0.52,
    critMultiplierBonus: 0.7,
  },
  {
    id: 'chaos_hex_cursor',
    name: 'Scarlet Chaos Hex',
    crateType: 'wakanda',
    rarity: 'Epic',
    dropWeight: 16,
    description: 'Scarlet Witch reality-warping chaos magic sphere.',
    abilitySummary: '+68% CPS • +58% Click Power • +8% Crit Chance',
    image: './images/s3/cursors/chaos_hex_cursor.png',
    accentColor: '#fb7185',
    glowColor: 'rgba(251, 113, 133, 0.92)',
    cpsMultiplierBonus: 0.68,
    clickMultiplierBonus: 0.58,
    critChanceBonus: 0.08,
  },
  {
    id: 'stormbreaker_cursor',
    name: 'Cosmic Stormbreaker',
    crateType: 'infinity',
    rarity: 'Legendary',
    dropWeight: 28,
    description: 'King’s Bifrost battle-axe tearing through endgame thresholds.',
    abilitySummary: '+95% Click Power • +85% CPS • +9% Crit • +0.02/Shard Ascension',
    image: './images/s3/cursors/stormbreaker_cursor.png',
    accentColor: '#22d3ee',
    glowColor: 'rgba(34, 211, 238, 0.95)',
    clickMultiplierBonus: 0.95,
    cpsMultiplierBonus: 0.85,
    critChanceBonus: 0.09,
    critMultiplierBonus: 0.85,
    ascensionBonusPerShard: 0.02,
  },
  {
    id: 'infinity_gauntlet_cursor',
    name: 'Nano Infinity Gauntlet',
    crateType: 'infinity',
    rarity: 'Mythic',
    dropWeight: 10,
    description: 'Supreme 6-Stone Nano Gauntlet pointer — immune to Mirror Freeze!',
    abilitySummary: '+140% Click Power • +125% CPS • +12% Crit • Freeze Immune!',
    image: './images/s3/cursors/infinity_gauntlet_cursor.png',
    accentColor: '#facc15',
    glowColor: 'rgba(250, 204, 21, 0.98)',
    clickMultiplierBonus: 1.4,
    cpsMultiplierBonus: 1.25,
    critChanceBonus: 0.12,
    critMultiplierBonus: 1.15,
    ascensionBonusPerShard: 0.03,
    freezeImmune: true,
  },
];

const LEGACY_CURSOR_MIGRATION: Record<string, string> = {
  wooden_cursor: 'golden_cursor',
  iron_cursor: 'diamond_cursor',
  plasma_cursor: 'galaxy_cursor',
  snowball_cursor: 'cyberpunk_cursor',
  icicle_cursor: 'glitch_cursor',
  permafrost_cursor: 'void_cursor',
  blizzard_cursor: 'gigachad_cursor',
};

export function resolveCursorId(cursorId?: string | null): string | null {
  if (!cursorId) return null;
  return LEGACY_CURSOR_MIGRATION[cursorId] || cursorId;
}

export const ALL_CURSORS: CursorDefinition[] = [STARTER_CURSOR, ...CURSORS];
export const NORMAL_CRATE_CURSORS = CURSORS.filter((c) => c.crateType === 'normal');
export const FROST_CRATE_CURSORS = CURSORS.filter((c) => c.crateType === 'frost');
export const STARK_CRATE_CURSORS = CURSORS.filter((c) => c.crateType === 'stark');
export const WAKANDA_CRATE_CURSORS = CURSORS.filter((c) => c.crateType === 'wakanda');
export const INFINITY_CRATE_CURSORS = CURSORS.filter((c) => c.crateType === 'infinity');
export const MARVEL_CURSORS = CURSORS.filter(
  (c) => c.crateType === 'stark' || c.crateType === 'wakanda' || c.crateType === 'infinity'
);

const CURSOR_MAP = new Map(ALL_CURSORS.map((c) => [c.id, c]));

export function getCursorById(cursorId?: string | null): CursorDefinition | null {
  if (!cursorId) return null;
  return CURSOR_MAP.get(cursorId) || null;
}

export function isValidCursorId(cursorId?: string | null): boolean {
  return Boolean(cursorId && CURSOR_MAP.has(cursorId));
}

