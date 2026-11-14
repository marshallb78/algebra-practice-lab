import React, { useState } from 'react';
import { CosmeticSlot, EggRarity, GameState } from '../types/game';
import { getUpgradesForSeason } from '../data/upgrades';
import { ALL_SKINS, Skin, equipSkin, isSeasonTwoOrLater } from '../data/skins';
import { QUESTS, getQuestProgress } from '../data/quests';
import {
  EGG_DEFINITIONS,
  getPetClickMultiplierBonus,
  getPetCombatDps,
  getPetSpeciesDefinition,
  getPetUpgradeGemCost,
} from '../data/petsAndEggs';
import {
  ITEM_SHOP_SKINS,
  SEASON_2_LIVE_EVENT_SKINS,
  getDailyItemShopRotation,
} from '../data/season2Skins';
import { CRATE_DEFINITIONS, CrateType } from '../data/crates';
import { ALL_CURSORS, getCursorById } from '../data/cursors';
import { CursorVisual } from './s2/CursorVisual';
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
  getUpgradeCost,
  getBulkUpgradeCost,
  getMaxAffordableUpgrade,
} from '../utils/calculations';
import { getAuthoritativeDateString } from '../utils/scheduleEngine';
import { GEM_ECONOMY_CONFIG, SEASON_2_CONFIG } from '../config/gameConfig';
import { saveGame } from '../utils/storage';
import { saveStateToCloud } from '../firebase/cloudSave';
import { formatCoins } from '../utils/formatters';
import { soundManager } from '../audio/soundManager';
import { particleEngine } from './ParticleCanvas';
import { UpgradeArtwork } from './UpgradeArtwork';
import { EggBadgeVisual, PetSprite2D } from './s2/PetSprite2D';
import {
  ShoppingBag,
  Infinity as InfinityIcon,
  Trophy,
  Check,
  Zap,
  Gem,
  Gift,
  Eye,
  Swords,
  Sparkles,
  Snowflake,
  Palette,
  ArrowUpCircle,
  Crown,
  Lock,
  Hammer,
  Compass,
  X,
} from 'lucide-react';

export type RightTab = 'upgrades' | 'rebirth' | 'quests' | 'pets' | 'skins' | 'events';

