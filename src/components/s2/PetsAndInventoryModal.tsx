import React, { useMemo, useState } from 'react';
import { X, Gem, Sparkles, ArrowUpCircle, Check, Swords, BarChart3 } from 'lucide-react';
import { EggRarity, GameState, PetInstance } from '../../types/game';
import { SEASON_2_CONFIG } from '../../config/gameConfig';
import {
  EGG_DEFINITIONS,
  PET_SPECIES_CATALOG,
  getPetClickMultiplierBonus,
  getPetCombatDps,
  getPetSpeciesDefinition,
  getPetUpgradeGemCost,
} from '../../data/petsAndEggs';
import { EggBadgeVisual, PetSprite2D } from './PetSprite2D';

interface PetsAndInventoryModalProps {
  state: GameState;
  onClose: () => void;
  onHatchEgg: (rarity: EggRarity) => void;
  onToggleEquipPet: (instanceId: string) => void;
  onUpgradePet: (instanceId: string) => void;
}

export const PetsAndInventoryModal: React.FC<PetsAndInventoryModalProps> = ({
  state,
  onClose,
  onHatchEgg,
  onToggleEquipPet,
  onUpgradePet,
}) => {
  const [tab, setTab] = useState<'pets' | 'eggs'>('pets');
  const pets = state.pets || [];
  const equippedIds = state.equippedPetIds || [];
  const [inspectedPetId, setInspectedPetId] = useState<string | null>(
    () => pets[0]?.instanceId || null
  );

  const discoveredSpeciesCount = useMemo(
    () => new Set(pets.map((p) => p.speciesId)).size,
    [pets]
  );

  const totalSquadDps = useMemo(() => {
    const equippedSet = new Set(equippedIds);
    return pets
      .filter((p) => equippedSet.has(p.instanceId))
      .reduce((sum, p) => sum + getPetCombatDps(p), 0);
  }, [pets, equippedIds]);

  const totalSquadClickMult = useMemo(() => {
    const equippedSet = new Set(equippedIds);
    return pets
      .filter((p) => equippedSet.has(p.instanceId))
      .reduce((sum, p) => sum + getPetClickMultiplierBonus(p), 0);
  }, [pets, equippedIds]);

  const inspectedPet = useMemo(
    () => pets.find((p) => p.instanceId === inspectedPetId) || pets[0] || null,
    [pets, inspectedPetId]
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/96 backdrop-blur-xl flex flex-col p-4 sm:p-6 overflow-hidden select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-cyan-500/25 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center">
            <Swords className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              PET SQUAD &amp; EGGS
            </h2>
            <p className="text-xs font-bold text-cyan-200/75">
              1. Hatch Eggs → 2. Equip up to {SEASON_2_CONFIG.maxEquippedPets} Pets → 3. Upgrade Unlimited Lv.1–∞ ({discoveredSpeciesCount}/{PET_SPECIES_CATALOG.length} Species Discovered)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-cyan-400/40 text-xs font-black text-cyan-200">
            Squad: +{(totalSquadClickMult * 100).toFixed(0)}% Click • {totalSquadDps.toFixed(1)} DPS
          </div>
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

      {/* Nav Tabs */}
      <div className="flex gap-2 py-3 shrink-0">
        {[
          {
            id: 'pets' as const,
            label: `My Pets (${pets.length}) • Equipped ${equippedIds.length}/${SEASON_2_CONFIG.maxEquippedPets}`,
          },
          {
            id: 'eggs' as const,
            label: `Eggs (${Object.values(state.sealedEggs || {}).reduce((a, b) => a + b, 0)})`,
          },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition ${
              tab === t.id
                ? 'bg-cyan-400 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.45)]'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pr-1 pb-4">
        {tab === 'pets' && (
          <div className="space-y-4">
            {pets.length === 0 ? (
              <div className="p-10 rounded-3xl bg-slate-900/70 border border-slate-800 text-center space-y-2">
                <p className="text-lg font-black text-white">No Pets Hatched Yet</p>
                <p className="text-xs font-bold text-slate-400">
                  Open Chests or hatch Eggs in the Eggs tab!
                </p>
              </div>
            ) : (
              <>
                {/* Detailed Selected Pet Stats Inspector */}
                {inspectedPet && (() => {
                  const spec = getPetSpeciesDefinition(inspectedPet.speciesId, inspectedPet.rarity);
                  const clickBonus = getPetClickMultiplierBonus(inspectedPet);
                  const nextClickBonus = getPetClickMultiplierBonus({
                    ...inspectedPet,
                    level: inspectedPet.level + 1,
                  });
                  const dps = getPetCombatDps(inspectedPet);
                  const nextDps = getPetCombatDps({
                    ...inspectedPet,
                    level: inspectedPet.level + 1,
                  });
                  const upgCost = getPetUpgradeGemCost(inspectedPet);
                  const isEquipped = equippedIds.includes(inspectedPet.instanceId);
                  const squadSharePct =
                    isEquipped && totalSquadDps > 0
                      ? Math.round((dps / totalSquadDps) * 100)
                      : 0;

                  return (
                    <div
                      className="p-4 rounded-2xl bg-slate-900/95 border flex flex-col lg:flex-row lg:items-center gap-4"
                      style={{
                        borderColor: spec.color + '88',
                        boxShadow: `0 0 30px ${spec.glowColor}`,
                      }}
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <PetSprite2D
                          speciesId={inspectedPet.speciesId}
                          rarity={inspectedPet.rarity}
                          size={88}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase border bg-slate-950"
                              style={{ color: spec.color, borderColor: spec.color + '66' }}
                            >
                              {spec.rarityLabel}
                            </span>
                            <span className="text-[11px] font-bold text-slate-400">
                              Lv.{inspectedPet.level} / ∞
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                              From {inspectedPet.rarity}
                            </span>
                          </div>
                          <h3 className="text-xl font-black text-white truncate mt-1">
                            {spec.name}
                          </h3>
                          <p className="text-xs font-medium text-slate-300 mt-0.5">
                            {spec.description}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 lg:w-[540px] shrink-0">
                        <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800">
                          <div className="text-[10px] font-black uppercase text-slate-400">
                            Click Multiplier
                          </div>
                          <div className="text-sm font-black text-cyan-300 mt-0.5">
                            +{(clickBonus * 100).toFixed(0)}%
                          </div>
                          <div className="text-[10px] font-bold text-emerald-300">
                            Next Lv: +{(nextClickBonus * 100).toFixed(0)}%
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800">
                          <div className="text-[10px] font-black uppercase text-slate-400">
                            Zombie Combat
                          </div>
                          <div className="text-sm font-black text-amber-300 mt-0.5">
                            {dps.toFixed(1)} DPS
                          </div>
                          <div className="text-[10px] font-bold text-emerald-300">
                            Next Lv: {nextDps.toFixed(1)} DPS
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800">
                          <div className="text-[10px] font-black uppercase text-slate-400">
                            Squad Share
                          </div>
                          <div className="text-sm font-black text-white mt-0.5">
                            {isEquipped ? `${squadSharePct}% DPS` : 'Benched'}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400">
                            {isEquipped ? 'Active Guard' : 'Click Equip'}
                          </div>
                        </div>

                        <button
                          onClick={() => onUpgradePet(inspectedPet.instanceId)}
                          disabled={state.gems < upgCost}
                          className="p-2.5 rounded-xl bg-fuchsia-500/20 hover:bg-fuchsia-500/35 disabled:opacity-40 border border-fuchsia-400/60 text-fuchsia-100 flex flex-col items-center justify-center cursor-pointer transition"
                        >
                          <span className="text-[10px] font-black uppercase text-fuchsia-300">
                            Upgrade Lv.{inspectedPet.level + 1}
                          </span>
                          <span className="text-sm font-black flex items-center gap-1 mt-0.5">
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                            {upgCost}G
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pets.map((pet: PetInstance) => {
                    const isEquipped = equippedIds.includes(pet.instanceId);
                    const isInspected = inspectedPet?.instanceId === pet.instanceId;
                    const spec = getPetSpeciesDefinition(pet.speciesId, pet.rarity);
                    const upgCost = getPetUpgradeGemCost(pet);
                    const clickBonus = getPetClickMultiplierBonus(pet);
                    const dps = getPetCombatDps(pet);

                    return (
                      <div
                        key={pet.instanceId}
                        onClick={() => setInspectedPetId(pet.instanceId)}
                        className={`p-4 rounded-2xl border transition flex flex-col gap-3 cursor-pointer ${
                          isInspected
                            ? 'bg-slate-800/95 ring-2 ring-cyan-300/70 border-cyan-300'
                            : isEquipped
                            ? 'bg-cyan-950/35 border-cyan-400/70 shadow-[0_0_24px_rgba(34,211,238,0.18)]'
                            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <PetSprite2D
                            speciesId={pet.speciesId}
                            rarity={pet.rarity}
                            size={64}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-black text-white truncate">{spec.name}</span>
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-950 border border-slate-700 shrink-0"
                                style={{ color: spec.color }}
                              >
                                Lv.{pet.level}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] font-black" style={{ color: spec.color }}>
                              <span>{spec.rarityLabel}</span>
                              <span className="text-slate-500">•</span>
                              <span className="text-slate-400 font-bold text-[10px] flex items-center gap-0.5">
                                <BarChart3 className="w-3 h-3" /> Stats
                              </span>
                            </div>
                            <div className="text-[11px] font-bold text-slate-300 mt-0.5">
                              +{(clickBonus * 100).toFixed(0)}% Click • {dps.toFixed(1)} Zombie DPS
                            </div>
                          </div>
                        </div>

                        <div
                          className="grid grid-cols-2 gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => onToggleEquipPet(pet.instanceId)}
                            className={`py-2 rounded-xl font-black text-xs uppercase cursor-pointer transition flex items-center justify-center gap-1 ${
                              isEquipped
                                ? 'bg-cyan-400 text-slate-950'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                            }`}
                          >
                            {isEquipped && <Check className="w-3.5 h-3.5" />}
                            <span>{isEquipped ? 'Equipped' : 'Equip'}</span>
                          </button>

                          <button
                            onClick={() => onUpgradePet(pet.instanceId)}
                            disabled={state.gems < upgCost}
                            className="py-2 rounded-xl bg-fuchsia-500/20 hover:bg-fuchsia-500/35 disabled:opacity-40 border border-fuchsia-400/50 text-fuchsia-200 font-black text-xs uppercase cursor-pointer transition flex items-center justify-center gap-1"
                          >
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                            <span>{`Lv.${pet.level + 1} (${upgCost}G)`}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'eggs' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {EGG_DEFINITIONS.map((egg) => {
              const count = state.sealedEggs?.[egg.rarity] || 0;
              const canHatch = count > 0 && state.gems >= egg.hatchGemCost;
              return (
                <div
                  key={egg.rarity}
                  className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col items-center text-center gap-2.5"
                >
                  <EggBadgeVisual rarity={egg.rarity} size={68} />
                  <div>
                    <div className="text-sm font-black" style={{ color: egg.color }}>
                      {egg.rarity}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400">
                      Owned: <span className="text-white font-black">{count}</span>
                    </div>
                  </div>
                  <div className="w-full p-2 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1 text-left">
                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                      Possible Hatches
                    </div>
                    {egg.hatchPool.map((entry) => {
                      const spec = getPetSpeciesDefinition(entry.speciesId, egg.rarity);
                      return (
                        <div
                          key={entry.speciesId}
                          className="flex items-center justify-between gap-1 text-[10px] font-bold"
                        >
                          <span className="truncate" style={{ color: spec.color }}>
                            {spec.name} ({spec.rarityLabel})
                          </span>
                          <span className="text-slate-300 font-black shrink-0">
                            {entry.chancePct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => onHatchEgg(egg.rarity)}
                    disabled={!canHatch}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs uppercase cursor-pointer transition flex items-center justify-center gap-1.5 mt-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Hatch ({egg.hatchGemCost}G)</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
