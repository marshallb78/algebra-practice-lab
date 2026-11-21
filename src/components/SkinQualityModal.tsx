import React, { useMemo } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import {
  SKIN_CATEGORIES_TREE,
  SEASON_3_ONLY_SKIN_ID_SET,
  SEASON_2_ONLY_SKIN_ID_SET,
  getSkinById,
  isSeasonThreeOrLater,
  isSeasonTwoOrLater,
} from '../data/skins';

interface SkinQualityModalProps {
  isOpen: boolean;
  onClose: () => void;
  equippedSkinId: string;
  unlockedSkinIds: string[];
  onEquipSkin?: (skinId: string) => void;
  currentSeasonId?: string;
}

/**
 * Full-screen wardrobe modal displaying ONLY owned skins on a single scrollable page,
 * organized by Major Season Headers (OG, Frozen Apocalypse, Marvel) and Minor Subheaders.
 */
export const SkinQualityModal: React.FC<SkinQualityModalProps> = ({
  isOpen,
  onClose,
  equippedSkinId,
  unlockedSkinIds,
  onEquipSkin,
  currentSeasonId = 'season_1',
}) => {
  const showSeason2 = isSeasonTwoOrLater(currentSeasonId);
  const showSeason3 = isSeasonThreeOrLater(currentSeasonId);

  const sections = useMemo(() => {
    const ownedSet = new Set(unlockedSkinIds);
    return SKIN_CATEGORIES_TREE.filter((major) => {
      if (major.id === 'frozen_apocalypse') return showSeason2;
      if (major.id === 'marvel') return showSeason3;
      return true;
    })
      .map((major) => {
        const minorGroups = major.minors
          .map((minor) => {
            const skins = minor.skinIds
              .map((id) => getSkinById(id))
              .filter((skin) => {
                if (!ownedSet.has(skin.id)) return false;
                if (!showSeason2 && SEASON_2_ONLY_SKIN_ID_SET.has(skin.id)) return false;
                if (!showSeason3 && SEASON_3_ONLY_SKIN_ID_SET.has(skin.id)) return false;
                return true;
              });
            return { ...minor, skins };
          })
          .filter((g) => g.skins.length > 0);
        return { ...major, minorGroups };
      })
      .filter((sec) => sec.minorGroups.length > 0);
  }, [unlockedSkinIds, showSeason2, showSeason3]);

  if (!isOpen) return null;

  const totalOwnedVisible = sections.reduce(
    (sum, sec) => sum + sec.minorGroups.reduce((mSum, g) => mSum + g.skins.length, 0),
    0
  );

  const rarityBorderGlow: Record<string, string> = {
    Common: 'border-slate-700',
    Uncommon: 'border-emerald-500/60',
    Rare: 'border-sky-500/60',
    Epic: 'border-purple-500/60',
    Legendary: 'border-amber-400/70',
    Mythic: 'border-rose-500/70',
    Divine: 'border-yellow-300/90 shadow-[0_0_25px_rgba(253,224,71,0.25)]',
  };

  return (
    <div className="fixed inset-0 z-[130] bg-slate-950/92 backdrop-blur-xl flex flex-col p-3 sm:p-6 overflow-hidden">
      {/* Header */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tight text-white flex items-center gap-2.5 font-marvel">
            <Sparkles className="w-6 h-6 text-amber-400" />
            Owned Matthew Skins
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-0.5">
            {totalOwnedVisible} Unlocked Skins • Organized by Season &amp; Collection
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
          aria-label="Close Wardrobe"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Single Scrollable Page: Major Headers + Minor Subheaders */}
      <div className="max-w-6xl w-full mx-auto mt-4 flex-1 overflow-y-auto pr-1 pb-8 space-y-8">
        {sections.length === 0 ? (
          <div className="p-10 rounded-3xl bg-slate-900/70 border border-slate-800 text-center text-sm font-bold text-slate-400">
            No skins unlocked yet! Unlock skins from Milestones, Matthew Shop, and Crates.
          </div>
        ) : (
          sections.map((major) => (
            <section key={major.id} className="space-y-5">
              {/* Major Header */}
              <div className="pb-2 border-b-2 border-amber-400/40 flex items-center justify-between">
                <h3 className="text-lg sm:text-2xl font-black uppercase tracking-wider text-amber-300 font-marvel">
                  {major.label}
                </h3>
                <span className="px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-xs font-black text-amber-200">
                  {major.minorGroups.reduce((s, g) => s + g.skins.length, 0)} Owned
                </span>
              </div>

              {/* Minor Subheaders */}
              {major.minorGroups.map((minor) => (
                <div key={minor.id} className="space-y-2.5">
                  <div className="text-xs sm:text-sm font-black uppercase tracking-widest text-cyan-300 pl-1">
                    {minor.label}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                    {minor.skins.map((skin) => {
                      const isEquipped = equippedSkinId === skin.id;
                      return (
                        <div
                          key={skin.id}
                          onClick={() => {
                            if (!isEquipped && onEquipSkin) {
                              onEquipSkin(skin.id);
                            }
                          }}
                          className={`group relative flex flex-col items-center p-3 rounded-3xl bg-[#10162b] border-2 transition-all duration-200 hover:-translate-y-1 shadow-xl cursor-pointer ${
                            isEquipped
                              ? 'ring-2 ring-amber-400 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.4)]'
                              : rarityBorderGlow[skin.rarity] || 'border-slate-800'
                          }`}
                        >
                          <div className="relative w-full aspect-square flex items-center justify-center p-3 overflow-hidden bg-slate-950 rounded-2xl border border-slate-800/80">
                            <img
                              src={skin.image}
                              alt={skin.name}
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                  skin.fallbackImage || './images/skins/classic_matthew.png';
                              }}
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                            />
                            {isEquipped && (
                              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                Equipped
                              </span>
                            )}
                          </div>

                          <div className="w-full mt-2.5 text-center">
                            <div className="text-xs font-black text-white truncate">{skin.name}</div>
                            <div className="text-[10px] font-bold text-amber-300/90 uppercase mt-0.5 truncate">
                              {skin.rarity}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
};
