import React, { useEffect, useState } from 'react';
import { GameState } from '../types/game';
import {
  fetchWorldwideLeaderboard,
  fetchPlayerLeaderboardEntry,
  updateLeaderboardEntry,
  sortLeaderboardDeterministically,
  isExcludedFromLeaderboard,
  isLeaderboardPlayerOnline,
  LeaderboardEntry,
} from '../firebase/leaderboard';
import {
  submitPlayerSuspicionReport,
  isDevAdminAccount,
} from '../firebase/moderation';
import { SEASON_2_CONFIG, SEASON_3_CONFIG } from '../config/gameConfig';
import { getAscensionMultiplier } from '../data/prestige';
import { CHAMPION_SKIN, LIAM_SKIN, getSkinById } from '../data/skins';
import { formatCoins, formatExtendedCoins, formatTime } from '../utils/formatters';
import {
  Trophy,
  Crown,
  RefreshCw,
  X,
  UploadCloud,
  ArrowLeft,
  Eye,
  Snowflake,
  Sparkles,
  Flag,
  CheckCircle2,
  Gauge,
} from 'lucide-react';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: GameState;
  seasonId: string;
  seasonLabel: string;
  seasonRemainingSec: number;
  isSandbox?: boolean;
  onOpenAccount: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  state,
  seasonId,
  seasonLabel,
  seasonRemainingSec,
  isSandbox = false,
  onOpenAccount,
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [, setPlayerEntry] = useState<LeaderboardEntry | null>(null);
  const [viewedSeasonId, setViewedSeasonId] = useState<string>(seasonId);
  const [selectedPlayer, setSelectedPlayer] = useState<{
    entry: LeaderboardEntry;
    rank: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportedUids, setReportedUids] = useState<Record<string, boolean>>({});
  const [reportingUid, setReportingUid] = useState<string | null>(null);

  const isSeason2Launched = Date.now() >= SEASON_2_CONFIG.launchTimeMs;
  const isSeason3Launched = Date.now() >= SEASON_3_CONFIG.launchTimeMs;
  const canViewLiveSeason2 = isSeason2Launched || isSandbox;
  const canViewLiveSeason3 = isSeason3Launched || isSandbox;
  const effectiveTargetSeasonId = viewedSeasonId;
  const isViewingMyCurrentSeason = effectiveTargetSeasonId === seasonId;
  const isMarvelLb = viewedSeasonId === 'season_3';
  const onlineCount = entries.filter((e) =>
    isLeaderboardPlayerOnline(e, state.cloudAccount?.uid)
  ).length;

  const loadLeaderboard = async (
    targetSeason: string = effectiveTargetSeasonId,
    silent = false
  ) => {
    if (
      (targetSeason === 'season_2' && !canViewLiveSeason2) ||
      (targetSeason === 'season_3' && !canViewLiveSeason3)
    ) {
      setEntries([]);
      setPlayerEntry(null);
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
    }
    try {
      const targetSandboxFlag =
        (targetSeason === 'season_2' && isSandbox && !isSeason2Launched) ||
        (targetSeason === 'season_3' && isSandbox && !isSeason3Launched);
      if (state.cloudAccount && targetSeason === seasonId) {
        updateLeaderboardEntry(
          state.cloudAccount.uid,
          state.cloudAccount.displayUsername,
          state,
          seasonId,
          false,
          isSandbox
        ).catch(() => {});
      }

      const list = await fetchWorldwideLeaderboard(targetSeason, 500, targetSandboxFlag);

      if (
        targetSeason === seasonId &&
        state.cloudAccount &&
        !isExcludedFromLeaderboard(state.cloudAccount.uid, state.cloudAccount.displayUsername, targetSeason, Date.now(), targetSandboxFlag)
      ) {
        const localScore = Math.max(
          0,
          Math.floor(Math.max(state.seasonalScore || 0, state.lifetimeCoins || 0))
        );
        const liveMine: LeaderboardEntry = {
          uid: state.cloudAccount.uid,
          username: state.cloudAccount.displayUsername,
          seasonalScore: localScore,
          lifetimeCoins: Math.floor(state.lifetimeCoins || 0),
          totalClicks: Math.floor(state.clicks || 0),
          highestCps: Number((state.highestCps || 0).toFixed(1)),
          rebirthCount: state.prestigeCount || 0,
          ascensionMultiplier: getAscensionMultiplier(state.prestigeShards),
          equippedSkin: state.equippedSkin || 'classic_matthew',
          unlockedSkins:
            Array.isArray(state.unlockedSkins) && state.unlockedSkins.length > 0
              ? state.unlockedSkins
              : ['classic_matthew'],
          winnerBadges: state.winnerBadges || [],
          clanName: state.clanName || undefined,
          chestsOpened: state.chestsOpened || 0,
          totalPlaytimeSeconds: Math.floor(state.totalPlaytimeSeconds || 0),
          updatedAtMs: Date.now(),
        };

        const existingIdx = list.findIndex((e) => e.uid === state.cloudAccount?.uid);
        if (existingIdx >= 0) {
          if (liveMine.seasonalScore >= list[existingIdx].seasonalScore) {
            list[existingIdx] = {
              ...liveMine,
              highestCps: Math.max(liveMine.highestCps || 0, list[existingIdx].highestCps || 0),
            };
          }
        } else {
          list.push(liveMine);
        }

        const sorted = sortLeaderboardDeterministically(list);
        setEntries(sorted);

        const cloudMine = await fetchPlayerLeaderboardEntry(state.cloudAccount.uid, targetSeason);
        setPlayerEntry(
          cloudMine && cloudMine.seasonalScore > liveMine.seasonalScore ? cloudMine : liveMine
        );
      } else {
        setEntries(list);
        setPlayerEntry(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedPlayer(null);
      setViewedSeasonId(seasonId);
      loadLeaderboard(seasonId);
    }
  }, [isOpen, seasonId]);

  useEffect(() => {
    if (isOpen) {
      setSelectedPlayer(null);
      loadLeaderboard(viewedSeasonId);
    }
  }, [viewedSeasonId]);

  // Refresh leaderboard quietly every 20s while open so Online status bubbles stay current
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      loadLeaderboard(viewedSeasonId, true);
    }, 20000);
    return () => clearInterval(id);
  }, [isOpen, viewedSeasonId, seasonId]);

  if (!isOpen) return null;

  const handleReportSuspicious = async (target: LeaderboardEntry) => {
    if (reportingUid === target.uid || reportedUids[target.uid]) return;
    setReportingUid(target.uid);
    const reporterName =
      state.cloudAccount?.displayUsername || state.cloudAccount?.username || 'A Player';
    const ok = await submitPlayerSuspicionReport({
      reporterUid: state.cloudAccount?.uid || null,
      reporterUsername: reporterName,
      targetUid: target.uid,
      targetUsername: target.username,
      targetHighestCps: target.highestCps || 0,
      targetScore: target.seasonalScore || 0,
      reason: `Suspicious activity reported from Frost Leaderboard (Peak CPS: ${(
        target.highestCps || 0
      ).toFixed(1)}/s)`,
    });
    setReportingUid(null);
    if (ok) {
      setReportedUids((prev) => ({ ...prev, [target.uid]: true }));
    }
  };

  const FROST_FLAKES = [
    { left: '6%', top: '12%', size: 18, opacity: 'opacity-20' },
    { left: '19%', top: '64%', size: 14, opacity: 'opacity-15' },
    { left: '34%', top: '26%', size: 22, opacity: 'opacity-15' },
    { left: '54%', top: '8%', size: 16, opacity: 'opacity-20' },
    { left: '72%', top: '48%', size: 24, opacity: 'opacity-15' },
    { left: '88%', top: '20%', size: 18, opacity: 'opacity-20' },
    { left: '91%', top: '76%', size: 15, opacity: 'opacity-15' },
  ];

  return (
    <div
      className={`fixed inset-0 z-50 w-screen h-screen flex flex-col font-chunky text-slate-100 select-none overflow-hidden animate-fade-in ${
        isMarvelLb
          ? 'bg-gradient-to-b from-[#1a0410] via-[#100622] to-[#04030b]'
          : 'bg-gradient-to-b from-[#07182d] via-[#061123] to-[#030916]'
      }`}
    >
      {/* AMBIENT BACKDROP */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={`absolute -top-28 left-1/4 w-[36rem] h-[24rem] rounded-full blur-3xl ${
            isMarvelLb ? 'bg-red-500/15' : 'bg-cyan-400/12'
          }`}
        />
        <div
          className={`absolute bottom-0 right-1/4 w-[34rem] h-[22rem] rounded-full blur-3xl ${
            isMarvelLb ? 'bg-purple-500/15' : 'bg-sky-500/12'
          }`}
        />
        {!isMarvelLb &&
          FROST_FLAKES.map((f, i) => (
            <Snowflake
              key={i}
              style={{ left: f.left, top: f.top, width: f.size, height: f.size }}
              className={`absolute text-cyan-200 ${f.opacity} animate-pulse`}
            />
          ))}
      </div>

      {/* FULL-SCREEN HEADER */}
      <div
        className={`relative z-10 flex items-center justify-between px-5 sm:px-8 py-4 backdrop-blur-md border-b-2 shrink-0 ${
          isMarvelLb
            ? 'bg-[#170618]/85 border-amber-400/50 shadow-[0_6px_30px_rgba(239,68,68,0.2)]'
            : 'bg-sky-950/75 border-cyan-300/45 shadow-[0_6px_30px_rgba(34,211,238,0.16)]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center ${
              isMarvelLb
                ? 'bg-gradient-to-br from-red-500/30 to-amber-500/20 border-amber-300 text-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.4)]'
                : 'bg-gradient-to-br from-cyan-400/30 to-sky-500/20 border-cyan-300 text-cyan-200 shadow-[0_0_24px_rgba(56,189,248,0.45)]'
            }`}
          >
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2
                className={`text-xl sm:text-3xl font-black uppercase tracking-wide ${
                  isMarvelLb
                    ? 'text-amber-300 drop-shadow-[0_2px_12px_rgba(239,68,68,0.5)]'
                    : 'text-cyan-100 drop-shadow-[0_2px_10px_rgba(56,189,248,0.45)]'
                }`}
              >
                {isMarvelLb
                  ? 'Season 3: Marvel Leaderboard'
                  : viewedSeasonId === 'season_1'
                  ? 'Season 1 Archive'
                  : 'Frost Leaderboard'}
              </h2>
              {isMarvelLb ? (
                <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
              ) : (
                <Snowflake className="w-5 h-5 text-cyan-300 animate-spin" style={{ animationDuration: '9s' }} />
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-950/75 border border-amber-300/30">
                {(['season_1', 'season_2', 'season_3'] as const).map((sid) => {
                  const active = viewedSeasonId === sid;
                  const sLabel =
                    sid === 'season_1'
                      ? 'Season 1'
                      : sid === 'season_2'
                      ? 'Season 2'
                      : 'Season 3 (Marvel)';
                  return (
                    <button
                      key={sid}
                      type="button"
                      onClick={() => setViewedSeasonId(sid)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase cursor-pointer transition ${
                        active
                          ? sid === 'season_3'
                            ? 'bg-gradient-to-r from-red-500 to-amber-400 text-slate-950 shadow'
                            : 'bg-cyan-400 text-slate-950 shadow'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {sLabel}
                    </button>
                  );
                })}
              </div>
              {isViewingMyCurrentSeason && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/50 text-[11px] font-black text-amber-200">
                  {seasonLabel} • {formatTime(seasonRemainingSec)}
                </span>
              )}
              {!isViewingMyCurrentSeason && (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-600 text-[11px] font-black text-slate-200">
                  {viewedSeasonId === 'season_1'
                    ? 'Season 1 Final Archive'
                    : viewedSeasonId === 'season_2'
                    ? 'Season 2: Frozen Apocalypse'
                    : 'Season 3: Marvel'}
                </span>
              )}
              {entries.length > 0 && (
                <>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/60 text-[11px] font-black text-emerald-200 flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.28)]">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                    <span>{onlineCount} Online</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-400/15 border border-sky-300/40 text-[11px] font-black text-sky-200">
                    {entries.length} Players Ranked
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {!selectedPlayer && (
            <button
              onClick={() => loadLeaderboard(effectiveTargetSeasonId)}
              disabled={loading}
              className="px-4 py-2.5 rounded-2xl bg-sky-900/70 hover:bg-sky-800/80 border-2 border-cyan-300/40 text-xs font-black text-cyan-200 flex items-center gap-2 cursor-pointer transition shadow"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl bg-slate-900/90 hover:bg-sky-950 border-2 border-cyan-300/40 hover:border-cyan-200 text-white font-black text-xs uppercase flex items-center gap-1.5 cursor-pointer transition shadow-lg"
          >
            <X className="w-5 h-5" />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>
      </div>

      {/* FULL-SCREEN BODY */}
      <div className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-5xl mx-auto">
          {selectedPlayer ? (
            <div className="space-y-5">
              <button
                onClick={() => setSelectedPlayer(null)}
                className="px-4 py-2 rounded-2xl bg-sky-900/70 hover:bg-sky-800 border border-cyan-300/40 text-xs font-black text-cyan-200 flex items-center gap-2 cursor-pointer transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              {/* HERO FROST PROFILE BANNER + REPORT SUSPICIOUS ACTIVITY */}
              {(() => {
                const selectedOnline = isLeaderboardPlayerOnline(
                  selectedPlayer.entry,
                  state.cloudAccount?.uid
                );
                return (
              <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-950/90 via-cyan-950/70 to-slate-900/90 backdrop-blur-md border-2 border-cyan-300/60 flex flex-col sm:flex-row sm:items-center gap-4 shadow-[0_12px_40px_rgba(34,211,238,0.2)]">
                <div className="relative shrink-0 self-start sm:self-auto">
                  <img
                    src={getSkinById(selectedPlayer.entry.equippedSkin).image}
                    alt={selectedPlayer.entry.username}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-950/90 p-2 border-2 border-cyan-300 object-contain shadow-[0_0_20px_rgba(56,189,248,0.35)]"
                  />
                  <span
                    title={selectedOnline ? 'Online Now' : 'Offline'}
                    className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-slate-950 ${
                      selectedOnline
                        ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                        : 'bg-slate-600'
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-400 text-slate-950 font-black text-sm shadow">
                      #{selectedPlayer.rank}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-black text-white truncate">
                      {selectedPlayer.entry.username}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase flex items-center gap-1.5 border ${
                        selectedOnline
                          ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                          : 'bg-slate-800/80 border-slate-600 text-slate-400'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          selectedOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                        }`}
                      />
                      <span>{selectedOnline ? 'Online' : 'Offline'}</span>
                    </span>
                  </div>
                  <p className="text-sm text-cyan-200 font-black mt-1">
                    {getSkinById(selectedPlayer.entry.equippedSkin).name}
                  </p>
                </div>

                {selectedPlayer.entry.uid !== state.cloudAccount?.uid &&
                  !isDevAdminAccount(selectedPlayer.entry.uid, selectedPlayer.entry.username) && (
                    <div className="shrink-0">
                      {reportedUids[selectedPlayer.entry.uid] ? (
                        <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400/60 text-emerald-200 text-xs font-black flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Reported to Devs ✓</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={reportingUid === selectedPlayer.entry.uid}
                          onClick={() => handleReportSuspicious(selectedPlayer.entry)}
                          className="px-4 py-2.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/35 border-2 border-rose-400/60 text-rose-200 font-black text-xs uppercase flex items-center gap-2 cursor-pointer transition shadow-lg disabled:opacity-50"
                        >
                          <Flag className="w-4 h-4" />
                          <span>
                            {reportingUid === selectedPlayer.entry.uid
                              ? 'Reporting...'
                              : 'Report Suspicious Activity'}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
              </div>
                );
              })()}

              {/* 7 STAT CARDS INCLUDING HIGHEST CPS, PLAYTIME & CHESTS OPENED */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
                <div className="p-3.5 rounded-2xl bg-sky-950/75 border border-cyan-300/35 backdrop-blur-md">
                  <span className="text-[10px] text-cyan-200/80 uppercase font-black">Score</span>
                  <p className="text-lg font-black text-amber-300 mt-1">
                    {formatExtendedCoins(selectedPlayer.entry.seasonalScore, selectedPlayer.entry.krillionScore || 0)}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-sky-950/75 border border-cyan-300/35 backdrop-blur-md">
                  <span className="text-[10px] text-cyan-200/80 uppercase font-black">Ascension</span>
                  <p className="text-lg font-black text-fuchsia-300 mt-1">
                    {selectedPlayer.entry.ascensionMultiplier.toFixed(2)}×
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-sky-950/75 border border-cyan-300/35 backdrop-blur-md">
                  <span className="text-[10px] text-cyan-200/80 uppercase font-black">Clicks</span>
                  <p className="text-lg font-black text-cyan-200 mt-1">
                    {formatCoins(selectedPlayer.entry.totalClicks)}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-cyan-950/85 border-2 border-cyan-300/65 backdrop-blur-md shadow-[0_0_15px_rgba(34,211,238,0.18)]">
                  <span className="text-[10px] text-cyan-300 uppercase font-black flex items-center justify-center gap-1">
                    <Gauge className="w-3 h-3" />
                    Highest CPS
                  </span>
                  <p className="text-lg font-black text-white mt-1">
                    {(selectedPlayer.entry.highestCps || 0).toFixed(1)}/s
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-sky-950/75 border border-cyan-300/35 backdrop-blur-md">
                  <span className="text-[10px] text-cyan-200/80 uppercase font-black">Rebirths</span>
                  <p className="text-lg font-black text-emerald-300 mt-1">
                    {selectedPlayer.entry.rebirthCount}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-sky-950/75 border border-amber-300/40 backdrop-blur-md">
                  <span className="text-[10px] text-amber-200 uppercase font-black">Chests</span>
                  <p className="text-lg font-black text-amber-200 mt-1">
                    {selectedPlayer.entry.chestsOpened ?? 0}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-sky-950/75 border-2 border-sky-300/50 backdrop-blur-md">
                  <span className="text-[10px] text-sky-200 uppercase font-black">Time Spent</span>
                  <p className="text-lg font-black text-sky-200 mt-1">
                    {formatTime(selectedPlayer.entry.totalPlaytimeSeconds || 0)}
                  </p>
                </div>
              </div>

              {/* SKIN COLLECTION GRID */}
              <div className="p-5 rounded-3xl bg-sky-950/65 backdrop-blur-md border border-cyan-300/35">
                <h4 className="text-xs font-black uppercase tracking-wider text-cyan-200 mb-4">
                  Unlocked Matthews ({selectedPlayer.entry.unlockedSkins.length})
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {selectedPlayer.entry.unlockedSkins.map((skinId) => {
                    const skin = getSkinById(skinId);
                    return (
                      <div
                        key={skinId}
                        className="p-3 rounded-2xl bg-slate-950/85 border border-cyan-400/25 flex flex-col items-center text-center"
                        title={skin.name}
                      >
                        <img
                          src={skin.image}
                          alt={skin.name}
                          className="w-16 h-16 object-contain"
                        />
                        <span className="text-[10px] font-black text-slate-200 mt-1.5 truncate w-full">
                          {skin.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* COMPACT VISUAL #1 CHAMPION REWARD + PLAYER SCORE BAR */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-3xl bg-gradient-to-r from-cyan-950/90 via-sky-900/60 to-slate-900/90 backdrop-blur-md border-2 border-cyan-300/55 flex items-center gap-3.5 shadow-lg">
                  <img
                    src={CHAMPION_SKIN.image}
                    alt={CHAMPION_SKIN.name}
                    className="w-12 h-12 rounded-2xl bg-slate-950 p-1 border-2 border-cyan-300 object-contain shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-cyan-300" />
                      <span className="text-[11px] font-black text-cyan-200 uppercase">
                        #1 Champion &amp; S1 Top 10: {LIAM_SKIN.name}
                      </span>
                    </div>
                    <p className="text-sm font-black text-white mt-0.5 truncate">
                      {CHAMPION_SKIN.name} + {LIAM_SKIN.name}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-3xl bg-sky-950/75 backdrop-blur-md border-2 border-cyan-300/35 flex items-center justify-between gap-3 shadow-lg">
                  <div>
                    <span className="text-[10px] text-cyan-200/80 uppercase font-black">
                      Your Score
                    </span>
                    <p className="text-xl font-black text-amber-300">
                      {formatExtendedCoins(state.seasonalScore, state.krillionSeasonalScore || 0)}
                    </p>
                  </div>

                  {state.cloudAccount ? (
                    <span className="px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-300/50 text-xs font-black text-cyan-200">
                      {state.cloudAccount.displayUsername} ✓
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenAccount();
                      }}
                      className="px-4 py-2.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer transition btn-chunky"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>Sign In</span>
                    </button>
                  )}
                </div>
              </div>

              {/* RANKINGS LIST */}
              <div className="space-y-2.5">
                {viewedSeasonId === 'season_3' && !canViewLiveSeason3 ? (
                  <div className="py-14 text-center bg-purple-950/40 rounded-3xl border border-amber-400/35 p-6 space-y-2">
                    <Sparkles className="w-12 h-12 text-amber-300 mx-auto" />
                    <p className="text-base font-black text-white uppercase">
                      Season 3: Marvel Unlocks Soon
                    </p>
                    <p className="text-xs font-bold text-amber-200/80">
                      Preview leaderboards are hidden during Downtime!
                    </p>
                  </div>
                ) : viewedSeasonId === 'season_2' && !canViewLiveSeason2 ? (
                  <div className="py-14 text-center bg-sky-950/60 rounded-3xl border border-cyan-300/35 p-6 space-y-2">
                    <Snowflake className="w-12 h-12 text-cyan-300 mx-auto" />
                    <p className="text-base font-black text-white uppercase">
                      Season 2 Unlocks After Midnight Monday
                    </p>
                    <p className="text-xs font-bold text-cyan-200/80">
                      Switch to the Season 1 tab above to view final Season 1 standings &amp; Top 10 winners.
                    </p>
                  </div>
                ) : loading && entries.length === 0 ? (
                  <div className="py-16 text-center text-sm text-cyan-200 font-black">
                    Loading Frost Leaderboard...
                  </div>
                ) : entries.length === 0 ? (
                  <div className="py-14 text-center bg-sky-950/60 rounded-3xl border border-cyan-300/35 p-6">
                    <Trophy className="w-12 h-12 text-cyan-300 mx-auto mb-2" />
                    <p className="text-base font-black text-white">No Scores Yet</p>
                  </div>
                ) : (
                  entries.map((entry, idx) => {
                    const rank = idx + 1;
                    const isMe = state.cloudAccount?.uid === entry.uid;
                    const equipped = getSkinById(entry.equippedSkin);
                    const isOnline = isLeaderboardPlayerOnline(entry, state.cloudAccount?.uid);

                    return (
                      <div
                        key={entry.uid}
                        onClick={() => setSelectedPlayer({ entry, rank })}
                        className={`flex items-center justify-between p-3.5 sm:p-4 rounded-3xl border-2 backdrop-blur-md transition cursor-pointer hover:scale-[1.005] ${
                          rank === 1
                            ? 'bg-gradient-to-r from-cyan-500/25 via-sky-900/75 to-slate-900/90 border-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.28)]'
                            : isMe
                            ? 'bg-cyan-950/65 border-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.2)]'
                            : 'bg-sky-950/60 border-cyan-300/25 hover:border-cyan-300/65'
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm ${
                              rank === 1
                                ? 'bg-gradient-to-br from-cyan-300 to-sky-400 text-slate-950 shadow'
                                : rank === 2
                                ? 'bg-sky-200 text-slate-950'
                                : rank === 3
                                ? 'bg-indigo-300 text-slate-950'
                                : 'bg-sky-900/80 text-cyan-200 border border-cyan-300/25'
                            }`}
                          >
                            #{rank}
                          </div>
                          <div className="relative shrink-0">
                            <img
                              src={equipped.image}
                              alt={equipped.name}
                              className="w-12 h-12 rounded-2xl bg-slate-950/90 p-1 border border-cyan-300/40 object-contain"
                            />
                            <span
                              title={isOnline ? 'Online Now' : 'Offline'}
                              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${
                                isOnline
                                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                                  : 'bg-slate-600'
                              }`}
                            />
                          </div>
                          <div>
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="font-black text-base text-white">
                                {entry.username}
                              </span>
                              {isOnline && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 font-black flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <span>Online</span>
                                </span>
                              )}
                              {rank === 1 && <Crown className="w-4 h-4 text-cyan-300" />}
                              {(entry.winnerBadges || []).map((badge) => (
                                <span
                                  key={`wb_${badge.seasonNumber}`}
                                  className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-400/20 border border-amber-300/60 text-amber-200 font-black uppercase"
                                >
                                  {badge.label}
                                </span>
                              ))}
                              {entry.clanName && (
                                <span className="text-[10px] px-2 py-0.5 rounded-lg bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 font-black">
                                  {entry.clanName}
                                </span>
                              )}
                              {isMe && (
                                <span className="text-[10px] px-2 py-0.5 rounded-lg bg-cyan-500/25 text-cyan-200 font-black">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-black text-cyan-200/75 flex items-center flex-wrap gap-2 mt-0.5">
                              <span className="text-fuchsia-300">{entry.ascensionMultiplier}×</span>
                              <span>•</span>
                              <span className="text-amber-300">{entry.unlockedSkins.length} Skins</span>
                              {typeof entry.highestCps === 'number' && entry.highestCps > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-cyan-300">Peak {entry.highestCps.toFixed(0)} CPS</span>
                                </>
                              )}
                              <Eye className="w-3.5 h-3.5 text-cyan-300 ml-1" />
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-base sm:text-lg font-black text-amber-300">
                            {formatExtendedCoins(entry.seasonalScore, entry.krillionScore || 0)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
