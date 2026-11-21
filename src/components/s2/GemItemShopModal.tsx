import React from 'react';
import { X, Gem, Check, ShoppingBag } from 'lucide-react';
import { CosmeticSlot, GameState } from '../../types/game';
import {
  ITEM_SHOP_SKINS,
  getDailyItemShopRotation,
} from '../../data/season2Skins';
import {
  MARVEL_SHOP_SKINS,
  getDailyMarvelShopRotation,
} from '../../data/season3Skins';
import { isSeasonThreeOrLater } from '../../data/skins';
import { ChestLootResult } from '../../data/infinityGauntlet';
import { getAuthoritativeDateString } from '../../utils/scheduleEngine';

interface GemItemShopModalProps {
  state: GameState;
  onClose: () => void;
  onBuySkinWithGems: (skinId: string, gemCost: number) => void;
  onClaimVaultSkinWithToken?: (skinId: string) => void;
  onEquipSkin: (skinId: string) => void;
  onOpenMysteryChest: () => ChestLootResult | null;
  onBuyOrEquipCosmetic: (cosmeticId: string, slot: CosmeticSlot, gemCost: number) => void;
}

export const GemItemShopModal: React.FC<GemItemShopModalProps> = ({
  state,
  onClose,
  onBuySkinWithGems,
  onEquipSkin,
}) => {
  const hasShopToken = Boolean(state.hasMatthewShopToken);

  const isSeason3 = isSeasonThreeOrLater(state.currentSeasonId);
  const todayStr = getAuthoritativeDateString();
  const dailyFeatured = isSeason3
    ? getDailyMarvelShopRotation(todayStr)
    : getDailyItemShopRotation(todayStr);
  const poolTotal = isSeason3 ? MARVEL_SHOP_SKINS.length : ITEM_SHOP_SKINS.length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/96 backdrop-blur-xl flex flex-col p-4 sm:p-6 overflow-hidden select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-fuchsia-500/25 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-fuchsia-500/20 border border-fuchsia-400/50 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-fuchsia-300" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              MATTHEW SHOP
            </h2>
            <p className="text-xs font-bold text-slate-300">
              {dailyFeatured.length} of {poolTotal} Featured Today • Swaps Daily ({todayStr})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-2 rounded-xl bg-fuchsia-500/20 border border-fuchsia-400/40 flex items-center gap-2 text-fuchsia-200 font-black text-sm">
            <Gem className="w-4 h-4 text-fuchsia-300" />
            <span>{state.gems}</span>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 pb-4 mt-3">
        {/* DAILY ROTATING ITEM SHOP (ALL FOOD SKINS + SEASONAL SHOP) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {dailyFeatured.map((skin) => {
              const owned = state.unlockedSkins.includes(skin.id);
              const equipped = state.equippedSkin === skin.id;
              const cost = skin.gemCost || 25;
              return (
                <div
                  key={skin.id}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center text-center gap-2 ${
                    owned ? 'bg-slate-900/95 border-emerald-500/45' : 'bg-slate-900/90 border-slate-800'
                  }`}
                >
                  <img src={skin.image} alt={skin.name} className="w-20 h-20 object-contain drop-shadow-lg" />
                  <div className="text-xs font-black text-white">{skin.name}</div>
                  <div className="text-[10px] font-black uppercase text-fuchsia-300">
                    {skin.category === 'food_shop' ? 'Food Collection' : skin.rarity}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 line-clamp-2">
                    {skin.perkDescription}
                  </div>
                  {owned ? (
                    <button
                      onClick={() => onEquipSkin(skin.id)}
                      className={`w-full py-2 rounded-xl font-black text-xs uppercase cursor-pointer transition flex items-center justify-center gap-1 ${
                        equipped ? 'bg-cyan-400 text-slate-950' : 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/50'
                      }`}
                    >
                      {equipped && <Check className="w-3.5 h-3.5" />}
                      <span>{equipped ? 'Equipped' : 'Equip'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onBuySkinWithGems(skin.id, hasShopToken ? 0 : cost)}
                      disabled={!hasShopToken && state.gems < cost}
                      className={`w-full py-2 rounded-xl font-black text-xs uppercase cursor-pointer transition ${
                        hasShopToken
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 shadow'
                          : 'bg-fuchsia-500/25 hover:bg-fuchsia-400 hover:text-slate-950 disabled:opacity-40 border border-fuchsia-400/50 text-fuchsia-100'
                      }`}
                    >
                      {hasShopToken ? 'Claim FREE (Shop Token)' : `Buy (${cost} Gems)`}
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

