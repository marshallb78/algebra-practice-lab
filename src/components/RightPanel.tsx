import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CosmeticSlot, GameState } from '../types/game';
import { getUpgradesForSeason } from '../data/upgrades';
import {
  ALL_SKINS,
  SKIN_CATEGORIES_TREE,
  SEASON_2_ONLY_SKIN_ID_SET,
  SEASON_3_ONLY_SKIN_ID_SET,
  Skin,
  equipSkin,
  getSkinById,
  isSeasonThreeOrLater,
  isSeasonTwoOrLater,
} from '../data/skins';
import {
  INFINITY_GAUNTLET_IMAGE,
  INFINITY_STONES,
  hasAllInfinityStones,
} from '../data/infinityGauntlet';
import {
  ITEM_SHOP_SKINS,
  getDailyItemShopRotation,
} from '../data/season2Skins';
import {
  MARVEL_SHOP_SKINS,
  getDailyMarvelShopRotation,
} from '../data/season3Skins';
import { CRATE_DEFINITIONS, CrateType } from '../data/crates';
import { ALL_CURSORS, getCursorById } from '../data/cursors';
import { CursorVisual } from './s2/CursorVisual';
import { LeaderboardEntry } from '../firebase/leaderboard';
import {
  PLAYER_TRIGGERABLE_EVENTS,
  ActiveGlobalLiveEvent,
  PlayerEventCostSpec,
  summonGlobalLiveEvent,
} from '../firebase/liveEvents';
import {
  PRESTIGE_REQUIREMENT,
  calculatePrestigeShards,
  getAscensionMultiplier,
  getNextPrestigeRequirement,
} from '../data/prestige';
import {
  KRILLION_COIN_UNIT,
  canAffordCoinCost,
  getUpgradeCost,
  getBulkUpgradeCost,
  getMaxAffordableUpgrade,
} from '../utils/calculations';
import { getAuthoritativeDateString } from '../utils/scheduleEngine';
import { GEM_ECONOMY_CONFIG, SEASON_3_CONFIG, isAuthorizedDevUid } from '../config/gameConfig';
import { saveGame } from '../utils/storage';
import { saveStateToCloud } from '../firebase/cloudSave';
import { formatCoins, formatExtendedCoins, formatKrillion } from '../utils/formatters';
import { soundManager } from '../audio/soundManager';
import { particleEngine } from './ParticleCanvas';
import { UpgradeArtwork } from './UpgradeArtwork';
import {
  ShoppingBag,
  Infinity as InfinityIcon,
  Check,
  Zap,
  Gem,
  Eye,
  Sparkles,
  Flame,
  Palette,
  ArrowUpCircle,
  Crown,
  Hammer,
  Compass,
  X,
} from 'lucide-react';

export type RightTab = 'upgrades' | 'rebirth' | 'skins' | 'gauntlet';

interface RightPanelProps {
  state: GameState;
  setState: React.Dispatch<React.SetStateAction<GameState>>;
  isSandbox?: boolean;
  playersList?: LeaderboardEntry[];
  isSnapBusy?: boolean;
  onTriggerInfinitySnap?: () => void;
  onOpenSkinQualityModal?: () => void;
  onNotify?: (title: string, subtitle: string) => void;
  onBuySkinWithGems?: (skinId: string, gemCost: number) => void;
  onClaimVaultSkinWithToken?: (skinId: string) => void;
  onOpenMysteryChest?: () => void;
  onOpenCrate?: (crateType: CrateType) => void;
  onEquipCursor?: (cursorId: string | null) => void;
  onBuyOrEquipCosmetic?: (cosmeticId: string, slot: CosmeticSlot, gemCost: number) => void;
  onEventSummoned?: (event: ActiveGlobalLiveEvent) => void;
}

type BuyMode = 1 | 10 | 'MAX';
type SkinSubTab = 'daily' | 'crates' | 'cursors' | 'collection';

