import React, { useState, useEffect, useRef } from 'react';
import { GameState } from '../types/game';
import { soundManager } from '../audio/soundManager';
import { particleEngine } from './ParticleCanvas';
import { formatCoins } from '../utils/formatters';
import { BALANCE } from '../data/balance';
import { calculateCPS, calculateClickPower } from '../utils/calculations';
import { isSeasonTwoOrLater } from '../data/skins';
import { MATTHEW_VAULT_SKINS } from '../data/season2Skins';
import { rollChestLoot } from '../data/petsAndEggs';

interface GoldenMatthewEventProps {
  state: GameState;
  setState: React.Dispatch<React.SetStateAction<GameState>>;
  onSpawnBonus: (text: string) => void;
  forceSpawnCounter?: number;
  isPaused?: boolean;
}

export const GoldenMatthewEvent: React.FC<GoldenMatthewEventProps> = ({
  state,
  setState,
  onSpawnBonus,
  forceSpawnCounter = 0,
  isPaused = false,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [position, setPosition] = useState({ x: 10, y: 30 });
  const [direction, setDirection] = useState<'left' | 'right'>('right');

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const directionRef = useRef(direction);
  directionRef.current = direction;
  const posRef = useRef(position);
  posRef.current = position;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const isSeason2Ref = useRef(isSeasonTwoOrLater(state.currentSeasonId));
  isSeason2Ref.current = isSeasonTwoOrLater(state.currentSeasonId);

  useEffect(() => {
    if (forceSpawnCounter <= 0 || isPausedRef.current) return;
    const startLeft = Math.random() > 0.5;
    const dir = startLeft ? 'right' : 'left';
    const startPos = {
      x: startLeft ? 120 : Math.max(220, window.innerWidth - 280),
      y: 140 + Math.random() * Math.max(120, window.innerHeight - 360),
    };
    directionRef.current = dir;
    posRef.current = startPos;
    setDirection(dir);
    setPosition(startPos);
    setIsActive(true);
    soundManager.playGoldenSpawn();
  }, [forceSpawnCounter]);

  // Interval timer for spawning Golden/Flying Matthew cleanly without mid-flight kill timers
  useEffect(() => {
    if (isActive || isPaused) return;
    const spawnDelay = isSeason2Ref.current
      ? 15000 + Math.random() * 9000
      : Math.max(
          16000,
          BALANCE.goldenEvent.baseDelayMs + (Math.random() - 0.5) * BALANCE.goldenEvent.delayVarianceMs
        );

    const timer = window.setTimeout(() => {
      if (isPausedRef.current) return;
      const startLeft = Math.random() > 0.5;
      const dir = startLeft ? 'right' : 'left';
      const startPos = {
        x: startLeft ? -70 : window.innerWidth + 70,
        y: Math.max(95, Math.min(window.innerHeight - 190, 100 + Math.random() * Math.max(120, window.innerHeight - 310))),
      };
      directionRef.current = dir;
      posRef.current = startPos;
      setDirection(dir);
      setPosition(startPos);
      setIsActive(true);
      soundManager.playGoldenSpawn();
    }, spawnDelay);

    return () => window.clearTimeout(timer);
  }, [isActive, isPaused]);

  // Smooth edge-to-edge flight animation (despawns ONLY when exiting opposite screen edge or caught)
  useEffect(() => {
    if (!isActive || isPaused) return;

    let lastTickMs = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.08, (now - lastTickMs) / 1000);
      lastTickMs = now;

      const cur = posRef.current;
      const speedPxPerSec = 165;
      const newX = cur.x + (directionRef.current === 'right' ? speedPxPerSec : -speedPxPerSec) * dt;
      const minY = 85;
      const maxY = Math.max(180, window.innerHeight - 150);
      const waveY = cur.y + Math.sin(newX * 0.03) * 1.8;
      const newY = Math.max(minY, Math.min(maxY, waveY));

      if (
        (directionRef.current === 'right' && newX > window.innerWidth + 95) ||
        (directionRef.current === 'left' && newX < -95)
      ) {
        setIsActive(false);
        return;
      }

      const nextPos = { x: newX, y: newY };
      posRef.current = nextPos;
      setPosition(nextPos);
    }, 22);

    return () => window.clearInterval(interval);
  }, [isActive, isPaused]);

  const handleCatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsActive(false);

    soundManager.playCrit();
    particleEngine.emitClick(e.clientX, e.clientY, true, 25);

    // Balanced Golden Matthew reward scaling cleanly with Click Power & CPS (no runaway lifetime feedback loop)
    const cps = calculateCPS(state);
    const { totalPower } = calculateClickPower(state);
    const productionBounty = Math.floor(cps * 35 + totalPower * 80);
    const bounty = Math.max(BALANCE.goldenEvent.minBountyFloor, productionBounty);

    if (isSeasonTwoOrLater(state.currentSeasonId)) {
      setState((prev) => ({
        ...prev,
        coins: prev.coins + bounty,
        lifetimeCoins: prev.lifetimeCoins + bounty,
        seasonalScore: prev.seasonalScore + bounty,
        goldenMatthewsClicked: prev.goldenMatthewsClicked + 1,
      }));
      onSpawnBonus(`GOLDEN MATTHEW! +${formatCoins(bounty)} Coins!`);
      return;
    }

    setState((prev) => ({
      ...prev,
      coins: prev.coins + bounty,
      lifetimeCoins: prev.lifetimeCoins + bounty,
      seasonalScore: prev.seasonalScore + bounty,
      goldenMatthewsClicked: prev.goldenMatthewsClicked + 1,
    }));
    onSpawnBonus(`🌟 GOLDEN MATTHEW! +${formatCoins(bounty)} COINS! 🌟`);
  };

  if (!isActive || isPaused) return null;

  return (
    <div
      onClick={handleCatch}
      className="fixed z-50 cursor-pointer select-none transition-transform hover:scale-110 active:scale-95 animate-pulse"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Glowing Aura Ring */}
        <div
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-yellow-500 via-amber-300 to-yellow-100 blur-md opacity-80 animate-spin"
          style={{ animationDuration: '4s' }}
        />
        <img
          src="./images/skins/classic_matthew.png"
          alt="Rare Matthew"
          className="relative w-20 h-20 object-contain drop-shadow-[0_0_16px_rgba(255,215,0,0.95)]"
        />
      </div>
    </div>
  );
};
