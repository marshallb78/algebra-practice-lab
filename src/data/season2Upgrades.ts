import { Upgrade } from '../types/game';

interface UpgradeSpecSeed {
  id: string;
  iconNum: string;
  name: string;
  description: string;
  focus: 'click' | 'cps' | 'hybrid';
}

const S2_UPGRADE_SPECS: UpgradeSpecSeed[] = [
  // Tier 1-24: Early Camp Rations, Basic Footwear & Warmth
  { id: 's2_snowball_pack', iconNum: '06', name: 'Snow-Proof Thermals', description: 'Insulated base layer keeping clicking hands nimble in the cold.', focus: 'click' },
  { id: 's2_thermal_mittens', iconNum: '08', name: 'Tundra Fur Boots', description: 'Sturdy sheepskin boots for trekking snowy supply trails.', focus: 'hybrid' },
  { id: 's2_campfire_ember', iconNum: '63', name: 'Tin Camp Mess Plate', description: 'Serves steady warm trail rations around the campfire.', focus: 'cps' },
  { id: 's2_slingshot_frost', iconNum: '65', name: 'Hearth Sourdough Loaf', description: 'Hearty baked bread that fuels longer clicking sprints.', focus: 'click' },
  { id: 's2_hot_tea_flask', iconNum: '66', name: 'Cellar Winter Carrots', description: 'Crisp root cellar harvest replenishing worker stamina.', focus: 'hybrid' },
  { id: 's2_ice_pick', iconNum: '67', name: 'Aged Bunker Cheddar', description: 'Sharp fortified cheese wedges traded for quick coins.', focus: 'click' },
  { id: 's2_lantern_post', iconNum: '76', name: 'Cavern Morel Ration', description: 'Foraged cave mushrooms dried for reliable camp income.', focus: 'cps' },
  { id: 's2_hot_cocoa_stand', iconNum: '77', name: 'Toasted Tundra Acorns', description: 'Roasted nut rations boosting camp energy steadily.', focus: 'hybrid' },
  { id: 's2_frost_gloves', iconNum: '64', name: 'Freeze-Dried Bananas', description: 'High-potassium emergency fuel for rapid click streaks.', focus: 'click' },
  { id: 's2_sled_courier', iconNum: '68', name: 'Wild Tundra Cranberries', description: 'Tart glacier berries harvested and bottled passively.', focus: 'cps' },
  { id: 's2_snow_shovel', iconNum: '73', name: 'Vitamin-C Frost Lemon', description: 'Citrus frost tonic keeping winter scurvy away.', focus: 'hybrid' },
  { id: 's2_frost_turret', iconNum: '78', name: 'Sunburst Tangerine', description: 'Sweet citrus crates traded along the snowy outpost.', focus: 'hybrid' },
  { id: 's2_wolf_whistle', iconNum: '79', name: 'Ice-Cellar Green Pear', description: 'Chilled orchard pears preserved beneath permafrost.', focus: 'cps' },
  { id: 's2_shelter_heater', iconNum: '82', name: 'Permafrost Crimson Radish', description: 'Hardy ruby roots grown inside geothermal planters.', focus: 'cps' },
  { id: 's2_steel_cleaver', iconNum: '86', name: 'Snow-Glazed Strawberry', description: 'Frosted greenhouse berries boosting critical focus.', focus: 'click' },
  { id: 's2_plasma_glove', iconNum: '87', name: 'Bio-Dome Watermelon', description: 'Juicy dome-grown slices energizing heavy click hits.', focus: 'click' },
  { id: 's2_arctic_barricade', iconNum: '72', name: 'Hydroponic Green Pepper', description: 'Crisp indoor crops maturing cleanly every second.', focus: 'cps' },
  { id: 's2_snowplow_rig', iconNum: '85', name: 'Ember Red Bell Pepper', description: 'Spicy red peppers warming up workers and clicks.', focus: 'hybrid' },
  { id: 's2_copper_coil', iconNum: '88', name: 'Solar Yellow Pepper', description: 'UV-lamp golden peppers producing steady camp revenue.', focus: 'cps' },
  { id: 's2_glacier_drill', iconNum: '70', name: 'Frost Concord Grapes', description: 'Ice-wine vineyard clusters thriving in cold air.', focus: 'hybrid' },
  { id: 's2_thermal_spear', iconNum: '71', name: 'Cryo-Mist White Grapes', description: 'Frost-dusted white grapes sharpening click strikes.', focus: 'click' },
  { id: 's2_cryo_capacitor', iconNum: '75', name: 'Midnight Blackberries', description: 'Deep-winter berries packed with burst click energy.', focus: 'click' },
  { id: 's2_steam_boiler', iconNum: '81', name: 'Greenhouse Gold Pineapple', description: 'Tropical dome pineapples sold at top winter prices.', focus: 'cps' },
  { id: 's2_watchtower_beacon', iconNum: '61', name: 'Condensed Milk Flask', description: 'Rich fortified milk rations sustaining the ranch.', focus: 'cps' },

  // Tier 25-42: Hot Camp Feasts, Medicines & Scout Gear
  { id: 's2_magma_pipe', iconNum: '69', name: 'Charred Turkey Skewer', description: 'Smoked poultry feast roasted over glowing coals.', focus: 'hybrid' },
  { id: 's2_silver_crossbow', iconNum: '83', name: 'Glacier Fish Skewer', description: 'Fresh ice-fished trout skewered for instant vigor.', focus: 'click' },
  { id: 's2_frostbite_katana', iconNum: '74', name: 'Campfire Seared Steak', description: 'Sizzling iron-skillet sirloin fueling ferocious clicks.', focus: 'click' },
  { id: 's2_tundra_generator', iconNum: '84', name: 'Thick Cut Prime Steak', description: 'Prime butchered cuts feeding the entire defense crew.', focus: 'cps' },
  { id: 's2_arctic_outpost', iconNum: '80', name: 'Spiced Trail Cake', description: 'Rich layered ration cake elevating outpost morale.', focus: 'cps' },
  { id: 's2_pet_dojo', iconNum: '56', name: 'Hound Marrow Bone', description: 'Reward bone keeping guard pets fierce and loyal.', focus: 'hybrid' },
  { id: 's2_sunstone_charm', iconNum: '55', name: 'Mammoth Tusk Signal Horn', description: 'Carved ivory horn rallying critical click strikes.', focus: 'click' },
  { id: 's2_aurora_collector', iconNum: '54', name: 'Cryo Splitting Hatchet', description: 'Heavy steel axe cleaving ice crates and zombies.', focus: 'click' },
  { id: 's2_rune_tablet', iconNum: '07', name: 'Fleece Survival Tunic', description: 'Padded canvas tunic shielding against biting winds.', focus: 'cps' },
  { id: 's2_cryo_mecha', iconNum: '10', name: 'Insulated Camp Slippers', description: 'Strapped thermal footwear speeding yard patrols.', focus: 'hybrid' },
  { id: 's2_blizzard_engine', iconNum: '09', name: 'Ranger Buckled Boots', description: 'Moss-green buckled boots built for snowy marches.', focus: 'cps' },
  { id: 's2_glacier_greatsword', iconNum: '11', name: 'Frost-Grip Ice Cleats', description: 'Spiked alpine boots anchoring powerful click blows.', focus: 'click' },
  { id: 's2_solar_flare_gauntlet', iconNum: '29', name: 'Fleece-Lined Scout Cap', description: 'Studded leather helmet guarding the vanguard.', focus: 'click' },
  { id: 's2_frost_refinery', iconNum: '58', name: 'Frostbite Salve Vial', description: 'Restorative ointment tube healing frost-bitten crews.', focus: 'cps' },
  { id: 's2_permafrost_bank', iconNum: '59', name: 'Thermal Melt Vial', description: 'Stabilized blue frost serum catalyzing passive output.', focus: 'cps' },
  { id: 's2_glacial_train', iconNum: '60', name: 'Concentrated Thaw Tonic', description: 'Distilled alchemist flask turbocharging homestead work.', focus: 'hybrid' },
  { id: 's2_plasma_halberd', iconNum: '53', name: 'Bio-Stamina Elixir', description: 'Emerald alchemy brew amplifying click stamina.', focus: 'click' },
  { id: 's2_ice_satellite', iconNum: '47', name: 'Timber Ranch Buckler', description: 'Bound oak round shield strengthening the wood fence.', focus: 'cps' },

  // Tier 43-64: Fortifications, Shields, Helms & Forged Steel
  { id: 's2_magnetic_siphon', iconNum: '48', name: 'Studded Oak Fence Shield', description: 'Iron-rimmed timber shield holding back undead swarms.', focus: 'hybrid' },
  { id: 's2_absolute_zero_tap', iconNum: '49', name: 'Homestead Plank Shield', description: 'Tall reinforced wood buckler deflecting heavy swipes.', focus: 'click' },
  { id: 's2_subzero_foundry', iconNum: '50', name: 'Spiked Fence Barricade', description: 'Heavy iron-bolted wood crate blocking zombie breaches.', focus: 'cps' },
  { id: 's2_valkyrie_helm', iconNum: '40', name: 'Reinforced Bunker Drum', description: 'Steel supply drum stacked into a blast barrier.', focus: 'hybrid' },
  { id: 's2_aurora_core', iconNum: '38', name: 'Iron Grate Riot Buckler', description: 'Caged steel buckler turning aside frozen claws.', focus: 'hybrid' },
  { id: 's2_yeti_legion', iconNum: '39', name: 'Charcoal Bastion Shield', description: 'Riveted dark-iron shield guarding elite squads.', focus: 'cps' },
  { id: 's2_meteor_mace', iconNum: '62', name: 'Refined Frost-Silver Ingot', description: 'Mirror-forged silver bullion hammered into gear.', focus: 'click' },
  { id: 's2_comet_freezer', iconNum: '30', name: 'Cryo Sentry Battle Helm', description: 'Full steel helm protecting sentries during blizzards.', focus: 'hybrid' },
  { id: 's2_starlight_loom', iconNum: '12', name: 'Gale-Runner Winged Boots', description: 'Silver winged greaves flying across icy fields.', focus: 'cps' },
  { id: 's2_ice_citadel', iconNum: '13', name: 'Shadowstalker Boots', description: 'Arcane violet-laced boots patrolling silent nights.', focus: 'cps' },
  { id: 's2_chrono_glacier', iconNum: '14', name: 'Firewalker Garrison Boots', description: 'Ember-cuffed steel boots striding over permafrost.', focus: 'hybrid' },
  { id: 's2_hyper_thaw_hammer', iconNum: '03', name: 'Stitched Hide Armor', description: 'Boiled leather chestguard built for fierce strikes.', focus: 'click' },
  { id: 's2_frozen_dimension', iconNum: '01', name: 'Tempered Steel Frost Plate', description: 'Forged silver chestplate shielding the outpost core.', focus: 'cps' },
  { id: 's2_astral_lantern', iconNum: '41', name: 'Polar Knight Heater Shield', description: 'Polished kite shield standing firm against raids.', focus: 'hybrid' },
  { id: 's2_cryo_singularity', iconNum: '31', name: 'Glacier Paladin Greathelm', description: 'Plumed knight visor leading every defensive wave.', focus: 'hybrid' },
  { id: 's2_celestial_glacier', iconNum: '04', name: 'Silvered Glacier Cuirass', description: 'Gleaming white-steel plate shrugging off frostbites.', focus: 'cps' },
  { id: 's2_ether_gauntlets', iconNum: '42', name: 'Cryo-Turret Deflector', description: 'Segmented alloy shield shattering charging undead.', focus: 'click' },
  { id: 's2_eternal_aurora', iconNum: '57', name: 'Permafrost Survival Codex', description: 'Ancient leather-bound tome unlocking icy secrets.', focus: 'hybrid' },
  { id: 's2_quantum_flurry', iconNum: '32', name: 'Blizzard Weaver Mage Hat', description: 'Violet wizard hat channeling frosty winds automatically.', focus: 'cps' },
  { id: 's2_omega_blizzard', iconNum: '33', name: 'Cinder-Spark Witch Hat', description: 'Ember-banded witch hat igniting blistering click bursts.', focus: 'click' },
  { id: 's2_apex_cryo_throne', iconNum: '27', name: 'Cryo-Forged Silver Ring', description: 'Polished silver ring multiplying passive treasury flow.', focus: 'cps' },
  { id: 's2_frost_chronosphere', iconNum: '28', name: 'Zero-Kelvin Frost Band', description: 'Sapphire-glint band freezing time for massive payouts.', focus: 'hybrid' },

  // Tier 65-88: Sovereign Shields, Mythic Armor, Prisms & Relic Amulets
  { id: 's2_undecillion_vault', iconNum: '43', name: 'UDc Glacier Mirror Aegis', description: 'Diamond-inlaid crystalline shield guarding UDc vaults.', focus: 'cps' },
  { id: 's2_udc_crystal_lance', iconNum: '44', name: 'UDc Titanium Tower Shield', description: 'Ribbed steel tower shield bashing at 10^36 power.', focus: 'click' },
  { id: 's2_udc_glacier_loom', iconNum: '45', name: 'UDc Emerald Wolf Crest', description: 'Emerald wolf-emblazoned shield rallying frost beasts.', focus: 'hybrid' },
  { id: 's2_ddc_aurora_forger', iconNum: '46', name: 'Ddc Crimson Wolf Aegis', description: 'Blood-crimson wolf crest commanding Duodecillion ranks.', focus: 'cps' },
  { id: 's2_ddc_frost_prism', iconNum: '36', name: 'Ddc Royal Citadel Aegis', description: 'Gold-and-sapphire citadel shield multiplying prestige wealth.', focus: 'hybrid' },
  { id: 's2_ddc_frost_gauntlet', iconNum: '37', name: 'Ddc Solstice Mirror Shield', description: 'Golden sunburst buckler reflecting radiant click strikes.', focus: 'click' },
  { id: 's2_tdc_cryo_bastion', iconNum: '02', name: 'Tdc Magma-Vented Armor', description: 'Lava-forged chestplate melting Tredecillion glaciers.', focus: 'cps' },
  { id: 's2_tdc_blizzard_ring', iconNum: '05', name: 'Tdc Sun-Forged Gold Mail', description: 'Royal golden armor shining through endless winter.', focus: 'hybrid' },
  { id: 's2_tdc_star_saber', iconNum: '34', name: 'Tdc Ossuary Rib-Armor', description: 'Fossilized bone rib-mail shattering cosmic undead.', focus: 'click' },
  { id: 's2_qadc_hyper_beacon', iconNum: '35', name: 'Qadc Void-Spike Plate', description: 'Obsidian horned demon armor ruling Quattuordecillion realms.', focus: 'cps' },
  { id: 's2_qadc_frost_matrix', iconNum: '51', name: 'Qadc Star-Core Rose Gem', description: 'Flawless crimson jewel pulsing with 10^45 energy.', focus: 'hybrid' },
  { id: 's2_qadc_frost_blade', iconNum: '52', name: 'Qadc Nebula Amethyst Shard', description: 'Faceted violet crystal cleaving frozen barriers on click.', focus: 'click' },
  { id: 's2_qidc_comet_nexus', iconNum: '15', name: 'Qidc Gilded Frontier Cross', description: 'Golden four-point medallion channeling Quindecillion wealth.', focus: 'hybrid' },
  { id: 's2_qidc_frost_dynamo', iconNum: '16', name: 'Qidc Frost-Star Seal', description: 'Silver sunburst medal spinning nonstop cosmic revenue.', focus: 'cps' },
  { id: 's2_qidc_nova_fist', iconNum: '17', name: 'Qidc Bronze Relic Cross', description: 'Ancient guardian cross unleashing Quindecillion clicks.', focus: 'click' },
  { id: 's2_sxdc_prism_monolith', iconNum: '18', name: 'Sxdc Sapphire Brooch', description: 'Royal blue jewel pendant radiating Sexdecillion fortune.', focus: 'cps' },
  { id: 's2_sxdc_quantum_anvil', iconNum: '19', name: 'Sxdc Phoenix Flame Amulet', description: 'Crimson teardrop talisman superheating Sexdecillion taps.', focus: 'click' },
  { id: 's2_sxdc_glacier_nebula', iconNum: '20', name: 'Sxdc Deep-Ice Heart', description: 'Cobalt heart pendant raining icy Sexdecillion clouds.', focus: 'cps' },
  { id: 's2_spdc_galaxy_dome', iconNum: '21', name: 'Spdc Polaris North-Star', description: 'Snowflake-gem pendant guiding Septendecillion fleets.', focus: 'cps' },
  { id: 's2_spdc_solar_engine', iconNum: '22', name: 'Spdc Seraph Wing Talisman', description: 'Silver angel-wing necklace uplifting Septendecillion yields.', focus: 'hybrid' },
  { id: 's2_spdc_infinity_claw', iconNum: '23', name: 'Spdc Twin-Ruby Charm', description: 'Alchemical twin-ruby amulet empowering lightning clicks.', focus: 'click' },
  { id: 's2_ocdc_cosmos_vault', iconNum: '24', name: 'Ocdc Cryo-Fang Necklace', description: 'Beast-fang trophy necklace claiming Octodecillion domains.', focus: 'cps' },
  { id: 's2_ocdc_zenith_wand', iconNum: '25', name: 'Ocdc Dewdrop Amulet', description: 'Luminous azure droplet charm surging click multipliers.', focus: 'click' },
  { id: 's2_ocdc_astral_engine', iconNum: '26', name: 'Ocdc Solstice Gold Chain', description: 'Radiant golden rosary binding Octodecillion galaxies.', focus: 'hybrid' },

  // Tier 89-96: Siege Cannons, Vault Chests & Vigintillion Chronosphere
  { id: 's2_nmdc_nebula_crown', iconNum: '89', name: 'Nmdc Iron Snow-Cannon', description: 'Heavy cast-iron artillery blasting Novemdecillion waves.', focus: 'hybrid' },
  { id: 's2_nmdc_comet_cathedral', iconNum: '90', name: 'Nmdc Magma Siege Cannon', description: 'Flaming magma cannon vaporizing frozen colossi.', focus: 'cps' },
  { id: 's2_nmdc_cosmic_glaive', iconNum: '91', name: 'Nmdc Cryo Glacier Cannon', description: 'Sub-zero siege barrel firing concentrated star-ice.', focus: 'click' },
  { id: 's2_pre_vg_obsidian_key', iconNum: '92', name: 'Pre-Vg Voltage Tesla Cannon', description: 'Golden storm-arc cannon shattering outer Vg shields.', focus: 'hybrid' },
  { id: 's2_pre_vg_aurora_ark', iconNum: '93', name: 'Pre-Vg Isotope Plasma Mortar', description: 'Bio-reactive green plasma cannon raining Vg returns.', focus: 'cps' },
  { id: 's2_pre_vg_nova_scepter', iconNum: '94', name: 'Pre-Vg Sealed Treasury Chest', description: 'Locked iron-bound treasury bursting with click riches.', focus: 'click' },
  { id: 's2_pre_vg_eternity_seal', iconNum: '95', name: 'Pre-Vg Open Relic Vault', description: 'Wide-open golden chest pouring endless Vg compound interest.', focus: 'hybrid' },
  { id: 's2_vg_omega_apocalypse', iconNum: '96', name: 'Vigintillion Frost Chronosphere', description: 'Ultimate Vg (10^63) cosmic clock mastering frozen time.', focus: 'hybrid' },
];

