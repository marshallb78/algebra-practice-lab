import React, { useState, useEffect, useRef } from 'react';
import { GameState } from '../types/game';
import { soundManager } from '../audio/soundManager';
import { particleEngine } from './ParticleCanvas';
import { formatCoins } from '../utils/formatters';
import { BALANCE } from '../data/balance';
import { calculateCPS, calculateClickPower, clampFiniteCoinAmount, MAX_SAFE_SEASON_COINS } from '../utils/calculations';
import { isSeasonTwoOrLater } from '../data/skins';
import { MATTHEW_VAULT_SKINS } from '../data/season2Skins';
import { rollChestLoot } from '../data/petsAndEggs';

interface GoldenSwarmItem {
  id: number;
  x: number;
  y: number;
  dir: 'left' | 'right';
  speed: number;
  phase: number;
  spawnedAt: number;
}

interface GoldenMatthewEventProps {
  state: GameState;
  setState: React.Dispatch<React.SetStateAction<GameState>>;
  onSpawnBonus: (text: string) => void;
  forceSpawnCounter?: number;
  swarmTrigger?: { id: string; count: number } | null;
  isPaused?: boolean;
}

export const GoldenMatthewEvent: React.FC<GoldenMatthewEventProps> = ({
  state,
  setState,
  onSpawnBonus,
  forceSpawnCounter = 0,
  swarmTrigger = null,
  isPaused = false,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [position, setPosition] = useState({ x: 10, y: 30 });
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [swarmItems, setSwarmItems] = useState<GoldenSwarmItem[]>([]);

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const directionRef = useRef(direction);
  directionRef.current = direction;
  const posRef = useRef(position);
  posRef.current = position;
  const swarmItemsRef = useRef(swarmItems);
  swarmItemsRef.current = swarmItems;
  const lastSwarmTriggerIdRef = useRef<string | null>(null);
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

  // Dev-triggered server-wide Flying Golden Matthew Swarm
  useEffect(() => {
    if (!swarmTrigger?.id || lastSwarmTriggerIdRef.current === swarmTrigger.id) return;
    lastSwarmTriggerIdRef.current = swarmTrigger.id;

    const total = Math.min(24, Math.max(8, swarmTrigger.count || 18));
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
  }, [swarmTrigger?.id, swarmTrigger?.count]);

  // Smooth edge-to-edge flight animation (despawns ONLY when exiting opposite screen edge or caught)
  const hasSwarmActive = swarmItems.length > 0;
  useEffect(() => {
    if ((!isActive && !hasSwarmActive) || isPaused) return;

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
    }, 22);

    return () => window.clearInterval(interval);
  }, [isActive, hasSwarmActive, isPaused]);

  const computeGoldenBounty = (): number => {
    const cps = calculateCPS(state);
    const { totalPower } = calculateClickPower(state);
    const productionBounty = clampFiniteCoinAmount(
      Math.floor(cps * 35 + totalPower * 80),
      MAX_SAFE_SEASON_COINS
    );
    return Math.max(BALANCE.goldenEvent.minBountyFloor, productionBounty);
  };

  const handleCatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsActive(false);

    soundManager.playCrit();
    particleEngine.emitClick(e.clientX, e.clientY, true, 25);

    // Balanced Golden Matthew reward scaling cleanly with Click Power & CPS (no runaway lifetime feedback loop)
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
    onSpawnBonus(
      isSeasonTwoOrLater(state.currentSeasonId)
        ? `GOLDEN MATTHEW! +${formatCoins(bounty)} Coins!`
        : `🌟 GOLDEN MATTHEW! +${formatCoins(bounty)} COINS! 🌟`
    );
  };

  const handleCatchSwarmItem = (itemId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = swarmItemsRef.current.filter((it) => it.id !== itemId);
    swarmItemsRef.current = filtered;
    setSwarmItems(filtered);

    soundManager.playCrit();
    particleEngine.emitClick(e.clientX, e.clientY, true, 20);

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
    onSpawnBonus(`🌟 GOLDEN SWARM CATCH! +${formatCoins(bounty)} Coins & +1 💎!`);
  };

  if ((!isActive && swarmItems.length === 0) || isPaused) return null;

  return (
    <>
      {isActive && (
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
      )}

      {swarmItems.map((item) => (
        <div
          key={item.id}
          onClick={(e) => handleCatchSwarmItem(item.id, e)}
          className="fixed z-50 cursor-pointer select-none transition-transform hover:scale-115 active:scale-95"
          style={{
            left: `${item.x}px`,
            top: `${item.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="relative w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-yellow-500 via-amber-300 to-yellow-100 blur-sm opacity-80" />
            <img
              src="./images/skins/classic_matthew.png"
              alt="Flying Golden Matthew"
              className="relative w-16 h-16 object-contain drop-shadow-[0_0_14px_rgba(255,215,0,0.95)]"
            />
          </div>
        </div>
      ))}
    </>
  );
};
