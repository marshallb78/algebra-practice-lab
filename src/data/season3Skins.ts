import { Skin } from '../types/game';

/**
 * 44 MARVEL SEASON (Season 3) Collectible Matthew Skins (Common -> Mythic)
 */
const makeMarvelSkin = (
  id: string,
  name: string,
  rarity: Skin['rarity'],
  category: Skin['category'],
  description: string,
  perkDescription: string,
  milestone: Skin['milestone'],
  backgroundTheme: Skin['backgroundTheme'] = 'neon'
): Skin => ({
  id,
  name,
  rarity,
  category,
  description,
  perkDescription,
  image: `./images/s3/skins/${id}.png`,
  fallbackImage: './images/skins/classic_matthew.png',
  isPlaceholderArt: false,
  backgroundTheme,
  milestone,
  clickBonusMultiplier: 1.0,
  cpsBonusMultiplier: 1.0,
  critBonusChance: 0,
});

export const MARVEL_COMMON_SKINS: Skin[] = [
  makeMarvelSkin('spider_man_matthew', 'Matthew Spider-Man', 'Common', 'marvel_common', 'Classic red mask pulled up over forehead with crisp black webs.', 'Marvel Collectible', { type: 'lifetime_coins', target: 1e6, description: 'Reach 1M Points (Marvel)' }, 'lava'),
  makeMarvelSkin('iron_man_mk3_matthew', 'Matthew Iron Man Mark III', 'Common', 'marvel_common', 'Red-and-gold Mark III helmet opened over Matthew.', 'Marvel Collectible', { type: 'lifetime_coins', target: 2.5e7, description: 'Reach 25M Points (Marvel)' }, 'gold'),
  makeMarvelSkin('captain_america_matthew', 'Matthew Captain America', 'Common', 'marvel_common', 'Classic First Avenger blue cowl with white star.', 'Marvel Collectible', { type: 'lifetime_coins', target: 5e8, description: 'Reach 500M Points (Marvel)' }, 'ocean'),
  makeMarvelSkin('hulk_matthew', 'Matthew Hulk', 'Common', 'marvel_common', 'Gamma-charged green Hulk head with wild messy hair.', 'Marvel Collectible', { type: 'lifetime_coins', target: 1e10, description: 'Reach 10B Points (Marvel)' }, 'minecraft'),
  makeMarvelSkin('thor_matthew', 'Matthew Thor', 'Common', 'marvel_common', 'Long blond hair, short beard, winged helmet & lightning glow.', 'Marvel Collectible', { type: 'lifetime_coins', target: 2.5e11, description: 'Reach 250B Points (Marvel)' }, 'ice'),
  makeMarvelSkin('black_widow_matthew', 'Matthew Black Widow', 'Common', 'marvel_common', 'Copper-red hair and sleek tactical espionage headgear.', 'Normal Crate', { type: 'chest_drop', target: 1, description: 'Normal Crate' }, 'lava'),
  makeMarvelSkin('hawkeye_matthew', 'Matthew Hawkeye', 'Common', 'marvel_common', 'Precision tactical headpiece with purple accents.', 'Normal Crate', { type: 'chest_drop', target: 1, description: 'Normal Crate' }, 'neon'),
  makeMarvelSkin('ant_man_matthew', 'Matthew Ant-Man', 'Common', 'marvel_common', 'Red-and-silver Pym-particle helmet raised above brow.', 'Normal Crate', { type: 'chest_drop', target: 1, description: 'Normal Crate' }, 'lava'),
  makeMarvelSkin('war_machine_matthew', 'Matthew War Machine', 'Common', 'marvel_common', 'Gunmetal heavy-armor helmet opened at the top.', 'Normal Crate', { type: 'chest_drop', target: 1, description: 'Normal Crate' }, 'default'),
  makeMarvelSkin('falcon_matthew', 'Matthew Falcon', 'Common', 'marvel_common', 'Red-and-black aerial flight helmet raised above forehead.', 'Normal Crate', { type: 'chest_drop', target: 1, description: 'Normal Crate' }, 'lava'),
];