const START_COST = 25;
const END_COST = 2.5e63;
const TOTAL_STEPS = S2_UPGRADE_SPECS.length - 1;
const STEP_RATIO = Math.pow(END_COST / START_COST, 1 / TOTAL_STEPS); // Smooth spacing per tier!

function formatNiceCost(raw: number): number {
  if (raw < 100) return Math.round(raw);
  const exp = Math.floor(Math.log10(raw));
  const pow = Math.pow(10, Math.max(0, exp - 1));
  return Math.round(raw / pow) * pow;
}

/**
 * SEASON 2: FROZEN APOCALYPSE — 96 SMOOTHLY STEPPED PROGRESSION TIERS UP TO VIGINTILLION (Vg, 10^63)
 * PLUS 80 POST-VG TIERS FROM UVg (10^66) THROUGH CENTILLION (Ctg, 10^303).
 */
const BASE_SEASON_2_UPGRADES: Upgrade[] = S2_UPGRADE_SPECS.map((spec, idx) => {
  const baseCost = idx === TOTAL_STEPS ? END_COST : formatNiceCost(START_COST * Math.pow(STEP_RATIO, idx));
  // Smooth earned ROI curve scaling cleanly up to Vigintillion
  const powerAnchor = Math.max(1, Math.round(baseCost / (210 + idx * 14)));
  const iconFallback =
    spec.focus === 'click' ? 'Sword' : spec.focus === 'cps' ? 'Zap' : 'Snowflake';

  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    icon: iconFallback,
    iconImage: `./images/s2/upgrades/up_${spec.iconNum}.png`,
    baseCost,
    costMultiplier: Number((1.21 + Math.min(0.14, idx * 0.0015)).toFixed(3)),
    baseCps:
      spec.focus === 'click'
        ? 0
        : spec.focus === 'cps'
        ? powerAnchor
        : Math.max(1, Math.round(powerAnchor * 0.7)),
    baseClickPower:
      spec.focus === 'cps'
        ? 0
        : spec.focus === 'click'
        ? Math.max(1, Math.round(powerAnchor * 1.15))
        : Math.max(1, Math.round(powerAnchor * 0.45)),
    tier: (idx % 8) + 1,
  };
});

