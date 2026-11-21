import { Quest, GameState } from '../types/game';
import { getTotalUpgradesPurchased } from './skins';

export const QUESTS: Quest[] = [
  // Daily Quests (balanced rewards so early gameplay progresses steadily without sudden 100M skips!)
  {
    id: 'daily_clicks_7500',
    title: 'Daily Click Gauntlet',
    description: 'Land 7,500 clicks on Matthew.',
    scope: 'daily',
    type: 'clicks',
    target: 7500,
    rewardGems: 12,
    rewardCoins: 1500,
  },
  {
    id: 'daily_crits_600',
    title: 'Daily Critical Deadeye',
    description: 'Land 600 Critical Hits.',
    scope: 'daily',
    type: 'crit_clicks',
    target: 600,
    rewardGems: 15,
    rewardCoins: 5000,
  },
  {
    id: 'daily_upgrades_200',
    title: 'Daily Empire Architect',
    description: 'Own 200 total upgrade levels.',
    scope: 'daily',
    type: 'upgrades',
    target: 200,
    rewardGems: 18,
    rewardCoins: 18000,
  },
  {
    id: 'daily_chests_3',
    title: 'Daily Infinity Seeker',
    description: 'Open 3 Mystery Chests.',
    scope: 'daily',
    type: 'chests_opened',
    target: 3,
    rewardGems: 20,
    rewardCoins: 12000,
  },
  {
    id: 'daily_rebirth_5',
    title: 'Daily Ascension Grinder',
    description: 'Complete 5 Rebirths.',
    scope: 'daily',
    type: 'rebirth',
    target: 5,
    rewardGems: 25,
    rewardCoins: 75000,
  },

  // High-Tier Monthly / Seasonal Quests (scaling cleanly without sudden multi-tier jumps!)
  {
    id: 'season_clicks_250k',
    title: 'Monthly Click Overdrive',
    description: 'Reach 250,000 manual clicks.',
    scope: 'seasonal',
    type: 'clicks',
    target: 250000,
    rewardGems: 60,
    rewardCoins: 5000000,
  },
  {
    id: 'season_crits_25k',
    title: 'Monthly Critical Legend',
    description: 'Land 25,000 Critical Hits.',
    scope: 'seasonal',
    type: 'crit_clicks',
    target: 25000,
    rewardGems: 75,
    rewardCoins: 25000000,
  },
  {
    id: 'season_upgrades_1200',
    title: 'Monthly Arsenal Titan',
    description: 'Own 1,200 total upgrade levels.',
    scope: 'seasonal',
    type: 'upgrades',
    target: 1200,
    rewardGems: 90,
    rewardCoins: 150000000,
  },
  {
    id: 'season_chests_50',
    title: 'Monthly Stone Collector',
    description: 'Open 50 Mystery Chests.',
    scope: 'seasonal',
    type: 'chests_opened',
    target: 50,
    rewardGems: 150,
    rewardCoins: 50000000,
  },
  {
    id: 'season_chests_20',
    title: 'Monthly Frost Raider',
    description: 'Crack open 20 Mystery Chests.',
    scope: 'seasonal',
    type: 'chests_opened',
    target: 20,
    rewardGems: 140,
    rewardCoins: 10000000,
  },
  {
    id: 'season_rebirth_40',
    title: 'Monthly Ascension Immortal',
    description: 'Complete 40 Rebirths.',
    scope: 'seasonal',
    type: 'rebirth',
    target: 40,
    rewardGems: 160,
    rewardCoins: 1e12,
  },
  {
    id: 'season_coins_udc',
    title: 'Undecillion Sovereign',
    description: 'Reach 1 UDc (10^36) lifetime coins.',
    scope: 'seasonal',
    type: 'coins',
    target: 1e36,
    rewardGems: 200,
    rewardCoins: 1e35,
  },
  {
    id: 'season_coins_vg',
    title: 'Vigintillion Frost Emperor',
    description: 'Reach 1 Vg (10^63) lifetime coins.',
    scope: 'seasonal',
    type: 'coins',
    target: 1e63,
    rewardGems: 400,
    rewardCoins: 1e61,
  },
  {
    id: 'season_all_monthly_master',
    title: 'Complete All Monthly Quests',
    description: 'Complete every Monthly Quest above for the ultimate frost bounty.',
    scope: 'seasonal',
    type: 'all_monthly',
    target: 8,
    rewardGems: 1000,
    rewardCoins: 1e63,
  },
];

