import { GameState, RealmId, PetInstance, EggRarity, FoodId } from '../types/game';
import { calculateCPS, clampFiniteCoinAmount, MAX_SAFE_SEASON_COINS } from './calculations';
import { isValidSkinId, isSeason2OnlySkinId, checkAndApplyMilestoneUnlocks } from '../data/skins';
import {
  createEmptySealedEggs,
  createDefaultFoodInventory,
  getPetSpeciesDefinition,
  normalizeEggRarity,
  normalizePetSpeciesId,
} from '../data/petsAndEggs';
import { COSMETIC_ITEMS } from '../data/cosmetics';
import { ITEM_SHOP_SKINS, MATTHEW_VAULT_SKINS } from '../data/season2Skins';
import { CRATE_DEFINITIONS } from '../data/crates';
import { ALL_CURSORS, STARTER_CURSOR_ID, isValidCursorId, resolveCursorId } from '../data/cursors';
import { getActiveSeason, getAuthoritativeDateString } from './scheduleEngine';
import {
  MATTHEW_STORM_CONFIG,
  BETA_RESET_CONFIG,
  SEASON_2_CONFIG,
  TEST_ISOLATION_CONFIG,
  isSandboxSeason2Context,
} from '../config/gameConfig';

const SAVE_KEY = 'matthew_clicker_save_v1';

const VALID_REALMS: RealmId[] = ['earth', 'under', 'ocean', 'space', 'uper'];
const VALID_COSMETIC_IDS = new Set(COSMETIC_ITEMS.map((c) => c.id));

/**
 * Returns all Item Shop, Vault, and Crate skins unlocked permanently for Matthew Shop Token holders.
 */
export function getPermanentTokenFreeSkinIds(preLaunchLive = false): string[] {
  return Array.from(
    new Set([
      ...ITEM_SHOP_SKINS.map((s) => s.id),
      ...MATTHEW_VAULT_SKINS.map((s) => s.id),
      ...CRATE_DEFINITIONS.normal.skins.map((s) => s.skinId),
      ...CRATE_DEFINITIONS.frost.skins.map((s) => s.skinId),
    ])
  ).filter((id) => isValidSkinId(id) && (!preLaunchLive || !isSeason2OnlySkinId(id)));
}

export function getDefaultGameState(): GameState {
  const activeSeason = getActiveSeason();
  return {
    coins: 0,
    lifetimeCoins: 0,
    seasonalScore: 0,
    clicks: 0,
    criticalClicks: 0,
    combo: 0,
    comboTimer: 0,
    frenzyTimer: 0,
    frenzyMultiplier: 1,
    maxComboReached: 0,

    upgrades: {},
    currentRealm: 'earth',
    unlockedRealms: ['earth'],
    uperCompleted: false,
    uperCompletionModalDismissed: false,

    equippedSkin: 'classic_matthew',
    unlockedSkins: ['classic_matthew'],

    unlockedAchievements: [],
    permanentAchievements: [],
    claimedQuests: [],
    lastDailyQuestResetDate: getAuthoritativeDateString(),

    prestigeCount: 0,
    prestigeShards: 0,
    lifetimePrestigeShards: 0,
    prestigeUpgrades: {},

    gems: 0,
    lifetimeGems: 0,
    activePlaySecondsAccumulated: 0,
    stormActiveSecondsAccumulated: 0,
    lastActiveInputTimestamp: Date.now(),
    lastDailyLoginClaimDate: null,

    currentSeasonId: activeSeason.seasonId,
    seasonHistory: [],
    eventStats: {
      eventId: MATTHEW_STORM_CONFIG.eventId,
      activeSeconds: 0,
      gemsEarned: 0,
      giantMatthewsClicked: 0,
      giantMatthewRewardsCoins: 0,
      stormSkinsPurchased: [],
    },

    pets: [],
    equippedPetIds: [],
    sealedEggs: createEmptySealedEggs(),
    foodInventory: createDefaultFoodInventory(),
    ownedCosmetics: [],
    equippedCosmetics: { hat: null, glasses: null },
    hasMatthewShopToken: false,
    matthewShopTokens: 0,
    unlockedCursors: [STARTER_CURSOR_ID],
    equippedCursorId: STARTER_CURSOR_ID,
    cratesOpened: 0,
    chestsOpened: 0,
    zombiesDefeated: 0,
    zombiesStolenCoins: 0,
    zombieHitsTaken: 0,
    season2IntroSeen: false,
    winnerBadges: [],
    clanId: null,
    clanName: null,
    sandboxS2Enabled: false,

    lastSaveTime: Date.now(),
    totalPlaytimeSeconds: 0,
    lifetimeAllSeasonsCoins: 0,
    lifetimeAllSeasonsClicks: 0,
    highestCps: 0,
    goldenMatthewsClicked: 0,
    giantMatthewsClicked: 0,
    introCutsceneSeen: false,
    discoveredEasterEggs: [],
    lastBetaWipeId:
      Date.now() >= BETA_RESET_CONFIG.resetTimeMs ? BETA_RESET_CONFIG.wipeId : null,
    lastOwnerUid: null,
    cloudAccount: null,

    settings: {
      masterVolume: 0.8,
      sfxVolume: 0.9,
      musicVolume: 0.45,
      isMuted: false,
      isMusicPlaying: true,
      reducedMotion: false,
      showParticles: true,
      theme: 'cyber',
    },
  };
}

