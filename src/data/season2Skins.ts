import { SEASON_2_CONFIG } from '../config/gameConfig';
import { Skin, SkinBackgroundTheme } from '../types/game';

/**
 * 1) FROZEN APOCALYPSE SEASONAL PROGRESSION SKINS
 * Unlocked automatically as players climb Frozen Apocalypse point milestones.
 */
export const FROZEN_PROGRESSION_SKINS: Skin[] = [
  {
    id: 'snowy_matthew',
    name: 'Snowy Matthew',
    rarity: 'Common',
    category: 'frozen_apocalypse',
    description: 'Frosted coat and freezing breath against the first undead frost.',
    perkDescription: '+6% Click Power & +6% CPS',
    image: './images/skins/season2/snowy_matthew.png',
    isPlaceholderArt: false,
    backgroundTheme: 'snowy',
    milestone: { type: 'lifetime_coins', target: 1e6, description: 'Reach 1M Points in Frozen Apocalypse' },
    clickBonusMultiplier: 1.0,
    cpsBonusMultiplier: 1.0,
    critBonusChance: 0,
  },
  {
    id: 'snowman_matthew',
    name: 'Snowman Matthew',
    rarity: 'Uncommon',
    category: 'frozen_apocalypse',
    description: 'Carrot-nosed frost sentry chucking packed snowballs.',
    perkDescription: '+10% Click Power & +10% CPS',
    image: './images/skins/season2/snowman_matthew.png',
    isPlaceholderArt: false,
    backgroundTheme: 'snowy',
    milestone: { type: 'lifetime_coins', target: 5e12, description: 'Reach 5T Points in Frozen Apocalypse' },
    clickBonusMultiplier: 1.0,
    cpsBonusMultiplier: 1.0,
    critBonusChance: 0,
  },
  {
    id: 'girl_matthew',
    name: 'Girl Matthew',
    rarity: 'Rare',
    category: 'frozen_apocalypse',
    description: 'Stylish frost-chic survivor rocking tundra couture.',
    perkDescription: '+22% Click Power & +20% CPS',
    image: './images/skins/season2/girl_matthew.png',
    isPlaceholderArt: false,
    backgroundTheme: 'strawberry',
    milestone: { type: 'lifetime_coins', target: 5e8, description: 'Reach 500M Points in Frozen Apocalypse' },
    clickBonusMultiplier: 1.0,
    cpsBonusMultiplier: 1.0,
    critBonusChance: 0,
  },
  {
    id: 'ice_cube_matthew',
    name: 'Ice Cube Matthew',
    rarity: 'Rare',
    category: 'frozen_apocalypse',
    description: 'Solid crystalline glacier prism deflecting zombie claws.',
    perkDescription: '+15% Click Power & +15% CPS',
    image: './images/skins/season2/ice_cube_matthew.png',
    isPlaceholderArt: false,
    backgroundTheme: 'ice',
    milestone: { type: 'lifetime_coins', target: 1e11, description: 'Reach 100B Points in Frozen Apocalypse' },
    clickBonusMultiplier: 1.0,
    cpsBonusMultiplier: 1.0,
    critBonusChance: 0,
  },
  {
    id: 'updated_mathjew',
    name: 'Updated Mathjew',
    rarity: 'Super Rare',
    category: 'frozen_apocalypse',
    description: 'Season 2 remastered Mathjew bundle-wrapped for eternal winter.',
    perkDescription: '+20% Click Power & +2% Crit Chance',
    image: './images/skins/season2/updated_mathjew.png',
    isPlaceholderArt: false,
    backgroundTheme: 'neon',
    milestone: { type: 'lifetime_coins', target: 1e14, description: 'Reach 100T Points in Frozen Apocalypse' },
    clickBonusMultiplier: 1.0,
    cpsBonusMultiplier: 1.0,
    critBonusChance: 0,
  },
  {
    id: 'naruto_matthew',
    name: 'Naruto Matthew',
    rarity: 'Epic',
    category: 'frozen_apocalypse',
    description: 'Shinobi Matthew channeling blizzard chakra.',
    perkDescription: '+30% Click Power & +28% CPS',
    image: './images/skins/season2/naruto_matthew.png',
    isPlaceholderArt: false,
    backgroundTheme: 'gold',
    milestone: { type: 'lifetime_coins', target: 5e15, description: 'Reach 5 Qa Points in Frozen Apocalypse' },
    clickBonusMultiplier: 1.0,
    cpsBonusMultiplier: 1.0,
    critBonusChance: 0,
  },
  {
    id: 'minecraft_matthew',
    name: 'Minecraft Matthew',
    rarity: 'Epic',
    category: 'frozen_apocalypse',
    description: 'Blocky diamond-armored Matthew mining permafrost ore.',
    perkDescription: '+25% Click Power & +25% CPS',
    image: './images/skins/season2/minecraft_matthew.png',
    isPlaceholderArt: false,
    backgroundTheme: 'minecraft',
    milestone: { type: 'lifetime_coins', target: 1e18, description: 'Reach 1 Qi Points in Frozen Apocalypse' },
    clickBonusMultiplier: 1.0,
    cpsBonusMultiplier: 1.0,
    critBonusChance: 0,
  },
  {
    id: 'lava_matthew',
    name: 'Lava Matthew',
    rarity: 'Legendary',
    category: 'frozen_apocalypse',
    description: 'Molten volcanic core melting entire zombie hordes instantly.',
    perkDescription: '+42% Click Power, +40% CPS & +4% Crit',
    image: './images/skins/season2/lava_matthew.png',
    isPlaceholderArt: false,
    backgroundTheme: 'lava',
    milestone: { type: 'lifetime_coins', target: 1e27, description: 'Reach 1 Oc Points in Frozen Apocalypse' },
    clickBonusMultiplier: 1.0,
    cpsBonusMultiplier: 1.0,
    critBonusChance: 0,
  },
  {
    id: 'apocalypse_matthew',
    name: 'Apocalypse Matthew',
    rarity: 'Divine',
    category: 'frozen_apocalypse',
    description: 'Battle-hardened Frozen Apocalypse survivor leading the final stand.',
    perkDescription: '+75% Click Power, +70% CPS & +6% Crit',
    image: './images/skins/season2/apocalypse_matthew.png',
    isPlaceholderArt: false,
    backgroundTheme: 'zombie',
    milestone: { type: 'lifetime_coins', target: 1e33, description: 'Reach 1 Dc Points in Frozen Apocalypse' },
    clickBonusMultiplier: 1.0,
    cpsBonusMultiplier: 1.0,
    critBonusChance: 0,
  },
];

