import { Skin } from '../types/game';
import { getSkinById } from './skins';

export interface HeroSquadSummary {
  members: Skin[];
  clickBonusPct: number;
  cpsBonusPct: number;
  bossDamageMultiplier: number;
  isAvengersAssembled: boolean;
}

const RARITY_RANK: Record<string, number> = {
  mythic: 5,
  cosmic: 5,
  legendary: 4,
  epic: 3,
  rare: 2,
  common: 1,
  starter: 0,
};

const RARITY_BONUS: Record<string, { clickPct: number; cpsPct: number }> = {
  mythic: { clickPct: 2.5, cpsPct: 1.8 },
  cosmic: { clickPct: 2.5, cpsPct: 1.8 },
  legendary: { clickPct: 1.1, cpsPct: 0.75 },
  epic: { clickPct: 0.5, cpsPct: 0.35 },
  rare: { clickPct: 0.22, cpsPct: 0.14 },
  common: { clickPct: 0.1, cpsPct: 0.05 },
  starter: { clickPct: 0.05, cpsPct: 0.02 },
};

/**
 * Builds the player's automatic 3-Hero Strike Team from their equipped skin +
 * top 2 highest-rarity unlocked skins.
 * - Every unlocked skin contributes real Click + CPS power!
 * - Having 3 Marvel/Season 3 skins activates "Avengers Assembled (+50% Boss Damage)".
 */
export function getHeroSquadSummary(
  unlockedSkinIds: string[] = [],
  equippedSkinId: string = 'classic_matthew'
): HeroSquadSummary {
  const uniqueIds = Array.from(new Set([equippedSkinId, ...(unlockedSkinIds || [])].filter(Boolean)));
  const resolved = uniqueIds
    .map((id) => getSkinById(id))
    .filter((s): s is Skin => Boolean(s));

  const leader = resolved.find((s) => s.id === equippedSkinId) || resolved[0];
  const wingmen = resolved
    .filter((s) => !leader || s.id !== leader.id)
    .sort((a, b) => (RARITY_RANK[b.rarity] || 0) - (RARITY_RANK[a.rarity] || 0))
    .slice(0, 2);

  const members = leader ? [leader, ...wingmen] : wingmen;

  let clickBonusPct = 0;
  let cpsBonusPct = 0;
  for (const m of members) {
    const b = RARITY_BONUS[m.rarity] || RARITY_BONUS.common;
    clickBonusPct += b.clickPct;
    cpsBonusPct += b.cpsPct;
  }

  const marvelCount = members.filter((m) => m.image.includes('/s3/')).length;
  const isAvengersAssembled = members.length === 3 && marvelCount === 3;
  const bossDamageMultiplier = isAvengersAssembled ? 1.5 : 1 + marvelCount * 0.12;

  return {
    members,
    clickBonusPct,
    cpsBonusPct,
    bossDamageMultiplier,
    isAvengersAssembled,
  };
}