/**
 * Resets seasonal progression at a 30-day season boundary while preserving
 * permanent skins, gems, lifetime stats, permanent achievements, and season history.
 */
export function performSeasonalRollover(
  state: GameState,
  newSeasonId: string,
  wasChampion = false,
  wasTop10 = false
): GameState {
  const unlockedRealms = state.unlockedRealms || ['earth'];
  const realmPriority: RealmId[] = ['uper', 'space', 'ocean', 'under', 'earth'];
  const highestRealm = realmPriority.find((r) => unlockedRealms.includes(r)) || 'earth';
  const prevSeasonNum = parseInt((state.currentSeasonId || 'season_1').replace('season_', ''), 10) || 1;

  const rewardSkinIds: string[] = [];
  if (wasChampion) rewardSkinIds.push('champion_matthew', 'liam_matthew');
  else if (wasTop10) rewardSkinIds.push('liam_matthew');

  const nextUnlockedSkins = Array.from(
    new Set([...(state.unlockedSkins || ['classic_matthew']), ...rewardSkinIds])
  );

  const nextWinnerBadges = Array.isArray(state.winnerBadges) ? [...state.winnerBadges] : [];
  if (wasChampion && !nextWinnerBadges.some((b) => b.seasonNumber === prevSeasonNum)) {
    nextWinnerBadges.push({
      seasonNumber: prevSeasonNum,
      label: `Season ${prevSeasonNum} Winner`,
      awardedAt: Date.now(),
    });
  }

  return {
    ...state,
    sandboxS2Enabled: false,
    coins: 0,
    lifetimeCoins: 0,
    seasonalScore: 0,
    clicks: 0,
    criticalClicks: 0,
    combo: 0,
    comboTimer: 0,
    frenzyTimer: 0,
    frenzyMultiplier: 1,
    maxComboReached: 0,

    upgrades: {},
    currentRealm: 'earth',
    unlockedRealms: ['earth'],
    uperCompleted: false,
    uperCompletionModalDismissed: false,

    unlockedSkins: nextUnlockedSkins,
    equippedSkin: wasChampion ? 'champion_matthew' : state.equippedSkin,

    unlockedAchievements: [],
    claimedQuests: [],

    prestigeCount: 0,
    prestigeShards: 0,
    lifetimePrestigeShards: 0,
    prestigeUpgrades: {},

    gems: Math.max(0, state.gems || 0),
    activePlaySecondsAccumulated: 0,
    stormActiveSecondsAccumulated: 0,

    // Season 2: Skins, Cosmetics, and Matthew Shop Token (+ unlocked cursors) persist forever across seasons
    ownedCosmetics: (state.ownedCosmetics || []).filter((id) => VALID_COSMETIC_IDS.has(id)),
    equippedCosmetics: {
      hat: null,
      glasses:
        state.equippedCosmetics?.glasses &&
        VALID_COSMETIC_IDS.has(state.equippedCosmetics.glasses)
          ? state.equippedCosmetics.glasses
          : null,
    },
    pets: [],
    equippedPetIds: [],
    sealedEggs: createEmptySealedEggs(),
    foodInventory: createDefaultFoodInventory(),
    ...(() => {
      const keepShopToken = Boolean(
        state.hasMatthewShopToken || (state.matthewShopTokens || 0) > 0
      );
      return {
        hasMatthewShopToken: keepShopToken,
        matthewShopTokens: keepShopToken ? Math.max(1, state.matthewShopTokens || 1) : 0,
      };
    })(),
    unlockedCursors: (state.unlockedCursors || []).filter((id) => isValidCursorId(id)),
    equippedCursorId: isValidCursorId(state.equippedCursorId) ? state.equippedCursorId : null,
    cratesOpened: state.cratesOpened || 0,
    chestsOpened: state.chestsOpened || 0,
    zombiesDefeated: 0,
    zombiesStolenCoins: 0,
    zombieHitsTaken: 0,

    winnerBadges: nextWinnerBadges,
    season2IntroSeen: newSeasonId === 'season_2' ? false : state.season2IntroSeen,

    lifetimeAllSeasonsCoins: Math.max(
      state.lifetimeAllSeasonsCoins || 0,
      (state.lifetimeAllSeasonsCoins || 0) + (state.lifetimeCoins || 0)
    ),
    lifetimeAllSeasonsClicks: Math.max(
      state.lifetimeAllSeasonsClicks || 0,
      (state.lifetimeAllSeasonsClicks || 0) + (state.clicks || 0)
    ),
    highestCps: state.highestCps || 0,

    currentSeasonId: newSeasonId,
    eventStats: {
      eventId: MATTHEW_STORM_CONFIG.eventId,
      activeSeconds: 0,
      gemsEarned: 0,
      giantMatthewsClicked: 0,
      giantMatthewRewardsCoins: 0,
      stormSkinsPurchased: [],
    },
    seasonHistory: [
      ...(state.seasonHistory || []),
      {
        seasonId: state.currentSeasonId || 'season_1',
        seasonNumber: prevSeasonNum,
        finalScore: Math.max(state.seasonalScore || 0, Math.floor(state.lifetimeCoins || 0)),
        finalRebirths: state.prestigeCount || 0,
        highestRealm,
        endedAt: Date.now(),
        wasChampion,
      },
    ],
    // Discard uncollected previous-season offline earnings
    lastSaveTime: Date.now(),
  };
}

