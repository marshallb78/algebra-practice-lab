import React, { useState, useEffect, useRef } from 'react';
import { GameState } from '../types/game';
import { soundManager } from '../audio/soundManager';
import { particleEngine } from './ParticleCanvas';
import { formatCoins } from '../utils/formatters';
import { BALANCE } from '../data/balance';
import {
  calculateCPS,
  calculateClickPower,
  clampFiniteCoinAmount,
  MAX_SAFE_SEASON_COINS,
} from '../utils/calculations';
import { isSeasonTwoOrLater } from '../data/skins';

interface GoldenSwarmItem {
  id: number;
  x: number;
  y: number;
  dir: 'left' | 'right';
  speed: number;
  phase: number;
  spawnedAt: number;
}

interface FallingChestItem {
  id: number;
  x: number;
  y: number;
  vy: number;
  swayPhase: number;
}

interface GoldenMatthewEventProps {
  state: GameState;
  setState: React.Dispatch<React.SetStateAction<GameState>>;
  onSpawnBonus: (text: string) => void;
  onCatchChest?: () => void;
  forceSpawnCounter?: number;
  forceSpawnChestCounter?: number;
  swarmTrigger?: { id: string; count: number } | null;
  isPaused?: boolean;
}

export const GoldenMatthewEvent: React.FC<GoldenMatthewEventProps> = ({
  state,
  setState,
  onSpawnBonus,
  onCatchChest,
  forceSpawnCounter = 0,
  forceSpawnChestCounter = 0,
  swarmTrigger = null,
  isPaused = false,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [position, setPosition] = useState({ x: 10, y: 30 });
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [swarmItems, setSwarmItems] = useState<GoldenSwarmItem[]>([]);
  const [fallingChests, setFallingChests] = useState<FallingChestItem[]>([]);

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const directionRef = useRef(direction);
  directionRef.current = direction;
  const posRef = useRef(position);
  posRef.current = position;
  const swarmItemsRef = useRef(swarmItems);
  swarmItemsRef.current = swarmItems;
  const chestsRef = useRef(fallingChests);
  chestsRef.current = fallingChests;
  const lastSwarmTriggerIdRef = useRef<string | null>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const isSeason2Ref = useRef(isSeasonTwoOrLater(state.currentSeasonId));
  isSeason2Ref.current = isSeasonTwoOrLater(state.currentSeasonId);

  const spawnOneFallingChest = () => {
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const item: FallingChestItem = {
      id: Date.now() + Math.random(),
      x: 80 + Math.random() * Math.max(200, winW - 200),
      y: -60,
      vy: 72 + Math.random() * 28,
      swayPhase: Math.random() * Math.PI * 2,
    };
    const next = [...chestsRef.current.slice(-2), item];
    chestsRef.current = next;
    setFallingChests(next);
    soundManager.playGoldenSpawn();
  };

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

  useEffect(() => {
    if (forceSpawnChestCounter <= 0 || isPausedRef.current) return;
    spawnOneFallingChest();
  }, [forceSpawnChestCounter]);

  // Periodic natural Falling Marvel Mystery Chests (slightly rarer: ~38-62s)
  useEffect(() => {
    if (!isSeason2Ref.current || isPaused || fallingChests.length >= 2) return;
    const delay = 38000 + Math.random() * 24000;
    const t = window.setTimeout(() => {
      if (!isPausedRef.current && isSeason2Ref.current) {
        spawnOneFallingChest();
      }
    }, delay);
    return () => window.clearTimeout(t);
  }, [isPaused, fallingChests.length]);

  // Interval timer for spawning Golden/Flying Matthew (slightly less frequent)
  useEffect(() => {
    if (isActive || isPaused) return;
    const spawnDelay = isSeason2Ref.current
      ? 22000 + Math.random() * 14000
      : Math.max(
          20000,
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

  // Dev-triggered server-wide Flying Golden Matthew Swarm
  useEffect(() => {
    if (!swarmTrigger?.id || lastSwarmTriggerIdRef.current === swarmTrigger.id) return;
    if (isPaused) return;
    lastSwarmTriggerIdRef.current = swarmTrigger.id;

    const total = Math.min(18, Math.max(6, swarmTrigger.count || 14));
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 720;
    const xSpan = Math.max(200, winW - 140);
    const ySpan = Math.max(140, winH - 265);
    const now = Date.now();

    const spawned: GoldenSwarmItem[] = Array.from({ length: total }).map((_, idx) => ({
      id: now + idx + Math.random(),
      x: 60 + Math.random() * xSpan,
      y: 95 + Math.random() * ySpan,
      dir: idx % 2 === 0 ? 'right' : 'left',
      speed: 145 + Math.random() * 75,
      phase: Math.random() * Math.PI * 2,
      spawnedAt: now,
    }));

    swarmItemsRef.current = spawned;
    setSwarmItems(spawned);
    soundManager.playGoldenSpawn();
  }, [swarmTrigger?.id, swarmTrigger?.count, isPaused]);

  const hasSwarmActive = swarmItems.length > 0;
  const hasChestsFalling = fallingChests.length > 0;
  useEffect(() => {
    if ((!isActive && !hasSwarmActive && !hasChestsFalling) || isPaused) return;

    let lastTickMs = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      const wallNow = Date.now();
      const dt = Math.min(0.08, (now - lastTickMs) / 1000);
      lastTickMs = now;
      const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 720;
      const minY = 85;
      const maxY = Math.max(180, winH - 150);

      if (isActiveRef.current) {
        const cur = posRef.current;
        const speedPxPerSec = 165;
        const newX =
          cur.x + (directionRef.current === 'right' ? speedPxPerSec : -speedPxPerSec) * dt;
        const waveY = cur.y + Math.sin(newX * 0.03) * 1.8;
        const newY = Math.max(minY, Math.min(maxY, waveY));

        if (
          (directionRef.current === 'right' && newX > winW + 95) ||
          (directionRef.current === 'left' && newX < -95)
        ) {
          setIsActive(false);
        } else {
          const nextPos = { x: newX, y: newY };
          posRef.current = nextPos;
          setPosition(nextPos);
        }
      }

      if (chestsRef.current.length > 0) {
        const remaining: FallingChestItem[] = [];
        for (const ch of chestsRef.current) {
          const nextY = ch.y + ch.vy * dt;
          if (nextY > winH + 90) continue;
          const nextX = Math.max(55, Math.min(winW - 55, ch.x + Math.sin(nextY * 0.02 + ch.swayPhase) * 0.7));
          remaining.push({ ...ch, x: nextX, y: nextY });
        }
        chestsRef.current = remaining;
        setFallingChests(remaining);
      }

      if (swarmItemsRef.current.length > 0) {
        const nextSwarm: GoldenSwarmItem[] = [];
        for (const item of swarmItemsRef.current) {
          const elapsed = wallNow - item.spawnedAt;
          if (elapsed > 22000) continue;

          let nextDir = item.dir;
          let nextX = item.x + (item.dir === 'right' ? item.speed : -item.speed) * dt;
          if (elapsed < 18000) {
            if (nextDir === 'right' && nextX > winW - 55) {
              nextDir = 'left';
              nextX = winW - 55;
            } else if (nextDir === 'left' && nextX < 55) {
              nextDir = 'right';
              nextX = 55;
            }
          } else if (nextX > winW + 95 || nextX < -95) {
            continue;
          }

          const waveY = item.y + Math.sin(nextX * 0.025 + item.phase) * 2.1;
          const nextY = Math.max(minY, Math.min(maxY, waveY));
          nextSwarm.push({ ...item, x: nextX, y: nextY, dir: nextDir });
        }
        swarmItemsRef.current = nextSwarm;
        setSwarmItems(nextSwarm);
      }
    }, 30);

    return () => window.clearInterval(interval);
  }, [isActive, hasSwarmActive, hasChestsFalling, isPaused]);

  const computeGoldenBounty = (): number => {
    const cps = calculateCPS(state);
    const { totalPower } = calculateClickPower(state);
    const productionBounty = clampFiniteCoinAmount(
      Math.floor(cps * 24 + totalPower * 55),
      MAX_SAFE_SEASON_COINS
    );
    return Math.max(BALANCE.goldenEvent.minBountyFloor, productionBounty);
  };

  const handleCatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsActive(false);

    soundManager.playCrit();
    particleEngine.emitClick(e.clientX, e.clientY, true, 10);

    const bounty = computeGoldenBounty();
    setState((prev) => ({
      ...prev,
      coins: clampFiniteCoinAmount((prev.coins || 0) + bounty, MAX_SAFE_SEASON_COINS),
      lifetimeCoins: clampFiniteCoinAmount(
        (prev.lifetimeCoins || 0) + bounty,
        MAX_SAFE_SEASON_COINS
      ),
      seasonalScore: clampFiniteCoinAmount(
        (prev.seasonalScore || 0) + bounty,
        MAX_SAFE_SEASON_COINS
      ),
      goldenMatthewsClicked: prev.goldenMatthewsClicked + 1,
    }));
    onSpawnBonus(`GOLDEN MATTHEW! +${formatCoins(bounty)} Coins!`);
  };

  const handleCatchChestItem = (chestId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = chestsRef.current.filter((c) => c.id !== chestId);
    chestsRef.current = filtered;
    setFallingChests(filtered);
    soundManager.playChestOpen();
    onCatchChest?.();
  };

  const handleCatchSwarmItem = (itemId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = swarmItemsRef.current.filter((it) => it.id !== itemId);
    swarmItemsRef.current = filtered;
    setSwarmItems(filtered);

    soundManager.playCrit();
    particleEngine.emitClick(e.clientX, e.clientY, true, 8);

    const bounty = computeGoldenBounty();
    setState((prev) => ({
      ...prev,
      coins: clampFiniteCoinAmount((prev.coins || 0) + bounty, MAX_SAFE_SEASON_COINS),
      lifetimeCoins: clampFiniteCoinAmount(
        (prev.lifetimeCoins || 0) + bounty,
        MAX_SAFE_SEASON_COINS
      ),
      seasonalScore: clampFiniteCoinAmount(
        (prev.seasonalScore || 0) + bounty,
        MAX_SAFE_SEASON_COINS
      ),
      gems: (prev.gems || 0) + 1,
      lifetimeGems: (prev.lifetimeGems || 0) + 1,
      goldenMatthewsClicked: prev.goldenMatthewsClicked + 1,
    }));
    onSpawnBonus(`GOLDEN SWARM! +${formatCoins(bounty)} Coins & +1 Gem!`);
  };

  if ((!isActive && swarmItems.length === 0 && fallingChests.length === 0) || isPaused) {
    return null;
  }

  return (
    <>
      {isActive && (
        <div
          onClick={handleCatch}
          className="fixed z-50 cursor-pointer select-none transition-transform hover:scale-110 active:scale-95"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="relative w-24 h-24 flex items-center justify-center">
            <img
              src="./images/skins/classic_matthew.png"
              alt="Golden Matthew"
              className="relative w-20 h-20 object-contain drop-shadow-[0_0_16px_rgba(255,215,0,0.95)]"
            />
          </div>
        </div>
      )}

      {/* FALLING MARVEL MYSTERY CHESTS */}
      {fallingChests.map((ch) => (
        <button
          key={ch.id}
          type="button"
          onClick={(e) => handleCatchChestItem(ch.id, e)}
          className="fixed z-50 cursor-pointer select-none transition-transform hover:scale-115 active:scale-90 bg-transparent border-0 p-0"
          style={{
            left: `${ch.x}px`,
            top: `${ch.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
          title="Click to open Falling Marvel Chest!"
        >
          <div className="relative w-32 h-36 flex flex-col items-center justify-center">
            <img
              src="./images/s3/chest/marvel_chest_closed.png"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = './images/s2/chest/pixel_closed.png';
              }}
              alt="Falling Marvel Chest"
              className="w-28 h-28 sm:w-32 sm:h-32 object-contain drop-shadow-[0_0_22px_rgba(251,191,36,0.95)]"
            />
            <span className="px-2.5 py-0.5 -mt-1.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase shadow">
              CHEST!
            </span>
          </div>
        </button>
      ))}

      {swarmItems.map((item) => (
        <div
          key={item.id}
          onClick={(e) => handleCatchSwarmItem(item.id, e)}
          className="fixed z-50 cursor-pointer select-none transition-transform hover:scale-110 active:scale-95"
          style={{
            left: `${item.x}px`,
            top: `${item.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <img
            src="./images/skins/classic_matthew.png"
            alt="Flying Golden Matthew"
            className="w-16 h-16 object-contain drop-shadow-[0_0_14px_rgba(255,215,0,0.95)]"
          />
        </div>
      ))}
    </>
  );
};
