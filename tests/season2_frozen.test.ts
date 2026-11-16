import { describe, it, expect, vi } from 'vitest';
import {
  getDefaultGameState,
  saveGame,
  loadSandboxGame,
  performSeasonalRollover,
  sanitizeAndValidateGameState,
} from '../src/utils/storage';
import { getEffectiveSeasonInfo } from '../src/utils/scheduleEngine';
import {
  SEASON_2_CONFIG,
  TEST_ISOLATION_CONFIG,
} from '../src/config/gameConfig';
import { ALL_SKINS, getProgressionSkinsForSeason } from '../src/data/skins';
import { scopeRtdbPath } from '../src/firebase/config';
import {
  FROZEN_PROGRESSION_SKINS,
  ITEM_SHOP_SKINS,
  MATTHEW_VAULT_SKINS,
  getDailyItemShopRotation,
} from '../src/data/season2Skins';
import { AntiAutoclickerGuard } from '../src/utils/antiAutoclicker';
import {
  EGG_DEFINITIONS,
  PET_SPECIES_CATALOG,
  createStarterFrostPup,
  getPetAnimationFrames,
  getPetClickMultiplierBonus,
  getPetCombatDps,
  getPetSpeciesDefinition,
  getPetUpgradeGemCost,
  normalizeEggRarity,
  rollChestLoot,
  rollHatchedPetSpecies,
} from '../src/data/petsAndEggs';
import { reconcileCloudAndLocalState } from '../src/firebase/cloudSave';
import { applyTradeSwapToState } from '../src/firebase/clansAndTrades';
import { formatCoins } from '../src/utils/formatters';
import { SEASON_2_UPGRADES } from '../src/data/season2Upgrades';
import { checkAndAutoClaimQuests, QUESTS } from '../src/data/quests';
import {
  CURSORS,
  FROST_CRATE_CURSORS,
  NORMAL_CRATE_CURSORS,
  getCursorById,
} from '../src/data/cursors';
import { CRATE_DEFINITIONS, rollCrateReward } from '../src/data/crates';
import { calculateClickPower, calculateCPS } from '../src/utils/calculations';
import {
  LIAM_S2_ADJUSTED_LIFETIME_COINS,
  LIAM_S2_ADJUSTED_SHARDS,
  LIAM_S2_REBALANCE_REVISION_MS,
  LIAM_S2_REBALANCE_UID,
  buildLeaderboardPayload,
  isExcludedFromLeaderboard,
} from '../src/firebase/leaderboard';
import { PLAYER_TRIGGERABLE_EVENTS, summonGlobalLiveEvent } from '../src/firebase/liveEvents';

