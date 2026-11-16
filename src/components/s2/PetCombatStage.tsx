import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Gem, ShieldAlert, Skull, Sparkles, Swords, X } from 'lucide-react';
import { EggRarity, PetInstance } from '../../types/game';
import { getEggDefinition, getPetCombatDps } from '../../data/petsAndEggs';
import { RiggedZombie2D } from './RiggedZombie2D';
import { EggBadgeVisual, PetSprite2D } from './PetSprite2D';
import { formatCoins } from '../../utils/formatters';

export interface SnowLootDrop {
  id: number;
  kind: 'egg' | 'chest' | 'gems' | 'coins';
  xPercent: number;
  yOffsetPx: number;
  eggRarity?: EggRarity;
  gemAmount?: number;
  coinAmount?: number;
  createdAt: number;
}

interface ZombieTierConfig {
  tier: number;
  title: string;
  variant: 'normal' | 'frost' | 'boss';
  size: number;
  speedPerTick: number;
  hpFactor: number;
  minHp: number;
  minEggTierIdx: number;
  eggChance: number;
  chestChance: number;
  gemChance: number;
  gemRange: [number, number];
  coinMult: number;
  tintBadge: string;
}

const ZOMBIE_TIERS: ZombieTierConfig[] = [
  {
    tier: 0,
    title: 'Frost Walker',
    variant: 'normal',
    size: 108,
    speedPerTick: 0.25,
    hpFactor: 5.5,
    minHp: 28,
    minEggTierIdx: 0,
    eggChance: 0.07,
    chestChance: 0.07,
    gemChance: 0.18,
    gemRange: [2, 3],
    coinMult: 1,
    tintBadge: 'bg-slate-900/90 text-slate-200 border-slate-400/50',
  },
  {
    tier: 1,
    title: 'Ice Stalker',
    variant: 'frost',
    size: 118,
    speedPerTick: 0.30,
    hpFactor: 6.8,
    minHp: 85,
    minEggTierIdx: 1,
    eggChance: 0.08,
    chestChance: 0.08,
    gemChance: 0.20,
    gemRange: [3, 4],
    coinMult: 1.6,
    tintBadge: 'bg-cyan-950/90 text-cyan-200 border-cyan-400/60',
  },
  {
    tier: 2,
    title: 'Armored Draugr',
    variant: 'frost',
    size: 130,
    speedPerTick: 0.32,
    hpFactor: 8.2,
    minHp: 240,
    minEggTierIdx: 1,
    eggChance: 0.10,
    chestChance: 0.11,
    gemChance: 0.22,
    gemRange: [4, 6],
    coinMult: 2.5,
    tintBadge: 'bg-purple-950/90 text-purple-200 border-purple-400/60',
  },
  {
    tier: 3,
    title: 'Blizzard Brute',
    variant: 'boss',
    size: 144,
    speedPerTick: 0.34,
    hpFactor: 9.2,
    minHp: 680,
    minEggTierIdx: 2,
    eggChance: 0.12,
    chestChance: 0.13,
    gemChance: 0.24,
    gemRange: [5, 8],
    coinMult: 3.8,
    tintBadge: 'bg-amber-950/90 text-amber-200 border-amber-400/70',
  },
  {
    tier: 4,
    title: 'Cryo Titan',
    variant: 'boss',
    size: 160,
    speedPerTick: 0.34,
    hpFactor: 10.2,
    minHp: 1850,
    minEggTierIdx: 3,
    eggChance: 0.14,
    chestChance: 0.16,
    gemChance: 0.26,
    gemRange: [7, 11],
    coinMult: 6,
    tintBadge: 'bg-rose-950/95 text-rose-200 border-rose-400/80',
  },
];

function selectZombieTier(totalPetDps: number, raidOn: boolean): ZombieTierConfig {
  let maxUnlocked = 0;
  if (totalPetDps >= 180) maxUnlocked = 4;
  else if (totalPetDps >= 75) maxUnlocked = 3;
  else if (totalPetDps >= 28) maxUnlocked = 2;
  else if (totalPetDps >= 10) maxUnlocked = 1;

  if (raidOn && maxUnlocked < 4 && Math.random() < 0.45) {
    maxUnlocked += 1;
  }

  if (maxUnlocked === 0) return ZOMBIE_TIERS[0];
  const roll = Math.random();
  const chosenTier = roll < 0.72 ? maxUnlocked : Math.max(0, maxUnlocked - 1);
  return ZOMBIE_TIERS[chosenTier];
}

function clampGroundDropX(xPct: number): number {
  const clamped = Math.max(8, Math.min(92, xPct));
  // Keep drops outside Matthew's central silhouette so both sides stay clear & clickable
  if (clamped >= 35 && clamped <= 50) return 30;
  if (clamped > 50 && clamped <= 65) return 70;
  return clamped;
}

interface ActiveZombie {
  id: number;
  xPercent: number;
  fromLeft: boolean;
  speedPerTick: number;
  hp: number;
  maxHp: number;
  tierCfg: ZombieTierConfig;
  pose: 'walk' | 'lunge' | 'hit' | 'ko';
  attackCooldownMs: number;
  hitFlashUntil: number;
  stepAccumulator: number;
}

interface ActivePetMotion {
  xPercent: number;
  yOffsetPx: number;
  facingLeft: boolean;
  lunging: boolean;
  stepAccumulator: number;
}