const VG_BRIDGE_SPECS: readonly {
  id: string;
  iconNum: string;
  name: string;
  description: string;
  focus: 'click' | 'cps' | 'hybrid';
  baseCost: number;
}[] = [
  {
    id: 's2_vg_glacial_singularity',
    iconNum: '93',
    name: 'Vg Glacial Singularity Core',
    description: 'Channels 15 Vg (10^64) zero-point glacier turbines automatically.',
    focus: 'cps',
    baseCost: 1.5e64,
  },
  {
    id: 's2_vg_permafrost_lance',
    iconNum: '94',
    name: 'Vg Permafrost Nova Lance',
    description: 'Condenses 95 Vg permafrost fury into thunderous manual clicks.',
    focus: 'click',
    baseCost: 9.5e64,
  },
  {
    id: 's2_vg_eternal_chronocore',
    iconNum: '95',
    name: 'Vg Eternal Chronocore',
    description: 'Bridges 500 Vg (10^65) space-time energy straight into Unvigintillion!',
    focus: 'hybrid',
    baseCost: 5e65,
  },
];

const VG_BRIDGE_UPGRADES: Upgrade[] = VG_BRIDGE_SPECS.map((spec, idx) => {
  const powerAnchor = spec.baseCost / 140;
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    icon: spec.focus === 'click' ? 'Sword' : spec.focus === 'cps' ? 'Zap' : 'Snowflake',
    iconImage: `./images/s2/upgrades/up_${spec.iconNum}.png`,
    baseCost: spec.baseCost,
    costMultiplier: 1.22,
    baseCps: spec.focus === 'click' ? 0 : spec.focus === 'cps' ? powerAnchor : powerAnchor * 0.7,
    baseClickPower:
      spec.focus === 'cps' ? 0 : spec.focus === 'click' ? powerAnchor * 1.15 : powerAnchor * 0.45,
    tier: (idx % 8) + 1,
  };
});

