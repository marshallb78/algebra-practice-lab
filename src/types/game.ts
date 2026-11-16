export type SkinRarity =
  | 'Common'
  | 'Uncommon'
  | 'Rare'
  | 'Super Rare'
  | 'Epic'
  | 'Ultra Rare'
  | 'Legendary'
  | 'Mythic'
  | 'Divine'
  | 'Celestial';

export type SkinCategory =
  | 'existing'
  | 'characters'
  | 'realms'
  | 'achievements'
  | 'champion'
  | 'matthew_storm'
  | 'frozen_apocalypse'
  | 'item_shop'
  | 'food_shop'
  | 'matthew_vault'
  | 'live_event_s2';

export type SkinBackgroundTheme =
  | 'default'
  | 'gold'
  | 'snowy'
  | 'lava'
  | 'royal'
  | 'minecraft'
  | 'festive'
  | 'pizza'
  | 'burger'
  | 'fries'
  | 'strawberry'
  | 'chocolate'
  | 'zombie'
  | 'ice'
  | 'ghost'
  | 'neon'
  | 'space'
  | 'ocean'
  | 'infernal';

export type RealmId = 'earth' | 'under' | 'ocean' | 'space' | 'uper';

export type MilestoneType =
  | 'free'
  | 'clicks'
  | 'lifetime_coins'
  | 'upgrades'
  | 'cps'
  | 'achievements'
  | 'rebirth'
  | 'skins_unlocked'
  | 'realm'
  | 'combo'
  | 'giant_matthew'
  | 'storm_shop'
  | 'item_shop'
  | 'matthew_vault'
  | 's2_live_event'
  | 'chest_drop'
  | 'season_champion';

export interface SkinMilestone {
  type: MilestoneType;
  target: number;
  description: string;
  realmId?: RealmId;
}

export interface Skin {
  id: string;
  name: string;
  rarity: SkinRarity;
  category?: SkinCategory;
  description: string;
  perkDescription: string;
  image: string;
  /** Optional legacy/fallback image path */
  fallbackImage?: string;
  /** Used by Mathjew to briefly display a bruised face on click before fading back */
  bruisedImage?: string;
  milestone: SkinMilestone;
  gemCost?: number;
  isEventLimited?: boolean;
  isPlaceholderArt?: boolean;
  backgroundTheme?: SkinBackgroundTheme;
  clickBonusMultiplier: number;
  cpsBonusMultiplier: number;
  critBonusChance: number;
}

export type EggRarity =
  | 'Common Egg'
  | 'Uncommon Egg'
  | 'Rare Egg'
  | 'Super Rare Egg'
  | 'Epic Egg'
  | 'Ultra Rare Egg'
  | 'Legendary Egg'
  | 'Mythic Egg'
  | 'Divine Egg'
  | 'Celestial Egg';

export type FoodId =
  | 'apple'
  | 'potato'
  | 'cookie'
  | 'fries'
  | 'strawberry'
  | 'chocolate'
  | 'ice_treat'
  | 'fish'
  | 'burger'
  | 'pizza'
  | 'turkey'
  | 'steak';

export interface PetInstance {
  instanceId: string;
  speciesId: string;
  name: string;
  rarity: EggRarity;
  /** Upgrade level 1..5 */
  level: number;
  /** 0..100 hunger bar; below 25 = too tired to fight effectively */
  hunger: number;
  hatchedAt: number;
}

export type CosmeticSlot = 'hat' | 'glasses';

export interface CosmeticItem {
  id: string;
  name: string;
  slot: CosmeticSlot;
  rarity: SkinRarity;
  description: string;
  gemCost: number;
  previewColor: string;
  isPlaceholder?: boolean;
}

export interface SeasonWinnerBadge {
  seasonNumber: number;
  label: string;
  awardedAt: number;
}

export interface ActiveZombieRaidState {
  active: boolean;
  startedAtMs: number;
  endsAtMs: number;
  nextRaidAtMs: number;
  zombiesDefeatedInRaid: number;
}

export interface RealmRequirement {
  lifetimeCoins: number;
  upgradesPurchased: number;
  clicks: number;
  rebirths: number;
}

export interface RealmDefinition {
  id: RealmId;
  order: number;
  name: string;
  tagline: string;
  description: string;
  atmosphere: string;
  accentColor: string;
  coinMultiplier: number;
  skinRewardId: string;
  requirements: RealmRequirement;
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconImage?: string;
  baseCost: number;
  costMultiplier: number;
  baseCps: number;
  baseClickPower: number;
  tier?: number;
}

