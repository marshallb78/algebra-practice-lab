import React, { useEffect, useState } from 'react';
import { GameState } from '../types/game';
import { Crown, Flame, Gem, Package, ShieldAlert, Sparkles, Wrench, X, Zap } from 'lucide-react';
import { CrateType } from '../data/crates';

interface DevTestMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: GameState;
  onSetMoneyGems: (coins: number, gems: number, krillion?: number) => void;
  onGiveStone: () => void;
  onGiveAllStones: () => void;
  onClearStones: () => void;
  onTestSnapPreview: () => void;
  onTestSnapReal: () => void;
  onTestThanosReset: () => void;
  onSpawnFallingChest: () => void;
  onOpenTestChest: (forceStone?: boolean) => void;
  onOpenCrateTest: (crateType: CrateType) => void;
  onGrantShopToken: () => void;
  onUnlockAllMarvelSkins: () => void;
  onToggleStormEvent: () => void;
  onSpawnGoldenSwarm: () => void;
  onReplayMarvelIntro: () => void;
  onPreviewDowntime: () => void;
  onOpenFullDevTools: () => void;
}

/**
 * Unified top-level Dev Test Menu (`z-[210]`):
 * One button in the HUD opens everything devs need during the Season 3 testing window.
 */
export const DevTestMenuModal: React.FC<DevTestMenuModalProps> = ({
  isOpen,
  onClose,
  state,
  onSetMoneyGems,
  onGiveStone,
  onGiveAllStones,
  onClearStones,
  onTestSnapPreview,
  onTestSnapReal,
  onTestThanosReset,
  onSpawnFallingChest,
  onOpenTestChest,
  onOpenCrateTest,
  onGrantShopToken,
  onUnlockAllMarvelSkins,
  onToggleStormEvent,
  onSpawnGoldenSwarm,
  onReplayMarvelIntro,
  onPreviewDowntime,
  onOpenFullDevTools,
}) => {
  const [coinsInput, setCoinsInput] = useState('1000000000');
  const [gemsInput, setGemsInput] = useState('500');
  const [krillionInput, setKrillionInput] = useState('0');

  useEffect(() => {
    if (isOpen) {
      setCoinsInput(String(Math.floor(state.coins || 0)));
      setGemsInput(String(Math.floor(state.gems || 0)));
      setKrillionInput(String(Math.floor(state.krillionCoins || 0)));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[210] bg-slate-950/88 flex items-center justify-center p-3 sm:p-6 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[90vh] rounded-3xl bg-[#0b1022] border-2 border-amber-400/75 shadow-[0_0_50px_rgba(251,191,36,0.3)] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-slate-950 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <Wrench className="w-5 h-5 text-amber-300" />
            <div>
              <h2 className="text-lg sm:text-xl font-black uppercase text-white font-marvel tracking-wide">
                Season 3 Dev Test Menu
              </h2>
              <p className="text-[11px] font-bold text-slate-400">
                Dev-Only Testing Suite (Leaderboards isolated to Sandbox)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* 1. MONEY & GEMS */}
          <section className="p-4 rounded-2xl bg-slate-900/90 border border-amber-400/35 space-y-3">
            <div className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Gem className="w-4 h-4 text-fuchsia-300" />
              Give / Set Money &amp; Gems
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => onSetMoneyGems(state.coins, (state.gems || 0) + 100, state.krillionCoins)}
                className="py-2 rounded-xl bg-fuchsia-500/25 hover:bg-fuchsia-500/40 border border-fuchsia-400/40 text-fuchsia-200 text-xs font-black cursor-pointer"
              >
                +100 Gems
              </button>
              <button
                type="button"
                onClick={() => onSetMoneyGems(state.coins, (state.gems || 0) + 1000, state.krillionCoins)}
                className="py-2 rounded-xl bg-fuchsia-500/25 hover:bg-fuchsia-500/40 border border-fuchsia-400/40 text-fuchsia-200 text-xs font-black cursor-pointer"
              >
                +1,000 Gems
              </button>
              <button
                type="button"
                onClick={() => onSetMoneyGems((state.coins || 0) + 1e9, state.gems, state.krillionCoins)}
                className="py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-200 text-xs font-black cursor-pointer"
              >
                +1B Coins
              </button>
              <button
                type="button"
                onClick={() => onSetMoneyGems((state.coins || 0) + 1e24, state.gems, state.krillionCoins)}
                className="py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-200 text-xs font-black cursor-pointer"
              >
                +1Sp Coins
              </button>
              <button
                type="button"
                onClick={() => onSetMoneyGems((state.coins || 0) + 1e63, state.gems, state.krillionCoins)}
                className="py-2 rounded-xl bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/50 text-amber-200 text-xs font-black cursor-pointer"
              >
                +1Vg Coins
              </button>
              <button
                type="button"
                onClick={() => onSetMoneyGems(state.coins, state.gems, (state.krillionCoins || 0) + 1)}
                className="py-2 rounded-xl bg-purple-500/25 hover:bg-purple-500/40 border border-purple-400/40 text-purple-200 text-xs font-black cursor-pointer"
              >
                +1 Krillion
              </button>
              <button
                type="button"
                onClick={() => onSetMoneyGems(0, state.gems, 0)}
                className="py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-200 text-xs font-black cursor-pointer"
              >
                Reset Coins to 0
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
              <label className="text-[10px] font-bold text-slate-300">
                Set Coins
                <input
                  type="text"
                  value={coinsInput}
                  onChange={(e) => setCoinsInput(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                />
              </label>
              <label className="text-[10px] font-bold text-slate-300">
                Set Krillion
                <input
                  type="number"
                  value={krillionInput}
                  onChange={(e) => setKrillionInput(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                />
              </label>
              <label className="text-[10px] font-bold text-slate-300">
                Set Gems
                <input
                  type="number"
                  value={gemsInput}
                  onChange={(e) => setGemsInput(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const c = Math.max(0, Number(coinsInput.replace(/,/g, '').trim()) || 0);
                  const kr = Math.max(0, Math.floor(Number(krillionInput) || 0));
                  const g = Math.max(0, Math.floor(Number(gemsInput) || 0));
                  onSetMoneyGems(c, g, kr);
                }}
                className="py-2 rounded-xl bg-amber-400 hover:brightness-110 text-slate-950 font-black text-xs uppercase cursor-pointer"
              >
                Apply Exact Values
              </button>
            </div>
          </section>

          {/* 2. INFINITY GAUNTLET, SNAP & THANOS */}
          <section className="p-4 rounded-2xl bg-slate-900/90 border border-purple-400/40 space-y-2.5">
            <div className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Infinity Gauntlet, Snap &amp; Thanos Events
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={onGiveStone}
                className="py-2 px-3 rounded-xl bg-purple-500/25 hover:bg-purple-500/40 border border-purple-400/40 text-purple-100 text-xs font-black cursor-pointer"
              >
                Give +1 Missing Stone
              </button>
              <button
                type="button"
                onClick={onGiveAllStones}
                className="py-2 px-3 rounded-xl bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/50 text-amber-200 text-xs font-black cursor-pointer"
              >
                Give All 6 Stones
              </button>
              <button
                type="button"
                onClick={onClearStones}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-black cursor-pointer"
              >
                Clear Stones
              </button>
              <button
                type="button"
                onClick={() => { onClose(); onTestSnapPreview(); }}
                className="py-2 px-3 rounded-xl bg-rose-500/25 hover:bg-rose-500/40 border border-rose-400/50 text-rose-100 text-xs font-black cursor-pointer"
              >
                Test Snap Cutscene (Safe)
              </button>
              <button
                type="button"
                onClick={() => { onClose(); onTestSnapReal(); }}
                className="py-2 px-3 rounded-xl bg-red-600/35 hover:bg-red-600/55 border border-red-400 text-white text-xs font-black cursor-pointer"
              >
                Test Real Snap Reset on Self
              </button>
              <button
                type="button"
                onClick={() => { onClose(); onTestThanosReset(); }}
                className="py-2 px-3 rounded-xl bg-fuchsia-600/30 hover:bg-fuchsia-600/45 border border-fuchsia-400 text-fuchsia-100 text-xs font-black cursor-pointer"
              >
                Thanos 0-Coin Cutscene
              </button>
            </div>
          </section>

          {/* 3. CHESTS, CRATES & SKINS */}
          <section className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-400/35 space-y-2.5">
            <div className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <Package className="w-4 h-4" />
              Chests, Crates &amp; All Skins
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => { onClose(); onSpawnFallingChest(); }}
                className="py-2 px-3 rounded-xl bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/45 text-amber-200 text-xs font-black cursor-pointer"
              >
                Spawn Falling Chest
              </button>
              <button
                type="button"
                onClick={() => { onClose(); onOpenTestChest(false); }}
                className="py-2 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/40 text-cyan-200 text-xs font-black cursor-pointer"
              >
                Test Chest Cutscene
              </button>
              <button
                type="button"
                onClick={() => { onClose(); onOpenTestChest(true); }}
                className="py-2 px-3 rounded-xl bg-purple-500/25 hover:bg-purple-500/40 border border-purple-400/45 text-purple-200 text-xs font-black cursor-pointer"
              >
                Test Stone Chest Drop
              </button>
              <button
                type="button"
                onClick={onGrantShopToken}
                className="py-2 px-3 rounded-xl bg-yellow-500/25 hover:bg-yellow-500/40 border border-yellow-300/60 text-yellow-200 text-xs font-black cursor-pointer flex items-center justify-center gap-1"
              >
                <Crown className="w-3.5 h-3.5" /> Free Shop Token
              </button>
              {(['normal', 'stark', 'wakanda', 'infinity'] as CrateType[]).map((ct) => (
                <button
                  key={ct}
                  type="button"
                  onClick={() => { onClose(); onOpenCrateTest(ct); }}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-black uppercase cursor-pointer"
                >
                  Open {ct} Crate
                </button>
              ))}
              <button
                type="button"
                onClick={onUnlockAllMarvelSkins}
                className="sm:col-span-2 py-2 px-3 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400/50 text-emerald-200 text-xs font-black cursor-pointer"
              >
                Unlock All 44 Marvel Skins
              </button>
            </div>
          </section>

          {/* 4. CUTSCENES, STORM VAULT & ADMIN */}
          <section className="p-4 rounded-2xl bg-slate-900/90 border border-rose-400/35 space-y-2.5">
            <div className="text-xs font-black uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4" />
              Cutscenes, Vault &amp; Admin Controls
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { onClose(); onToggleStormEvent(); }}
                className="py-2 px-3 rounded-xl bg-fuchsia-500/25 hover:bg-fuchsia-500/40 border border-fuchsia-400/50 text-fuchsia-200 text-xs font-black cursor-pointer flex items-center justify-center gap-1"
              >
                <Flame className="w-3.5 h-3.5" /> Toggle Live Event Vault
              </button>
              <button
                type="button"
                onClick={() => { onClose(); onSpawnGoldenSwarm(); }}
                className="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/45 text-amber-200 text-xs font-black cursor-pointer"
              >
                Spawn Golden Swarm
              </button>
              <button
                type="button"
                onClick={() => { onClose(); onReplayMarvelIntro(); }}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-black cursor-pointer"
              >
                Replay S3 Intro Cutscene
              </button>
              <button
                type="button"
                onClick={() => { onClose(); onPreviewDowntime(); }}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-black cursor-pointer"
              >
                Preview Downtime Screen
              </button>
              <button
                type="button"
                onClick={() => { onClose(); onOpenFullDevTools(); }}
                className="py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/50 text-rose-200 text-xs font-black cursor-pointer flex items-center justify-center gap-1"
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Full Admin / Bans
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