export function getQuestProgress(
  quest: Quest,
  state: GameState
): { current: number; target: number; percent: number; isComplete: boolean } {
  let current = 0;
  switch (quest.type) {
    case 'clicks':
      current = state.clicks;
      break;
    case 'coins':
      current = state.lifetimeCoins;
      break;
    case 'crit_clicks':
      current = state.criticalClicks;
      break;
    case 'upgrades':
      current = getTotalUpgradesPurchased(state.upgrades);
      break;
    case 'rebirth':
      current = state.prestigeCount;
      break;
    case 'chests_opened':
      current = state.chestsOpened || 0;
      break;
    case 'zombies_defeated':
      current = state.zombiesDefeated || 0;
      break;
    case 'all_monthly': {
      const otherSeasonal = QUESTS.filter((q) => q.scope === 'seasonal' && q.type !== 'all_monthly');
      const claimed = new Set(state.claimedQuests || []);
      current = otherSeasonal.filter((q) => claimed.has(q.id)).length;
      return {
        current,
        target: otherSeasonal.length,
        percent:
          otherSeasonal.length > 0
            ? Math.min(100, Math.floor((current / otherSeasonal.length) * 100))
            : 100,
        isComplete: current >= otherSeasonal.length,
      };
    }
    default:
      current = 0;
      break;
  }

  const isComplete = current >= quest.target;
  const percent = quest.target > 0 ? Math.min(100, Math.floor((current / quest.target) * 100)) : 100;
  return { current, target: quest.target, percent, isComplete };
}

/**
 * Automatically claims completed quests immediately (running meta-quest check afterward so completing
 * the final monthly quest triggers the master bonus cleanly in the same tick).
 */
export function checkAndAutoClaimQuests(
  state: GameState
): { state: GameState; newlyClaimed: Quest[] } {
  const claimedSet = new Set(state.claimedQuests || []);
  const newlyClaimed: Quest[] = [];
  let addedGems = 0;
  let addedCoins = 0;

  let workingState = state;
  // Pass 1: all standard quests
  for (const quest of QUESTS) {
    if (quest.type === 'all_monthly' || claimedSet.has(quest.id)) continue;
    const progress = getQuestProgress(quest, workingState);
    if (progress.isComplete) {
      claimedSet.add(quest.id);
      newlyClaimed.push(quest);
      addedGems += quest.rewardGems;
      addedCoins += quest.rewardCoins;
    }
  }

  workingState = {
    ...state,
    claimedQuests: Array.from(claimedSet),
  };

  // Pass 2: meta "Complete All Monthly Quests"
  for (const quest of QUESTS) {
    if (quest.type !== 'all_monthly' || claimedSet.has(quest.id)) continue;
    const progress = getQuestProgress(quest, workingState);
    if (progress.isComplete) {
      claimedSet.add(quest.id);
      newlyClaimed.push(quest);
      addedGems += quest.rewardGems;
      addedCoins += quest.rewardCoins;
    }
  }

  if (newlyClaimed.length === 0) {
    return { state, newlyClaimed: [] };
  }

  return {
    state: {
      ...state,
      gems: state.gems + addedGems,
      lifetimeGems: state.lifetimeGems + addedGems,
      coins: state.coins + addedCoins,
      lifetimeCoins: state.lifetimeCoins + addedCoins,
      seasonalScore: state.seasonalScore + addedCoins,
      claimedQuests: Array.from(claimedSet),
    },
    newlyClaimed,
  };
}