export const RightPanel: React.FC<RightPanelProps> = ({
  state,
  setState,
  isSandbox = false,
  playersList = [],
  isSnapBusy = false,
  onTriggerInfinitySnap,
  onOpenSkinQualityModal,
  onNotify,
  onBuySkinWithGems,
  onClaimVaultSkinWithToken,
  onOpenMysteryChest,
  onOpenCrate,
  onEquipCursor,
  onBuyOrEquipCosmetic,
  onEventSummoned,
}) => {
  const [activeTab, setActiveTab] = useState<RightTab>('upgrades');
  const [buyMode, setBuyMode] = useState<BuyMode>(1);
  const [justBoughtId, setJustBoughtId] = useState<string | null>(null);
  const [skinSubTab, setSkinSubTab] = useState<SkinSubTab>('daily');
  const [selectedCursorDetailId, setSelectedCursorDetailId] = useState<string | null>(null);
  const upgradesListRef = useRef<HTMLDivElement | null>(null);
  const upgradesScrollTopRef = useRef<number>(0);

  useEffect(() => {
    if (activeTab === 'upgrades' && upgradesListRef.current) {
      upgradesListRef.current.scrollTop = upgradesScrollTopRef.current;
    }
  }, [activeTab]);

  const isSeason2 = isSeasonTwoOrLater(state.currentSeasonId);
  const isSeason3 = isSeasonThreeOrLater(state.currentSeasonId);

  const activeUpgrades = getUpgradesForSeason(state.currentSeasonId);

  const resolveUpgradePurchasePlan = (
    upgrade: (typeof activeUpgrades)[number],
    currentLevel: number
  ): { countToDisplay: number; cost: number; canAfford: boolean; isKrillion: boolean } => {
    const isKrillion = Boolean(upgrade.krillionBaseCost && upgrade.krillionBaseCost > 0);
    const availableBalance = isKrillion
      ? (state.krillionCoins || 0) + (state.coins >= KRILLION_COIN_UNIT ? state.coins / KRILLION_COIN_UNIT : 0)
      : (state.krillionCoins || 0) > 0
      ? KRILLION_COIN_UNIT
      : state.coins;
    const baseCost = isKrillion ? upgrade.krillionBaseCost! : upgrade.baseCost;

    if (buyMode === 'MAX') {
      const maxInfo = getMaxAffordableUpgrade(
        baseCost,
        upgrade.costMultiplier,
        currentLevel,
        availableBalance
      );
      if (maxInfo.count > 0) {
        return { countToDisplay: maxInfo.count, cost: maxInfo.totalCost, canAfford: true, isKrillion };
      }
      const nextCost = getUpgradeCost(baseCost, upgrade.costMultiplier, currentLevel);
      return { countToDisplay: 1, cost: nextCost, canAfford: false, isKrillion };
    }

    if (buyMode === 10) {
      const bulk10 = getBulkUpgradeCost(
        baseCost,
        upgrade.costMultiplier,
        currentLevel,
        10
      ).totalCost;
      if (canAffordCoinCost(availableBalance, bulk10)) {
        return { countToDisplay: 10, cost: bulk10, canAfford: true, isKrillion };
      }
      const maxInfo = getMaxAffordableUpgrade(
        baseCost,
        upgrade.costMultiplier,
        currentLevel,
        availableBalance
      );
      if (maxInfo.count > 0) {
        const partialCount = Math.min(10, maxInfo.count);
        const partialCost =
          partialCount === maxInfo.count
            ? maxInfo.totalCost
            : getBulkUpgradeCost(
                baseCost,
                upgrade.costMultiplier,
                currentLevel,
                partialCount
              ).totalCost;
        return {
          countToDisplay: partialCount,
          cost: partialCost,
          canAfford: canAffordCoinCost(availableBalance, partialCost),
          isKrillion,
        };
      }
      return { countToDisplay: 10, cost: bulk10, canAfford: false, isKrillion };
    }

    const singleCost = getUpgradeCost(baseCost, upgrade.costMultiplier, currentLevel);
    return {
      countToDisplay: 1,
      cost: singleCost,
      canAfford: canAffordCoinCost(availableBalance, singleCost),
      isKrillion,
    };
  };

  const handleBuyUpgrade = (upgradeId: string) => {
    const upgrade = activeUpgrades.find((u) => u.id === upgradeId);
    if (!upgrade) return;
    const currentLevel = state.upgrades[upgradeId] || 0;
    const plan = resolveUpgradePurchasePlan(upgrade, currentLevel);
    if (!plan.canAfford) return;

    const nowMs = Date.now();
    setState((prev) => {
      if (plan.isKrillion) {
        const availKr =
          (prev.krillionCoins || 0) +
          (prev.coins >= KRILLION_COIN_UNIT ? prev.coins / KRILLION_COIN_UNIT : 0);
        if (!canAffordCoinCost(availKr, plan.cost)) return prev;
        const nextKr = Math.max(0, availKr - Math.min(availKr, plan.cost));
        const next: GameState = {
          ...prev,
          coins: 0,
          krillionCoins: nextKr,
          lastSaveTime: nowMs,
          lastActiveInputTimestamp: nowMs,
          upgrades: {
            ...prev.upgrades,
            [upgradeId]: (prev.upgrades[upgradeId] || 0) + plan.countToDisplay,
          },
        };
        saveGame(next);
        return next;
      }

      const hasKrillion = (prev.krillionCoins || 0) > 0;
      if (!hasKrillion && !canAffordCoinCost(prev.coins, plan.cost)) return prev;
      const next: GameState = {
        ...prev,
        coins: hasKrillion ? 0 : Math.max(0, prev.coins - Math.min(prev.coins, plan.cost)),
        krillionCoins: hasKrillion
          ? Math.max(0, (prev.krillionCoins || 0) - plan.cost / KRILLION_COIN_UNIT)
          : 0,
        lastSaveTime: nowMs,
        lastActiveInputTimestamp: nowMs,
        upgrades: {
          ...prev.upgrades,
          [upgradeId]: (prev.upgrades[upgradeId] || 0) + plan.countToDisplay,
        },
      };
      saveGame(next);
      return next;
    });
    soundManager.playBuy();
    setJustBoughtId(upgradeId);
    setTimeout(() => setJustBoughtId((p) => (p === upgradeId ? null : p)), 320);
  };

  const handleEquipSkin = (skin: Skin) => {
    setState((prev) => {
      const next = equipSkin(prev, skin.id);
      if (next !== prev) {
        saveGame(next);
        soundManager.playBuy();
      }
      return next;
    });
  };

  const currentAscensionMult = getAscensionMultiplier(state.prestigeShards);
  const potentialBonus = calculatePrestigeShards(state.lifetimeCoins);
  const multGain = Math.max(0, potentialBonus - state.lifetimePrestigeShards);
  const nextAscensionMult = getAscensionMultiplier(state.prestigeShards + multGain);
  const multDeltaDisplay = (nextAscensionMult - currentAscensionMult).toFixed(2);
  const nextRebirthReqCoins = getNextPrestigeRequirement(state.lifetimePrestigeShards);
  const canRebirth = state.lifetimeCoins >= PRESTIGE_REQUIREMENT && multGain > 0;

  const handleRebirth = () => {
    if (!canRebirth) return;
    soundManager.playPrestige();
    particleEngine.emitPrestige();
    const nowMs = Date.now();
    setState((prev) => {
      const next: GameState = {
        ...prev,
        coins: 0,
        upgrades: {},
        combo: 0,
        comboTimer: 0,
        frenzyTimer: 0,
        prestigeCount: prev.prestigeCount + 1,
        prestigeShards: prev.prestigeShards + multGain,
        lifetimePrestigeShards: prev.lifetimePrestigeShards + multGain,
        lastSaveTime: nowMs,
        lastActiveInputTimestamp: nowMs,
      };
      saveGame(next);
      if (next.cloudAccount) {
        saveStateToCloud(
          next.cloudAccount.uid,
          next.cloudAccount.displayUsername,
          next,
          true
        ).catch(() => {});
      }
      return next;
    });
    onNotify?.('ASCENSION COMPLETE!', `Ascension Multiplier is now ${nextAscensionMult.toFixed(2)}×!`);
  };

  const todayDateStr = getAuthoritativeDateString();

  const unlockedSkinsList = ALL_SKINS.filter((s) => state.unlockedSkins.includes(s.id));
  const dailyFeatured = isSeason3
    ? getDailyMarvelShopRotation(todayDateStr)
    : getDailyItemShopRotation(todayDateStr);
  const shopPoolTotal = isSeason3 ? MARVEL_SHOP_SKINS.length : ITEM_SHOP_SKINS.length;
  const ownedStones = state.infinityStones || [];
  const allStonesCollected = hasAllInfinityStones(ownedStones);
  const availableShopTokens = Math.max(0, state.matthewShopTokens ?? 0);
  const hasShopToken = Boolean(state.hasMatthewShopToken);

  const visibleMajorCategories = useMemo(
    () =>
      SKIN_CATEGORIES_TREE.filter((major) => {
        if (major.id === 'frozen_apocalypse') return isSeason2;
        if (major.id === 'marvel') return isSeason3;
        return true;
      }),
    [isSeason2, isSeason3]
  );

  const guidedTip: { text: string; cta: string; action: () => void; accent: string } | null =
    !isSeason2
      ? null
      : allStonesCollected && isSeason3
      ? {
          text: 'All 6 Infinity Stones collected! Open Gauntlet to SNAP half the server!',
          cta: 'Open Gauntlet',
          action: () => setActiveTab('gauntlet'),
          accent: 'from-purple-500/25 to-amber-500/15 border-amber-400/70 text-amber-200',
        }
      : hasShopToken &&
        dailyFeatured.some((s) => !state.unlockedSkins.includes(s.id))
      ? {
          text: 'Matthew Shop Token Active! Claim any Item Shop skin 100% FREE!',
          cta: 'Open Skins Shop',
          action: () => {
            setActiveTab('skins');
            setSkinSubTab('daily');
          },
          accent: 'from-amber-500/20 to-yellow-500/10 border-amber-400/60 text-amber-200',
        }
      : null;

  return (
    <div className="flex h-full w-full bg-[#090d1a]/92 border-l border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden font-chunky">
      {/* VERTICAL SIDEBAR TABS: SKINS SHOP | UPGRADES | REBIRTH | QUESTS | GAUNTLET | EVENTS */}
      <div className="flex flex-col items-center py-3 px-1.5 bg-[#050811] border-r border-white/10 gap-2.5 z-30 select-none overflow-y-auto">
        {[
          ...(isSeason2
            ? [
                {
                  id: 'skins' as RightTab,
                  label: 'Matthew Shop',
                  Icon: ShoppingBag,
                  activeClass: 'bg-fuchsia-400 text-slate-950 shadow-fuchsia-400/30',
                  badge: availableShopTokens > 0,
                  count: availableShopTokens > 0 ? availableShopTokens : unlockedSkinsList.length,
                },
              ]
            : []),
          { id: 'upgrades' as RightTab, label: 'Upgrades', Icon: Hammer, activeClass: 'bg-amber-500 text-slate-950 shadow-amber-500/30' },
          { id: 'rebirth' as RightTab, label: 'Rebirth', Icon: InfinityIcon, activeClass: 'bg-purple-600 text-white shadow-purple-600/30' },
          ...(isSeason3
            ? [
                {
                  id: 'gauntlet' as RightTab,
                  label: 'Gauntlet',
                  Icon: Sparkles,
                  activeClass: 'bg-amber-400 text-slate-950 shadow-amber-400/30',
                  badge: allStonesCollected,
                  count: ownedStones.length,
                },
              ]
            : []),
        ].map((tabItem) => {
          const isActive = activeTab === tabItem.id;
          return (
            <button
              key={tabItem.id}
              onClick={() => setActiveTab(tabItem.id)}
              className={`relative w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer shrink-0 ${
                isActive
                  ? `${tabItem.activeClass} font-black shadow-lg scale-105`
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <tabItem.Icon className="w-5 h-5" />
              <span className="text-[9px] font-bold mt-0.5">{tabItem.label}</span>
              {'badge' in tabItem && tabItem.badge && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-fuchsia-500 border border-white animate-ping" />
              )}
              {'count' in tabItem && typeof tabItem.count === 'number' && !isActive && (
                <span className="absolute -top-1 -right-1 px-1 rounded-full bg-slate-800 border border-slate-600 text-[8px] font-black text-cyan-200">
                  {tabItem.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* PANEL CONTENT */}
      {/* MAIN PANEL CONTENT */}
      <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
        {guidedTip && (
          <button
            type="button"
            onClick={guidedTip.action}
            className={`mx-2.5 mt-2.5 px-3 py-2 rounded-xl bg-gradient-to-r ${guidedTip.accent} border text-left flex items-center justify-between gap-2 cursor-pointer hover:brightness-110 transition shrink-0 shadow`}
          >
            <span className="flex items-center gap-1.5 text-[10.5px] font-black leading-tight min-w-0">
              <Compass className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{guidedTip.text}</span>
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-slate-950/75 text-[9.5px] font-black uppercase whitespace-nowrap shrink-0">
              {guidedTip.cta}
            </span>
          </button>
        )}

        {/* ================= UPGRADES (KEPT MOUNTED SO SCROLL POSITION PERSISTS) ================= */}
        <div className={activeTab === 'upgrades' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
          <div className="px-3 py-2.5 border-b border-red-500/25 flex items-center justify-between gap-2 bg-gradient-to-r from-[#130d18]/95 via-[#0f1629]/95 to-[#161224]/95 shrink-0">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Hammer className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className={isSeason3 ? 'font-marvel tracking-wide text-sm text-white' : ''}>
                  {isSeason3 ? 'Stark Tech Armory' : isSeason2 ? 'Upgrades Armory (1 → Ctg)' : 'Upgrades'}
                </span>
              </div>
              <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                {activeUpgrades.filter((u) => (state.upgrades[u.id] || 0) > 0).length}/{activeUpgrades.length} Tech Unlocked
              </div>
            </div>
            <div className="flex items-center bg-slate-950/90 rounded-xl p-1 border border-slate-700/80 shadow-inner shrink-0">
              {([1, 10, 'MAX'] as BuyMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setBuyMode(mode)}
                  className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all cursor-pointer ${
                    buyMode === mode
                      ? 'bg-gradient-to-r from-red-500 to-amber-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mode === 'MAX' ? 'MAX' : `${mode}×`}
                </button>
              ))}
            </div>
          </div>

          <div
            ref={upgradesListRef}
            onScroll={(e) => {
              upgradesScrollTopRef.current = e.currentTarget.scrollTop;
            }}
            className="flex-1 min-h-0 overflow-y-auto p-2.5 pb-24 space-y-2"
          >
            {activeUpgrades.map((upgrade) => {
              const currentLevel = state.upgrades[upgrade.id] || 0;
              const isCookiePopped = justBoughtId === upgrade.id;
              const { countToDisplay, cost, canAfford, isKrillion } = resolveUpgradePurchasePlan(
                upgrade,
                currentLevel
              );

              const availableForProgress = isKrillion
                ? (state.krillionCoins || 0) +
                  (state.coins >= KRILLION_COIN_UNIT ? state.coins / KRILLION_COIN_UNIT : 0)
                : (state.krillionCoins || 0) > 0
                ? KRILLION_COIN_UNIT
                : state.coins;
              const affordProgressPct = Math.min(
                100,
                cost > 0 ? Math.floor((availableForProgress / cost) * 100) : 100
              );

              const tier = upgrade.tier || 1;
              const tierColors: Record<number, string> = {
                1: 'bg-slate-800 text-slate-300 border-slate-600',
                2: 'bg-sky-950/90 text-sky-300 border-sky-500/50',
                3: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50',
                4: 'bg-purple-950/90 text-purple-300 border-purple-500/50',
                5: 'bg-amber-950/90 text-amber-300 border-amber-500/50',
                6: 'bg-red-950/90 text-red-300 border-red-500/50',
                7: 'bg-fuchsia-950/90 text-fuchsia-300 border-fuchsia-500/60',
                8: 'bg-yellow-950/90 text-yellow-300 border-yellow-400/70',
              };

              return (
                <div
                  key={upgrade.id}
                  onClick={() => canAfford && handleBuyUpgrade(upgrade.id)}
                  className={`group relative overflow-hidden flex items-center justify-between gap-2 p-2 rounded-2xl transition-all select-none ${
                    isCookiePopped
                      ? 'scale-[1.02] ring-1 ring-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.45)] bg-gradient-to-r from-red-950/80 via-slate-900/90 to-amber-950/60 border border-amber-400/80'
                      : canAfford
                      ? 'bg-gradient-to-r from-slate-900/90 via-[#15182d]/90 to-[#1f1324]/85 hover:from-[#1d172e] hover:to-[#281526] border border-amber-400/40 hover:border-amber-300/85 hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-md'
                      : 'bg-slate-950/75 border border-white/[0.06] opacity-75 cursor-not-allowed'
                  }`}
                >
                  {!canAfford && affordProgressPct > 2 && (
                    <div
                      className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-red-500/70 via-amber-400/70 to-yellow-300/70 transition-all duration-200"
                      style={{ width: `${affordProgressPct}%` }}
                    />
                  )}

                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="relative shrink-0 p-0.5 rounded-xl bg-gradient-to-br from-white/15 to-white/5 border border-white/10">
                      <UpgradeArtwork
                        iconKey={upgrade.icon}
                        iconImage={upgrade.iconImage}
                        tier={tier}
                        className={`w-12 h-12 rounded-lg transition-transform ${
                          canAfford ? 'scale-100' : 'grayscale-[35%]'
                        }`}
                      />
                      <span
                        className={`absolute -top-1.5 -left-1.5 px-1 py-0.2 rounded-md text-[9px] font-black border shadow-sm ${
                          tierColors[tier] || tierColors[1]
                        }`}
                      >
                        T{tier}
                      </span>
                      <span
                        className={`absolute -bottom-1.5 -right-1.5 px-1.5 py-0.2 rounded-md text-[10px] font-black border shadow ${
                          currentLevel > 0
                            ? 'bg-amber-400 text-slate-950 border-white'
                            : 'bg-slate-900 text-slate-400 border-slate-700'
                        }`}
                      >
                        {currentLevel}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className={`font-black text-[13px] text-white truncate leading-tight ${isSeason3 ? 'font-marvel tracking-wide' : ''}`}>
                        {upgrade.name}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap mt-1">
                        {(upgrade.baseClickPower > 0 || (upgrade.krillionBaseClickPower || 0) > 0) && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-400/45 text-[10px] font-black text-cyan-200">
                            <Zap className="w-2.5 h-2.5 text-yellow-300 fill-yellow-300" />
                            +{isKrillion
                              ? formatKrillion((upgrade.krillionBaseClickPower || 0) * countToDisplay)
                              : formatCoins(upgrade.baseClickPower * countToDisplay)}
                          </span>
                        )}
                        {(upgrade.baseCps > 0 || (upgrade.krillionBaseCps || 0) > 0) && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-400/35 text-[10px] font-bold text-amber-300">
                            +{isKrillion
                              ? formatKrillion((upgrade.krillionBaseCps || 0) * countToDisplay)
                              : formatCoins(upgrade.baseCps * countToDisplay)}/s
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={!canAfford}
                    className={`px-3 py-2 rounded-xl font-black text-xs min-w-[74px] shrink-0 transition-transform ${
                      canAfford
                        ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 text-slate-950 border border-yellow-100 shadow-[0_0_14px_rgba(251,191,36,0.35)] group-hover:scale-105'
                        : 'bg-slate-900 text-slate-400 border border-slate-700/80 cursor-not-allowed'
                    }`}
                  >
                    {isKrillion ? formatKrillion(cost) : formatCoins(cost)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= REBIRTH TAB ================= */}
        {activeTab === 'rebirth' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-24 flex flex-col justify-center">
            <div className="text-center p-5 rounded-3xl bg-slate-900/90 border-2 border-purple-500/40 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border-2 border-purple-400 p-3 mx-auto mb-3 flex items-center justify-center text-purple-300 shadow-[0_0_30px_rgba(168,85,247,0.4)]">
                <InfinityIcon className="w-9 h-9" />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-wide">
                Ascension Rebirth
              </h3>

              <div className="my-5 grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-black">Current</span>
                  <p className="text-2xl font-black text-purple-300 mt-1">
                    {currentAscensionMult.toFixed(2)}×
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border-2 border-yellow-400/50">
                  <span className="text-[10px] text-yellow-300 uppercase font-black">Next</span>
                  <p className="text-2xl font-black text-yellow-300 mt-1">
                    {nextAscensionMult.toFixed(2)}×{' '}
                    <span className="text-xs text-emerald-400">(+{multDeltaDisplay}×)</span>
                  </p>
                </div>
              </div>

              <button
                onClick={handleRebirth}
                disabled={!canRebirth}
                className={`w-full py-3.5 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider btn-chunky transition ${
                  canRebirth
                    ? 'bg-gradient-to-r from-purple-600 via-fuchsia-500 to-amber-400 hover:brightness-110 text-slate-950 cursor-pointer shadow-lg shadow-purple-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                }`}
              >
                {canRebirth
                  ? `Rebirth → ${nextAscensionMult.toFixed(2)}×`
                  : `${formatCoins(state.lifetimeCoins)} / ${formatCoins(nextRebirthReqCoins)}`}
              </button>
            </div>
          </div>
        )}

        {/* ================= SKINS SHOP TAB (VAULT + DAILY + CRATES + CURSORS + OWNED) ================= */}
        {activeTab === 'skins' && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="p-2.5 border-b border-slate-800/80 flex items-center justify-between gap-1.5 bg-[#101426]/80 flex-wrap shrink-0">
              <div className="flex items-center gap-1 bg-slate-900 rounded-xl p-1 border border-slate-800 flex-wrap">
                {[
                  { id: 'daily' as SkinSubTab, label: 'Matthew Shop' },
                  { id: 'crates' as SkinSubTab, label: 'Crates' },
                  {
                    id: 'cursors' as SkinSubTab,
                    label: `Cursors (${
                      hasShopToken
                        ? ALL_CURSORS.length
                        : ALL_CURSORS.filter((c) => (state.unlockedCursors || []).includes(c.id)).length
                    }/${ALL_CURSORS.length})`,
                  },
                  { id: 'collection' as SkinSubTab, label: 'Owned' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setSkinSubTab(st.id)}
                    className={`px-2.5 py-1 text-[11px] font-black rounded-lg cursor-pointer transition ${
                      skinSubTab === st.id
                        ? 'bg-fuchsia-400 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
              {onOpenSkinQualityModal && (
                <button
                  onClick={onOpenSkinQualityModal}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 hover:text-white cursor-pointer"
                  title="Browse All Skins"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-24">
              {skinSubTab === 'collection' && (() => {
                const ownedSet = new Set(state.unlockedSkins);
                const sections = visibleMajorCategories
                  .map((major) => {
                    const minorGroups = major.minors
                      .map((minor) => {
                        const skins = minor.skinIds
                          .map((id) => getSkinById(id))
                          .filter((skin) => {
                            if (!ownedSet.has(skin.id)) return false;
                            if (!isSeason2 && SEASON_2_ONLY_SKIN_ID_SET.has(skin.id)) return false;
                            if (!isSeason3 && SEASON_3_ONLY_SKIN_ID_SET.has(skin.id)) return false;
                            return true;
                          });
                        return { ...minor, skins };
                      })
                      .filter((g) => g.skins.length > 0);
                    return { ...major, minorGroups };
                  })
                  .filter((sec) => sec.minorGroups.length > 0);

                return (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                      <span>Owned Skins ({unlockedSkinsList.length})</span>
                      <span className="text-amber-300 font-black uppercase">Tap to Equip</span>
                    </div>

                    {sections.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 text-center text-xs font-bold text-slate-400">
                        No skins unlocked yet. Unlock skins from Milestones, Matthew Shop, and Crates!
                      </div>
                    ) : (
                      sections.map((major) => (
                        <div key={major.id} className="space-y-3">
                          <div className="pb-1 border-b border-amber-400/35 flex items-center justify-between">
                            <h3 className="text-sm font-black uppercase tracking-wider text-amber-300 font-marvel">
                              {major.label}
                            </h3>
                            <span className="text-[10px] font-black text-slate-400">
                              {major.minorGroups.reduce((sum, g) => sum + g.skins.length, 0)} Owned
                            </span>
                          </div>

                          {major.minorGroups.map((minor) => (
                            <div key={minor.id} className="space-y-2">
                              <div className="text-[10px] font-black uppercase tracking-widest text-cyan-300 pl-1">
                                {minor.label}
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {minor.skins.map((skin) => {
                                  const isEquipped = state.equippedSkin === skin.id;
                                  return (
                                    <button
                                      key={skin.id}
                                      type="button"
                                      onClick={() => handleEquipSkin(skin)}
                                      title={skin.name}
                                      className={`relative aspect-square rounded-2xl p-2 bg-slate-950/90 border-2 flex flex-col items-center justify-center transition cursor-pointer hover:scale-105 ${
                                        isEquipped
                                          ? 'border-amber-400 ring-2 ring-amber-400/50'
                                          : 'border-slate-800 hover:border-cyan-400/60'
                                      }`}
                                    >
                                      <img
                                        src={skin.image}
                                        alt={skin.name}
                                        loading="lazy"
                                        onError={(e) => {
                                          (e.currentTarget as HTMLImageElement).src =
                                            skin.fallbackImage || './images/skins/classic_matthew.png';
                                        }}
                                        className="w-4/5 h-4/5 object-contain pointer-events-none"
                                      />
                                      <span className="text-[8.5px] font-bold text-slate-300 truncate w-full text-center mt-0.5">
                                        {skin.name}
                                      </span>
                                      {isEquipped && (
                                        <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center">
                                          <Check className="w-3 h-3 stroke-[3]" />
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                );
              })()}

              {skinSubTab === 'daily' && (
                <div className="space-y-4">
                  {/* MATTHEW SHOP TOKEN STATUS BANNER */}
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-950/45 via-slate-900 to-slate-950 border border-amber-400/50 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                        <Crown className="w-4 h-4 text-yellow-300" />
                        <span>Matthew Shop Token</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/60 text-[10px] font-black text-amber-200">
                        {hasShopToken ? 'ACTIVE FOREVER • EVERYTHING FREE' : `${availableShopTokens} / 1`}
                      </span>
                    </div>
                    <p className="text-[10.5px] font-bold text-amber-100/80">
                      {hasShopToken
                        ? 'Your Matthew Shop Token permanently unlocks all Shop Skins, Crates, and Cursors for FREE across all seasons!'
                        : 'Find the ultra-rare Matthew Shop Token inside Mystery Chests or Golden Matthews to permanently unlock EVERYTHING in shops for FREE forever!'}
                    </p>
                  </div>

                  {/* DAILY ROTATING GEM SKINS */}
                  <div>
                    <div className="text-[11px] font-black uppercase text-fuchsia-300 mb-2">
                      Daily Rotating Shop ({dailyFeatured.length}/{shopPoolTotal} • Swaps Daily • {todayDateStr})
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {dailyFeatured.map((skin) => {
                        const owned = state.unlockedSkins.includes(skin.id);
                        const equipped = state.equippedSkin === skin.id;
                        const cost = skin.gemCost || 25;
                        return (
                          <div
                            key={skin.id}
                            className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col items-center text-center gap-2"
                          >
                            <img src={skin.image} alt={skin.name} className="w-16 h-16 object-contain" />
                            <div className="text-xs font-black text-white truncate w-full">{skin.name}</div>
                            {owned ? (
                              <button
                                onClick={() => handleEquipSkin(skin)}
                                className={`w-full py-1.5 rounded-xl font-black text-[10px] uppercase cursor-pointer ${
                                  equipped ? 'bg-cyan-400 text-slate-950' : 'bg-emerald-500/20 text-emerald-200'
                                }`}
                              >
                                {equipped ? 'Equipped' : 'Equip'}
                              </button>
                            ) : (
                              <button
                                onClick={() => onBuySkinWithGems?.(skin.id, hasShopToken ? 0 : cost)}
                                disabled={!hasShopToken && state.gems < cost}
                                className={`w-full py-1.5 rounded-xl font-black text-[10px] uppercase cursor-pointer ${
                                  hasShopToken
                                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 shadow'
                                    : 'bg-fuchsia-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950'
                                }`}
                              >
                                {hasShopToken ? 'Claim FREE' : `${cost} Gems`}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {skinSubTab === 'crates' && (
                <div className="space-y-3">
                  <div className="text-[11px] font-bold text-slate-300">
                    Unbox Skins &amp; Ability Cursors! Duplicates refund Gems automatically.
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {(['normal', 'stark', 'wakanda', 'infinity'] as CrateType[]).map((ctype) => {
                      const spec = CRATE_DEFINITIONS[ctype];
                      const canAfford = hasShopToken || state.gems >= spec.gemCost;
                      const crateAccentMap: Record<CrateType, string> = {
                        normal: '#f59e0b',
                        stark: '#ef4444',
                        wakanda: '#a855f7',
                        infinity: '#eab308',
                      };
                      const accentColor = crateAccentMap[ctype];
                      const topCursorObj = getCursorById(spec.rarestCursorId);
                      const topSkinObj = getSkinById(spec.rarestSkinId);
                      return (
                        <div
                          key={ctype}
                          className="group p-3 rounded-2xl border-2 bg-gradient-to-b from-slate-900/95 to-slate-950 flex flex-col items-center text-center gap-2 transition-transform hover:-translate-y-0.5"
                          style={{ borderColor: `${accentColor}88` }}
                        >
                          <img
                            src={spec.image}
                            alt={spec.name}
                            className="w-24 h-24 object-contain transition-transform duration-200 group-hover:scale-105"
                            style={{ filter: `drop-shadow(0 0 14px ${accentColor}99)` }}
                          />
                          <div className="w-full">
                            <h4 className="text-xs font-black uppercase text-white truncate">
                              {spec.name}
                            </h4>
                            <div className="text-[9.5px] font-bold text-slate-400 truncate mt-0.5">
                              {topCursorObj?.name || 'Cursor'} • {topSkinObj?.name?.replace('Matthew ', '') || 'Skin'}
                            </div>
                          </div>

                          <button
                            onClick={() => onOpenCrate?.(ctype)}
                            disabled={!canAfford}
                            className="w-full mt-auto py-2 rounded-xl font-black text-[10px] uppercase cursor-pointer transition flex items-center justify-center gap-1 text-slate-950 disabled:opacity-40 hover:brightness-110 active:scale-95"
                            style={{ background: accentColor }}
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>{hasShopToken ? 'FREE • Token' : `${spec.gemCost} Gems`}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {skinSubTab === 'cursors' && (
                <div className="space-y-3">
                  {(() => {
                    const equipped = getCursorById(state.equippedCursorId);
                    return (
                      <div className="p-3 rounded-2xl bg-slate-900/90 border border-cyan-400/40 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {equipped ? (
                            <CursorVisual cursor={equipped} size={32} />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700" />
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-black text-white truncate">
                              {equipped ? `Equipped: ${equipped.name}` : 'No Cursor Equipped'}
                            </div>
                            <div className="text-[10px] font-bold text-cyan-300 truncate">
                              {equipped ? equipped.abilitySummary : 'Unbox cursors from Stark, Wakanda & Infinity Crates!'}
                            </div>
                          </div>
                        </div>
                        {equipped && (
                          <button
                            onClick={() => onEquipCursor?.(null)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-black uppercase cursor-pointer shrink-0"
                          >
                            Unequip
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ALL_CURSORS.map((cursor) => {
                      const directlyOwned = (state.unlockedCursors || []).includes(cursor.id);
                      const unlocked = directlyOwned || hasShopToken;
                      const isEquipped = state.equippedCursorId === cursor.id;
                      return (
                        <button
                          key={cursor.id}
                          type="button"
                          onClick={() => setSelectedCursorDetailId(cursor.id)}
                          className={`group p-3 rounded-2xl border flex flex-col items-center justify-center gap-2 text-center transition hover:scale-[1.03] cursor-pointer ${
                            isEquipped
                              ? 'bg-cyan-950/60 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.28)]'
                              : unlocked
                              ? 'bg-slate-900/90 hover:border-amber-300/60 border-slate-700'
                              : 'bg-slate-950/75 hover:border-slate-600 border-slate-800/80 opacity-75'
                          }`}
                        >
                          <div className="w-16 h-16 rounded-2xl bg-slate-950/90 border border-white/10 flex items-center justify-center">
                            <CursorVisual cursor={cursor} size={46} />
                          </div>
                          <span className="text-xs font-black text-white leading-tight line-clamp-2">
                            {cursor.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* CLICKED CURSOR DETAIL MODAL */}
                  {selectedCursorDetailId && (() => {
                    const cursor = ALL_CURSORS.find((c) => c.id === selectedCursorDetailId);
                    if (!cursor) return null;
                    const directlyOwned = (state.unlockedCursors || []).includes(cursor.id);
                    const unlocked = directlyOwned || hasShopToken;
                    const isEquipped = state.equippedCursorId === cursor.id;
                    return (
                      <div
                        className="fixed inset-0 z-[130] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
                        onClick={() => setSelectedCursorDetailId(null)}
                      >
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="w-full max-w-sm rounded-3xl bg-[#0e1529] border-2 p-5 shadow-2xl flex flex-col items-center text-center relative"
                          style={{
                            borderColor: `${cursor.accentColor}99`,
                            boxShadow: `0 0 48px ${cursor.glowColor}`,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedCursorDetailId(null)}
                            className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>

                          <div className="w-24 h-24 rounded-2xl bg-slate-950 border border-white/15 flex items-center justify-center mb-3">
                            <CursorVisual cursor={cursor} size={68} />
                          </div>

                          <h4 className="text-lg font-black text-white">{cursor.name}</h4>
                          <span
                            className="mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase"
                            style={{
                              backgroundColor: `${cursor.accentColor}22`,
                              color: cursor.accentColor,
                              border: `1px solid ${cursor.accentColor}66`,
                            }}
                          >
                            {cursor.rarity} •{' '}
                            {cursor.crateType === 'starter'
                              ? 'Starter Cursor'
                              : (CRATE_DEFINITIONS as Record<string, { name?: string }>)[cursor.crateType]?.name || 'Crate Cursor'}
                          </span>

                          <div className="w-full mt-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                            <div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                              Cursor Powers
                            </div>
                            <div className="text-xs font-black text-white">
                              {cursor.abilitySummary}
                            </div>
                            {cursor.description && (
                              <p className="text-[11px] font-bold text-slate-400">
                                {cursor.description}
                              </p>
                            )}
                          </div>

                          <div className="w-full mt-4">
                            {unlocked ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onEquipCursor?.(isEquipped ? null : cursor.id);
                                  setSelectedCursorDetailId(null);
                                }}
                                className={`w-full py-2.5 rounded-xl font-black text-xs uppercase cursor-pointer transition ${
                                  isEquipped
                                    ? 'bg-slate-800 hover:bg-rose-500/30 text-cyan-300 border border-cyan-400/50'
                                    : hasShopToken && !directlyOwned
                                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 shadow-lg'
                                    : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-lg'
                                }`}
                              >
                                {isEquipped
                                  ? 'Unequip Cursor'
                                  : hasShopToken && !directlyOwned
                                  ? 'Claim FREE with Shop Token & Equip'
                                  : 'Equip Cursor'}
                              </button>
                            ) : (
                              <div className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 font-black text-xs uppercase">
                                Locked — Unbox in{' '}
                                {cursor.crateType === 'starter'
                                  ? 'Starter'
                                  : (CRATE_DEFINITIONS as Record<string, { name?: string }>)[cursor.crateType]?.name || 'Crates'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

            </div>
          </div>
        )}

        {/* ================= INFINITY GAUNTLET TAB (SEASON 3) ================= */}
        {activeTab === 'gauntlet' && (() => {
          const stoneSockets: { id: (typeof ownedStones)[number]; x: string; y: string }[] = [
            { id: 'power', x: '22%', y: '34%' },
            { id: 'space', x: '38%', y: '27%' },
            { id: 'reality', x: '54%', y: '27%' },
            { id: 'soul', x: '68%', y: '34%' },
            { id: 'time', x: '77%', y: '58%' },
            { id: 'mind', x: '48%', y: '52%' },
          ];
          const remainingCount = Math.max(0, 6 - ownedStones.length);
          return (
            <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-24 space-y-3.5">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/80 via-slate-950 to-amber-950/50 border-2 border-amber-400/60 flex flex-col items-center text-center gap-2.5 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                <div className="text-[11px] font-black uppercase tracking-widest text-amber-300">
                  Infinity Stones Lit Up ({ownedStones.length} / 6)
                </div>

                {/* GAUNTLET VISUAL WITH CONSISTENT PROGRESSIVE STONE IMAGES */}
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <img
                    src={
                      ownedStones.length > 0
                        ? `./images/s3/gauntlet/gauntlet_${Math.min(6, ownedStones.length)}.png`
                        : INFINITY_GAUNTLET_IMAGE
                    }
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = INFINITY_GAUNTLET_IMAGE;
                    }}
                    alt="Infinity Gauntlet"
                    className={`w-40 h-40 object-contain transition-transform ${
                      allStonesCollected
                        ? 'scale-105 drop-shadow-[0_0_26px_rgba(250,204,21,0.95)] animate-pulse'
                        : 'drop-shadow-[0_0_12px_rgba(168,85,247,0.45)]'
                    }`}
                  />
                </div>

                <h4 className="text-base font-black text-white uppercase font-marvel">
                  Thanos Infinity Gauntlet
                </h4>
                <p className="text-[11px] font-bold text-slate-300 leading-snug">
                  Click falling Marvel Chests for a <span className="text-amber-300">1-in-75 chance</span> per chest to light up an unowned Infinity Stone. Collect all 6 to unlock The Snap!
                </p>

                {allStonesCollected ? (
                  <button
                    type="button"
                    disabled={isSnapBusy}
                    onClick={() => onTriggerInfinitySnap?.()}
                    className="w-full mt-1 py-3 rounded-xl bg-gradient-to-r from-amber-300 via-yellow-300 to-rose-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_28px_rgba(250,204,21,0.75)] hover:brightness-110 active:scale-95 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSnapBusy ? 'Snapping Half the Universe...' : 'SNAP HALF THE UNIVERSE (Uses All 6 Stones)'}
                  </button>
                ) : (
                  <div className="w-full py-2.5 rounded-xl bg-slate-900/90 border border-amber-400/35 text-xs font-black uppercase text-amber-200">
                    Need {remainingCount} More Stone{remainingCount === 1 ? '' : 's'} ({ownedStones.length}/6)
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {INFINITY_STONES.map((stone) => {
                  const isOwned = ownedStones.includes(stone.id);
                  return (
                    <div
                      key={stone.id}
                      className={`p-3 rounded-2xl border flex items-center gap-2.5 transition ${
                        isOwned
                          ? 'bg-slate-900/95 border-amber-300/75 shadow-lg'
                          : 'bg-slate-950/70 border-slate-800/80 opacity-55'
                      }`}
                    >
                      <div
                        className="w-11 h-11 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-center shrink-0"
                        style={isOwned ? { boxShadow: `0 0 18px ${stone.glowColor}` } : undefined}
                      >
                        <img
                          src={stone.image}
                          alt={stone.name}
                          className={`w-8 h-8 object-contain ${isOwned ? '' : 'grayscale opacity-35'}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black truncate" style={{ color: stone.color }}>
                          {stone.name}
                        </div>
                        <div className="text-[9.5px] font-bold text-slate-400 truncate">
                          {isOwned ? 'Lit Up!' : 'Chest Drop (1/75)'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
};