describe('Season 2: Frozen Apocalypse Systems & Isolation', () => {
  it('locks Season 2 in Downtime until Monday midnight while restricting preview strictly to the 2 dev UIDs', () => {
    const nov12Ms = Date.UTC(2026, 10, 12, 18, 0, 0);
    const saturdayNov14Ms = Date.UTC(2026, 10, 14, 17, 0, 0);
    const mondayNov16Ms = Date.UTC(2026, 10, 16, 6, 0, 0);

    const publicPlayerSeason = getEffectiveSeasonInfo('regular_uid', false, nov12Ms);
    expect(publicPlayerSeason.isDowntime).toBe(true);
    expect(publicPlayerSeason.downtimeRemainingSeconds).toBeGreaterThan(0);
    expect(publicPlayerSeason.nextSeasonStartMs).toBe(SEASON_2_CONFIG.launchTimeMs);
    expect(publicPlayerSeason.isSandbox).toBe(false);
    expect(publicPlayerSeason.isFrozenApocalypseActive).toBe(false);

    // Inspect-element / localStorage tampering with sandboxEnabled=true is blocked for non-dev UIDs
    const spoofedBypass = getEffectiveSeasonInfo('regular_uid', true, saturdayNov14Ms);
    expect(spoofedBypass.isDowntime).toBe(true);
    expect(spoofedBypass.isSandbox).toBe(false);

    const satPublic = getEffectiveSeasonInfo(null, false, saturdayNov14Ms);
    expect(satPublic.isDowntime).toBe(true);

    // Only the 2 verified dev UIDs (`Marshallb78` & `testmarshall`) can toggle Season 2 preview before Monday
    for (const devUid of ['89nsfff2YtaEVcNTHUBDq22V4FW2', 'cKFezHsISfbZGH4tKjQyME0wvrt1']) {
      // Both devs start in Downtime when sandbox is toggled OFF
      expect(getEffectiveSeasonInfo(devUid, false, saturdayNov14Ms).isDowntime).toBe(true);

      // When toggled ON before Monday, preview opens in isolated sandbox_s2/
      const devPreview = getEffectiveSeasonInfo(devUid, true, saturdayNov14Ms);
      expect(devPreview.seasonNumber).toBe(2);
      expect(devPreview.seasonId).toBe('season_2');
      expect(devPreview.isDowntime).toBe(false);
      expect(devPreview.isSandbox).toBe(true);
      expect(devPreview.isFrozenApocalypseActive).toBe(true);

      // Monday Nov 16 launch disables sandbox even for devs and starts live Season 2
      const devOnMonday = getEffectiveSeasonInfo(devUid, true, mondayNov16Ms);
      expect(devOnMonday.isDowntime).toBe(false);
      expect(devOnMonday.seasonNumber).toBe(2);
      expect(devOnMonday.isSandbox).toBe(false);
    }

    // Monday Nov 16 launch ends Downtime for everyone and starts Season 2 live
    const mondayLive = getEffectiveSeasonInfo('regular_uid', false, mondayNov16Ms);
    expect(mondayLive.isDowntime).toBe(false);
    expect(mondayLive.seasonNumber).toBe(2);
    expect(mondayLive.seasonId).toBe('season_2');
    expect(mondayLive.isSandbox).toBe(false);
    expect(mondayLive.isFrozenApocalypseActive).toBe(true);

    // RTDB paths never touch live Season 1 leaderboards or users for sandbox
    expect(scopeRtdbPath('leaderboards/season_2', true)).toBe('sandbox_s2/leaderboards/season_2');
    expect(scopeRtdbPath('users/abc', false)).toBe('users/abc');
  });

  it('keeps dev sandbox isolated from Season 1 save, removes gay_matthew, and includes liam_matthew placeholder', () => {
    const store: Record<string, string> = {};
    const prevWin = (globalThis as any).window;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 10, 14, 17, 0, 0)));
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
      },
    };
    try {
      const s2 = loadSandboxGame();
      expect(s2.coins).toBe(0);
      expect(s2.currentSeasonId).toBe('season_2');
      expect(TEST_ISOLATION_CONFIG.sandboxStorageKey).toBe('matthew_clicker_s2_sandbox_v1');

      // Saving sandbox as authorized dev is strictly ephemeral before Monday launch:
      // it never writes to Season 1 OR Season 2 storage and resets on reload.
      saveGame({
        ...s2,
        coins: 9999,
        currentSeasonId: 'season_2',
        sandboxS2Enabled: true,
        cloudAccount: {
          uid: 'cKFezHsISfbZGH4tKjQyME0wvrt1',
          username: 'testmarshall',
          displayUsername: 'testmarshall',
          lastCloudSync: Date.now(),
        },
      });
      expect(store[TEST_ISOLATION_CONFIG.sandboxStorageKey]).toBeUndefined();
      expect(store['matthew_clicker_save_v1']).toBeUndefined();
      const reloaded = loadSandboxGame();
      expect(reloaded.coins).toBe(0);
    } finally {
      vi.useRealTimers();
      (globalThis as any).window = prevWin;
    }

    const s1Skins = getProgressionSkinsForSeason('season_1').map((s) => s.id);
    const s2Skins = getProgressionSkinsForSeason('season_2').map((s) => s.id);
    expect(s1Skins).not.toContain('anime_matthew');
    expect(s1Skins).not.toContain('apocalypse_matthew');
    expect(s2Skins).toContain('anime_matthew');
    expect(s2Skins).toContain('apocalypse_matthew');
    expect(s2Skins).toContain('girl_matthew');
    expect(s2Skins).toContain('naruto_matthew');
    expect(s2Skins).not.toContain('moaning_matthew');
    expect(s2Skins).not.toContain('matthgoon');
    expect(ALL_SKINS.some((s) => s.id === 'gay_matthew')).toBe(false);
    expect(CRATE_DEFINITIONS.normal.skins.some((s) => s.skinId === 'gay_matthew')).toBe(false);
    const liamSkin = ALL_SKINS.find((s) => s.id === 'liam_matthew');
    expect(liamSkin).toBeDefined();
    expect(liamSkin?.isPlaceholderArt).toBe(false);
    expect(liamSkin?.milestone.type).toBe('season_champion');
    expect(FROZEN_PROGRESSION_SKINS.some((s) => s.id === 'liam_matthew')).toBe(false);
    expect(ITEM_SHOP_SKINS.some((s) => s.id === 'liam_matthew')).toBe(false);
    expect(CRATE_DEFINITIONS.normal.skins.some((s) => s.skinId === 'liam_matthew')).toBe(false);
    expect(CRATE_DEFINITIONS.frost.skins.some((s) => s.skinId === 'liam_matthew')).toBe(false);
    expect(s2Skins).toContain('minecraft_matthew');
    expect(s2Skins.length).toBe(15);
  });

  it('keeps curated Item Shop small (6 skins), rotates featured skins daily, and excludes holiday/removed skins', () => {
    expect(ITEM_SHOP_SKINS.length).toBe(6);
    const shopIds = ITEM_SHOP_SKINS.map((s) => s.id);
    expect(shopIds).not.toContain('gay_matthew');
    expect(shopIds).not.toContain('turkey_matthew');
    expect(shopIds).not.toContain('santa_matthew');
    expect(shopIds).not.toContain('reindeer_matthew');
    expect(shopIds).not.toContain('king_matthew');
    expect(shopIds).not.toContain('shop_balenciaga_matthew');
    expect(shopIds).not.toContain('shop_super_saiyan_matthew');
    expect(shopIds).not.toContain('shop_omnipotent_matthew');
    expect(shopIds).not.toContain('girl_matthew');
    expect(shopIds).not.toContain('naruto_matthew');
    expect(shopIds).not.toContain('mathgoon');
    expect(MATTHEW_VAULT_SKINS.length).toBe(0);

    const day1Featured = getDailyItemShopRotation('2026-11-16').map((s) => s.id);
    const day2Featured = getDailyItemShopRotation('2026-11-17').map((s) => s.id);
    expect(day1Featured.length).toBe(3);
    expect(day2Featured.length).toBe(3);
    expect(day2Featured).not.toEqual(day1Featured);
    expect(new Set([...day1Featured, ...day2Featured]).size).toBeGreaterThan(3);

    const allShop = getDailyItemShopRotation('2026-11-16', 12).map((s) => s.id);
    expect(allShop.length).toBe(6);
  });

  it('keeps both devs off Season 2 leaderboards before Monday while preserving Season 1 & Monday live eligibility', () => {
    const saturdayNov14Ms = Date.UTC(2026, 10, 14, 17, 0, 0);
    const mondayNov16Ms = Date.UTC(2026, 10, 16, 6, 0, 0);

    for (const devUid of TEST_ISOLATION_CONFIG.authorizedDevUids) {
      expect(isExcludedFromLeaderboard(devUid, 'dev', 'season_2', saturdayNov14Ms)).toBe(true);
      expect(isExcludedFromLeaderboard(devUid, 'dev', 'season_1', saturdayNov14Ms)).toBe(false);
      expect(isExcludedFromLeaderboard(devUid, 'dev', 'season_2', mondayNov16Ms)).toBe(false);
    }

    expect(isExcludedFromLeaderboard('regular_uid', 'player', 'season_2', saturdayNov14Ms)).toBe(false);

    // Monday reset clears seasonal scores while keeping Season 1 skins, gems, and Top-10/Champion rewards
    const devS1 = {
      ...getDefaultGameState(),
      coins: 9999999,
      lifetimeCoins: 9999999,
      seasonalScore: 9999999,
      clicks: 5000,
      gems: 350,
      unlockedSkins: ['classic_matthew', 'galaxy_matthew', 'god_matthew'],
      currentSeasonId: 'season_1',
    };
    const rolledDev = performSeasonalRollover(devS1, 'season_2', true, true);
    expect(rolledDev.coins).toBe(0);
    expect(rolledDev.seasonalScore).toBe(0);
    expect(rolledDev.clicks).toBe(0);
    expect(rolledDev.gems).toBe(350);
    expect(rolledDev.unlockedSkins).toContain('galaxy_matthew');
    expect(rolledDev.unlockedSkins).toContain('champion_matthew');
    expect(rolledDev.unlockedSkins).toContain('liam_matthew');
  });

  it('AntiAutoclickerGuard spares fast jittering humans while rejecting constant-interval macros & untrusted scripts', () => {
    const humanGuard = new AntiAutoclickerGuard();
    // Simulate 25 natural human butterfly/jitter clicks (~12-14 CPS with natural 50..115ms variance)
    let t = 10000;
    const humanDeltas = [68, 92, 55, 108, 74, 61, 114, 83, 59, 98, 71, 64, 105, 88, 57, 94, 79, 63, 109, 72];
    let humanAccepted = 0;
    for (const d of humanDeltas) {
      t += d;
      const res = humanGuard.evaluateClick({ timestampMs: t, isTrusted: true });
      if (res.accepted) humanAccepted += 1;
    }
    expect(humanAccepted).toBe(humanDeltas.length);

    // Programmatic untrusted click must be rejected immediately
    const botGuard = new AntiAutoclickerGuard();
    const untrusted = botGuard.evaluateClick({ timestampMs: 20000, isTrusted: false });
    expect(untrusted.accepted).toBe(false);
    expect(untrusted.reason).toBe('untrusted_event');

    // Constant 50.0ms robotic autoclicker across 24 clicks flags probation for admin review
    let bt = 30000;
    let botRejected = 0;
    let flaggedProbation = false;
    for (let i = 0; i < 24; i++) {
      bt += 50;
      const r = botGuard.evaluateClick({ timestampMs: bt, isTrusted: true });
      if (!r.accepted) botRejected += 1;
      if (r.shouldFlagProbation) flaggedProbation = true;
    }
    expect(botRejected).toBeGreaterThan(0);
    expect(flaggedProbation).toBe(true);
  });

  it('keeps Matthew Shop Token ultra-rare (~0.85%), applies pet level scaling, and ignores legacy hunger', () => {
    let tokenWins = 0;
    // Uniform grid sampling across 1000 chest rolls should yield ~8-9 tokens (~0.85%), never 100%
    for (let i = 0; i < 1000; i++) {
      const r = rollChestLoot(100, 10, ['classic_matthew'], false, () => (i + 0.5) / 1000);
      if (r.foundMatthewShopToken) tokenWins += 1;
    }
    expect(tokenWins).toBeGreaterThan(0);
    expect(tokenWins).toBeLessThan(20);

    const petLvl1 = createStarterFrostPup();
    const petLvl5Full = { ...petLvl1, level: 5, hunger: 100 };
    const petLvl5NoFeed = { ...petLvl1, level: 5, hunger: 0 };

    expect(getPetClickMultiplierBonus(petLvl5Full)).toBeGreaterThan(
      getPetClickMultiplierBonus(petLvl1)
    );
    expect(getPetCombatDps(petLvl5Full)).toBeGreaterThan(getPetCombatDps(petLvl1));
    // Pets never require feeding — 100% power regardless of legacy hunger field
    expect(getPetCombatDps(petLvl5NoFeed)).toBe(getPetCombatDps(petLvl5Full));
    expect(getPetClickMultiplierBonus(petLvl5NoFeed)).toBe(
      getPetClickMultiplierBonus(petLvl5Full)
    );
  });

  it('formats UDc..Vg suffixes accurately, scales S2 upgrades to Vg with unique images, and tracks chests & monthly meta-quest', async () => {
    expect(formatCoins(1e36)).toContain('UDc');
    expect(formatCoins(1e39)).toContain('Ddc');
    expect(formatCoins(1e42)).toContain('Tdc');
    expect(formatCoins(1e45)).toContain('Qadc');
    expect(formatCoins(1e48)).toContain('Qidc');
    expect(formatCoins(1e51)).toContain('Sxdc');
    expect(formatCoins(1e54)).toContain('Spdc');
    expect(formatCoins(1e57)).toContain('Ocdc');
    expect(formatCoins(1e60)).toContain('Nmdc');
    expect(formatCoins(1e63)).toContain('Vg');

    expect(SEASON_2_UPGRADES.length).toBe(96);
    expect(SEASON_2_UPGRADES[SEASON_2_UPGRADES.length - 1].baseCost).toBeGreaterThanOrEqual(1e63);
    const uniqueImgs = new Set(SEASON_2_UPGRADES.map((u) => u.iconImage));
    expect(uniqueImgs.size).toBe(SEASON_2_UPGRADES.length);
    for (const img of uniqueImgs) {
      expect(img).toMatch(/^\.\/images\/s2\/upgrades\/up_\d{2}\.png$/);
    }
    expect(getPetAnimationFrames('frost_pup')).toEqual([
      './images/s2/pets/frost_pup_1.png',
      './images/s2/pets/frost_pup_2.png',
      './images/s2/pets/frost_pup_3.png',
      './images/s2/pets/frost_pup_4.png',
    ]);
    for (const egg of EGG_DEFINITIONS) {
      expect(egg.eggImage).toMatch(/^(\.\/images\/s2\/eggs\/).+\.png$/);
      expect(egg.petImage).toMatch(/^(\.\/images\/s2\/pets\/).+\.png$/);
    }

    const maxedState = {
      ...getDefaultGameState(),
      currentSeasonId: 'season_2',
      clicks: 500000,
      criticalClicks: 50000,
      lifetimeCoins: 1e65,
      seasonalScore: 1e65,
      prestigeCount: 50,
      chestsOpened: 25,
      zombiesDefeated: 500,
      upgrades: { s2_snowball_pack: 1500 },
    };
    const payload = buildLeaderboardPayload('u1', 'Marshallb78', maxedState);
    expect(payload.chestsOpened).toBe(25);

    const dailyQuests = QUESTS.filter((q) => q.scope === 'daily');
    expect(dailyQuests.length).toBeGreaterThan(0);
    for (const dq of dailyQuests) {
      expect(dq.rewardCoins).toBeLessThanOrEqual(100000);
    }

    const questRes = checkAndAutoClaimQuests(maxedState);
    expect(questRes.state.claimedQuests).toContain('season_all_monthly_master');

    const fallingSpec = PLAYER_TRIGGERABLE_EVENTS.find((e) => e.type === 'falling_matthews')!;
    const evtRes = await summonGlobalLiveEvent({
      spec: fallingSpec,
      uid: 'u1',
      username: 'tesmarshall',
      isSandbox: true,
    });
    expect(evtRes.ok).toBe(true);
    expect(evtRes.event?.type).toBe('falling_matthews');
  });

  it('enforces atomic trade bundle validation and prevents duping missing skins/pets/eggs', () => {
    const sender = {
      ...getDefaultGameState(),
      currentSeasonId: 'season_2',
      unlockedSkins: ['classic_matthew', 'anime_matthew'],
      equippedSkin: 'anime_matthew',
      pets: [createStarterFrostPup()],
      equippedPetIds: ['pet_starter_frost_pup'],
    };
    sender.sealedEggs['Rare Egg'] = 2;

    // Attempting to trade an unowned skin must fail without altering state
    const badTrade = applyTradeSwapToState(
      sender,
      { skinIds: ['balenciaga_matthew'], pets: [], sealedEggs: {} },
      { skinIds: ['sushi_matthew'], pets: [], sealedEggs: {} }
    );
    expect(badTrade.ok).toBe(false);

    // Valid trade deducts offered items, adds received items, and unequips traded active skin/pet cleanly
    const goodTrade = applyTradeSwapToState(
      sender,
      {
        skinIds: ['anime_matthew'],
        pets: [sender.pets[0]],
        sealedEggs: { 'Rare Egg': 1 },
      },
      {
        skinIds: ['sushi_matthew'],
        pets: [],
        sealedEggs: { 'Epic Egg': 1 },
      }
    );
    expect(goodTrade.ok).toBe(true);
    expect(goodTrade.nextState!.unlockedSkins).not.toContain('anime_matthew');
    expect(goodTrade.nextState!.unlockedSkins).toContain('sushi_matthew');
    expect(goodTrade.nextState!.equippedSkin).toBe('classic_matthew');
    expect(goodTrade.nextState!.pets.length).toBe(0);
    expect(goodTrade.nextState!.equippedPetIds.length).toBe(0);
    expect(goodTrade.nextState!.sealedEggs['Rare Egg']).toBe(1);
    expect(goodTrade.nextState!.sealedEggs['Epic Egg']).toBe(1);
  });

  it('uses 5 cohesive crystal eggs with legacy normalization and carries Skins & Glasses across seasonal rollover', () => {
    expect(EGG_DEFINITIONS.map((e) => e.rarity)).toEqual([
      'Common Egg',
      'Rare Egg',
      'Epic Egg',
      'Legendary Egg',
      'Mythic Egg',
    ]);
    expect(normalizeEggRarity('Uncommon Egg')).toBe('Common Egg');
    expect(normalizeEggRarity('Super Rare Egg')).toBe('Rare Egg');
    expect(normalizeEggRarity('Ultra Rare Egg')).toBe('Epic Egg');
    expect(normalizeEggRarity('Divine Egg')).toBe('Legendary Egg');
    expect(normalizeEggRarity('Celestial Egg')).toBe('Mythic Egg');

    const baseState = getDefaultGameState();
    const prevSeason = {
      ...baseState,
      currentSeasonId: 'season_2',
      coins: 5000000,
      lifetimeCoins: 12000000,
      seasonalScore: 12000000,
      gems: 250,
      prestigeCount: 4,
      upgrades: { s2_snowball_pack: 12 },
      unlockedSkins: ['classic_matthew', 'king_matthew'],
      equippedSkin: 'king_matthew',
      ownedCosmetics: ['glasses_shades', 'legacy_removed_hat'],
      equippedCosmetics: { hat: 'legacy_removed_hat', glasses: 'glasses_shades' },
      pets: [createStarterFrostPup()],
      equippedPetIds: ['pet_starter_frost_pup'],
      sealedEggs: {
        ...baseState.sealedEggs,
        'Common Egg': 3,
        'Mythic Egg': 1,
      },
      hasMatthewShopToken: true,
      matthewShopTokens: 2,
      zombieHitsTaken: 5,
    };

    const nextSeason = performSeasonalRollover(prevSeason, 'season_3', false);
    expect(nextSeason.currentSeasonId).toBe('season_3');
    // Carryover: Skins, Glasses, and Gems
    expect(nextSeason.unlockedSkins).toEqual(['classic_matthew', 'king_matthew']);
    expect(nextSeason.equippedSkin).toBe('king_matthew');
    expect(nextSeason.ownedCosmetics).toEqual(['glasses_shades']);
    expect(nextSeason.equippedCosmetics).toEqual({ hat: null, glasses: 'glasses_shades' });
    expect(nextSeason.gems).toBe(250);

    // Seasonal reset: coins, upgrades, pets, eggs, tokens, hits
    expect(nextSeason.coins).toBe(0);
    expect(nextSeason.upgrades).toEqual({});
    expect(nextSeason.pets).toEqual([]);
    expect(nextSeason.equippedPetIds).toEqual([]);
    expect(nextSeason.sealedEggs['Common Egg']).toBe(0);
    expect(nextSeason.sealedEggs['Mythic Egg']).toBe(0);
    expect(nextSeason.hasMatthewShopToken).toBe(false);
    expect(nextSeason.matthewShopTokens).toBe(0);
    expect(nextSeason.zombieHitsTaken).toBe(0);
  });

  it('maps all 96 Season 2 upgrades to unique icons and preserves active Matthew Shop Token', () => {
    expect(SEASON_2_UPGRADES.length).toBe(96);
    expect(SEASON_2_UPGRADES[0].id).toBe('s2_snowball_pack');
    const uniqueImages = new Set(SEASON_2_UPGRADES.map((u) => u.iconImage));
    expect(uniqueImages.size).toBe(96);
    expect(Array.from(uniqueImages).every((img) => /^\.\/images\/s2\/upgrades\/up_\d{2}\.png$/.test(img || ''))).toBe(true);

    const activeTokenState = sanitizeAndValidateGameState({
      ...getDefaultGameState(),
      currentSeasonId: 'season_2',
      matthewShopTokens: 0,
      hasMatthewShopToken: true,
    });
    expect(activeTokenState.matthewShopTokens).toBe(1);
    expect(activeTokenState.hasMatthewShopToken).toBe(true);

    const heldState = sanitizeAndValidateGameState({
      ...getDefaultGameState(),
      currentSeasonId: 'season_2',
      matthewShopTokens: 1,
      hasMatthewShopToken: false,
    });
    expect(heldState.matthewShopTokens).toBe(1);
    expect(heldState.hasMatthewShopToken).toBe(true);
  });

  it('supports 10 distinct animated pet species with super-rare/celestial tiers, infinite upgrades, and daily claim cloud retention', () => {
    expect(PET_SPECIES_CATALOG.length).toBe(10);
    for (const spec of PET_SPECIES_CATALOG) {
      const frames = getPetAnimationFrames(spec.speciesId);
      expect(frames.length).toBe(4);
      expect(frames[0]).toBe(`./images/s2/pets/${spec.speciesId}_1.png`);
    }

    const phoenix = getPetSpeciesDefinition('frost_phoenix', 'Mythic Egg');
    const celestial = getPetSpeciesDefinition('celestial_warden', 'Mythic Egg');
    expect(celestial.rarityLabel).toBe('Celestial');
    expect(celestial.baseMultiplierBonus).toBeGreaterThan(phoenix.baseMultiplierBonus);
    expect(celestial.baseDps).toBeGreaterThan(phoenix.baseDps);

    // Weighted Mythic hatch roll at high percentile yields Secret Celestial Warden
    const rolledSecret = rollHatchedPetSpecies('Mythic Egg', () => 0.99);
    expect(rolledSecret.speciesId).toBe('celestial_warden');

    // Infinite pet upgrades: Lv. 25 persists unsquashed and scales strictly past Lv. 5
    const lv5Pet = { ...createStarterFrostPup(), speciesId: 'celestial_warden', name: 'Celestial Warden', rarity: 'Mythic Egg' as const, level: 5 };
    const lv25Pet = { ...lv5Pet, level: 25 };
    const sanitizedHigh = sanitizeAndValidateGameState({
      ...getDefaultGameState(),
      currentSeasonId: 'season_2',
      pets: [lv25Pet],
    });
    expect(sanitizedHigh.pets[0].level).toBe(25);
    expect(sanitizedHigh.pets[0].speciesId).toBe('celestial_warden');
    expect(sanitizedHigh.pets[0].name).toBe('Celestial Warden');
    expect(getPetClickMultiplierBonus(lv25Pet)).toBeGreaterThan(getPetClickMultiplierBonus(lv5Pet));
    expect(getPetCombatDps(lv25Pet)).toBeGreaterThan(getPetCombatDps(lv5Pet));
    expect(getPetUpgradeGemCost(lv25Pet)).toBeGreaterThan(getPetUpgradeGemCost(lv5Pet));

    // Daily login claim & season2IntroSeen survive reconciliation even if cloud snapshot had stale values
    const localClaimed = {
      ...getDefaultGameState(),
      currentSeasonId: 'season_2',
      lifetimeCoins: 5000,
      lastDailyLoginClaimDate: '2026-11-12',
      season2IntroSeen: true,
      gems: 55,
      lastSaveTime: 2000,
    };
    const reconciled = reconcileCloudAndLocalState({
      uid: 'u_test',
      username: 'tesmarshall',
      localState: localClaimed,
      rtdbUser: {
        uid: 'u_test',
        lastDailyLoginClaimDate: null,
        season2IntroSeen: false,
        gems: 50,
        updatedAtMs: 3000,
        seasons: {
          season_2: {
            seasonId: 'season_2',
            lifetimeCoins: 6000,
            coins: 6000,
            lastSaveTime: 3000,
          },
        },
      },
      rtdbLb: null,
      wasExplicitlyReset: false,
      resetAtMs: 0,
      activeSeasonId: 'season_2',
      nowMs: 4000,
    });
    expect(reconciled.state.lastDailyLoginClaimDate).toBe('2026-11-12');
    expect(reconciled.state.season2IntroSeen).toBe(true);
    expect(reconciled.state.gems).toBe(55);
    expect(reconciled.shouldPushToCloud).toBe(true);
  });

  it('supports Normal (50G) & Frost (75G) Crates, 10 Cursors with stat/ascension scaling & Fire Cursor freeze immunity', () => {
    expect(CRATE_DEFINITIONS.normal.gemCost).toBe(50);
    expect(CRATE_DEFINITIONS.frost.gemCost).toBe(75);

    expect(CURSORS.length).toBe(10);
    expect(NORMAL_CRATE_CURSORS.length).toBe(5);
    expect(FROST_CRATE_CURSORS.length).toBe(5);

    const fireCursor = getCursorById('fire_cursor');
    const frostyCursor = getCursorById('frosty_cursor');
    const galaxyCursor = getCursorById('galaxy_cursor');
    const godCursor = getCursorById('god_cursor');
    expect(galaxyCursor?.crateType).toBe('normal');
    expect(godCursor?.crateType).toBe('normal');
    expect(NORMAL_CRATE_CURSORS.map((c) => c.id)).toEqual([
      'golden_cursor',
      'diamond_cursor',
      'galaxy_cursor',
      'god_cursor',
      'fire_cursor',
    ]);
    expect(FROST_CRATE_CURSORS.map((c) => c.id)).toEqual([
      'cyberpunk_cursor',
      'glitch_cursor',
      'void_cursor',
      'gigachad_cursor',
      'frosty_cursor',
    ]);
    expect(fireCursor?.freezeImmune).toBe(true);
    expect(frostyCursor?.freezeImmune).toBeFalsy();

    // Frost crate contains winter + zombie + apocalypse skins (with apocalypse_matthew rarest) and frost cursors (frosty_cursor rarest)
    const frostSkins = CRATE_DEFINITIONS.frost.skins.map((s) => s.skinId);
    expect(frostSkins).toContain('apocalypse_matthew');
    expect(frostSkins).toContain('zombie_matthew');
    expect(frostSkins).toContain('snowy_matthew');
    expect(CRATE_DEFINITIONS.frost.rarestSkinId).toBe('apocalypse_matthew');
    expect(CRATE_DEFINITIONS.frost.rarestCursorId).toBe('frosty_cursor');
    expect(CRATE_DEFINITIONS.normal.rarestCursorId).toBe('fire_cursor');

    // Rolling highest jackpot threshold yields rarest skins / cursors cleanly (cursorDropChance = 0.55)
    const frostJackpotSkin = rollCrateReward('frost', [], [], () => 0.9999);
    expect(frostJackpotSkin.rewardKind).toBe('skin');
    expect(frostJackpotSkin.skin?.id).toBe('apocalypse_matthew');

    // Rolling cursor branch (rng=0.1 selects cursor pool since 0.1 < 0.55, then 0.9999 picks rarest cursor)
    let call = 0;
    const seq = [0.1, 0.9999];
    const frostJackpotCursor = rollCrateReward('frost', [], [], () => seq[call++]);
    expect(frostJackpotCursor.rewardKind).toBe('cursor');
    expect(frostJackpotCursor.cursor?.id).toBe('frosty_cursor');

    call = 0;
    const normSeq = [0.1, 0.9999];
    const normalJackpotCursor = rollCrateReward('normal', [], [], () => normSeq[call++]);
    expect(normalJackpotCursor.rewardKind).toBe('cursor');
    expect(normalJackpotCursor.cursor?.id).toBe('fire_cursor');

    // Cursor abilities boost click power, crit chance/multiplier, CPS, and Ascension shard scaling
    const baseState = {
      ...getDefaultGameState(),
      currentSeasonId: 'season_2',
      prestigeShards: 10,
      upgrades: { ...(getDefaultGameState().upgrades || {}), s2_snowball_pack: 2, s2_campfire_ember: 2 },
    };
    const baseClick = calculateClickPower(baseState, { fridayBonusActive: false });
    const baseCps = calculateCPS(baseState, { fridayBonusActive: false });

    const withFrosty = {
      ...baseState,
      unlockedCursors: ['frosty_cursor'],
      equippedCursorId: 'frosty_cursor',
    };
    const frostyClick = calculateClickPower(withFrosty, { fridayBonusActive: false });
    const frostyCps = calculateCPS(withFrosty, { fridayBonusActive: false });

    expect(frostyClick.totalPower).toBeGreaterThan(baseClick.totalPower);
    expect(frostyClick.critChance).toBeGreaterThan(baseClick.critChance);
    expect(frostyClick.ascensionMultiplier).toBeGreaterThan(baseClick.ascensionMultiplier);
    expect(frostyCps).toBeGreaterThan(baseCps);

    // Starter cursor is unlocked & equipped by default; persistence keeps unlockedCursors, equippedCursorId, cratesOpened
    const freshDefaults = getDefaultGameState();
    expect(freshDefaults.unlockedCursors).toContain('starter_cursor');
    expect(freshDefaults.equippedCursorId).toBe('starter_cursor');

    const validated = sanitizeAndValidateGameState({
      ...withFrosty,
      cratesOpened: 4,
    });
    expect(validated.unlockedCursors).toContain('starter_cursor');
    expect(validated.unlockedCursors).toContain('frosty_cursor');
    expect(validated.equippedCursorId).toBe('frosty_cursor');
    expect(validated.cratesOpened).toBe(4);

    // Matthew Shop Token unlocks all cursors for free
    const tokenValidated = sanitizeAndValidateGameState({
      ...baseState,
      hasMatthewShopToken: true,
      matthewShopTokens: 1,
    });
    expect(tokenValidated.unlockedCursors).toContain('galaxy_cursor');
    expect(tokenValidated.unlockedCursors).toContain('god_cursor');
    expect(tokenValidated.unlockedCursors).toContain('fire_cursor');
    expect(tokenValidated.unlockedCursors).toContain('frosty_cursor');
    expect(tokenValidated.unlockedCursors?.length).toBe(11);
  });

  it('carries gems across seasonal rollover, drops chest eggs ~1 in 3 chests (~33%), and uses custom crate artwork', () => {
    const prevState = {
      ...getDefaultGameState(),
      currentSeasonId: 'season_1',
      coins: 500000,
      gems: 742,
      prestigeCount: 6,
      unlockedSkins: ['classic_matthew', 'anime_matthew'],
    };
    const nextState = performSeasonalRollover(prevState, 'season_2', true, true);
    expect(nextState.currentSeasonId).toBe('season_2');
    expect(nextState.sandboxS2Enabled).toBe(false);
    expect(nextState.gems).toBe(742);
    expect(nextState.coins).toBe(0);
    expect(nextState.unlockedSkins).toContain('anime_matthew');
    expect(nextState.unlockedSkins).toContain('champion_matthew');
    expect(nextState.unlockedSkins).toContain('liam_matthew');

    const top10OnlyState = performSeasonalRollover(prevState, 'season_2', false, true);
    expect(top10OnlyState.unlockedSkins).toContain('liam_matthew');
    expect(top10OnlyState.unlockedSkins).not.toContain('champion_matthew');

    // Chest loot drops eggs ~1 every 3 chests (~33.3%)
    let eggDrops = 0;
    for (let i = 0; i < 1000; i++) {
      const r1 = (i + 0.5) / 1000;
      let step = 0;
      const loot = rollChestLoot(100, 10, [], false, () => (step++ === 0 ? r1 : 0.42));
      if (loot.eggRarity !== null) {
        eggDrops++;
      } else {
        expect(loot.gems).toBeGreaterThanOrEqual(14);
      }
    }
    expect(eggDrops).toBeGreaterThan(290);
    expect(eggDrops).toBeLessThan(380);

    // Custom crate transparent artwork paths
    expect(CRATE_DEFINITIONS.normal.image).toBe('./images/s2/crates/normal_crate.png');
    expect(CRATE_DEFINITIONS.frost.image).toBe('./images/s2/crates/frost_crate.png');
  });

  it('strips leaked Season 2 skins from pre-Monday live saves and cloud sync while keeping them after Monday launch', () => {
    const s2SkinId = FROZEN_PROGRESSION_SKINS[0].id;
    const preLaunchNow = SEASON_2_CONFIG.launchTimeMs - 60_000;
    const postLaunchNow = SEASON_2_CONFIG.launchTimeMs + 60_000;

    // 1. Live Season 1 sanitize strips any leaked Season 2 skin if before Monday launch
    if (Date.now() < SEASON_2_CONFIG.launchTimeMs) {
      const sanitized = sanitizeAndValidateGameState({
        ...getDefaultGameState(),
        currentSeasonId: 'season_1',
        sandboxS2Enabled: false,
        unlockedSkins: ['classic_matthew', 'broke_matthew', s2SkinId],
        equippedSkin: s2SkinId,
      });
      expect(sanitized.unlockedSkins).toContain('broke_matthew');
      expect(sanitized.unlockedSkins).not.toContain(s2SkinId);
      expect(sanitized.equippedSkin).toBe('classic_matthew');
    }

    // 2. Pre-Monday reconciliation scrubs leaked Season 2 skin from cloud/local and marks push
    const preLaunchReconciled = reconcileCloudAndLocalState({
      uid: 'cKFezHsISfbZGH4tKjQyME0wvrt1',
      username: 'Marshallb78',
      localState: {
        ...getDefaultGameState(),
        currentSeasonId: 'season_1',
        lastOwnerUid: 'cKFezHsISfbZGH4tKjQyME0wvrt1',
        unlockedSkins: ['classic_matthew', 'broke_matthew', s2SkinId],
        equippedSkin: s2SkinId,
      },
      rtdbUser: {
        username: 'Marshallb78',
        unlockedSkins: ['classic_matthew', 'broke_matthew', s2SkinId],
        equippedSkin: s2SkinId,
        currentSeason: 'season_1',
        seasons: {
          season_1: {
            lifetimeCoins: 1000,
            coins: 500,
            lastSaveTime: preLaunchNow - 1000,
          },
        },
      },
      rtdbLb: null,
      wasExplicitlyReset: false,
      resetAtMs: 0,
      activeSeasonId: 'season_1',
      nowMs: preLaunchNow,
    });
    expect(preLaunchReconciled.state.unlockedSkins).toContain('broke_matthew');
    expect(preLaunchReconciled.state.unlockedSkins).not.toContain(s2SkinId);
    expect(preLaunchReconciled.state.equippedSkin).toBe('classic_matthew');
    expect(preLaunchReconciled.shouldPushToCloud).toBe(true);

    // 3. Once Monday launch arrives and Season 2 is active, Season 2 skins persist normally
    const postLaunchReconciled = reconcileCloudAndLocalState({
      uid: 'cKFezHsISfbZGH4tKjQyME0wvrt1',
      username: 'Marshallb78',
      localState: {
        ...getDefaultGameState(),
        currentSeasonId: 'season_2',
        lastOwnerUid: 'cKFezHsISfbZGH4tKjQyME0wvrt1',
        unlockedSkins: ['classic_matthew', s2SkinId],
        equippedSkin: s2SkinId,
      },
      rtdbUser: {
        username: 'Marshallb78',
        unlockedSkins: ['classic_matthew', s2SkinId],
        equippedSkin: s2SkinId,
        currentSeason: 'season_2',
        seasons: {
          season_2: {
            lifetimeCoins: 5000,
            coins: 2500,
            lastSaveTime: postLaunchNow - 1000,
          },
        },
      },
      rtdbLb: null,
      wasExplicitlyReset: false,
      resetAtMs: 0,
      activeSeasonId: 'season_2',
      nowMs: postLaunchNow,
    });
    expect(postLaunchReconciled.state.unlockedSkins).toContain(s2SkinId);
    expect(postLaunchReconciled.state.equippedSkin).toBe(s2SkinId);
  });

  it('formats 10^66+ cleanly without showing Infinity and enforces cloudAdjustmentAtMs rebalancing over stale local saves', () => {
    expect(formatCoins(5.0427e68)).toBe('504.3UVg');
    expect(formatCoins(5.0427e68)).not.toContain('Infinity');

    const chestQuest = QUESTS.find((q) => q.id === 'season_chests_20');
    expect(chestQuest?.rewardCoins).toBeLessThanOrEqual(1e8);

    const adjTs = LIAM_S2_REBALANCE_REVISION_MS + 60_000;
    const inflatedLocal = {
      ...getDefaultGameState(),
      currentSeasonId: 'season_2',
      lastOwnerUid: 'UF3esYX32lhJJThQMMXmXQ7TJof1',
      coins: 6.7e67,
      lifetimeCoins: 5.04e68,
      seasonalScore: 5.04e68,
      prestigeShards: 305,
      lifetimePrestigeShards: 305,
      prestigeCount: 2,
      claimedQuests: ['season_chests_20', 'season_coins_udc', 'season_coins_vg'],
      lastSaveTime: adjTs - 300_000,
    };

    const adjusted = reconcileCloudAndLocalState({
      uid: 'UF3esYX32lhJJThQMMXmXQ7TJof1',
      username: 'liamkd3',
      localState: inflatedLocal,
      rtdbUser: {
        uid: 'UF3esYX32lhJJThQMMXmXQ7TJof1',
        username: 'liamkd3',
        cloudAdjustmentAtMs: adjTs,
        lifetimeAllSeasonsCoins: 2.2e41,
        seasons: {
          season_2: {
            seasonId: 'season_2',
            coins: 2.5e13,
            lifetimeCoins: 1.5e14,
            seasonalScore: 1.5e14,
            prestigeCount: 2,
            prestigeShards: 36,
            lifetimePrestigeShards: 36,
            claimedQuests: ['season_chests_20'],
            upgrades: { s2_snowball_pack: 15, s2_thermal_mittens: 10 },
            lastSaveTime: adjTs,
          },
        },
      },
      rtdbLb: {
        uid: 'UF3esYX32lhJJThQMMXmXQ7TJof1',
        username: 'liamkd3',
        cloudAdjustmentAtMs: adjTs,
        lifetimeCoins: 1.5e14,
        seasonalScore: 1.5e14,
        coins: 2.5e13,
        prestigeShards: 36,
        rebirthCount: 2,
      },
      wasExplicitlyReset: false,
      resetAtMs: 0,
      activeSeasonId: 'season_2',
      nowMs: adjTs + 5000,
    });

    expect(adjusted.state.lifetimeCoins).toBe(1.5e14);
    expect(adjusted.state.coins).toBe(2.5e13);
    expect(adjusted.state.prestigeShards).toBe(36);
    expect(adjusted.state.claimedQuests).not.toContain('season_coins_vg');
    expect(adjusted.state.appliedCloudAdjustmentAtMs).toBe(adjTs);
    expect(adjusted.shouldPushToCloud).toBe(false);

    // Also verifies one-time automatic rebalance for liamkd3 pre-patch 5.04e68 save
    const autoRebalance = reconcileCloudAndLocalState({
      uid: LIAM_S2_REBALANCE_UID,
      username: 'liamkd3',
      localState: {
        ...getDefaultGameState(),
        currentSeasonId: 'season_2',
        lastOwnerUid: LIAM_S2_REBALANCE_UID,
        coins: 6.73e67,
        lifetimeCoins: 5.04e68,
        seasonalScore: 5.04e68,
        prestigeCount: 2,
        prestigeShards: 305,
        lifetimePrestigeShards: 305,
        unlockedSkins: ['classic_matthew', 'champion_matthew', 'liam_matthew'],
        equippedSkin: 'champion_matthew',
        claimedQuests: ['season_chests_20', 'season_coins_udc', 'season_coins_vg'],
      },
      rtdbUser: {
        uid: LIAM_S2_REBALANCE_UID,
        username: 'liamkd3',
        unlockedSkins: ['classic_matthew', 'champion_matthew', 'liam_matthew'],
        equippedSkin: 'champion_matthew',
        seasons: {
          season_2: {
            seasonId: 'season_2',
            coins: 6.73e67,
            lifetimeCoins: 5.04e68,
            seasonalScore: 5.04e68,
            prestigeCount: 2,
            prestigeShards: 305,
            lifetimePrestigeShards: 305,
          },
        },
      },
      rtdbLb: null,
      wasExplicitlyReset: false,
      resetAtMs: 0,
      activeSeasonId: 'season_2',
    });
    expect(autoRebalance.state.lifetimeCoins).toBe(LIAM_S2_ADJUSTED_LIFETIME_COINS);
    expect(autoRebalance.state.prestigeShards).toBe(LIAM_S2_ADJUSTED_SHARDS);
    expect(autoRebalance.state.prestigeCount).toBe(2);
    expect(autoRebalance.state.unlockedSkins).toContain('champion_matthew');
    expect(autoRebalance.state.claimedQuests).not.toContain('season_coins_vg');
    expect(autoRebalance.state.appliedCloudAdjustmentAtMs).toBe(LIAM_S2_REBALANCE_REVISION_MS);
    expect(autoRebalance.shouldPushToCloud).toBe(true);

    // Subsequent legitimate gains above 1.5e14 after rebalance are preserved
    const afterProgress = reconcileCloudAndLocalState({
      uid: LIAM_S2_REBALANCE_UID,
      username: 'liamkd3',
      localState: {
        ...autoRebalance.state,
        lifetimeCoins: 9e15,
        seasonalScore: 9e15,
        coins: 4e15,
      },
      rtdbUser: {
        uid: LIAM_S2_REBALANCE_UID,
        username: 'liamkd3',
        cloudAdjustmentAtMs: LIAM_S2_REBALANCE_REVISION_MS,
        seasons: {
          season_2: {
            seasonId: 'season_2',
            lifetimeCoins: LIAM_S2_ADJUSTED_LIFETIME_COINS,
            seasonalScore: LIAM_S2_ADJUSTED_LIFETIME_COINS,
            coins: 2.5e13,
            prestigeCount: 2,
            prestigeShards: LIAM_S2_ADJUSTED_SHARDS,
          },
        },
      },
      rtdbLb: null,
      wasExplicitlyReset: false,
      resetAtMs: 0,
      activeSeasonId: 'season_2',
    });
    expect(afterProgress.state.lifetimeCoins).toBe(9e15);
  });
});