export const MARVEL_UNCOMMON_SKINS: Skin[] = [
  makeMarvelSkin('miles_morales_matthew', 'Matthew Miles Morales', 'Uncommon', 'marvel_uncommon', 'Black Spider-Man mask pulled up with red web lines.', 'Marvel Collectible', { type: 'lifetime_coins', target: 5e12, description: 'Reach 5T Points (Marvel)' }, 'lava'),
  makeMarvelSkin('spider_gwen_matthew', 'Matthew Spider-Gwen', 'Uncommon', 'marvel_uncommon', 'White hood with black & pink Spider-Gwen mask.', 'Marvel Collectible', { type: 'lifetime_coins', target: 1e14, description: 'Reach 100T Points (Marvel)' }, 'strawberry'),
  makeMarvelSkin('venom_matthew', 'Matthew Venom', 'Uncommon', 'marvel_uncommon', 'Glossy symbiote cowl with jagged white eye patches & fangs.', 'Marvel Collectible', { type: 'lifetime_coins', target: 2e15, description: 'Reach 2Qa Points (Marvel)' }, 'infernal'),
  makeMarvelSkin('loki_matthew', 'Matthew Loki', 'Uncommon', 'marvel_uncommon', 'Curved golden Asgardian horns and mischievous smirk.', 'Marvel Collectible', { type: 'lifetime_coins', target: 5e16, description: 'Reach 50Qa Points (Marvel)' }, 'gold'),
  makeMarvelSkin('winter_soldier_matthew', 'Matthew Winter Soldier', 'Uncommon', 'marvel_uncommon', 'Long dark hair and black tactical headband.', 'Marvel Collectible', { type: 'lifetime_coins', target: 1e18, description: 'Reach 1Qi Points (Marvel)' }, 'default'),
  makeMarvelSkin('black_panther_matthew', 'Matthew Black Panther', 'Uncommon', 'marvel_uncommon', 'Vibranium panther mask raised with silver tribal engravings.', 'Normal Crate', { type: 'chest_drop', target: 1, description: 'Normal Crate' }, 'neon'),
  makeMarvelSkin('deadpool_matthew', 'Matthew Deadpool', 'Uncommon', 'marvel_uncommon', 'Wrinkled red-and-black Deadpool mask pulled up on forehead.', 'Normal Crate', { type: 'chest_drop', target: 1, description: 'Normal Crate' }, 'lava'),
  makeMarvelSkin('wolverine_matthew', 'Matthew Wolverine', 'Uncommon', 'marvel_uncommon', 'Wild dark sideburns with yellow-and-blue cowl pulled back.', 'Normal Crate', { type: 'chest_drop', target: 1, description: 'Normal Crate' }, 'gold'),
  makeMarvelSkin('green_goblin_matthew', 'Matthew Green Goblin', 'Uncommon', 'marvel_uncommon', 'Pointed-ear goblin helm with fiery orange eye lenses.', 'Normal Crate', { type: 'chest_drop', target: 1, description: 'Normal Crate' }, 'zombie'),
  makeMarvelSkin('doctor_octopus_matthew', 'Matthew Doctor Octopus', 'Uncommon', 'marvel_uncommon', 'Slicked-back hair & round green-tinted brass goggles.', 'Normal Crate', { type: 'chest_drop', target: 1, description: 'Normal Crate' }, 'zombie'),
];

export const MARVEL_RARE_SKINS: Skin[] = [
  makeMarvelSkin('iron_man_mk85_matthew', 'Matthew Iron Man Mark 85', 'Rare', 'marvel_rare', 'Endgame nanotech Mark 85 helmet opened cleanly.', 'Stark Tech Crate', { type: 'chest_drop', target: 1, description: 'Stark Tech Crate' }, 'gold'),
  makeMarvelSkin('rescue_matthew', 'Matthew Rescue', 'Rare', 'marvel_rare', 'Purple-and-silver armored helm with glowing blue vents.', 'Stark Tech Crate', { type: 'chest_drop', target: 1, description: 'Stark Tech Crate' }, 'neon'),
  makeMarvelSkin('thor_ragnarok_matthew', 'Matthew Thor: Ragnarok', 'Rare', 'marvel_rare', 'Sakaar gladiator silver helm & crimson cheek war paint.', 'Stark Tech Crate', { type: 'chest_drop', target: 1, description: 'Stark Tech Crate' }, 'ice'),
  makeMarvelSkin('endgame_cap_matthew', 'Matthew Endgame Captain America', 'Rare', 'marvel_rare', 'Battle-scarred navy tactical cowl with weathered white star.', 'Stark Tech Crate', { type: 'chest_drop', target: 1, description: 'Stark Tech Crate' }, 'ocean'),
  makeMarvelSkin('red_hulk_matthew', 'Matthew Red Hulk', 'Rare', 'marvel_rare', 'Crimson-skinned powerhouse scowl with thick dark brow.', 'Stark Tech Crate', { type: 'chest_drop', target: 1, description: 'Stark Tech Crate' }, 'infernal'),
];