const POST_VG_TIERS: readonly [string, string][] = [
  ['UVg', 'Unvigintillion'],
  ['DVg', 'Duovigintillion'],
  ['TrVg', 'Tresvigintillion'],
  ['QaVg', 'Quattuorvigintillion'],
  ['QnVg', 'Quinvigintillion'],
  ['SeVg', 'Sesvigintillion'],
  ['SpVg', 'Septemvigintillion'],
  ['OVg', 'Octovigintillion'],
  ['NVg', 'Novemvigintillion'],
  ['Tg', 'Trigintillion'],
  ['UTg', 'Untrigintillion'],
  ['DTg', 'Duotrigintillion'],
  ['TrTg', 'Trestrigintillion'],
  ['QaTg', 'Quattuortrigintillion'],
  ['QnTg', 'Quintrigintillion'],
  ['SeTg', 'Sestrigintillion'],
  ['SpTg', 'Septentrigintillion'],
  ['OTg', 'Octotrigintillion'],
  ['NTg', 'Noventrigintillion'],
  ['QAg', 'Quadragintillion'],
  ['UQAg', 'Unquadragintillion'],
  ['DQAg', 'Duoquadragintillion'],
  ['TrQAg', 'Tresquadragintillion'],
  ['QaQAg', 'Quattuorquadragintillion'],
  ['QnQAg', 'Quinquadragintillion'],
  ['SeQAg', 'Sesquadragintillion'],
  ['SpQAg', 'Septenquadragintillion'],
  ['OQAg', 'Octoquadragintillion'],
  ['NQAg', 'Novenquadragintillion'],
  ['Qqg', 'Quinquagintillion'],
  ['UQqg', 'Unquinquagintillion'],
  ['DQqg', 'Duoquinquagintillion'],
  ['TrQqg', 'Tresquinquagintillion'],
  ['QaQqg', 'Quattuorquinquagintillion'],
  ['QnQqg', 'Quinquinquagintillion'],
  ['SeQqg', 'Sesquinquagintillion'],
  ['SpQqg', 'Septenquinquagintillion'],
  ['OQqg', 'Octoquinquagintillion'],
  ['NQqg', 'Novenquinquagintillion'],
  ['Sxg', 'Sexagintillion'],
  ['USxg', 'Unsexagintillion'],
  ['DSxg', 'Duosexagintillion'],
  ['TrSxg', 'Tressexagintillion'],
  ['QaSxg', 'Quattuorsexagintillion'],
  ['QnSxg', 'Quinsexagintillion'],
  ['SeSxg', 'Sesexagintillion'],
  ['SpSxg', 'Septensexagintillion'],
  ['OSxg', 'Octosexagintillion'],
  ['NSxg', 'Novensexagintillion'],
  ['Stg', 'Septuagintillion'],
  ['UStg', 'Unseptuagintillion'],
  ['DStg', 'Duoseptuagintillion'],
  ['TrStg', 'Treseptuagintillion'],
  ['QaStg', 'Quattuorseptuagintillion'],
  ['QnStg', 'Quinseptuagintillion'],
  ['SeStg', 'Seseptuagintillion'],
  ['SpStg', 'Septenseptuagintillion'],
  ['OStg', 'Octoseptuagintillion'],
  ['NStg', 'Novenseptuagintillion'],
  ['Og', 'Octogintillion'],
  ['UOg', 'Unoctogintillion'],
  ['DOg', 'Duooctogintillion'],
  ['TrOg', 'Tresoctogintillion'],
  ['QaOg', 'Quattuoroctogintillion'],
  ['QnOg', 'Quinoctogintillion'],
  ['SeOg', 'Sexoctogintillion'],
  ['SpOg', 'Septemoctogintillion'],
  ['OOg', 'Octooctogintillion'],
  ['NOg', 'Novemoctogintillion'],
  ['Ng', 'Nonagintillion'],
  ['UNg', 'Unnonagintillion'],
  ['DNg', 'Duononagintillion'],
  ['TrNg', 'Tresnonagintillion'],
  ['QaNg', 'Quattuornonagintillion'],
  ['QnNg', 'Quinnonagintillion'],
  ['SeNg', 'Sesnonagintillion'],
  ['SpNg', 'Septennonagintillion'],
  ['ONg', 'Octononagintillion'],
  ['NNg', 'Novennonagintillion'],
  ['Ctg', 'Centillion'],
];

