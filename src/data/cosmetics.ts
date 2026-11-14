import { CosmeticItem } from '../types/game';

/**
 * Glasses Cosmetics (Hats removed per Season 2 overhaul — persists across seasons).
 */
export const COSMETIC_ITEMS: CosmeticItem[] = [
  {
    id: 'glasses_shades',
    name: 'Deal-With-It Shades',
    slot: 'glasses',
    rarity: 'Uncommon',
    description: 'Pixel sunglasses radiating pure Matthew confidence.',
    gemCost: 14,
    previewColor: '#020617',
  },
  {
    id: 'glasses_ice_visor',
    name: 'Cryo Cyber Visor',
    slot: 'glasses',
    rarity: 'Epic',
    description: 'Translucent sky-blue glacier scanner HUD visor.',
    gemCost: 30,
    previewColor: '#22d3ee',
  },
  {
    id: 'glasses_star',
    name: 'Superstar Shades',
    slot: 'glasses',
    rarity: 'Rare',
    description: 'Oversized pink star-shaped party frames.',
    gemCost: 22,
    previewColor: '#f472b6',
  },
  {
    id: 'glasses_laser',
    name: 'Laser Eye Specs',
    slot: 'glasses',
    rarity: 'Mythic',
    description: 'Glowing crimson target-lock optics built for Storm events.',
    gemCost: 48,
    previewColor: '#f43f5e',
  },
];

export function getCosmeticById(id: string | null | undefined): CosmeticItem | undefined {
  if (!id) return undefined;
  return COSMETIC_ITEMS.find((c) => c.id === id);
}