interface SnowFootprint {
  id: number;
  xPercent: number;
  yOffsetPx: number;
  createdAt: number;
  kind: 'pet' | 'zombie';
  strideSide?: -1 | 1;
  facingLeft?: boolean;
}

interface FloatingCombatTag {
  id: number;
  xPercent: number;
  text: string;
  colorClass: string;
}

interface PetCombatStageProps {
  pets: PetInstance[];
  equippedPetIds: string[];
  isRaidActive: boolean;
  isBossRaidActive?: boolean;
  raidSecondsRemaining: number;
  currentCoins: number;
  zombieHitsTaken: number;
  isPaused?: boolean;
  onZombieDefeated: (coinsReward: number, gemsReward?: number) => void;
  onZombieStealCoins: (stolenAmount: number) => void;
  onClaimSnowDrop: (drop: SnowLootDrop) => void;
  onSkinAttacked: () => void;
  onOpenPetsModal: () => void;
}

const DEFAULT_FLANK_X = [28, 72, 18];

export const PetCombatStage: React.FC<PetCombatStageProps> = ({
  pets,
  equippedPetIds,
  isRaidActive,
  isBossRaidActive = false,
  raidSecondsRemaining,
  currentCoins,
  zombieHitsTaken,
  isPaused = false,
  onZombieDefeated,
  onZombieStealCoins,
  onClaimSnowDrop,
  onSkinAttacked,
  onOpenPetsModal,
}) => {
  const effectiveRaid = isRaidActive || isBossRaidActive;

  const equippedPets = useMemo(() => {
    const valid = (pets || []).filter((p) => (equippedPetIds || []).includes(p.instanceId));
    return valid.slice(0, 3);
  }, [pets, equippedPetIds]);

  const [zombies, setZombies] = useState<ActiveZombie[]>([]);
  const [petMotions, setPetMotions] = useState<Record<string, ActivePetMotion>>({});
  const [footprints, setFootprints] = useState<SnowFootprint[]>([]);
  const [snowDrops, setSnowDrops] = useState<SnowLootDrop[]>([]);
  const [raidKills, setRaidKills] = useState(0);
  const [combatTags, setCombatTags] = useState<FloatingCombatTag[]>([]);
  const [breachAlert, setBreachAlert] = useState<{
    stolen: number;
    isEarlyTip: boolean;
    expiresAt: number;
  } | null>(null);

  const nextZombieIdRef = useRef(1);
  const nextDropIdRef = useRef(1);
  const nextFootprintIdRef = useRef(1);
  const lastSpawnAtRef = useRef(Date.now() - 4000);
  const tickCounterRef = useRef(0);
  const petMotionRef = useRef<Record<string, ActivePetMotion>>({});
  const footprintQueueRef = useRef<SnowFootprint[]>([]);
  const pendingDropsRef = useRef<SnowLootDrop[]>([]);
  const claimedDropIdsRef = useRef(new Set<number>());
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  useEffect(() => {
    if (!isPaused) {
      // Give the player a fair breather whenever combat resumes or cutscenes end
      lastSpawnAtRef.current = Date.now() - 3500;
    }
  }, [isPaused]);

  const totalPetDps = useMemo(
    () => equippedPets.reduce((sum, p) => sum + getPetCombatDps(p), 0),
    [equippedPets]
  );

  const onZombieDefeatedRef = useRef(onZombieDefeated);
  onZombieDefeatedRef.current = onZombieDefeated;
  const onZombieStealCoinsRef = useRef(onZombieStealCoins);
  onZombieStealCoinsRef.current = onZombieStealCoins;
  const onSkinAttackedRef = useRef(onSkinAttacked);
  onSkinAttackedRef.current = onSkinAttacked;

  const currentCoinsRef = useRef(currentCoins);
  currentCoinsRef.current = currentCoins;
  const isRaidRef = useRef(effectiveRaid);
  isRaidRef.current = effectiveRaid;
  const dpsRef = useRef(totalPetDps);
  dpsRef.current = totalPetDps;
  const equippedPetsRef = useRef(equippedPets);
  equippedPetsRef.current = equippedPets;
  const hitsTakenRef = useRef(zombieHitsTaken);
  hitsTakenRef.current = zombieHitsTaken;

  useEffect(() => {
    if (!effectiveRaid) setRaidKills(0);
  }, [effectiveRaid]);

  // Spawn an immediate Cryo Titan Boss when a Boss Raid global live event activates!
  useEffect(() => {
    if (!isBossRaidActive || isPaused) return;
    setZombies((prev) => {
      if (prev.some((z) => z.tierCfg.variant === 'boss')) return prev;
      const bossCfg = ZOMBIE_TIERS[4];
      const effectiveBaseDps = Math.max(8, dpsRef.current);
      const hp = Math.max(bossCfg.minHp, Math.round(effectiveBaseDps * bossCfg.hpFactor * 1.35));
      const fromLeft = Math.random() < 0.5;
      return [
        ...prev,
        {
          id: nextZombieIdRef.current++,
          xPercent: fromLeft ? 6 : 94,
          fromLeft,
          speedPerTick: bossCfg.speedPerTick * 1.15,
          hp,
          maxHp: hp,
          tierCfg: bossCfg,
          pose: 'walk',
          attackCooldownMs: 1100,
          hitFlashUntil: 0,
          stepAccumulator: 0,
        },
      ];
    });
  }, [isBossRaidActive, isPaused]);

  const pushCombatTag = (tag: Omit<FloatingCombatTag, 'id'>) => {
    const id = Date.now() + Math.random();
    setCombatTags((prev) => [...prev.slice(-10), { ...tag, id }]);
    window.setTimeout(() => {
      setCombatTags((prev) => prev.filter((item) => item.id !== id));
    }, 1050);
  };

  const rollZombieGemReward = (z: ActiveZombie): number => {
    const cfg = z.tierCfg;
    if (Math.random() >= Math.max(0.32, cfg.gemChance)) return 0;
    const [gMin, gMax] = cfg.gemRange;
    return gMin + Math.floor(Math.random() * (gMax - gMin + 1));
  };

  // Main 100ms animation + combat simulation tick
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (isPausedRef.current) {
        return;
      }
      const now = Date.now();
      const tick = ++tickCounterRef.current;
      const raidOn = isRaidRef.current;
      const teamDps = dpsRef.current;
      const spawnIntervalMs = raidOn ? 5200 : teamDps < 6 ? 19000 : teamDps < 20 ? 15000 : 12000;
      const maxSimultaneous = raidOn ? 4 : teamDps < 6 ? 1 : 2;
      const isCombatTick = tick % 3 === 0;
      const dpsPerCombatTick = teamDps > 0 ? teamDps * 0.45 : 0;

      setZombies((prev) => {
        const nextList: ActiveZombie[] = [];

        // Nearest living zombie for pets to intercept
        let focusZombie: ActiveZombie | null = null;
        let bestDist = Infinity;
        for (const cand of prev) {
          if (cand.pose === 'ko') continue;
          const d = Math.abs(cand.xPercent - 50);
          if (d < bestDist) {
            bestDist = d;
            focusZombie = cand;
          }
        }

        const activePets = equippedPetsRef.current;
        const updatedPetMap: Record<string, ActivePetMotion> = {};
        for (let pIdx = 0; pIdx < activePets.length; pIdx++) {
          const pet = activePets[pIdx];
          const homeX = DEFAULT_FLANK_X[pIdx % DEFAULT_FLANK_X.length];
          const prevM = petMotionRef.current[pet.instanceId] || {
            xPercent: homeX,
            yOffsetPx: 0,
            facingLeft: homeX > 50,
            lunging: false,
            stepAccumulator: 0,
          };

          const targetX = focusZombie
            ? Math.max(10, Math.min(88, focusZombie.xPercent + (focusZombie.fromLeft ? 3.2 : -3.2)))
            : homeX + Math.sin(tick * 0.08 + pIdx * 2.1) * 5.5;

          const diff = targetX - prevM.xPercent;
          const speed = focusZombie ? 2.15 : 0.72;
          const step = Math.abs(diff) <= speed ? diff : Math.sign(diff) * speed;
          const nextX = Math.max(10, Math.min(88, prevM.xPercent + step));
          const lunging = Boolean(focusZombie && Math.abs(focusZombie.xPercent - nextX) < 10);

          const facingLeft = diff < -0.1 ? true : diff > 0.1 ? false : prevM.facingLeft;
          let nextStepAcc = prevM.stepAccumulator + Math.abs(step);
          if (nextStepAcc >= 2.6) {
            nextStepAcc = 0;
            const fpId = nextFootprintIdRef.current++;
            const strideSide: -1 | 1 = fpId % 2 === 0 ? -1 : 1;
            footprintQueueRef.current.push({
              id: fpId,
              xPercent: nextX,
              yOffsetPx: (pIdx >= 2 ? 12 : 4) + strideSide * 2,
              createdAt: now,
              kind: 'pet',
              strideSide,
              facingLeft,
            });
          }

          updatedPetMap[pet.instanceId] = {
            xPercent: nextX,
            yOffsetPx: Math.sin(tick * 0.36 + pIdx) * (Math.abs(step) > 0.25 ? 5 : 2),
            facingLeft,
            lunging,
            stepAccumulator: nextStepAcc,
          };
        }
        petMotionRef.current = updatedPetMap;

        for (let idx = 0; idx < prev.length; idx++) {
          const z = prev[idx];
          if (z.pose === 'ko') {
            nextList.push(z);
            continue;
          }

          const strikePoint = z.fromLeft ? 42.5 : 57.5;
          const stepPx = z.speedPerTick * 1.5;
          const nextX = z.fromLeft
            ? Math.min(strikePoint, z.xPercent + stepPx)
            : Math.max(strikePoint, z.xPercent - stepPx);
          const atSkin = Math.abs(nextX - strikePoint) <= 0.9;

          let nextStepAcc = z.stepAccumulator + Math.abs(nextX - z.xPercent);
          if (nextStepAcc >= 2.2 && nextX > 4 && nextX < 96) {
            nextStepAcc = 0;
            const fpId = nextFootprintIdRef.current++;
            const strideSide: -1 | 1 = fpId % 2 === 0 ? -1 : 1;
            footprintQueueRef.current.push({
              id: fpId,
              xPercent: nextX,
              yOffsetPx: 14 + strideSide * 3,
              createdAt: now,
              kind: 'zombie',
              strideSide,
              facingLeft: !z.fromLeft,
            });
          }

          let nextHp = z.hp;
          let pose: ActiveZombie['pose'] = z.hitFlashUntil > now ? 'hit' : 'walk';
          let hitFlashUntil = z.hitFlashUntil;

          // Only deal pet damage to the primary zombie when at least 1 pet is equipped
          if (isCombatTick && dpsPerCombatTick > 0 && focusZombie && focusZombie.id === z.id) {
            nextHp = Math.max(0, z.hp - dpsPerCombatTick);
            hitFlashUntil = now + 180;
            pose = 'hit';
          }

          if (nextHp <= 0) {
            const coinBounty = Math.max(
              25,
              Math.round(Math.max(10, dpsRef.current * 18) * z.tierCfg.coinMult)
            );
            const gemReward = rollZombieGemReward(z);
            onZombieDefeatedRef.current(coinBounty, gemReward);
            if (raidOn) setRaidKills((k) => k + 1);

            pushCombatTag({
              xPercent: Math.max(10, Math.min(90, nextX)),
              text: gemReward > 0 ? `+${formatCoins(coinBounty)} • +${gemReward}G` : `+${formatCoins(coinBounty)}`,
              colorClass: gemReward > 0 ? 'text-cyan-300' : 'text-emerald-300',
            });

            nextList.push({
              ...z,
              xPercent: nextX,
              hp: 0,
              pose: 'ko',
              hitFlashUntil: 0,
              stepAccumulator: nextStepAcc,
            });
            const deadId = z.id;
            window.setTimeout(() => {
              setZombies((curr) => curr.filter((item) => item.id !== deadId));
            }, 620);
            continue;
          }

          let attackCooldownMs = Math.max(0, z.attackCooldownMs - 150);
          if (atSkin) {
            pose = attackCooldownMs > 3000 ? 'lunge' : 'walk';
            if (attackCooldownMs <= 0) {
              pose = 'lunge';
              attackCooldownMs = 3600;
              const pct = raidOn ? 0.015 : 0.0065;
              const steal =
                currentCoinsRef.current < 15
                  ? 0
                  : Math.min(
                      currentCoinsRef.current,
                      Math.max(6, Math.floor(currentCoinsRef.current * pct * (1 + z.tierCfg.tier * 0.25)))
                    );
              const willBeEarlyTip = hitsTakenRef.current < 3;
              onZombieStealCoinsRef.current(steal);
              onSkinAttackedRef.current();
              setBreachAlert({
                stolen: steal,
                isEarlyTip: willBeEarlyTip,
                expiresAt: now + (willBeEarlyTip ? 6500 : 3500),
              });
              pushCombatTag({
                xPercent: nextX,
                text: steal > 0 ? `-${formatCoins(steal)}!` : 'BREACH!',
                colorClass: 'text-rose-400',
              });
            }
          }

          nextList.push({
            ...z,
            xPercent: nextX,
            hp: nextHp,
            pose,
            attackCooldownMs,
            hitFlashUntil,
            stepAccumulator: nextStepAcc,
          });
        }

        // Spawn next approaching zombie on slower, fairer cadence
        if (nextList.length < maxSimultaneous && now - lastSpawnAtRef.current >= spawnIntervalMs) {
          lastSpawnAtRef.current = now;
          const id = nextZombieIdRef.current++;
          const fromLeft = id % 2 === 0 ? true : Math.random() < 0.45;
          const spawnX = fromLeft ? -4 : 104;
          const tierCfg = selectZombieTier(teamDps, raidOn);
          const effectiveBaseDps = Math.max(4.5, teamDps);
          const hp = Math.max(tierCfg.minHp, Math.round(effectiveBaseDps * tierCfg.hpFactor));

          nextList.push({
            id,
            xPercent: spawnX,
            fromLeft,
            speedPerTick: raidOn ? tierCfg.speedPerTick * 1.12 : tierCfg.speedPerTick,
            hp,
            maxHp: hp,
            tierCfg,
            pose: 'walk',
            attackCooldownMs: 1100,
            hitFlashUntil: 0,
            stepAccumulator: 0,
          });
        }

        return nextList;
      });

      setPetMotions({ ...petMotionRef.current });

      if (pendingDropsRef.current.length > 0) {
        const freshlyDropped = pendingDropsRef.current.splice(0, pendingDropsRef.current.length);
        setSnowDrops((prev) => [...prev, ...freshlyDropped].slice(-7));
      }

      if (footprintQueueRef.current.length > 0 || tick % 12 === 0) {
        const fresh = footprintQueueRef.current.splice(0, 8);
        setFootprints((prev) => [...prev.filter((fp) => now - fp.createdAt < 8500), ...fresh].slice(-18));
      }

      setBreachAlert((prev) => (prev && now > prev.expiresAt ? null : prev));
    }, 150);

    return () => window.clearInterval(timer);
  }, []);

  // Expire unclaimed low-value drops slowly while keeping eggs/chests safe longer
  useEffect(() => {
    const prune = window.setInterval(() => {
      if (isPausedRef.current) return;
      const now = Date.now();
      setSnowDrops((prev) =>
        prev.filter((d) => {
          const ttl = d.kind === 'egg' || d.kind === 'chest' ? 90000 : 45000;
          return now - d.createdAt < ttl;
        })
      );
    }, 5000);
    return () => window.clearInterval(prune);
  }, []);

  // Spawn random Mystery Chests in the snow at the bottom every 50s-90s
  useEffect(() => {
    let timeoutId: number | null = null;
    const scheduleNextChest = () => {
      const delayMs = 50000 + Math.floor(Math.random() * 40000);
      timeoutId = window.setTimeout(() => {
        if (!isPausedRef.current) {
          setSnowDrops((prev) => {
            const chestCount = prev.filter((d) => d.kind === 'chest').length;
            if (chestCount >= 2) return prev;
            const chestDrop: SnowLootDrop = {
              id: nextDropIdRef.current++,
              kind: 'chest',
              xPercent: clampGroundDropX(12 + Math.random() * 76),
              yOffsetPx: Math.floor((Math.random() - 0.5) * 14),
              createdAt: Date.now(),
            };
            return [...prev, chestDrop].slice(-7);
          });
        }
        scheduleNextChest();
      }, delayMs);
    };
    scheduleNextChest();
    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  const handleHitZombie = (zombieId: number, e: React.PointerEvent) => {
    e.stopPropagation();
    const clickDmg = Math.max(18, dpsRef.current * 0.95);
    setZombies((prev) => {
      const next: ActiveZombie[] = [];
      for (const z of prev) {
        if (z.id !== zombieId || z.pose === 'ko') {
          next.push(z);
          continue;
        }
        const rem = z.hp - clickDmg;
        if (rem <= 0) {
          const coinBounty = Math.max(25, Math.round(currentCoinsRef.current * 0.00065 * z.tierCfg.coinMult));
          const gemReward = rollZombieGemReward(z);
          onZombieDefeatedRef.current(coinBounty, gemReward);
          if (isRaidRef.current) setRaidKills((k) => k + 1);
          pushCombatTag({
            xPercent: Math.max(10, Math.min(90, z.xPercent)),
            text: gemReward > 0 ? `+${formatCoins(coinBounty)} • +${gemReward}G` : `+${formatCoins(coinBounty)}`,
            colorClass: gemReward > 0 ? 'text-cyan-300' : 'text-emerald-300',
          });
          next.push({ ...z, hp: 0, pose: 'ko', hitFlashUntil: 0 });
          window.setTimeout(() => {
            setZombies((curr) => curr.filter((item) => item.id !== zombieId));
          }, 560);
          continue;
        }
        const knockedX = z.fromLeft ? Math.max(0, z.xPercent - 5.5) : Math.min(100, z.xPercent + 5.5);
        pushCombatTag({
          xPercent: knockedX,
          text: `-${Math.round(clickDmg)}`,
          colorClass: 'text-amber-200',
        });
        next.push({
          ...z,
          xPercent: knockedX,
          hp: rem,
          pose: 'hit',
          hitFlashUntil: Date.now() + 260,
        });
      }
      return next;
    });
  };

  const getDropTagMeta = (drop: SnowLootDrop) => {
    let label = '+Loot!';
    let colorClass = 'text-amber-200';
    if (drop.kind === 'egg' && drop.eggRarity) {
      label = `+1 ${drop.eggRarity}!`;
      colorClass = 'text-fuchsia-300';
    } else if (drop.kind === 'chest') {
      label = 'Mystery Chest!';
      colorClass = 'text-amber-300';
    } else if (drop.kind === 'gems') {
      label = `+${drop.gemAmount || 2} Gems!`;
      colorClass = 'text-cyan-300';
    } else if (drop.kind === 'coins') {
      label = `+${formatCoins(drop.coinAmount || 0)}`;
      colorClass = 'text-amber-200';
    }
    return { label, colorClass };
  };

  const handleClaimGroundDrop = (drop: SnowLootDrop, e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (claimedDropIdsRef.current.has(drop.id)) return;
    claimedDropIdsRef.current.add(drop.id);
    if (claimedDropIdsRef.current.size > 120) {
      claimedDropIdsRef.current.clear();
      claimedDropIdsRef.current.add(drop.id);
    }
    setSnowDrops((prev) => prev.filter((item) => item.id !== drop.id));
    const { label, colorClass } = getDropTagMeta(drop);
    pushCombatTag({ xPercent: drop.xPercent, text: label, colorClass });
    onClaimSnowDrop(drop);
  };

  const handleClaimAllDrops = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    const toClaim = snowDrops.filter((d) => !claimedDropIdsRef.current.has(d.id));
    if (toClaim.length === 0) return;
    toClaim.forEach((d) => claimedDropIdsRef.current.add(d.id));
    setSnowDrops([]);
    toClaim.forEach((drop) => {
      const { label, colorClass } = getDropTagMeta(drop);
      pushCombatTag({ xPercent: drop.xPercent, text: label, colorClass });
      onClaimSnowDrop(drop);
    });
  };

  const highestTierUnlocked = useMemo(() => selectZombieTier(totalPetDps, effectiveRaid).title, [totalPetDps, effectiveRaid]);

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
      {/* HORIZON GLOW & DEPTH FOG */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: '44%',
          zIndex: 0,
          background: effectiveRaid
            ? 'linear-gradient(180deg, rgba(127,29,29,0) 0%, rgba(15,23,42,0.55) 45%, rgba(2,6,23,0.94) 100%)'
            : 'linear-gradient(180deg, rgba(14,165,233,0) 0%, rgba(15,23,42,0.45) 42%, rgba(2,6,23,0.92) 100%)',
        }}
      />

      {/* BACKDROP SNOWY FOREST SILHOUETTES */}
      <div
        className="absolute inset-x-0 bottom-[19%] h-32 pointer-events-none flex items-end justify-between opacity-35 px-3"
        style={{ zIndex: 1 }}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const ph = 90 + (i % 3) * 26;
          return (
            <svg key={`tree-l-${i}`} width="64" height={ph} viewBox="0 0 64 110" className="shrink-0">
              <polygon points="32,4 58,48 44,48 60,82 40,82 40,108 24,108 24,82 4,82 20,48 6,48" fill="#0f2942" />
              <polygon points="32,4 48,30 22,28" fill="#bae6fd" opacity="0.55" />
            </svg>
          );
        })}
        <div className="w-[26%]" />
        {[0, 1, 2, 3, 4].map((i) => {
          const ph = 95 + ((i + 1) % 3) * 24;
          return (
            <svg key={`tree-r-${i}`} width="64" height={ph} viewBox="0 0 64 110" className="shrink-0">
              <polygon points="32,4 58,48 44,48 60,82 40,82 40,108 24,108 24,82 4,82 20,48 6,48" fill="#0f2942" />
              <polygon points="32,4 48,30 22,28" fill="#bae6fd" opacity="0.55" />
            </svg>
          );
        })}
      </div>

      {/* FOREGROUND SNOWY GROUND PLANE */}
      <div
        className="absolute inset-x-0 bottom-0 border-t border-cyan-100/30"
        style={{
          height: '25.5%',
          background:
            'linear-gradient(180deg, rgba(224,242,254,0.22) 0%, rgba(186,230,253,0.42) 34%, rgba(125,211,252,0.52) 100%)',
          boxShadow: 'inset 0 10px 30px rgba(255,255,255,0.22)',
          zIndex: 2,
        }}
      >
        <div
          className="w-full h-3.5 -mt-1.5"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.68) 0%, rgba(186,230,253,0.12) 100%)',
            filter: 'blur(1px)',
          }}
        />
      </div>

      {/* CONTINUOUS HOMESTEAD WOODEN FENCE LINE */}
      <div
        className="absolute inset-x-0 bottom-[19.5%] h-14 flex items-end justify-between px-1 pointer-events-none"
        style={{ zIndex: 3 }}
      >
        <div className="w-[41%] flex items-end justify-between gap-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={`fp-l-${i}`} className="relative flex-1 flex flex-col items-center">
              <div className="w-3 sm:w-4 h-12 bg-gradient-to-b from-amber-800 to-stone-900 rounded-t-sm border-t-2 border-cyan-100/80 shadow-md" />
              <div className="w-full h-1.5 bg-amber-900/90 -mt-7 shadow" />
              <div className="w-full h-1.5 bg-amber-950/90 mt-3 shadow" />
            </div>
          ))}
        </div>
        <div className="w-[18%]" />
        <div className="w-[41%] flex items-end justify-between gap-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={`fp-r-${i}`} className="relative flex-1 flex flex-col items-center">
              <div className="w-3 sm:w-4 h-12 bg-gradient-to-b from-amber-800 to-stone-900 rounded-t-sm border-t-2 border-cyan-100/80 shadow-md" />
              <div className="w-full h-1.5 bg-amber-900/90 -mt-7 shadow" />
              <div className="w-full h-1.5 bg-amber-950/90 mt-3 shadow" />
            </div>
          ))}
        </div>
      </div>

      {/* FADING SNOW FOOTPRINTS */}
      {footprints.map((fp) => {
        const ageRatio = Math.min(1, (Date.now() - fp.createdAt) / 8500);
        const opacity = Math.max(0, 0.85 * Math.pow(1 - ageRatio, 1.3));
        const flipFactor = fp.facingLeft ? -1 : 1;
        return (
          <div
            key={`fp-${fp.id}`}
            className="absolute pointer-events-none"
            style={{
              left: `${fp.xPercent}%`,
              bottom: `calc(15% - ${fp.yOffsetPx}px)`,
              transform: `translate(-50%, 0) scaleX(${flipFactor}) rotate(${(fp.strideSide || 1) * 5}deg)`,
              opacity,
              zIndex: 6,
              filter: 'drop-shadow(0 1px 0 rgba(255,255,255,0.55))',
            }}
          >
            {fp.kind === 'pet' ? (
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                <ellipse cx="9.5" cy="6.8" rx="3.4" ry="2.6" fill="rgba(12,74,110,0.72)" />
                <circle cx="4.8" cy="3.2" r="1.35" fill="rgba(12,74,110,0.72)" />
                <circle cx="3.3" cy="6.2" r="1.35" fill="rgba(12,74,110,0.72)" />
                <circle cx="5.2" cy="9.2" r="1.35" fill="rgba(12,74,110,0.72)" />
              </svg>
            ) : (
              <svg width="22" height="12" viewBox="0 0 22 12" fill="none">
                <rect x="2" y="2.5" width="7" height="7" rx="2.2" fill="rgba(12,74,110,0.76)" />
                <path
                  d="M11 2C15.5 2 20 3.4 20 6C20 8.6 15.5 10 11 10C10.2 10 9.6 8.2 9.6 6C9.6 3.8 10.2 2 11 2Z"
                  fill="rgba(12,74,110,0.76)"
                />
              </svg>
            )}
          </div>
        );
      })}

      {/* CLICKABLE LOOT DROPS NESTLED IN SNOW INDENTS */}
      {snowDrops.map((drop) => {
        const eggDef = drop.eggRarity ? getEggDefinition(drop.eggRarity) : null;
        return (
          <button
            key={`snowdrop-${drop.id}`}
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => handleClaimGroundDrop(drop, e)}
            className={`absolute pointer-events-auto cursor-pointer group flex flex-col items-center focus:outline-none p-1 ${
              drop.kind === 'chest' ? 'animate-chest-fall' : ''
            }`}
            style={{
              left: `${drop.xPercent}%`,
              bottom: `calc(8.5% + ${drop.yOffsetPx}px)`,
              transform: 'translate(-50%, 0)',
              zIndex: 32,
            }}
            title="Click item in the snow crater to claim!"
          >
            {/* Floating Claim Prompt */}
            <div className="mb-0.5 px-2 py-0.5 rounded-full bg-slate-950/95 border border-cyan-300/80 text-[9px] font-black text-cyan-200 shadow-lg whitespace-nowrap group-hover:scale-110 transition-transform animate-bounce">
              {drop.kind === 'egg'
                ? `${drop.eggRarity} • Click!`
                : drop.kind === 'chest'
                ? 'Mystery Chest • Click!'
                : drop.kind === 'gems'
                ? `+${drop.gemAmount} Gems • Click!`
                : `+${formatCoins(drop.coinAmount || 0)} • Click!`}
            </div>

            {/* Item resting inside the concave snow crater */}
            <div className="relative flex flex-col items-center justify-end">
              <div className="relative z-10 -mb-2.5 group-hover:-translate-y-1 transition-transform drop-shadow-[0_6px_8px_rgba(2,6,23,0.85)]">
                {drop.kind === 'egg' && drop.eggRarity ? (
                  <EggBadgeVisual rarity={drop.eggRarity} size={50} />
                ) : drop.kind === 'chest' ? (
                  <div className="relative flex items-center justify-center">
                    <div
                      className="absolute inset-0 rounded-full blur-xl animate-pulse pointer-events-none"
                      style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.7) 0%, transparent 72%)' }}
                    />
                    <img
                      src="./images/s2/chest/pixel_closed.png"
                      alt="Mystery Chest"
                      className="relative w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-[0_0_22px_rgba(251,191,36,0.95)]"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                ) : drop.kind === 'gems' ? (
                  <div className="w-10 h-10 rounded-full bg-cyan-950/90 border-2 border-cyan-300 flex items-center justify-center shadow-[0_0_14px_rgba(34,211,238,0.75)]">
                    <Gem className="w-5 h-5 text-cyan-300" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-amber-950/90 border-2 border-amber-300 flex items-center justify-center shadow-[0_0_12px_rgba(251,191,36,0.6)]">
                    <Coins className="w-5 h-5 text-amber-300" />
                  </div>
                )}
              </div>

              {/* Concave Snow Indent / Crater */}
              <div
                className="w-16 h-5 rounded-full pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse at center, rgba(12,74,110,0.88) 0%, rgba(14,116,144,0.58) 58%, rgba(224,242,254,0.85) 88%, rgba(255,255,255,0) 100%)',
                  boxShadow:
                    'inset 0 4px 7px rgba(2,6,23,0.75), 0 2px 4px rgba(255,255,255,0.45)',
                  border: eggDef ? `1px solid ${eggDef.color}66` : '1px solid rgba(186,230,253,0.65)',
                }}
              />
            </div>
          </button>
        );
      })}

      {/* ACTIVE PET GUARDIANS ON THE FIELD */}
      {equippedPets.map((pet, idx) => {
        const motion = petMotions[pet.instanceId];
        const homeX = DEFAULT_FLANK_X[idx % DEFAULT_FLANK_X.length];
        const px = Math.max(10, Math.min(88, motion ? motion.xPercent : homeX));
        const flip = motion ? motion.facingLeft : homeX > 50;
        const lunging = Boolean(motion?.lunging);
        const yPct = 14.5 + (idx >= 2 ? 6 : 0);
        const liftScale = Math.max(0.72, 1 - Math.abs(motion?.yOffsetPx || 0) * 0.03);

        return (
          <div
            key={pet.instanceId}
            className="absolute flex flex-col items-center transition-all duration-100 pointer-events-none"
            style={{
              left: `${px}%`,
              bottom: `${yPct}%`,
              transform: `translate(-50%, ${-(motion?.yOffsetPx || 0)}px)`,
              zIndex: 24,
            }}
          >
            <div className="mb-0.5 px-1.5 py-0.5 rounded bg-slate-950/85 border border-cyan-400/50 text-[8.5px] font-black text-cyan-200 shadow whitespace-nowrap">
              {pet.name} Lv.{pet.level}
            </div>
            <PetSprite2D
              speciesId={pet.speciesId}
              rarity={pet.rarity}
              size={64}
              attacking={lunging}
              flip={flip}
            />
            <div
              className="relative flex flex-col items-center pointer-events-none -mt-2"
              style={{ transform: `scale(${liftScale})` }}
            >
              <div className="w-11 h-2 rounded-full bg-slate-900/20 blur-[2px]" />
            </div>
          </div>
        );
      })}

      {/* APPROACHING ZOMBIES */}
      {zombies.map((z) => {
        const pctHp = Math.max(0, Math.min(100, (z.hp / z.maxHp) * 100));
        const strikePoint = z.fromLeft ? 42.5 : 57.5;
        const attackingSkin = Math.abs(z.xPercent - strikePoint) <= 3.5;

        return (
          <button
            key={`zmb-${z.id}`}
            type="button"
            onPointerDown={(e) => handleHitZombie(z.id, e)}
            className="absolute bottom-[11.5%] flex flex-col items-center pointer-events-auto cursor-crosshair focus:outline-none group"
            style={{
              left: `${z.xPercent}%`,
              transform: 'translateX(-50%)',
              zIndex: 25,
            }}
            title={`Click to strike ${z.tierCfg.title}!`}
          >
            {attackingSkin && (
              <div className="mb-0.5 px-1.5 py-0.5 rounded bg-rose-600 text-[9px] font-black text-white uppercase tracking-wider shadow animate-bounce">
                Attacking!
              </div>
            )}
            <div
              className={`mb-0.5 px-1.5 py-0.5 rounded border text-[9px] font-black shadow whitespace-nowrap ${z.tierCfg.tintBadge}`}
            >
              {z.tierCfg.title} • {Math.ceil(z.hp)} HP
            </div>
            <div className="w-20 h-2 bg-slate-950/90 rounded-full overflow-hidden border border-white/25 mb-1 shadow">
              <div
                className={`h-full transition-all duration-100 ${
                  pctHp > 50 ? 'bg-emerald-400' : pctHp > 22 ? 'bg-amber-400' : 'bg-rose-500'
                }`}
                style={{ width: `${pctHp}%` }}
              />
            </div>

            <div className="relative group-hover:scale-105 active:scale-95 transition-transform">
              <RiggedZombie2D
                variant={z.tierCfg.variant}
                pose={z.pose}
                size={z.tierCfg.size}
                flip={!z.fromLeft}
              />
            </div>
            <div className="relative flex flex-col items-center pointer-events-none -mt-3">
              <div
                className="h-4 rounded-full bg-slate-900/50 blur-[3px] translate-x-3 translate-y-1.5 skew-x-12"
                style={{ width: z.tierCfg.size * 0.72 }}
              />
              <div
                className="h-3 rounded-full bg-slate-950/85 blur-[1.5px] -mt-3.5"
                style={{ width: z.tierCfg.size * 0.56 }}
              />
            </div>
          </button>
        );
      })}

      {/* FLOATING COMBAT / DROP CLAIM POPUPS */}
      {combatTags.map((tag) => (
        <div
          key={`tag-${tag.id}`}
          className={`absolute bottom-[30%] font-black text-xs sm:text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] animate-bounce pointer-events-none ${tag.colorClass}`}
          style={{ left: `${tag.xPercent}%`, transform: 'translateX(-50%)', zIndex: 38 }}
        >
          {tag.text}
        </div>
      ))}

      {/* BREACH WARNING BANNER & GUIDED EARLY-HIT COACHING */}
      {breachAlert && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-[48px] sm:bottom-[54px] z-[46] max-w-md w-[92%] sm:w-auto px-3.5 py-2 rounded-xl bg-rose-950/95 border-2 border-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.75)] pointer-events-auto flex items-center gap-2.5 animate-pulse"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <ShieldAlert className="w-5 h-5 text-rose-300 shrink-0" />
          <div className="text-left flex-1">
            <p className="text-xs font-black text-rose-200 uppercase tracking-wide">
              {breachAlert.stolen > 0
                ? `Zombie Breach! -${formatCoins(breachAlert.stolen)} Coins Stolen`
                : 'Zombie Breach at the Gate!'}
            </p>
            <p className="text-[11px] font-bold text-rose-100/95">
              {breachAlert.isEarlyTip
                ? 'Buy more Pets or Upgrade them with Gems in Pets to fight off zombies — or click zombies directly!'
                : 'Upgrade or equip stronger Pets to protect Matthew!'}
            </p>
          </div>
          {breachAlert.isEarlyTip && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setBreachAlert(null);
                onOpenPetsModal();
              }}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] shadow cursor-pointer"
            >
              Pets
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              setBreachAlert(null);
            }}
            className="shrink-0 p-1 rounded-lg bg-rose-900/70 hover:bg-rose-800 text-rose-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* COMPACT DEFENSE HUD PILL */}
      <div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/90 border border-cyan-400/45 shadow-lg pointer-events-auto z-[30] text-[10px] font-black whitespace-nowrap"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {effectiveRaid ? (
          <span className="flex items-center gap-1.5 text-rose-300 animate-pulse">
            <Skull className="w-3.5 h-3.5 text-rose-400" />
            {isBossRaidActive ? 'BOSS RAID' : 'ZOMBIE RAID'} ({raidSecondsRemaining}s) • {raidKills} KO
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-cyan-200">
            <Swords className="w-3.5 h-3.5 text-cyan-400" />
            Threat: <span className="text-amber-300">{highestTierUnlocked}</span> • {Math.round(totalPetDps)} Pet DPS
          </span>
        )}
        <span className="text-slate-600">|</span>
        <button
          type="button"
          onClick={onOpenPetsModal}
          className="text-amber-300 hover:text-amber-200 flex items-center gap-1 cursor-pointer underline-offset-2 hover:underline"
        >
          <Sparkles className="w-3 h-3" />
          {equippedPets.length}/3 Pets
        </button>
        {snowDrops.length > 0 && (
          <>
            <span className="text-slate-600">|</span>
            <button
              type="button"
              onClick={handleClaimAllDrops}
              className="px-2 py-0.5 rounded-full bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400/70 text-emerald-200 cursor-pointer animate-pulse"
              title="Collect all dropped loot in the snow"
            >
              Collect {snowDrops.length} Drop{snowDrops.length > 1 ? 's' : ''}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
