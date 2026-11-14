import React from 'react';

interface CosmeticOverlayProps {
  equippedCosmetics?: {
    hat: string | null;
    glasses: string | null;
  };
}

/**
 * Renders equipped Glasses cosmetic overlay anchored over Matthew's eyes (hats removed per S2 overhaul).
 */
export const CosmeticOverlay: React.FC<CosmeticOverlayProps> = ({ equippedCosmetics }) => {
  const glasses = equippedCosmetics?.glasses;
  if (!glasses) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-visible">
      {glasses === 'glasses_shades' && (
        <svg viewBox="0 0 120 40" className="absolute top-[30%] left-[21%] w-[58%] drop-shadow-md">
          <rect x="6" y="8" width="46" height="22" rx="4" fill="#020617" stroke="#38bdf8" strokeWidth="2.5" />
          <rect x="68" y="8" width="46" height="22" rx="4" fill="#020617" stroke="#38bdf8" strokeWidth="2.5" />
          <rect x="52" y="13" width="16" height="6" fill="#0f172a" />
          <path d="M12 12 L24 24 M74 12 L86 24" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
        </svg>
      )}

      {glasses === 'glasses_ice_visor' && (
        <svg viewBox="0 0 120 45" className="absolute top-[27%] left-[19%] w-[62%] drop-shadow-lg">
          <polygon points="8,10 112,10 104,34 66,30 60,22 54,30 16,34" fill="rgba(34,211,238,0.58)" stroke="#a5f3fc" strokeWidth="3" />
          <path d="M20 18 L48 18" stroke="#ecfeff" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}

      {glasses === 'glasses_star' && (
        <svg viewBox="0 0 120 45" className="absolute top-[28%] left-[20%] w-[60%] drop-shadow-[0_0_8px_rgba(244,114,182,0.85)]">
          <polygon points="30,3 37,16 51,18 41,28 43,42 30,35 17,42 19,28 9,18 23,16" fill="#ec4899" stroke="#fbcfe8" strokeWidth="2.5" />
          <polygon points="90,3 97,16 111,18 101,28 103,42 90,35 77,42 79,28 69,18 83,16" fill="#ec4899" stroke="#fbcfe8" strokeWidth="2.5" />
          <rect x="46" y="18" width="28" height="5" fill="#f9a8d4" />
        </svg>
      )}

      {glasses === 'glasses_laser' && (
        <svg viewBox="0 0 120 40" className="absolute top-[29%] left-[19%] w-[62%] drop-shadow-[0_0_12px_rgba(244,63,94,0.9)]">
          <rect x="6" y="8" width="46" height="20" rx="5" fill="#1f2937" stroke="#f43f5e" strokeWidth="3" />
          <rect x="68" y="8" width="46" height="20" rx="5" fill="#1f2937" stroke="#f43f5e" strokeWidth="3" />
          <circle cx="29" cy="18" r="5" fill="#fb7185" />
          <circle cx="91" cy="18" r="5" fill="#fb7185" />
          <rect x="52" y="14" width="16" height="6" fill="#f43f5e" />
        </svg>
      )}
    </div>
  );
};