const POST_VG_STEP_TEMPLATES: readonly {
  mantissa: number;
  idSuffix: string;
  titleSuffix: string;
  focus: 'cps' | 'click' | 'hybrid';
  descVerb: string;
}[] = [
  { mantissa: 1.2, idSuffix: 'harvester', titleSuffix: 'Harvester', focus: 'cps', descVerb: 'Harvests' },
  { mantissa: 7.5, idSuffix: 'striker', titleSuffix: 'Striker', focus: 'click', descVerb: 'Delivers' },
  { mantissa: 45, idSuffix: 'reactor', titleSuffix: 'Reactor', focus: 'cps', descVerb: 'Overclocks' },
  { mantissa: 280, idSuffix: 'ascendant', titleSuffix: 'Core', focus: 'hybrid', descVerb: 'Masters' },
];

const POST_VG_UPGRADES: Upgrade[] = POST_VG_TIERS.flatMap(([suffix, fullName], tierIdx) => {
  const exp = 66 + tierIdx * 3;
  return POST_VG_STEP_TEMPLATES.map((step, subIdx) => {
    const globalIdx = S2_UPGRADE_SPECS.length + VG_BRIDGE_SPECS.length + tierIdx * 4 + subIdx;
    const baseCost = Number(`${step.mantissa}e+${exp}`);
    const powerAnchor = baseCost / (140 + tierIdx * 2);
    const iconNum = String((globalIdx % 96) + 1).padStart(2, '0');
    const iconFallback =
      step.focus === 'click' ? 'Sword' : step.focus === 'cps' ? 'Zap' : 'Snowflake';

    return {
      id: `s2_${suffix.toLowerCase()}_${step.idSuffix}`,
      name: `${suffix} ${fullName} ${step.titleSuffix}`,
      description: `${step.descVerb} ${step.mantissa} ${suffix} (${fullName}) cryo-energy across the Frozen Apocalypse.`,
      icon: iconFallback,
      iconImage: `./images/s2/upgrades/up_${iconNum}.png`,
      baseCost,
      costMultiplier: 1.22,
      baseCps: step.focus === 'click' ? 0 : step.focus === 'cps' ? powerAnchor : powerAnchor * 0.7,
      baseClickPower:
        step.focus === 'cps' ? 0 : step.focus === 'click' ? powerAnchor * 1.15 : powerAnchor * 0.45,
      tier: (globalIdx % 8) + 1,
    };
  });
});

export const SEASON_2_UPGRADES: Upgrade[] = [
  ...BASE_SEASON_2_UPGRADES,
  ...VG_BRIDGE_UPGRADES,
  ...POST_VG_UPGRADES,
];