/**
 * 2) ITEM SHOP SKINS (6 CURATED ROTATING SKINS — ALL FOOD SKINS)
 * 3 skins are featured at a time and 2 rotate out/in daily!
 */
export const ITEM_SHOP_SKINS: Skin[] = [
  // ALL FOOD SKINS (in Item Shop!)
  {
    id: 'pizza_matthew',
    name: 'Pizza Matthew',
    rarity: 'Rare',
    category: 'food_shop',
    description: 'Hot pepperoni slice fresh out of the survivor oven.',
    perkDescription: '+18% Click Power & +15% CPS',
    image: './images/skins/season2/pizza_matthew.png',
    isPlaceholderArt: false,
    backgroundTheme: 'pizza',
    gemCost: 185,
    milestone: { type: 'item_shop', target: 185, description: 'Daily Item Shop (185 Gems)' },
    clickBonusMultiplier: 1.0,
    cpsBonusMultiplier: 1.0,
    critBonusChance: 0,
  },
  {
    id: 'potato_matthew',
    name: 'Potato Matthew',
    rarity: 'Common',
    category: 'food_shop',
    description: 'Loaded baked potato warming frostbitten hands.',
    perkDescription: '+12% Click Power & +12% CPS',
    image: './images/skins/season2/potato_matthew.png',
    isPlaceholderArt: false,
    backgroundTheme: 'fries',
    gemCost: 175,
    milestone: { type: 'item_shop', target: 175, description: 'Daily Item Shop (175 Gems)' },
    clickBonusMultiplier: 1.0,
    cpsBonusMultiplier: 1.0,
    critBonusChance: 0,
  },
  {
    id: 'burger_matthew',
    name: 'Burger Matthew',
    rarity: 'Super Rare',
    category: 'food_shop',
    description: 'Double-stacked cheddar burger dripping with flavor.',
    perkDescription: '+22% Click Power & +18% CPS',
    image: './images/skins/season2/burger_matthew.png',
    isPlaceholderArt: false,
    backgroundTheme: 'burger',
    gemCost: 195,
    milestone: { type: 'item_shop', target: 195, description: 'Daily Item Shop (195 Gems)' },
    clickBonusMultiplier: 1.0,
    cpsBonusMultiplier: 1.0,
    critBonusChance: 0,
  },
  {
    id: 'fries_matthew',
    name: 'Fries Matthew',
    rarity: 'Uncommon',
    category: 'food_shop',
    description: 'Golden salted shoestring fries packed with energy.',
    perkDescription: '+14% Click Power & +14% CPS',
    image: './images/skins/season2/fries_matthew.png',
    isPlaceholderArt: false,
    backgroundTheme: 'fries',
    gemCost: 180,
    milestone: { type: 'item_shop', target: 180, description: 'Daily Item Shop (180 Gems)' },
    clickBonusMultiplier: 1.0,
    cpsBonusMultiplier: 1.0,
    critBonusChance: 0,
  },
  {
    id: 'strawberry_matthew',
    name: 'Strawberry Matthew',
    rarity: 'Rare',
    category: 'food_shop',
    description: 'Frosted ruby berry bursting with sweet click juice.',
    perkDescription: '+18% Click Power & +2% Crit Chance',
    image: './images/skins/season2/strawberry_matthew.png',
    isPlaceholderArt: false,
    backgroundTheme: 'strawberry',
    gemCost: 190,
    milestone: { type: 'item_shop', target: 190, description: 'Daily Item Shop (190 Gems)' },
    clickBonusMultiplier: 1.0,
    cpsBonusMultiplier: 1.0,
    critBonusChance: 0,
  },
  {
    id: 'chocolate_matthew',
    name: 'Chocolate Matthew',
    rarity: 'Epic',
    category: 'food_shop',
    description: 'Rich hot-fudge glaze built for winter cravings.',
    perkDescription: '+24% Click Power & +20% CPS',
    image: './images/skins/season2/chocolate_matthew.png',
    isPlaceholderArt: false,
    backgroundTheme: 'chocolate',
    gemCost: 205,
    milestone: { type: 'item_shop', target: 205, description: 'Daily Item Shop (205 Gems)' },
    clickBonusMultiplier: 1.0,
    cpsBonusMultiplier: 1.0,
    critBonusChance: 0,
  },
];