export function saveGame(
  state: GameState,
  preserveTimestamp = false,
  storageKeyOverride?: string
): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return false;
    }
    const isSandbox = isSandboxSeason2Context(
      state.cloudAccount?.uid,
      state.sandboxS2Enabled
    );
    if (isSandbox) {
      // Dev Season 2 preview before Monday launch is strictly ephemeral (never persists across reloads)
      window.localStorage.removeItem(TEST_ISOLATION_CONFIG.sandboxStorageKey);
      return true;
    }
    const targetKey = storageKeyOverride || SAVE_KEY;
    const toSave: GameState = {
      ...state,
      lastOwnerUid: state.cloudAccount?.uid || state.lastOwnerUid || null,
      lastSaveTime: preserveTimestamp && state.lastSaveTime ? state.lastSaveTime : Date.now(),
    };
    window.localStorage.setItem(targetKey, JSON.stringify(toSave));
    return true;
  } catch (err) {
    console.error('Failed to save game state to localStorage:', err);
    return false;
  }
}

export function loadSandboxGame(): GameState {
  try {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.removeItem(TEST_ISOLATION_CONFIG.sandboxStorageKey);
    }
  } catch {
    // ignore storage cleanup error
  }
  return {
    ...getDefaultGameState(),
    currentSeasonId: 'season_2',
    coins: 0,
    lifetimeCoins: 0,
    seasonalScore: 0,
    sandboxS2Enabled: true,
  };
}