interface RightPanelProps {
  state: GameState;
  setState: React.Dispatch<React.SetStateAction<GameState>>;
  isSandbox?: boolean;
  onOpenSkinQualityModal?: () => void;
  onNotify?: (title: string, subtitle: string) => void;
  onHatchEgg?: (rarity: EggRarity) => void;
  onToggleEquipPet?: (instanceId: string) => void;
  onUpgradePet?: (instanceId: string) => void;
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
  onOpenSkinQualityModal,
  onNotify,
  onHatchEgg,
  onToggleEquipPet,
  onUpgradePet,
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
  const [petSubTab, setPetSubTab] = useState<'pets' | 'eggs'>('pets');
  const [inspectedPetId, setInspectedPetId] = useState<string | null>(null);
  const [skinSubTab, setSkinSubTab] = useState<SkinSubTab>('daily');
  const [selectedCursorDetailId, setSelectedCursorDetailId] = useState<string | null>(null);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);

  const isSeason2 = isSeasonTwoOrLater(state.currentSeasonId);
  const activeUpgrades = getUpgradesForSeason(state.currentSeasonId);

  const handleBuyUpgrade = (upgradeId: string) => {
    const upgrade = activeUpgrades.find((u) => u.id === upgradeId);
    if (!upgrade) return;
    const currentLevel = state.upgrades[upgradeId] || 0;
    let countToBuy = 1;
    let totalCost = 0;

    if (buyMode === 'MAX') {
      const maxInfo = getMaxAffordableUpgrade(
        upgrade.baseCost,
        upgrade.costMultiplier,
        currentLevel,
        state.coins
      );
      if (maxInfo.count <= 0) return;
      countToBuy = maxInfo.count;
      totalCost = maxInfo.totalCost;
    } else {
      countToBuy = buyMode;
      const bulkInfo = getBulkUpgradeCost(
        upgrade.baseCost,
        upgrade.costMultiplier,
        currentLevel,
        countToBuy
      );
      totalCost = bulkInfo.totalCost;
      if (state.coins < totalCost) return;
    }

    if (state.coins < totalCost) return;
    const nowMs = Date.now();
    setState((prev) => {
      const next: GameState = {
        ...prev,
        coins: prev.coins - totalCost,
        lastSaveTime: nowMs,
        lastActiveInputTimestamp: nowMs,
        upgrades: {
          ...prev.upgrades,
          [upgradeId]: (prev.upgrades[upgradeId] || 0) + countToBuy,
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
  const canClaimDailyLogin = state.lastDailyLoginClaimDate !== todayDateStr;

  const handleClaimDailyLogin = () => {
    if (!canClaimDailyLogin) return;
    soundManager.playBuy();
    particleEngine.emitPrestige();
    const nowMs = Date.now();
    let pushedNext: GameState | null = null;
    setState((prev) => {
      if (prev.lastDailyLoginClaimDate === todayDateStr) return prev;
      const bonus = GEM_ECONOMY_CONFIG.dailyLoginGems;
      const next: GameState = {
        ...prev,
        gems: prev.gems + bonus,
        lifetimeGems: prev.lifetimeGems + bonus,
        lastDailyLoginClaimDate: todayDateStr,
        lastSaveTime: nowMs,
        lastActiveInputTimestamp: nowMs,
      };
      pushedNext = next;
      saveGame(next);
      return next;
    });
    if (pushedNext && (pushedNext as GameState).cloudAccount) {
      const acc = (pushedNext as GameState).cloudAccount!;
      saveStateToCloud(acc.uid, acc.displayUsername, pushedNext, true).catch(() => {});
    }
    onNotify?.('DAILY BONUS!', `+${GEM_ECONOMY_CONFIG.dailyLoginGems} Gems added!`);
  };

  const handleClaimQuest = (questId: string) => {
    const quest = QUESTS.find((q) => q.id === questId);
    if (!quest || state.claimedQuests.includes(questId)) return;
    const progress = getQuestProgress(quest, state);
    if (!progress.isComplete) return;
    soundManager.playBuy();
    particleEngine.emitPrestige();
    setState((prev) => {
      const next: GameState = {
        ...prev,
        claimedQuests: [...prev.claimedQuests, questId],
        coins: prev.coins + (quest.rewardCoins || 0),
        lifetimeCoins: prev.lifetimeCoins + (quest.rewardCoins || 0),
        seasonalScore: prev.seasonalScore + (quest.rewardCoins || 0),
        gems: prev.gems + (quest.rewardGems || 0),
        lifetimeGems: prev.lifetimeGems + (quest.rewardGems || 0),
        lastActiveInputTimestamp: Date.now(),
      };
      saveGame(next);
      return next;
    });
    onNotify?.('QUEST COMPLETE!', `${quest.title} (+${quest.rewardGems} Gems)`);
  };

  const handleSummonEvent = async (spec: PlayerEventCostSpec & { id: string }) => {
    if (state.gems < spec.gemCost) return;
    setBusyEventId(spec.id);
    const uid = state.cloudAccount?.uid || 'local_tester';
    const username = state.cloudAccount?.displayUsername || state.cloudAccount?.username || 'Player';
    const res = await summonGlobalLiveEvent({ spec, uid, username, isSandbox });
    setBusyEventId(null);
    if (res.ok && res.event) {
      setState((prev) => {
        const next = { ...prev, gems: Math.max(0, prev.gems - spec.gemCost) };
        saveGame(next);
        return next;
      });
      onEventSummoned?.(res.event);
      soundManager.playStormWaveStart();
      onNotify?.('LIVE EVENT SUMMONED!', `${spec.label} active now!`);
    }
  };

  const unlockedSkinsList = ALL_SKINS.filter((s) => state.unlockedSkins.includes(s.id));
  const dailyQuests = QUESTS.filter((q) => q.scope === 'daily');
  const seasonalQuests = QUESTS.filter((q) => q.scope === 'seasonal');
  const dailyFeatured = getDailyItemShopRotation(todayDateStr, 12);
  const pets = state.pets || [];
  const equippedPetIds = state.equippedPetIds || [];
  const totalSealedEggs = Object.values(state.sealedEggs || {}).reduce((a, b) => a + b, 0);
  const availableShopTokens = Math.max(0, state.matthewShopTokens ?? 0);
  const hasShopToken = Boolean(state.hasMatthewShopToken);

  const guidedTip: { text: string; cta: string; action: () => void; accent: string } | null =
    !isSeason2
      ? null
      : hasShopToken &&
        ITEM_SHOP_SKINS.some((s) => !state.unlockedSkins.includes(s.id))
      ? {
          text: 'Matthew Shop Token Active! Claim any Item Shop skin 100% FREE!',
          cta: 'Open Skins Shop',
          action: () => {
            setActiveTab('skins');
            setSkinSubTab('daily');
          },
          accent: 'from-amber-500/20 to-yellow-500/10 border-amber-400/60 text-amber-200',
        }
      : pets.length > 0 && equippedPetIds.length === 0
      ? {
          text: 'Equip your Pet so it guards Matthew and fights Zombies!',
          cta: 'Equip Pet',
          action: () => {
            setActiveTab('pets');
            setPetSubTab('pets');
          },
          accent: 'from-cyan-500/20 to-sky-500/10 border-cyan-400/60 text-cyan-200',
        }
      : totalSealedEggs > 0
      ? {
          text: `${totalSealedEggs} Sealed Egg${totalSealedEggs > 1 ? 's' : ''} ready! Hatch stronger guardians in Pets.`,
          cta: 'Hatch Eggs',
          action: () => {
            setActiveTab('pets');
            setPetSubTab('eggs');
          },
          accent: 'from-sky-500/20 to-indigo-500/10 border-sky-400/60 text-sky-200',
        }
      : null;

  return (
    <div className="flex h-full w-full bg-[#090d1a]/92 border-l border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden font-chunky">
      {/* VERTICAL SIDEBAR TABS: SKINS SHOP (S2 FIRST) | UPGRADES | PETS | REBIRTH | QUESTS | EVENTS */}
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
          ...(isSeason2
            ? [
                {
                  id: 'pets' as RightTab,
                  label: 'Pets',
                  Icon: Swords,
                  activeClass: 'bg-cyan-400 text-slate-950 shadow-cyan-400/30',
                  badge: totalSealedEggs > 0,
                  count: pets.length,
                },
              ]
            : []),
          { id: 'rebirth' as RightTab, label: 'Rebirth', Icon: InfinityIcon, activeClass: 'bg-purple-600 text-white shadow-purple-600/30' },
          { id: 'quests' as RightTab, label: 'Quests', Icon: Trophy, activeClass: 'bg-yellow-400 text-slate-950 shadow-yellow-400/30', badge: canClaimDailyLogin },
          ...(isSeason2
            ? [
                { id: 'events' as RightTab, label: 'Events', Icon: Snowflake, activeClass: 'bg-sky-400 text-slate-950 shadow-sky-400/30' },
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
      <div className="flex-1 flex flex-col h-full overflow-hidden">
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

        {/* ================= UPGRADES (UP TO Vg) ================= */}
        {activeTab === 'upgrades' && (
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-slate-800/80 flex items-center justify-between gap-2 bg-[#101426]/80">
              <div className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Hammer className="w-4 h-4" />
                <span>{isSeason2 ? 'Upgrades Armory (1 → Vg)' : 'Upgrades'}</span>
              </div>
              <div className="flex items-center bg-slate-900 rounded-xl p-1 border border-slate-750">
                {([1, 10, 'MAX'] as BuyMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setBuyMode(mode)}
                    className={`px-2 py-0.5 text-[11px] font-black rounded-md transition-all cursor-pointer ${
                      buyMode === mode
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {mode === 'MAX' ? 'MAX' : `${mode}x`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {activeUpgrades.map((upgrade) => {
                const currentLevel = state.upgrades[upgrade.id] || 0;
                const isCookiePopped = justBoughtId === upgrade.id;
                let cost = 0;
                let countToDisplay = 1;
                let canAfford = false;

                if (buyMode === 'MAX') {
                  const maxInfo = getMaxAffordableUpgrade(
                    upgrade.baseCost,
                    upgrade.costMultiplier,
                    currentLevel,
                    state.coins
                  );
                  countToDisplay = maxInfo.count > 0 ? maxInfo.count : 1;
                  cost =
                    maxInfo.count > 0
                      ? maxInfo.totalCost
                      : getUpgradeCost(upgrade.baseCost, upgrade.costMultiplier, currentLevel);
                  canAfford = maxInfo.count > 0;
                } else {
                  countToDisplay = buyMode;
                  cost = getBulkUpgradeCost(
                    upgrade.baseCost,
                    upgrade.costMultiplier,
                    currentLevel,
                    countToDisplay
                  ).totalCost;
                  canAfford = state.coins >= cost;
                }

                const affordProgressPct = Math.min(
                  100,
                  cost > 0 ? Math.floor((state.coins / cost) * 100) : 100
                );

                return (
                  <div
                    key={upgrade.id}
                    onClick={() => canAfford && handleBuyUpgrade(upgrade.id)}
                    className={`relative overflow-hidden flex items-center justify-between p-2.5 rounded-xl transition-all select-none ${
                      isCookiePopped
                        ? 'scale-[1.03] ring-1 ring-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.45)] bg-gradient-to-r from-cyan-950/70 to-amber-950/45'
                        : canAfford
                        ? 'bg-white/[0.06] hover:bg-white/[0.11] border border-amber-400/35 hover:border-yellow-300/75 hover:scale-[1.01] active:scale-[0.98] cursor-pointer shadow-md'
                        : 'bg-white/[0.02] border border-white/5 opacity-70 cursor-not-allowed'
                    }`}
                  >
                    {!canAfford && affordProgressPct > 2 && (
                      <div
                        className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-cyan-500/60 to-amber-400/60 transition-all duration-200"
                        style={{ width: `${affordProgressPct}%` }}
                      />
                    )}

                    <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                      <div className="relative shrink-0">
                        <UpgradeArtwork
                          iconKey={upgrade.icon}
                          iconImage={upgrade.iconImage}
                          tier={upgrade.tier || 1}
                          className={`w-14 h-14 transition-transform ${
                            canAfford ? 'scale-100' : 'grayscale-[30%]'
                          }`}
                        />
                        <span
                          className={`absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-lg text-[10px] font-black border shadow ${
                            currentLevel > 0
                              ? 'bg-amber-400 text-slate-950 border-white'
                              : 'bg-slate-900 text-slate-400 border-slate-700'
                          }`}
                        >
                          Lv.{currentLevel}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-black text-sm text-white truncate leading-tight">
                          {upgrade.name}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                          {upgrade.baseClickPower > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gradient-to-r from-cyan-500/25 to-sky-500/20 border border-cyan-400/60 text-[11px] font-black text-cyan-200 shadow-sm">
                              <Zap className="w-3 h-3 text-yellow-300 fill-yellow-300" />
                              +{formatCoins(upgrade.baseClickPower * countToDisplay)}
                            </span>
                          )}
                          {upgrade.baseCps > 0 && (
                            <span className="px-2 py-0.5 rounded-lg bg-slate-900/80 border border-amber-400/35 text-[10px] font-bold text-amber-300/90">
                              +{formatCoins(upgrade.baseCps * countToDisplay)}/s
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      disabled={!canAfford}
                      className={`px-3.5 py-2.5 rounded-xl font-black text-xs min-w-[78px] btn-chunky shrink-0 transition-transform ${
                        canAfford
                          ? 'bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 text-slate-950 border-2 border-yellow-100 shadow-[0_0_16px_rgba(251,191,36,0.4)]'
                          : 'bg-slate-800/90 text-slate-400 border border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      {formatCoins(cost)}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= REBIRTH TAB ================= */}
        {activeTab === 'rebirth' && (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-center">
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

        {/* ================= QUESTS TAB ================= */}
        {activeTab === 'quests' && (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-fuchsia-950/80 via-purple-950/80 to-slate-900 border-2 border-fuchsia-500/50 shadow-lg flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Gift className="w-8 h-8 text-fuchsia-300 shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-white uppercase">Daily Login Bonus</h4>
                  <p className="text-[11px] font-bold text-fuchsia-300">
                    +{GEM_ECONOMY_CONFIG.dailyLoginGems} Gems
                  </p>
                </div>
              </div>
              <button
                disabled={!canClaimDailyLogin}
                onClick={handleClaimDailyLogin}
                className={`px-3 py-1.5 rounded-xl font-black text-xs transition ${
                  canClaimDailyLogin
                    ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {canClaimDailyLogin ? 'Claim +5' : 'Claimed'}
              </button>
            </div>

            {[
              { title: 'Daily Quests', list: dailyQuests, accent: 'amber' },
              { title: 'Monthly Quests', list: seasonalQuests, accent: 'cyan' },
            ].map((section) => (
              <div key={section.title}>
                <h3 className="text-xs font-black text-amber-300 uppercase tracking-wider mb-2">
                  {section.title}
                </h3>
                <div className="space-y-2">
                  {section.list.map((quest) => {
                    const isClaimed = state.claimedQuests.includes(quest.id);
                    const prog = getQuestProgress(quest, state);
                    const isMeta = quest.type === 'all_monthly';
                    return (
                      <div
                        key={quest.id}
                        className={`p-3 rounded-2xl border ${
                          isClaimed
                            ? 'bg-slate-900/50 border-emerald-500/30 opacity-75'
                            : isMeta
                            ? 'bg-gradient-to-r from-amber-950/60 to-fuchsia-950/60 border-amber-400/75'
                            : prog.isComplete
                            ? 'bg-[#1a2442] border-cyan-400'
                            : 'bg-slate-900/90 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-black text-xs text-white truncate block">
                              {quest.title}
                            </span>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="px-2 py-0.5 rounded-lg bg-fuchsia-500/20 text-[10px] font-black text-fuchsia-300">
                                +{quest.rewardGems} Gems
                              </span>
                              <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-[10px] font-black text-amber-300">
                                +{formatCoins(quest.rewardCoins || 0)}
                              </span>
                            </div>
                          </div>
                          {isClaimed ? (
                            <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1 shrink-0">
                              <Check className="w-3.5 h-3.5" /> Done
                            </span>
                          ) : (
                            <button
                              disabled={!prog.isComplete}
                              onClick={() => handleClaimQuest(quest.id)}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-black shrink-0 ${
                                prog.isComplete
                                  ? 'bg-amber-400 text-slate-950 cursor-pointer'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {prog.isComplete ? 'Claim' : `${prog.percent}%`}
                            </button>
                          )}
                        </div>
                        {!isClaimed && (
                          <div className="w-full h-1.5 rounded-full bg-slate-950 mt-2 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-400 to-amber-300 transition-all duration-300"
                              style={{ width: `${prog.percent}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= PETS TAB (PET SQUAD + EGGS SUB-TAB, NO FEEDING!) ================= */}
        {activeTab === 'pets' && (
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-slate-800/80 flex items-center justify-between gap-2 bg-[#101426]/80">
              <div className="flex items-center bg-slate-900 rounded-xl p-1 border border-slate-750">
                <button
                  onClick={() => setPetSubTab('pets')}
                  className={`px-3 py-1 text-xs font-black rounded-lg cursor-pointer transition ${
                    petSubTab === 'pets' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  My Pets ({pets.length})
                </button>
                <button
                  onClick={() => setPetSubTab('eggs')}
                  className={`px-3 py-1 text-xs font-black rounded-lg cursor-pointer transition ${
                    petSubTab === 'eggs' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Eggs ({totalSealedEggs})
                </button>
              </div>
              <span className="text-[11px] font-black text-cyan-300">
                {equippedPetIds.length}/{SEASON_2_CONFIG.maxEquippedPets} Active
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {petSubTab === 'pets' && (() => {
                const totalSquadDps = pets
                  .filter((p) => equippedPetIds.includes(p.instanceId))
                  .reduce((sum, p) => sum + getPetCombatDps(p), 0);

                return pets.map((pet) => {
                  const isEquipped = equippedPetIds.includes(pet.instanceId);
                  const isExpanded = inspectedPetId === pet.instanceId;
                  const spec = getPetSpeciesDefinition(pet.speciesId, pet.rarity);
                  const upgCost = getPetUpgradeGemCost(pet);
                  const clickBonus = getPetClickMultiplierBonus(pet);
                  const nextClickBonus = getPetClickMultiplierBonus({
                    ...pet,
                    level: pet.level + 1,
                  });
                  const dps = getPetCombatDps(pet);
                  const nextDps = getPetCombatDps({
                    ...pet,
                    level: pet.level + 1,
                  });
                  const dpsSharePct =
                    isEquipped && totalSquadDps > 0
                      ? Math.round((dps / totalSquadDps) * 100)
                      : 0;

                  return (
                    <div
                      key={pet.instanceId}
                      className={`p-3 rounded-2xl border transition ${
                        isEquipped
                          ? 'bg-cyan-950/35 border-cyan-400/70'
                          : 'bg-slate-900/90 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <PetSprite2D speciesId={pet.speciesId} rarity={pet.rarity} size={52} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-black text-xs text-white truncate">
                              {spec.name}
                            </span>
                            <span
                              className="text-[10px] font-black shrink-0"
                              style={{ color: spec.color }}
                            >
                              {spec.rarityLabel} • Lv.{pet.level}
                            </span>
                          </div>
                          <div className="text-[10px] font-bold text-slate-300 mt-0.5">
                            +{(clickBonus * 100).toFixed(0)}% Click • {dps.toFixed(1)} DPS
                          </div>
                          <div className="flex gap-1.5 mt-2">
                            <button
                              onClick={() => onToggleEquipPet?.(pet.instanceId)}
                              className={`flex-1 py-1.5 rounded-xl font-black text-[10px] uppercase cursor-pointer ${
                                isEquipped ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-200'
                              }`}
                            >
                              {isEquipped ? 'Equipped' : 'Equip'}
                            </button>
                            <button
                              onClick={() =>
                                setInspectedPetId((curr) =>
                                  curr === pet.instanceId ? null : pet.instanceId
                                )
                              }
                              className={`px-2 py-1.5 rounded-xl border text-[10px] font-black uppercase cursor-pointer ${
                                isExpanded
                                  ? 'bg-cyan-500/25 border-cyan-300 text-cyan-100'
                                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
                              }`}
                            >
                              Stats
                            </button>
                            <button
                              onClick={() => onUpgradePet?.(pet.instanceId)}
                              disabled={state.gems < upgCost}
                              className="px-2.5 py-1.5 rounded-xl bg-fuchsia-500/20 border border-fuchsia-400/50 text-fuchsia-200 disabled:opacity-40 font-black text-[10px] uppercase cursor-pointer flex items-center gap-1"
                            >
                              <ArrowUpCircle className="w-3 h-3" />
                              <span>{`Lv.${pet.level + 1} (${upgCost}G)`}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-700/60 space-y-1.5 text-[10px]">
                          <p className="text-slate-300 font-medium leading-snug">
                            {spec.description}
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div className="p-2 rounded-xl bg-slate-950/90 border border-slate-800">
                              <div className="text-slate-400 font-black uppercase text-[9px]">
                                Click Bonus
                              </div>
                              <div className="text-cyan-300 font-black">
                                +{(clickBonus * 100).toFixed(0)}% → +{(nextClickBonus * 100).toFixed(0)}%
                              </div>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-950/90 border border-slate-800">
                              <div className="text-slate-400 font-black uppercase text-[9px]">
                                Zombie DPS
                              </div>
                              <div className="text-amber-300 font-black">
                                {dps.toFixed(1)} → {nextDps.toFixed(1)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-slate-400 font-bold">
                            <span>Origin: {pet.rarity}</span>
                            <span>
                              {isEquipped ? `${dpsSharePct}% of Squad DPS` : 'Not Equipped'} • ∞ Max Lv
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}

              {petSubTab === 'eggs' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {EGG_DEFINITIONS.map((egg) => {
                    const count = state.sealedEggs?.[egg.rarity] || 0;
                    const canHatch = count > 0 && state.gems >= egg.hatchGemCost;
                    return (
                      <div
                        key={egg.rarity}
                        className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col items-center text-center gap-2"
                      >
                        <EggBadgeVisual rarity={egg.rarity} size={56} />
                        <div className="text-xs font-black leading-tight" style={{ color: egg.color }}>
                          {egg.rarity}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400">
                          Owned: {count}
                        </div>
                        <div className="w-full p-1.5 rounded-xl bg-slate-950/85 border border-slate-800 space-y-0.5 text-left">
                          {egg.hatchPool.map((entry) => {
                            const spec = getPetSpeciesDefinition(entry.speciesId, egg.rarity);
                            return (
                              <div
                                key={entry.speciesId}
                                className="flex items-center justify-between gap-1 text-[9px] font-bold"
                              >
                                <span className="truncate" style={{ color: spec.color }}>
                                  {spec.name}
                                </span>
                                <span className="text-slate-300 font-black shrink-0">
                                  {entry.chancePct}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => onHatchEgg?.(egg.rarity)}
                          disabled={!canHatch}
                          className="w-full py-1.5 rounded-xl bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-[10px] uppercase cursor-pointer mt-auto"
                        >
                          Hatch ({egg.hatchGemCost}G)
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= SKINS SHOP TAB (VAULT + DAILY + CHESTS + GLASSES + OWNED) ================= */}
        {activeTab === 'skins' && (
          <div className="flex flex-col h-full">
            <div className="p-2.5 border-b border-slate-800/80 flex items-center justify-between gap-1.5 bg-[#101426]/80 flex-wrap">
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

            <div className="flex-1 overflow-y-auto p-3">
              {skinSubTab === 'collection' && (
                <div className="space-y-3">
                  <div className="text-[11px] font-bold text-slate-400">
                    Your owned Matthew skins ({unlockedSkinsList.length}). Skins &amp; Glasses carry over across all seasons!
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {unlockedSkinsList.map((skin) => {
                      const isEquipped = state.equippedSkin === skin.id;
                      return (
                        <button
                          key={skin.id}
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
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                skin.fallbackImage || './images/skins/classic_matthew.png';
                            }}
                            className="w-4/5 h-4/5 object-contain pointer-events-none"
                          />
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
              )}

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
                        {hasShopToken ? 'ACTIVE • SKINS + CURSORS FREE' : `${availableShopTokens} / 1`}
                      </span>
                    </div>
                    <p className="text-[10.5px] font-bold text-amber-100/80">
                      {hasShopToken
                        ? 'Your Matthew Shop Token unlocks every skin in the Matthew Shop AND all ability Cursors for FREE!'
                        : 'Find the ultra-rare Matthew Shop Token inside Mystery Chests or Golden Matthews to unlock all Item Shop skins & Cursors for FREE!'}
                    </p>
                  </div>

                  {/* DAILY ROTATING GEM SKINS */}
                  <div>
                    <div className="text-[11px] font-black uppercase text-fuchsia-300 mb-2">
                      Daily Gem Rotation ({todayDateStr})
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

                  {(['normal', 'frost'] as CrateType[]).map((ctype) => {
                    const spec = CRATE_DEFINITIONS[ctype];
                    const isFrost = ctype === 'frost';
                    const canAfford = state.gems >= spec.gemCost;
                    return (
                      <div
                        key={ctype}
                        className={`p-3.5 rounded-2xl border-2 space-y-2.5 ${
                          isFrost
                            ? 'bg-gradient-to-br from-slate-900 via-cyan-950/60 to-slate-950 border-cyan-400/55'
                            : 'bg-gradient-to-br from-slate-900 via-orange-950/50 to-slate-950 border-amber-400/55'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-black uppercase text-white">{spec.name}</h4>
                            <p className="text-[10.5px] font-bold text-slate-300 mt-0.5">{spec.subtitle}</p>
                          </div>
                          <img
                            src={spec.image}
                            alt={spec.name}
                            className={`w-16 h-16 object-contain shrink-0 ${
                              isFrost
                                ? 'drop-shadow-[0_0_14px_rgba(56,189,248,0.85)]'
                                : 'drop-shadow-[0_0_14px_rgba(251,146,60,0.85)]'
                            }`}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold">
                          <div className="p-2 rounded-xl bg-slate-950/80 border border-white/10">
                            <div className="text-slate-400 uppercase text-[9px]">55% Cursor Drop</div>
                            <div className={isFrost ? 'text-cyan-300 font-black' : 'text-orange-300 font-black'}>
                              Rarest: {isFrost ? 'Frosty Cursor' : 'Fire Cursor (Freeze Immune!)'}
                            </div>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-950/80 border border-white/10">
                            <div className="text-slate-400 uppercase text-[9px]">45% Skin Drop</div>
                            <div className="text-amber-300 font-black">
                              Rarest: {isFrost ? 'Apocalypse Matthew' : 'Void Emperor Matthew'}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => onOpenCrate?.(ctype)}
                          disabled={!canAfford}
                          className={`w-full py-2.5 rounded-xl font-black text-xs uppercase cursor-pointer transition flex items-center justify-center gap-1.5 ${
                            isFrost
                              ? 'bg-gradient-to-r from-cyan-400 to-sky-300 text-slate-950 disabled:opacity-40'
                              : 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 disabled:opacity-40'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Open {spec.name} ({spec.gemCost} Gems)</span>
                        </button>
                      </div>
                    );
                  })}
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
                              {equipped ? equipped.abilitySummary : 'Unbox cursors from Normal & Frost Crates!'}
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
                            {cursor.crateType === 'frost'
                              ? 'Frost Crate'
                              : cursor.crateType === 'starter'
                              ? 'Starter Cursor'
                              : 'Normal Crate'}
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
                                {cursor.crateType === 'frost' ? 'Frost Crate' : 'Normal Crate'}
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

        {/* ================= EVENTS TAB (GRAPHICS-FIRST PLAYER SUMMONS + FRIDAY STORM PREVIEW) ================= */}
        {activeTab === 'events' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="grid grid-cols-1 gap-2.5">
              {PLAYER_TRIGGERABLE_EVENTS.map((spec) => (
                <div
                  key={spec.id}
                  className="p-3 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950/60 border border-sky-400/35 flex items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-300/40 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5 text-amber-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-white truncate">{spec.label}</div>
                      <div className="text-[10px] font-bold text-slate-400">
                        {spec.durationSeconds}s Global
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSummonEvent(spec)}
                    disabled={state.gems < spec.gemCost || busyEventId === spec.id}
                    className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 disabled:opacity-40 text-slate-950 font-black text-[10px] uppercase cursor-pointer shrink-0"
                  >
                    {busyEventId === spec.id ? '...' : `${spec.gemCost}G`}
                  </button>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/90 border border-purple-400/35 space-y-2.5">
              <div className="text-xs font-black text-purple-300 uppercase flex items-center gap-1.5">
                <Gem className="w-3.5 h-3.5" />
                <span>Friday Storm Exclusives</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SEASON_2_LIVE_EVENT_SKINS.map((s) => {
                  const isOwned = state.unlockedSkins.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center text-center gap-1"
                    >
                      {isOwned ? (
                        <>
                          <img src={s.image} alt={s.name} className="w-12 h-12 object-contain" />
                          <span className="text-[10px] font-black text-emerald-300 truncate w-full">
                            {s.name}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-xl bg-fuchsia-950/60 border border-fuchsia-400/40 flex items-center justify-center">
                            <Lock className="w-5 h-5 text-fuchsia-300" />
                          </div>
                          <span className="text-[10px] font-black text-fuchsia-200/80 truncate w-full">
                            ??? Storm Secret
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