export interface PrestigeUpgrade {
  id: string;
  name: string;
  description: string;
  icon: string;
  baseCost: number;
  costMultiplier: number;
  maxLevel: number;
  effect: (level: number) => {
    clickMult: number;
    cpsMult: number;
    critChance: number;
    critMult: number;
    offlineMult: number;
  };
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rewardText: string;
  isPermanent?: boolean;
  isHidden?: boolean;
  condition: (stats: GameState) => boolean;
  bonusRewardCoins?: number;
  bonusRewardShards?: number;
  bonusRewardGems?: number;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  scope: 'daily' | 'seasonal';
  type: 'clicks' | 'coins' | 'upgrades' | 'crit_clicks' | 'rebirth' | 'realm_order' | 'chests_opened' | 'zombies_defeated' | 'all_monthly';
  target: number;
  rewardGems: number;
  rewardCoins: number;
}

export interface FloatingNumber {
  id: number;
  x: number;
  y: number;
  value: string;
  isCrit: boolean;
  color?: string;
}

export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  isMuted: boolean;
  isMusicPlaying: boolean;
  reducedMotion: boolean;
  showParticles: boolean;
  theme: 'cyber' | 'dark' | 'neon';
}

export interface EventParticipationStats {
  eventId: string;
  activeSeconds: number;
  gemsEarned: number;
  giantMatthewsClicked: number;
  giantMatthewRewardsCoins: number;
  stormSkinsPurchased: string[];
}

export interface SeasonHistoryEntry {
  seasonId: string;
  seasonNumber: number;
  finalScore: number;
  finalRebirths: number;
  highestRealm: RealmId;
  endedAt: number;
  wasChampion: boolean;
}

export interface GameState {
  // Seasonal Economy & Clicks
  coins: number;
  lifetimeCoins: number;
  seasonalScore: number;
  clicks: number;
  criticalClicks: number;
  combo: number;
  comboTimer: number;
  frenzyTimer: number;
  frenzyMultiplier: number;
  maxComboReached: number;

  // Seasonal Upgrades & Realms
  upgrades: Record<string, number>;
  currentRealm: RealmId;
  unlockedRealms: RealmId[];
  uperCompleted: boolean;
  uperCompletionModalDismissed: boolean;

  // Permanent Skin Collection & Equipped Character
  equippedSkin: string;
  unlockedSkins: string[];

  // Achievements & Quests
  unlockedAchievements: string[];
  permanentAchievements: string[];
  claimedQuests: string[];
  lastDailyQuestResetDate: string;

  // Seasonal Rebirth (Cosmic Ascension)
  prestigeCount: number;
  prestigeShards: number;
  lifetimePrestigeShards: number;
  prestigeUpgrades: Record<string, number>;

  // Permanent Gem Economy & Active Play Tracking
  gems: number;
  lifetimeGems: number;
  activePlaySecondsAccumulated: number;
  stormActiveSecondsAccumulated: number;
  lastActiveInputTimestamp: number;
  lastDailyLoginClaimDate: string | null;

  // Season & Event Metadata
  currentSeasonId: string;
  seasonHistory: SeasonHistoryEntry[];
  eventStats: EventParticipationStats;

  // Season 2: Frozen Apocalypse Pets, Eggs, Food, Cosmetics, Shop, Clans & Raid State
  pets: PetInstance[];
  equippedPetIds: string[];
  sealedEggs: Record<EggRarity, number>;
  foodInventory: Record<FoodId, number>;
  ownedCosmetics: string[];
  equippedCosmetics: {
    hat: string | null;
    glasses: string | null;
  };
  hasMatthewShopToken: boolean;
  matthewShopTokens?: number;
  unlockedCursors?: string[];
  equippedCursorId?: string | null;
  cratesOpened?: number;
  chestsOpened: number;
  zombiesDefeated: number;
  zombiesStolenCoins: number;
  zombieHitsTaken?: number;
  season2IntroSeen: boolean;
  winnerBadges: SeasonWinnerBadge[];
  clanId: string | null;
  clanName: string | null;
  sandboxS2Enabled?: boolean;
  activeSessionToken?: string;

  // Timestamps & Lifetime Career Stats
  lastSaveTime: number;
  totalPlaytimeSeconds: number;
  lifetimeAllSeasonsCoins: number;
  lifetimeAllSeasonsClicks: number;
  highestCps?: number;
  goldenMatthewsClicked: number;
  giantMatthewsClicked: number;
  selectedEnvironment?: string;
  introCutsceneSeen: boolean;
  discoveredEasterEggs: string[];
  lastBetaWipeId?: string | null;
  lastOwnerUid?: string | null;
  appliedCloudAdjustmentAtMs?: number;
  cloudAccount?: {
    uid: string;
    username: string;
    displayUsername: string;
    lastCloudSync: number;
  } | null;
  settings: GameSettings;
}