/**
 * Safely sanitizes, migrates, and validates a parsed save object.
 * - Preserves legitimate unlocked skins and permanent currencies (Gems).
 * - Validates equipped skin against the unlocked collection; falls back to Classic Matthew if invalid/locked.
 * - NEVER grants a skin solely because an old save claims it is equipped.
 * - Recalculates milestone eligibility and unlocks/equips newly earned skins.
 * - Leaves coins, upgrades, achievements, and prestige stats intact without data loss.
 */
export function sanitizeAndValidateGameState(parsed: any): GameState {
  const def = getDefaultGameState();
  if (!parsed || typeof parsed !== 'object') {
    return def;
  }

  // 1. Sanitize raw numeric and object stats safely
  const coins = clampFiniteCoinAmount(
    typeof parsed.coins === 'number' ? parsed.coins : def.coins,
    MAX_SAFE_SEASON_COINS
  );
  const lifetimeCoins = clampFiniteCoinAmount(
    typeof parsed.lifetimeCoins === 'number' ? parsed.lifetimeCoins : Math.max(coins, def.lifetimeCoins),
    MAX_SAFE_SEASON_COINS
  );
  const seasonalScore = clampFiniteCoinAmount(
    Math.max(
      Math.floor(lifetimeCoins),
      typeof parsed.seasonalScore === 'number' ? Math.floor(parsed.seasonalScore) : 0
    ),
    MAX_SAFE_SEASON_COINS
  );
  const clicks = Math.max(0, typeof parsed.clicks === 'number' && !isNaN(parsed.clicks) ? parsed.clicks : def.clicks);
  const criticalClicks = Math.max(
    0,
    typeof parsed.criticalClicks === 'number' && !isNaN(parsed.criticalClicks)
      ? parsed.criticalClicks
      : def.criticalClicks
  );
  const maxComboReached = Math.max(
    0,
    typeof parsed.maxComboReached === 'number' && !isNaN(parsed.maxComboReached) ? parsed.maxComboReached : 0
  );
  const upgrades = parsed.upgrades && typeof parsed.upgrades === 'object' ? parsed.upgrades : def.upgrades;
  const unlockedAchievements = Array.isArray(parsed.unlockedAchievements)
    ? parsed.unlockedAchievements
    : def.unlockedAchievements;
  const permanentAchievements = Array.isArray(parsed.permanentAchievements)
    ? parsed.permanentAchievements
    : def.permanentAchievements;
  const claimedQuests = Array.isArray(parsed.claimedQuests) ? parsed.claimedQuests : [];

  const prestigeCount = Math.max(
    0,
    typeof parsed.prestigeCount === 'number' && !isNaN(parsed.prestigeCount) ? parsed.prestigeCount : def.prestigeCount
  );
  const prestigeShards = Math.max(
    0,
    typeof parsed.prestigeShards === 'number' && !isNaN(parsed.prestigeShards)
      ? parsed.prestigeShards
      : def.prestigeShards
  );
  const lifetimePrestigeShards = Math.max(
    0,
    typeof parsed.lifetimePrestigeShards === 'number' && !isNaN(parsed.lifetimePrestigeShards)
      ? parsed.lifetimePrestigeShards
      : def.lifetimePrestigeShards
  );
  const prestigeUpgrades =
    parsed.prestigeUpgrades && typeof parsed.prestigeUpgrades === 'object'
      ? parsed.prestigeUpgrades
      : def.prestigeUpgrades;

  // Realms
  let unlockedRealms: RealmId[] = ['earth'];
  if (Array.isArray(parsed.unlockedRealms)) {
    const validR = parsed.unlockedRealms.filter((r: unknown): r is RealmId =>
      typeof r === 'string' && VALID_REALMS.includes(r as RealmId)
    );
    unlockedRealms = Array.from(new Set<RealmId>(['earth', ...validR]));
  }
  const currentRealm: RealmId =
    typeof parsed.currentRealm === 'string' && unlockedRealms.includes(parsed.currentRealm as RealmId)
      ? (parsed.currentRealm as RealmId)
      : 'earth';

  // Gems & Active Play
  const gems = Math.max(0, typeof parsed.gems === 'number' && !isNaN(parsed.gems) ? Math.floor(parsed.gems) : 0);
  const lifetimeGems = Math.max(
    gems,
    typeof parsed.lifetimeGems === 'number' && !isNaN(parsed.lifetimeGems) ? Math.floor(parsed.lifetimeGems) : gems
  );
  const activePlaySecondsAccumulated = Math.max(
    0,
    typeof parsed.activePlaySecondsAccumulated === 'number' && !isNaN(parsed.activePlaySecondsAccumulated)
      ? parsed.activePlaySecondsAccumulated
      : 0
  );
  const stormActiveSecondsAccumulated = Math.max(
    0,
    typeof parsed.stormActiveSecondsAccumulated === 'number' && !isNaN(parsed.stormActiveSecondsAccumulated)
      ? parsed.stormActiveSecondsAccumulated
      : 0
  );

  const lastSaveTime =
    typeof parsed.lastSaveTime === 'number' && !isNaN(parsed.lastSaveTime) ? parsed.lastSaveTime : Date.now();
  const totalPlaytimeSeconds = Math.max(
    0,
    typeof parsed.totalPlaytimeSeconds === 'number' && !isNaN(parsed.totalPlaytimeSeconds)
      ? parsed.totalPlaytimeSeconds
      : def.totalPlaytimeSeconds
  );
  const goldenMatthewsClicked = Math.max(
    0,
    typeof parsed.goldenMatthewsClicked === 'number' && !isNaN(parsed.goldenMatthewsClicked)
      ? parsed.goldenMatthewsClicked
      : def.goldenMatthewsClicked
  );
  const giantMatthewsClicked = Math.max(
    0,
    typeof parsed.giantMatthewsClicked === 'number' && !isNaN(parsed.giantMatthewsClicked)
      ? parsed.giantMatthewsClicked
      : 0
  );

  const settings = {
    ...def.settings,
    ...(parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}),
    isMusicPlaying: true,
  };

  // 2. Preserve legitimate unlocked skins, strictly discarding non-existent IDs.
  // Classic Matthew is always unlocked. Migrate any legacy mathjew ID to updated mathjew.
  const normalizeSkinId = (id: string) =>
    id === 'og_mathjew' || id === 'updated_mathjew' ? 'mathjew' : id;

  const hasPermanentToken =
    Boolean(parsed.hasMatthewShopToken) ||
    (typeof parsed.matthewShopTokens === 'number' && parsed.matthewShopTokens > 0);
  const preLaunchLive =
    Date.now() < SEASON_2_CONFIG.launchTimeMs &&
    !parsed.sandboxS2Enabled &&
    (!parsed.currentSeasonId || parsed.currentSeasonId === 'season_1');
  const legitimateUnlocked = Array.isArray(parsed.unlockedSkins)
    ? parsed.unlockedSkins
        .filter((id: unknown): id is string => typeof id === 'string')
        .map(normalizeSkinId)
        .filter((id: string) => isValidSkinId(id) && (!preLaunchLive || !isSeason2OnlySkinId(id)))
    : [];
  const tokenFreeSkinIds = hasPermanentToken ? getPermanentTokenFreeSkinIds(preLaunchLive) : [];
  const validUnlockedSkins = Array.from(
    new Set(['classic_matthew', ...legitimateUnlocked, ...tokenFreeSkinIds])
  );

  // 3. Validate equipped skin against legitimate unlocked collection.
  // NEVER grant a skin solely because an old save claims it was equipped.
  const normalizedEquippedSkin =
    typeof parsed.equippedSkin === 'string' ? normalizeSkinId(parsed.equippedSkin) : '';
  const hasValidEquippedSkin =
    Boolean(normalizedEquippedSkin) &&
    isValidSkinId(normalizedEquippedSkin) &&
    validUnlockedSkins.includes(normalizedEquippedSkin);

  const initialEquippedSkin = hasValidEquippedSkin ? normalizedEquippedSkin : 'classic_matthew';

  const baseState: GameState = {
    coins,
    lifetimeCoins,
    seasonalScore,
    clicks,
    criticalClicks,
    combo: 0,
    comboTimer: 0,
    frenzyTimer: 0,
    frenzyMultiplier: 1,
    maxComboReached,

    upgrades,
    currentRealm,
    unlockedRealms,
    uperCompleted: Boolean(parsed.uperCompleted || unlockedRealms.includes('uper')),
    uperCompletionModalDismissed: Boolean(parsed.uperCompletionModalDismissed),

    equippedSkin: initialEquippedSkin,
    unlockedSkins: validUnlockedSkins,

    unlockedAchievements,
    permanentAchievements,
    claimedQuests,
    lastDailyQuestResetDate:
      typeof parsed.lastDailyQuestResetDate === 'string'
        ? parsed.lastDailyQuestResetDate
        : getAuthoritativeDateString(),

    prestigeCount,
    prestigeShards,
    lifetimePrestigeShards,
    prestigeUpgrades,

    gems,
    lifetimeGems,
    activePlaySecondsAccumulated,
    stormActiveSecondsAccumulated,
    lastActiveInputTimestamp: Date.now(),
    lastDailyLoginClaimDate:
      typeof parsed.lastDailyLoginClaimDate === 'string' ? parsed.lastDailyLoginClaimDate : null,

    currentSeasonId:
      typeof parsed.currentSeasonId === 'string' ? parsed.currentSeasonId : def.currentSeasonId,
    seasonHistory: Array.isArray(parsed.seasonHistory) ? parsed.seasonHistory : [],
    eventStats:
      parsed.eventStats && typeof parsed.eventStats === 'object'
        ? { ...def.eventStats, ...parsed.eventStats }
        : def.eventStats,

    pets: Array.isArray(parsed.pets)
      ? parsed.pets
          .filter((p: unknown): p is PetInstance => Boolean(p && typeof p === 'object' && (p as PetInstance).instanceId))
          .map((p: PetInstance) => {
            const normRarity = normalizeEggRarity(p.rarity);
            const normSpecies = normalizePetSpeciesId(p.speciesId);
            const spec = getPetSpeciesDefinition(normSpecies, normRarity);
            return {
              ...p,
              rarity: normRarity,
              speciesId: spec.speciesId,
              name: spec.name,
              level: Math.max(1, Math.floor(p.level || 1)),
              hunger: 100,
            };
          })
      : [],
    equippedPetIds: Array.isArray(parsed.equippedPetIds)
      ? parsed.equippedPetIds
          .filter((id: unknown): id is string => typeof id === 'string')
          .slice(0, SEASON_2_CONFIG.maxEquippedPets)
      : [],
    sealedEggs: (() => {
      const base = createEmptySealedEggs();
      if (parsed.sealedEggs && typeof parsed.sealedEggs === 'object') {
        for (const [rawKey, rawVal] of Object.entries(parsed.sealedEggs as Record<string, unknown>)) {
          const val = Math.max(0, typeof rawVal === 'number' && !isNaN(rawVal) ? Math.floor(rawVal) : 0);
          if (val > 0) {
            const normKey = normalizeEggRarity(rawKey);
            base[normKey] = (base[normKey] || 0) + val;
          }
        }
      }
      return base;
    })(),
    foodInventory: (() => {
      const base = createDefaultFoodInventory();
      if (parsed.foodInventory && typeof parsed.foodInventory === 'object') {
        for (const k of Object.keys(base) as FoodId[]) {
          const val = (parsed.foodInventory as Record<string, unknown>)[k];
          base[k] = Math.max(0, typeof val === 'number' && !isNaN(val) ? Math.floor(val) : base[k]);
        }
      }
      return base;
    })(),
    ownedCosmetics: hasPermanentToken
      ? COSMETIC_ITEMS.map((c) => c.id)
      : Array.isArray(parsed.ownedCosmetics)
      ? parsed.ownedCosmetics.filter((id: unknown): id is string => typeof id === 'string' && VALID_COSMETIC_IDS.has(id))
      : [],
    equippedCosmetics: {
      hat: null,
      glasses:
        parsed.equippedCosmetics?.glasses &&
        VALID_COSMETIC_IDS.has(parsed.equippedCosmetics.glasses) &&
        (hasPermanentToken ||
          (Array.isArray(parsed.ownedCosmetics) &&
            parsed.ownedCosmetics.includes(parsed.equippedCosmetics.glasses)))
          ? parsed.equippedCosmetics.glasses
          : null,
    },
    ...(() => {
      const tokens =
        typeof parsed.matthewShopTokens === 'number' && !isNaN(parsed.matthewShopTokens)
          ? Math.max(0, Math.floor(parsed.matthewShopTokens))
          : parsed.hasMatthewShopToken
          ? 1
          : 0;
      const active = Boolean(parsed.hasMatthewShopToken) || tokens > 0;
      return {
        matthewShopTokens: active ? Math.max(1, tokens) : 0,
        hasMatthewShopToken: active,
      };
    })(),
    ...(() => {
      const hasToken =
        Boolean(parsed.hasMatthewShopToken) ||
        (typeof parsed.matthewShopTokens === 'number' && parsed.matthewShopTokens > 0);
      const migratedList = Array.isArray(parsed.unlockedCursors)
        ? parsed.unlockedCursors
            .map((id: unknown) => (typeof id === 'string' ? resolveCursorId(id) : null))
            .filter((id: string | null): id is string => Boolean(id && isValidCursorId(id)))
        : [];
      const sanitizedUnlocked = Array.from(
        new Set([
          STARTER_CURSOR_ID,
          ...migratedList,
          ...(hasToken ? ALL_CURSORS.map((c) => c.id) : []),
        ])
      );
      const resolvedEquipped =
        parsed.equippedCursorId === null
          ? null
          : typeof parsed.equippedCursorId === 'string'
          ? resolveCursorId(parsed.equippedCursorId)
          : STARTER_CURSOR_ID;
      const sanitizedEquipped =
        resolvedEquipped === null
          ? null
          : resolvedEquipped &&
            isValidCursorId(resolvedEquipped) &&
            sanitizedUnlocked.includes(resolvedEquipped)
          ? resolvedEquipped
          : STARTER_CURSOR_ID;
      return {
        unlockedCursors: sanitizedUnlocked,
        equippedCursorId: sanitizedEquipped,
      };
    })(),
    cratesOpened: Math.max(0, Number(parsed.cratesOpened) || 0),
    chestsOpened: Math.max(0, Number(parsed.chestsOpened) || 0),
    zombiesDefeated: Math.max(0, Number(parsed.zombiesDefeated) || 0),
    zombiesStolenCoins: Math.max(0, Number(parsed.zombiesStolenCoins) || 0),
    zombieHitsTaken: Math.max(0, Number(parsed.zombieHitsTaken) || 0),
    season2IntroSeen: Boolean(parsed.season2IntroSeen),
    winnerBadges: Array.isArray(parsed.winnerBadges) ? parsed.winnerBadges : [],
    clanId: typeof parsed.clanId === 'string' ? parsed.clanId : null,
    clanName: typeof parsed.clanName === 'string' ? parsed.clanName : null,
    sandboxS2Enabled: Boolean(parsed.sandboxS2Enabled),
    activeSessionToken: typeof parsed.activeSessionToken === 'string' ? parsed.activeSessionToken : undefined,

    lastSaveTime,
    totalPlaytimeSeconds,
    lifetimeAllSeasonsCoins: Math.max(
      lifetimeCoins,
      typeof parsed.lifetimeAllSeasonsCoins === 'number' ? parsed.lifetimeAllSeasonsCoins : 0
    ),
    lifetimeAllSeasonsClicks: Math.max(
      clicks,
      typeof parsed.lifetimeAllSeasonsClicks === 'number' ? parsed.lifetimeAllSeasonsClicks : 0
    ),
    highestCps: Math.max(0, Number(parsed.highestCps) || 0),
    goldenMatthewsClicked,
    giantMatthewsClicked,
    selectedEnvironment: parsed.selectedEnvironment,
    introCutsceneSeen: Boolean(parsed.introCutsceneSeen),
    discoveredEasterEggs: Array.isArray(parsed.discoveredEasterEggs) ? parsed.discoveredEasterEggs : [],
    lastBetaWipeId: typeof parsed.lastBetaWipeId === 'string' ? parsed.lastBetaWipeId : null,
    lastOwnerUid:
      typeof parsed.lastOwnerUid === 'string'
        ? parsed.lastOwnerUid
        : parsed.cloudAccount?.uid || null,
    appliedCloudAdjustmentAtMs:
      typeof parsed.appliedCloudAdjustmentAtMs === 'number' && !isNaN(parsed.appliedCloudAdjustmentAtMs)
        ? parsed.appliedCloudAdjustmentAtMs
        : undefined,
    cloudAccount: parsed.cloudAccount && typeof parsed.cloudAccount === 'object' ? parsed.cloudAccount : null,
    settings,
  };

  // 4. Recalculate milestone eligibility using existing progression rules.
  const currentCps = calculateCPS(baseState);
  const shouldAutoEquip = !hasValidEquippedSkin;
  const { state: reconciledState } = checkAndApplyMilestoneUnlocks(baseState, currentCps, shouldAutoEquip);

  return reconciledState;
}

