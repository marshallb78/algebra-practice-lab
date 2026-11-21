import { Upgrade } from '../types/game';

interface MarvelUpgradeSeed {
  id: string;
  name: string;
  description: string;
  iconImage: string;
  baseCost: number;
  costMultiplier: number;
  baseCps: number;
  baseClickPower: number;
  tier: number;
}

/**
 * 51 Unique Marvel Scene & Reference Upgrades — 5–8x Tier-Paced Capybara Curve (50 Coins -> 1 Vg / 1e63).
 * - Each tier requires ~5-8 levels of the previous tier to unlock smoothly (buying only 1 of each won't cut it!).
 * - Low 1.15-1.18 cost multipliers keep multi-buying fast and rewarding.
 * - Every single upgrade adds BOTH Click Power AND passive CPS (baseClickPower > 0 && baseCps > 0).
 */
const BASE_SEEDS: Omit<MarvelUpgradeSeed, 'iconImage'>[] = [
  { id: 's3_web_cartridge', name: "Uncle Ben's Web-Shooters", description: 'With great power comes great clicking.', baseCost: 50, costMultiplier: 1.15, baseCps: 0.50, baseClickPower: 1, tier: 1 },
  { id: 's3_web_shooters_mk2', name: 'Queens Rooftop Backflip', description: 'Thwip! Classic Spider-Man swing across Queens.', baseCost: 841, costMultiplier: 1.15, baseCps: 6, baseClickPower: 13, tier: 1 },
  { id: 's3_arc_reactor', name: 'Box of Scraps Cave Reactor', description: 'Tony Stark built this in a cave! With a box of scraps!', baseCost: 14_158, costMultiplier: 1.15, baseCps: 67, baseClickPower: 149, tier: 1 },
  { id: 's3_repulsor_gloves', name: 'Monaco Suitcase Mark V', description: 'Briefcase armor snaps on in 3 seconds flat.', baseCost: 238_249, costMultiplier: 1.15, baseCps: 715, baseClickPower: 1_588, tier: 1 },
  { id: 's3_pym_vial', name: 'Baskin-Robbins Pym Heist', description: 'Baskin-Robbins always finds out. Shrink & click.', baseCost: 4.01e6, costMultiplier: 1.15, baseCps: 7_517, baseClickPower: 16_705, tier: 1 },
  { id: 's3_quantum_regulator', name: 'Quantum Van Tunnel', description: "Luis's van opens the subatomic Quantum Realm.", baseCost: 6.75e7, costMultiplier: 1.15, baseCps: 79_892, baseClickPower: 177_537, tier: 1 },
  { id: 's3_vibranium_shield', name: 'I Can Do This All Day', description: 'Brooklyn alley Cap stands back up with his shield.', baseCost: 1.14e9, costMultiplier: 1.15, baseCps: 982_433, baseClickPower: 2.18e6, tier: 2 },
  { id: 's3_magnetic_brace', name: 'Elevator Fight: Hail Hydra', description: 'Cap vs. STRIKE team in the Triskelion glass elevator.', baseCost: 1.91e10, costMultiplier: 1.15, baseCps: 1.26e7, baseClickPower: 2.81e7, tier: 2 },
  { id: 's3_hawkeye_quiver', name: 'Budapest Rooftop Quiver', description: "Hawkeye & Widow's legendary Budapest standoff.", baseCost: 3.21e11, costMultiplier: 1.15, baseCps: 1.72e8, baseClickPower: 3.83e8, tier: 2 },
  { id: 's3_ronin_edge', name: 'Ronin Tokyo Rain Duel', description: 'Neon-lit alley blade sweep in the pouring rain.', baseCost: 5.41e12, costMultiplier: 1.15, baseCps: 2.48e9, baseClickPower: 5.52e9, tier: 2 },
  { id: 's3_widow_bite', name: "Hallway Flip & Widow's Bite", description: 'Hammer Tech hallway takedown in full stride.', baseCost: 9.10e13, costMultiplier: 1.15, baseCps: 3.56e10, baseClickPower: 7.92e10, tier: 2 },
  { id: 's3_shield_batons', name: 'Red Room Skyfall', description: 'Free-falling between burning Helicarrier debris.', baseCost: 1.53e15, costMultiplier: 1.15, baseCps: 5.99e11, baseClickPower: 1.33e12, tier: 2 },
  { id: 's3_falcon_wings', name: 'On Your Left: Central Park', description: 'Sam laps Steve on the morning DC run.', baseCost: 2.58e16, costMultiplier: 1.15, baseCps: 1.01e13, baseClickPower: 2.24e13, tier: 3 },
  { id: 's3_redwing_swarm', name: 'Redwing Highway Ambush', description: 'Autobahn drone strike & wing-shield rescue.', baseCost: 4.34e17, costMultiplier: 1.15, baseCps: 1.70e14, baseClickPower: 3.77e14, tier: 3 },
  { id: 's3_gamma_beaker', name: "That's My Secret, Cap", description: 'Banner turns green and one-punches a Leviathan.', baseCost: 7.30e18, costMultiplier: 1.15, baseCps: 2.86e15, baseClickPower: 6.35e15, tier: 3 },
  { id: 's3_hulkbuster_core', name: 'Go To Sleep Hulkbuster', description: 'Veronica orbital drop: rapid piston-punch flurry.', baseCost: 1.23e20, costMultiplier: 1.15, baseCps: 4.81e16, baseClickPower: 1.07e17, tier: 3 },
  { id: 's3_kimoyo_beads', name: 'Busan Casino Chase', description: 'Shuri remote-drives the vibranium Lexus through Busan.', baseCost: 2.07e21, costMultiplier: 1.15, baseCps: 8.09e17, baseClickPower: 1.80e18, tier: 3 },
  { id: 's3_vibranium_weave', name: 'Wakanda Forever Kinetic Pulse', description: 'Purple vibranium shockwave blasts the whole field.', baseCost: 3.48e22, costMultiplier: 1.15, baseCps: 1.36e19, baseClickPower: 3.02e19, tier: 3 },
  { id: 's3_symbiote_jar', name: 'Bully Maguire Jazz Dance', description: 'Finger-guns down the Manhattan sidewalk. Pure power.', baseCost: 5.85e23, costMultiplier: 1.15, baseCps: 2.29e20, baseClickPower: 5.09e20, tier: 4 },
  { id: 's3_anti_venom_serum', name: 'We Are Venom Bodega', description: 'Symbiote tendrils grab snacks and double-click.', baseCost: 9.85e24, costMultiplier: 1.15, baseCps: 3.85e21, baseClickPower: 8.56e21, tier: 4 },
  { id: 's3_pumpkin_bomb', name: 'Godspeed, Spider-Man', description: 'Green Goblin glider swoops through the burning bridge.', baseCost: 1.66e26, costMultiplier: 1.15, baseCps: 6.48e22, baseClickPower: 1.44e23, tier: 4 },
  { id: 's3_goblin_glider', name: "I'm Something of a Scientist", description: 'Oscorp serum surge amps every click.', baseCost: 2.79e27, costMultiplier: 1.15, baseCps: 1.09e24, baseClickPower: 2.42e24, tier: 4 },
  { id: 's3_mjolnir', name: 'Bring Me Thanos! Wakanda Drop', description: 'Thor arrives in Wakanda with Stormbreaker & lightning!', baseCost: 4.69e28, costMultiplier: 1.15, baseCps: 1.84e25, baseClickPower: 4.08e25, tier: 4 },
  { id: 's3_odinforce_spark', name: 'Puny God! Stark Tower Slam', description: 'Hulk ragdolls Loki across the Stark penthouse floor.', baseCost: 7.90e29, costMultiplier: 1.15, baseCps: 3.09e26, baseClickPower: 6.87e26, tier: 4 },
  { id: 's3_loki_scepter', name: 'Get Help! Sakaar Elevator', description: 'Classic Asgardian brother decoy throw.', baseCost: 1.33e31, costMultiplier: 1.15, baseCps: 5.20e27, baseClickPower: 1.16e28, tier: 5 },
  { id: 's3_casket_winters', name: 'Glorious Purpose Throne', description: 'Loki steps onto the Yggdrasil Time-Tree throne.', baseCost: 2.24e32, costMultiplier: 1.15, baseCps: 8.75e28, baseClickPower: 1.94e29, tier: 5 },
  { id: 's3_sling_ring', name: "Wong's Tuna Melt Portal", description: "Sling Ring opens straight to Kamar-Taj's library.", baseCost: 3.76e33, costMultiplier: 1.15, baseCps: 1.47e30, baseClickPower: 3.27e30, tier: 5 },
  { id: 's3_mirror_shard', name: "Dormammu, I've Come to Bargain", description: 'Endless Time Stone loop forces Dormammu to quit.', baseCost: 6.33e34, costMultiplier: 1.15, baseCps: 2.48e31, baseClickPower: 5.51e31, tier: 5 },
  { id: 's3_adamantium_claws', name: 'Deadpool & Wolverine Odyssey', description: 'Maximum effort claws vs. indestructible adamantium!', baseCost: 1.07e36, costMultiplier: 1.15, baseCps: 4.17e32, baseClickPower: 9.27e32, tier: 5 },
  { id: 's3_cerebro_helm', name: 'Cerebro Mutant Lock-On', description: 'Professor X amplifies every mutant click on Earth.', baseCost: 1.79e37, costMultiplier: 1.15, baseCps: 7.02e33, baseClickPower: 1.56e34, tier: 5 },
  { id: 's3_chaos_hex', name: 'No More Mutants Hex', description: 'Wanda rewrites probability with a crimson whisper.', baseCost: 3.02e38, costMultiplier: 1.15, baseCps: 1.18e35, baseClickPower: 2.62e35, tier: 6 },
  { id: 's3_darkhold_page', name: 'Mount Wundagore Darkhold', description: 'Scarlet Witch dreamwalks across the multiverse.', baseCost: 5.08e39, costMultiplier: 1.15, baseCps: 1.99e36, baseClickPower: 4.41e36, tier: 6 },
  { id: 's3_mind_circuit', name: 'Vision Lifts Mjolnir', description: 'Synthezoid casually hands Thor his own hammer.', baseCost: 8.54e40, costMultiplier: 1.15, baseCps: 3.34e37, baseClickPower: 7.43e37, tier: 6 },
  { id: 's3_solar_gem', name: 'Sokovia Sky-City Lift', description: 'Vibranium spire lifts an entire city into the clouds.', baseCost: 1.44e42, costMultiplier: 1.15, baseCps: 5.63e38, baseClickPower: 1.25e39, tier: 6 },
  { id: 's3_stormbreaker', name: 'Cap Lifts Mjolnir!', description: '"I knew it!" Shield + thunder combo shockwave.', baseCost: 2.42e43, costMultiplier: 1.16, baseCps: 9.47e39, baseClickPower: 2.10e40, tier: 6 },
  { id: 's3_bifrost_conduit', name: 'Rainbow Bridge Immigrant Song', description: 'Bifrost explodes with lightning on the Asgard bridge.', baseCost: 4.07e44, costMultiplier: 1.16, baseCps: 1.59e41, baseClickPower: 3.54e41, tier: 6 },
  { id: 's3_chronopolis', name: 'TVA Time-Door Pruning', description: 'Reset charge wipes weak timelines for pure profit.', baseCost: 6.85e45, costMultiplier: 1.16, baseCps: 2.68e42, baseClickPower: 5.96e42, tier: 7 },
  { id: 's3_multiverse_loom', name: 'He Who Remains Citadel', description: 'End of Time desk where every timeline branches.', baseCost: 1.15e47, costMultiplier: 1.16, baseCps: 4.51e43, baseClickPower: 1.00e44, tier: 7 },
  { id: 's3_phoenix_crown', name: 'Dark Phoenix Orbit Flare', description: 'Jean Grey unleashes solar cosmic fire in orbit.', baseCost: 1.94e48, costMultiplier: 1.16, baseCps: 7.59e44, baseClickPower: 1.69e45, tier: 7 },
  { id: 's3_starforce_nova', name: 'Higher, Further, Faster Binary', description: 'Captain Marvel blasts straight through the Sanctuary II.', baseCost: 3.26e49, costMultiplier: 1.16, baseCps: 1.28e46, baseClickPower: 2.84e46, tier: 7 },
  { id: 's3_necrosword', name: "Gorr's Shadow Realm Altar", description: 'All-Black Necrosword cleaves monochrome space.', baseCost: 5.49e50, costMultiplier: 1.16, baseCps: 2.15e47, baseClickPower: 4.78e47, tier: 7 },
  { id: 's3_celestial_forge', name: 'Knowhere Collector Blast', description: 'Power Stone detonation inside the Celestial skull.', baseCost: 9.24e51, costMultiplier: 1.16, baseCps: 3.62e48, baseClickPower: 8.04e48, tier: 7 },
  { id: 's3_tesseract', name: 'Red Skull & the Tesseract', description: '1940s Hydra cube opens a cosmic wormhole.', baseCost: 1.56e53, costMultiplier: 1.16, baseCps: 6.09e49, baseClickPower: 1.35e50, tier: 8 },
  { id: 's3_aether_conduit', name: "Hela: \"Fake!\" Vault Gauntlet", description: 'Hela knocks the Odin vault replica off its stand.', baseCost: 2.62e54, costMultiplier: 1.16, baseCps: 1.02e51, baseClickPower: 2.28e51, tier: 8 },
  { id: 's3_agamotto', name: 'Vormir Soul Sacrifice', description: 'Soul Stone cliff at the center of celestial existence.', baseCost: 4.40e55, costMultiplier: 1.16, baseCps: 1.72e52, baseClickPower: 3.83e52, tier: 8 },
  { id: 's3_living_tribunal', name: 'Battle of Earth: Assemble!', description: '"On your left" — every portal opens for the final charge!', baseCost: 7.41e56, costMultiplier: 1.16, baseCps: 2.90e53, baseClickPower: 6.44e53, tier: 8 },
  { id: 's3_watcher_oath', name: 'Shawarma After-Battle Diner', description: 'Exhausted Avengers eating shawarma in the quiet ruins.', baseCost: 1.25e58, costMultiplier: 1.16, baseCps: 4.88e54, baseClickPower: 1.08e55, tier: 8 },
  { id: 's3_eternity_heart', name: 'Watcher Breaks His Oath', description: 'Uatu shatters the multiverse glass to intervene.', baseCost: 2.10e59, costMultiplier: 1.16, baseCps: 8.21e55, baseClickPower: 1.82e56, tier: 8 },
  { id: 's3_infinity_well', name: "Eternity's Wish Altar", description: 'Cosmic entity grants one ultimate click wish.', baseCost: 3.53e60, costMultiplier: 1.16, baseCps: 1.38e57, baseClickPower: 3.07e57, tier: 8 },
  { id: 's3_galacta_core', name: 'Galactus Consumes a World', description: 'Silver Surfer heralds planet-scale Power Cosmic.', baseCost: 5.94e61, costMultiplier: 1.16, baseCps: 2.33e58, baseClickPower: 5.17e58, tier: 8 },
  { id: 's3_one_above_all', name: 'And I... Am... Iron Man! Snap', description: '1 Vg Finale — all 6 Stones snap across infinity!', baseCost: 1.0e63, costMultiplier: 1.16, baseCps: 3.91e59, baseClickPower: 8.70e59, tier: 8 },
];

export const SEASON_3_UPGRADES: Upgrade[] = BASE_SEEDS.map((s, idx) => ({
  id: s.id,
  name: s.name,
  description: s.description,
  icon: s.id,
  iconImage: `./images/s3/upgrades/s3_u_${String(idx + 1).padStart(2, '0')}.png`,
  baseCost: s.baseCost,
  costMultiplier: s.costMultiplier,
  baseCps: s.baseCps,
  baseClickPower: s.baseClickPower,
  tier: s.tier,
}));