/**
 * 3) NEXT-FRIDAY LIVE EVENT EXCLUSIVES (Locked out of daily Item Shop!)
 */
export const SEASON_2_LIVE_EVENT_SKINS: Skin[] = [
  {
    id: 'zombie_matthew',
    name: 'Zombie Matthew',
    rarity: 'Mythic',
    category: 'live_event_s2',
    description: 'Next-Friday Live Event Exclusive: Undead raid commander.',
    perkDescription: '+45% Click Power, +40% CPS & +4% Crit',
    image: './images/skins/season2/zombie_matthew.png',
    isPlaceholderArt: false,
    isEventLimited: true,
    backgroundTheme: 'zombie',
    gemCost: 250,
    milestone: { type: 's2_live_event', target: 250, description: 'Next-Friday Live Event Exclusive (250 Gems)' },
    clickBonusMultiplier: 1.0,
    cpsBonusMultiplier: 1.0,
    critBonusChance: 0,
  },
  {
    id: 'ghost_matthew',
    name: 'Ghost Matthew',
    rarity: 'Divine',
    category: 'live_event_s2',
    description: 'Next-Friday Live Event Exclusive: Spectral frost phantom.',
    perkDescription: '+55% Click Power, +50% CPS & +5% Crit',
    image: './images/skins/season2/ghost_matthew.png',
    isPlaceholderArt: false,
    isEventLimited: true,
    backgroundTheme: 'ghost',
    gemCost: 300,
    milestone: { type: 's2_live_event', target: 300, description: 'Next-Friday Live Event Exclusive (300 Gems)' },
    clickBonusMultiplier: 1.0,
    cpsBonusMultiplier: 1.0,
    critBonusChance: 0,
  },
];

/**
 * 4) No separate Matthew Token Vault skins — finding a Matthew Shop Token unlocks all normal Item Shop skins FREE!
 */
export const MATTHEW_VAULT_SKINS: Skin[] = [];

/**
 * Computes which Item Shop skins are featured on a given day index (`YYYY-MM-DD`).
 * Shows up to `visibleCount` (default 3 out of 6 total pool), swapping skins out every day!
 */
export function getDailyItemShopRotation(
  dateStr: string,
  visibleCount: number = SEASON_2_CONFIG.itemShopVisibleSlots
): Skin[] {
  const pool = ITEM_SHOP_SKINS;
  if (pool.length <= visibleCount) return pool;

  const epochDay = Math.floor(Date.parse(`${dateStr}T12:00:00Z`) / (24 * 60 * 60 * 1000)) || 0;
  const shift = ((epochDay * SEASON_2_CONFIG.itemShopDailyRotateCount) % pool.length + pool.length) % pool.length;

  const rotated: Skin[] = [];
  for (let i = 0; i < visibleCount; i++) {
    rotated.push(pool[(shift + i) % pool.length]);
  }
  return rotated;
}

/**
 * Returns the animated visual theme identifier for any skin across Season 1 & Season 2.
 */
export function getSkinBackgroundTheme(skin: Skin): SkinBackgroundTheme {
  if (skin.backgroundTheme) return skin.backgroundTheme;
  if (skin.id === 'golden_matthew' || skin.id === 'champion_matthew') return 'gold';
  if (skin.id === 'god_matthew' || skin.id === 'cosmic_matthew') return 'space';
  if (skin.id === 'demon_matthew') return 'lava';
  if (skin.id === 'matthew_storm_skin_3') return 'ice';
  if (skin.id === 'matthew_storm_skin_5') return 'gold';
  return 'default';
}