export const MARVEL_EPIC_SKINS: Skin[] = [
  makeMarvelSkin('scarlet_witch_matthew', 'Matthew Scarlet Witch', 'Epic', 'marvel_epic', 'Crimson tiara & glowing scarlet Chaos Magic wisps.', 'Marvel Collectible', { type: 'lifetime_coins', target: 5e27, description: 'Reach 5Oc Points (Marvel)' }, 'lava'),
  makeMarvelSkin('moon_knight_matthew', 'Matthew Moon Knight', 'Epic', 'marvel_epic', 'Layered mummy hood & silver crescent crest with glowing white eyes.', 'Marvel Collectible', { type: 'lifetime_coins', target: 2.5e29, description: 'Reach 250Oc Points (Marvel)' }, 'snowy'),
  makeMarvelSkin('vision_matthew', 'Matthew Vision', 'Epic', 'marvel_epic', 'Synthetic crimson skin & glowing golden Mind Stone forehead gem.', 'Marvel Collectible', { type: 'lifetime_coins', target: 1e31, description: 'Reach 10No Points (Marvel)' }, 'gold'),
  makeMarvelSkin('ultron_matthew', 'Matthew Ultron', 'Epic', 'marvel_epic', 'Angular titanium Ultron faceplate with glowing crimson eyes.', 'Marvel Collectible', { type: 'lifetime_coins', target: 5e32, description: 'Reach 500No Points (Marvel)' }, 'neon'),
  makeMarvelSkin('thanos_matthew', 'Matthew Thanos', 'Epic', 'marvel_epic', 'Purple Titan jawline and gold-and-blue Chitauri war helm.', 'Marvel Collectible', { type: 'lifetime_coins', target: 2.5e34, description: 'Reach 25Dc Points (Marvel)' }, 'space'),
  makeMarvelSkin('dr_strange_supreme_matthew', 'Matthew Doctor Strange Supreme', 'Epic', 'marvel_epic', 'Silver temples framed by golden-orange eldritch runes.', 'Wakanda Vibranium Crate', { type: 'chest_drop', target: 1, description: 'Wakanda Vibranium Crate' }, 'gold'),
  makeMarvelSkin('zombie_iron_man_matthew', 'Matthew Zombie Iron Man', 'Epic', 'marvel_epic', 'Cracked battle-damaged Mark armor & eerie glowing eyes.', 'Wakanda Vibranium Crate', { type: 'chest_drop', target: 1, description: 'Wakanda Vibranium Crate' }, 'zombie'),
  makeMarvelSkin('zombie_cap_matthew', 'Matthew Zombie Captain America', 'Epic', 'marvel_epic', 'Torn blue cowl & cracked star over pale decayed skin.', 'Wakanda Vibranium Crate', { type: 'chest_drop', target: 1, description: 'Wakanda Vibranium Crate' }, 'zombie'),
  makeMarvelSkin('kang_matthew', 'Matthew Kang the Conqueror', 'Epic', 'marvel_epic', 'Cobalt-blue & purple futuristic conqueror visor helm.', 'Wakanda Vibranium Crate', { type: 'chest_drop', target: 1, description: 'Wakanda Vibranium Crate' }, 'neon'),
  makeMarvelSkin('loki_god_of_stories_matthew', 'Matthew Loki: God of Stories', 'Epic', 'marvel_epic', 'Ornate golden horns gleaming with emerald multiverse magic.', 'Wakanda Vibranium Crate', { type: 'chest_drop', target: 1, description: 'Wakanda Vibranium Crate' }, 'royal'),
];

export const MARVEL_LEGENDARY_SKINS: Skin[] = [
  makeMarvelSkin('phoenix_force_matthew', 'Matthew Phoenix Force Jean Grey', 'Legendary', 'marvel_legendary', 'Fiery red hair, golden Phoenix wing crown & solar flames.', 'Marvel Collectible', { type: 'lifetime_coins', target: 1e36, description: 'Reach 1UDc Points (Marvel)' }, 'lava'),
  makeMarvelSkin('knull_matthew', 'Matthew Knull', 'Legendary', 'marvel_legendary', 'Pale symbiote god with jagged black-and-red crown.', 'Marvel Collectible', { type: 'lifetime_coins', target: 1e51, description: 'Reach 1Sxdc Points (Marvel)' }, 'infernal'),
  makeMarvelSkin('world_breaker_hulk_matthew', 'Matthew World Breaker Hulk', 'Legendary', 'marvel_legendary', 'Glowing emerald gamma cracks blazing across green Titan skin.', 'Marvel Collectible', { type: 'lifetime_coins', target: 1e63, description: 'Reach 1Vg Points (Marvel)' }, 'minecraft'),
  makeMarvelSkin('rune_king_thor_matthew', 'Matthew Rune King Thor', 'Legendary', 'marvel_legendary', 'Glowing Odinforce forehead runes & golden Asgardian king crown.', 'Cosmic Infinity Crate', { type: 'chest_drop', target: 1, description: 'Cosmic Infinity Crate' }, 'gold'),
  makeMarvelSkin('god_emperor_doom_matthew', 'Matthew God Emperor Doom', 'Legendary', 'marvel_legendary', 'Battleworld white hood & gleaming silver Doom faceplate.', 'Cosmic Infinity Crate', { type: 'chest_drop', target: 1, description: 'Cosmic Infinity Crate' }, 'ice'),
  makeMarvelSkin('beyonder_matthew', 'Matthew The Beyonder', 'Legendary', 'marvel_legendary', 'Cosmic black-and-white geometric reality-warper pattern.', 'Cosmic Infinity Crate', { type: 'chest_drop', target: 1, description: 'Cosmic Infinity Crate' }, 'space'),
  makeMarvelSkin('one_above_all_matthew', 'Matthew The One Above All', 'Legendary', 'marvel_legendary', 'Radiant white-and-gold supreme celestial creator glow.', 'Cosmic Infinity Crate', { type: 'chest_drop', target: 1, description: 'Cosmic Infinity Crate' }, 'gold'),
];