/**
 * Enforces the Monday 1:00 AM Beta Reset for both local (guest) and signed-in players.
 * Once the clock reaches BETA_RESET_CONFIG.resetTimeMs, any save that does not yet carry
 * BETA_RESET_CONFIG.wipeId has all progress (coins, upgrades, rebirths, skins, gems, quests) wiped!
 */
export function performBetaWipeIfDue(
  state: GameState,
  _nowMs: number = Date.now()
): { state: GameState; wiped: boolean } {
  // Beta reset is complete; never reset any player's local or cloud progress.
  return { state, wiped: false };
}

export function loadGame(): GameState {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return getDefaultGameState();
    }
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return getDefaultGameState();

    const parsed = JSON.parse(raw);
    const sanitized = sanitizeAndValidateGameState(parsed);
    const { state: finalState } = performBetaWipeIfDue(sanitized);

    saveGame(finalState, true);
    return finalState;
  } catch (err) {
    console.error('Save file corrupted, recovering default game state:', err);
    return getDefaultGameState();
  }
}

export function exportSaveString(state: GameState): string {
  const json = JSON.stringify({
    ...state,
    exportTimestamp: Date.now(),
    version: '1.1',
  });
  return btoa(encodeURIComponent(json));
}

export function importSaveString(encoded: string): GameState {
  try {
    const json = decodeURIComponent(atob(encoded.trim()));
    const parsed = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Invalid save data format.');
    }

    const imported = sanitizeAndValidateGameState(parsed);
    saveGame(imported);
    return imported;
  } catch (err: unknown) {
    if ((err as Error)?.message === 'Invalid save data format.') {
      throw err;
    }
    throw new Error('Failed to import save code. Please ensure the code is valid.');
  }
}

export function clearSavedGame(): GameState {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    window.localStorage.removeItem(SAVE_KEY);
  }
  return getDefaultGameState();
}
