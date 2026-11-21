import React from 'react';
import { formatCoins } from '../../utils/formatters';
import { HeroSquadSummary } from '../../data/heroSquad';
import { Swords, Zap, Gem, Shield, AlertTriangle } from 'lucide-react';

export interface MarvelBossSpec {
  id: 'loki' | 'ultron' | 'thanos';
  name: string;
  title: string;
  image: string;
  accentColor: string;
  gemReward: number;
  coinSeconds: number;
  frenzyMult: number;
  frenzySec: number;
  hpMultiplier: number;
}

export const MARVEL_BOSSES: MarvelBossSpec[] = [
  {
    id: 'loki',
    name: 'Loki',
    title: 'God of Mischief',
    image: './images/s3/features/boss_loki.png',
    accentColor: 'from-emerald-500 to-amber-400',
    gemReward: 12,
    coinSeconds: 30,
    frenzyMult: 3,
    frenzySec: 20,
    hpMultiplier: 140,
  },
  {
    id: 'ultron',
    name: 'Ultron Prime',
    title: 'Vibranium Menace',
    image: './images/s3/features/boss_ultron.png',
    accentColor: 'from-rose-600 to-orange-400',
    gemReward: 18,
    coinSeconds: 45,
    frenzyMult: 3,
    frenzySec: 25,
    hpMultiplier: 210,
  },
  {
    id: 'thanos',
    name: 'Thanos',
    title: 'The Mad Titan',
    image: './images/s3/features/boss_thanos.png',
    accentColor: 'from-purple-600 to-amber-400',
    gemReward: 25,
    coinSeconds: 60,
    frenzyMult: 4,
    frenzySec: 30,
    hpMultiplier: 300,
  },
];

export interface ActiveMarvelBoss {
  spec: MarvelBossSpec;
  hp: number;
  maxHp: number;
  timeRemainingSec: number;
}

interface MarvelArenaHudProps {
  squad: HeroSquadSummary;
  arcCharge: number;
  arcMaxCharge: number;
  arcActiveSec: number;
  activeBoss: ActiveMarvelBoss | null;
  bossCooldownSec: number;
  onActivateArc: () => void;
  onSummonBoss: () => void;
}

export const MarvelArenaHud: React.FC<MarvelArenaHudProps> = ({
  squad,
  arcCharge,
  arcMaxCharge,
  arcActiveSec,
  activeBoss,
  bossCooldownSec,
  onActivateArc,
  onSummonBoss,
}) => {
  const arcPct = Math.min(100, Math.floor((arcCharge / arcMaxCharge) * 100));
  const arcReady = arcCharge >= arcMaxCharge && arcActiveSec <= 0;
  const bossPct = activeBoss ? Math.max(0, Math.min(100, (activeBoss.hp / activeBoss.maxHp) * 100)) : 0;

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-2 z-20 px-2">
      {/* ACTIVE BOSS ENCOUNTER BAR OR STRIKE TEAM + BOSS SUMMON */}
      {activeBoss ? (
        <div className="w-full rounded-2xl bg-slate-950/92 border-2 border-rose-500/75 p-2.5 shadow-[0_0_26px_rgba(244,63,94,0.45)]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-marvel text-sm text-white truncate">
              FIGHTING: {activeBoss.spec.name}{' '}
              <span className="text-rose-300 font-sans text-[11px] font-black">• {activeBoss.spec.title}</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-rose-500/30 border border-rose-400/60 text-xs font-black text-rose-100 font-mono shrink-0">
              {Math.ceil(activeBoss.timeRemainingSec)}s
            </span>
          </div>
          <div className="mt-1.5 w-full h-3.5 rounded-full bg-slate-900 border border-white/15 overflow-hidden relative">
            <div
              className={`h-full bg-gradient-to-r ${activeBoss.spec.accentColor} transition-all duration-100`}
              style={{ width: `${bossPct}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow">
              HP: {formatCoins(Math.ceil(activeBoss.hp))} / {formatCoins(Math.ceil(activeBoss.maxHp))}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold">
            <span className="inline-flex items-center gap-1 text-rose-300">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              Fail = -15% Coins &amp; 0.5× Ambush!
            </span>
            <span className="inline-flex items-center gap-1 text-amber-300">
              <Gem className="w-3 h-3 text-fuchsia-300" />+{activeBoss.spec.gemReward} &amp; {activeBoss.spec.frenzyMult}× Boost
            </span>
          </div>
        </div>
      ) : (
        <div className="w-full flex items-center justify-between gap-2 rounded-xl bg-slate-950/80 border border-white/10 px-3 py-1.5 backdrop-blur-md">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="flex -space-x-2 shrink-0">
              {squad.members.map((m) => (
                <img
                  key={m.id}
                  src={m.image}
                  alt={m.name}
                  title={`${m.name} (${m.rarity})`}
                  className="w-7 h-7 rounded-full object-contain bg-slate-900 border border-amber-400/70 shadow"
                />
              ))}
            </div>
            <div className="min-w-0 leading-tight">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1 truncate">
                <Shield className="w-3 h-3 text-cyan-300 shrink-0" />
                <span>Strike Team +{Math.round(squad.clickBonusPct * 100)}%</span>
              </div>
              <div className="text-[9px] font-bold text-slate-400 truncate">
                {squad.isAvengersAssembled ? 'Avengers Assembled (1.5× Boss DMG)' : 'Top 3 Skins Boost Power'}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={bossCooldownSec > 0}
            onClick={onSummonBoss}
            className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shrink-0 transition-all ${
              bossCooldownSec <= 0
                ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-[0_0_14px_rgba(244,63,94,0.45)] hover:scale-105 cursor-pointer'
                : 'bg-slate-900 text-slate-400 border border-slate-700 cursor-not-allowed'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            {bossCooldownSec <= 0 ? 'Boss Fight! (15s)' : `Boss ${Math.ceil(bossCooldownSec)}s`}
          </button>
        </div>
      )}

      {/* ARC REACTOR OVERDRIVE (250 CLICKS -> 3× POWER) */}
      <button
        type="button"
        onClick={onActivateArc}
        disabled={!arcReady}
        className={`w-full relative overflow-hidden flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all ${
          arcActiveSec > 0
            ? 'bg-cyan-950/90 border-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.5)]'
            : arcReady
            ? 'bg-gradient-to-r from-cyan-600/85 to-blue-600/85 border-cyan-300 hover:scale-[1.01] cursor-pointer shadow-[0_0_16px_rgba(34,211,238,0.45)]'
            : 'bg-slate-950/85 border-white/10 opacity-90 cursor-not-allowed'
        }`}
      >
        <img
          src="./images/s3/features/ability_arc_reactor.png"
          alt="Arc Overdrive"
          className="w-9 h-9 rounded-lg object-contain shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-white flex items-center gap-1 truncate">
              <Zap className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span>
                {arcActiveSec > 0
                  ? `ARC OVERDRIVE 3× ACTIVE (${Math.ceil(arcActiveSec)}s)`
                  : arcReady
                  ? 'ACTIVATE ARC OVERDRIVE (3×)!'
                  : 'Arc Reactor Overdrive (3×)'}
              </span>
            </span>
            <span className="text-[10px] font-black font-mono text-cyan-200 shrink-0">
              {arcActiveSec > 0 ? '+10 Auto/s' : `${arcCharge}/${arcMaxCharge}`}
            </span>
          </div>
          <div className="mt-1 w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-sky-300 transition-all duration-150"
              style={{ width: `${arcActiveSec > 0 ? 100 : arcPct}%` }}
            />
          </div>
        </div>
      </button>
    </div>
  );
};