export const MARVEL_MYTHIC_SKINS: Skin[] = [
  makeMarvelSkin('infinity_thanos_matthew', 'Matthew Infinity Thanos', 'Mythic', 'marvel_mythic', 'Six blazing Infinity Stones orbiting Thanos-Matthew’s golden war crown.', 'Marvel Mythic Milestone', { type: 'lifetime_coins', target: 1e63, description: 'Reach 1Vg Points (Marvel)' }, 'space'),
  makeMarvelSkin('infinity_ultron_matthew', 'Matthew Infinity Ultron', 'Mythic', 'marvel_mythic', 'Silver Ultron-Matthew crowned with all 6 embedded Infinity Stones.', 'Cosmic Infinity Crate (Mythic)', { type: 'chest_drop', target: 1, description: 'Cosmic Infinity Crate (Mythic!)' }, 'royal'),
];

/**
 * 10 Featured Marvel Skins; 5 rotate daily inside the Season 3 Matthew Shop.
 */
export const MARVEL_SHOP_SKINS: Skin[] = [
  { ...MARVEL_UNCOMMON_SKINS[1], gemCost: 35, milestone: { type: 'item_shop', target: 35, description: 'Matthew Shop (35 Gems)' } },
  { ...MARVEL_UNCOMMON_SKINS[6], gemCost: 40, milestone: { type: 'item_shop', target: 40, description: 'Matthew Shop (40 Gems)' } },
  { ...MARVEL_UNCOMMON_SKINS[2], gemCost: 45, milestone: { type: 'item_shop', target: 45, description: 'Matthew Shop (45 Gems)' } },
  { ...MARVEL_UNCOMMON_SKINS[5], gemCost: 50, milestone: { type: 'item_shop', target: 50, description: 'Matthew Shop (50 Gems)' } },
  { ...MARVEL_UNCOMMON_SKINS[7], gemCost: 55, milestone: { type: 'item_shop', target: 55, description: 'Matthew Shop (55 Gems)' } },
  { ...MARVEL_RARE_SKINS[0], gemCost: 65, milestone: { type: 'item_shop', target: 65, description: 'Matthew Shop (65 Gems)' } },
  { ...MARVEL_EPIC_SKINS[0], gemCost: 75, milestone: { type: 'item_shop', target: 75, description: 'Matthew Shop (75 Gems)' } },
  { ...MARVEL_EPIC_SKINS[1], gemCost: 85, milestone: { type: 'item_shop', target: 85, description: 'Matthew Shop (85 Gems)' } },
  { ...MARVEL_EPIC_SKINS[3], gemCost: 95, milestone: { type: 'item_shop', target: 95, description: 'Matthew Shop (95 Gems)' } },
  { ...MARVEL_EPIC_SKINS[9], gemCost: 110, milestone: { type: 'item_shop', target: 110, description: 'Matthew Shop (110 Gems)' } },
];

export function getDailyMarvelShopRotation(dateStr: string, count = 5): Skin[] {
  if (count >= MARVEL_SHOP_SKINS.length) return MARVEL_SHOP_SKINS;
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  const start = hash % MARVEL_SHOP_SKINS.length;
  const out: Skin[] = [];
  for (let i = 0; i < count; i++) {
    out.push(MARVEL_SHOP_SKINS[(start + i) % MARVEL_SHOP_SKINS.length]);
  }
  return out;
}

export const ALL_MARVEL_SKINS: Skin[] = [
  ...MARVEL_COMMON_SKINS,
  ...MARVEL_UNCOMMON_SKINS,
  ...MARVEL_RARE_SKINS,
  ...MARVEL_EPIC_SKINS,
  ...MARVEL_LEGENDARY_SKINS,
  ...MARVEL_MYTHIC_SKINS,
];
