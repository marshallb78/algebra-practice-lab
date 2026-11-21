import React, { useEffect, useState } from 'react';
import { X, Users, ArrowLeftRight, Trophy, Check, Ban, Plus, Send } from 'lucide-react';
import { EggRarity, GameState } from '../../types/game';
import { SEASON_2_CONFIG } from '../../config/gameConfig';
import {
  ClanInviteRecord,
  ClanRecord,
  TradeOfferRecord,
  acceptTradeAtomically,
  cancelOrDeclineTrade,
  claimCompletedSenderTradeAtomically,
  createClan,
  createTradeOffer,
  fetchClanLeaderboard,
  fetchIncomingClanInvites,
  fetchTradesForPlayer,
  respondToClanInvite,
  sendClanInvite,
  leaveOrUpdateClanScore,
} from '../../firebase/clansAndTrades';
import { getSkinById } from '../../data/skins';
import { EGG_RARITY_ORDER } from '../../data/petsAndEggs';
import { formatCoins } from '../../utils/formatters';

interface ClansAndTradingModalProps {
  state: GameState;
  isSandbox: boolean;
  onUpdateState: (updater: (prev: GameState) => GameState) => void;
  onNotify: (title: string, subtitle?: string) => void;
  onClose: () => void;
}

export const ClansAndTradingModal: React.FC<ClansAndTradingModalProps> = ({
  state,
  isSandbox,
  onUpdateState,
  onNotify,
  onClose,
}) => {
  const [tab, setTab] = useState<'clans' | 'clan_lb' | 'trading'>('clans');
  const [clanBoard, setClanBoard] = useState<ClanRecord[]>([]);
  const [invites, setInvites] = useState<ClanInviteRecord[]>([]);
  const [trades, setTrades] = useState<TradeOfferRecord[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Clan inputs
  const [newClanName, setNewClanName] = useState('');
  const [newClanTag, setNewClanTag] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');

  // Trade composer inputs
  const [tradeTargetUser, setTradeTargetUser] = useState('');
  const [offerSkinId, setOfferSkinId] = useState('');
  const [offerPetId, setOfferPetId] = useState('');
  const [offerEggRarity, setOfferEggRarity] = useState<EggRarity | ''>('');
  const [reqSkinId, setReqSkinId] = useState('');

  const uid = state.cloudAccount?.uid || '';
  const username = state.cloudAccount?.displayUsername || state.cloudAccount?.username || '';
  const myClan = clanBoard.find((c) => c.id === state.clanId) || null;

  const refreshData = async () => {
    const [board, inv, tr] = await Promise.all([
      fetchClanLeaderboard(isSandbox),
      username ? fetchIncomingClanInvites(username, isSandbox) : Promise.resolve([]),
      uid && username ? fetchTradesForPlayer(uid, username, isSandbox) : Promise.resolve([]),
    ]);
    setClanBoard(board);
    setInvites(inv);
    setTrades(tr);
  };

  useEffect(() => {
    refreshData();
  }, [uid, username, isSandbox]);

  const handleCreateClan = async () => {
    if (!uid || !username) {
      setStatusMsg('Sign in to an account to create a clan.');
      return;
    }
    const res = await createClan({
      uid,
      username,
      clanName: newClanName,
      tag: newClanTag,
      playerScore: Math.max(state.seasonalScore, state.lifetimeCoins),
      isSandbox,
    });
    if (res.ok && res.clan) {
      onUpdateState((prev) => ({ ...prev, clanId: res.clan!.id, clanName: res.clan!.name }));
      setNewClanName('');
      setNewClanTag('');
      setStatusMsg(`Created clan [${res.clan.tag}] ${res.clan.name}!`);
      await refreshData();
    } else {
      setStatusMsg(res.error || 'Could not create clan.');
    }
  };

  const handleInvite = async () => {
    if (!myClan || !uid || !username) return;
    const res = await sendClanInvite({
      clan: myClan,
      fromUid: uid,
      fromUsername: username,
      targetUsername: inviteUsername,
      isSandbox,
    });
    setStatusMsg(res.ok ? `Sent clan invite to ${inviteUsername}!` : res.error || 'Failed.');
    if (res.ok) setInviteUsername('');
  };

  const handleRespondInvite = async (inv: ClanInviteRecord, accept: boolean) => {
    if (!uid || !username) return;
    const res = await respondToClanInvite({
      invite: inv,
      accept,
      uid,
      username,
      playerScore: Math.max(state.seasonalScore, state.lifetimeCoins),
      isSandbox,
    });
    if (res.ok && accept && res.clan) {
      onUpdateState((prev) => ({ ...prev, clanId: res.clan!.id, clanName: res.clan!.name }));
      onNotify('CLAN JOINED', `Joined [${res.clan.tag}] ${res.clan.name}`);
    } else if (!res.ok) {
      setStatusMsg(res.error || 'Invite failed.');
    }
    await refreshData();
  };

  const handleLeaveClan = async () => {
    if (!state.clanId || !uid) return;
    await leaveOrUpdateClanScore({
      clanId: state.clanId,
      uid,
      playerScore: 0,
      leave: true,
      isSandbox,
    });
    onUpdateState((prev) => ({ ...prev, clanId: null, clanName: null }));
    setStatusMsg('Left clan.');
    await refreshData();
  };

  const handleSubmitTrade = async () => {
    if (!uid || !username) {
      setStatusMsg('Sign in to send trade offers.');
      return;
    }
    const chosenPet = offerPetId ? (state.pets || []).find((p) => p.instanceId === offerPetId) : undefined;
    const res = await createTradeOffer({
      fromUid: uid,
      fromUsername: username,
      toUsername: tradeTargetUser,
      offer: {
        skinIds: offerSkinId ? [offerSkinId] : [],
        pets: chosenPet ? [chosenPet] : [],
        sealedEggs: offerEggRarity ? { [offerEggRarity]: 1 } : {},
      },
      request: {
        skinIds: reqSkinId ? [reqSkinId] : [],
        pets: [],
        sealedEggs: {},
      },
      isSandbox,
    });
    setStatusMsg(res.ok ? `Trade sent to ${tradeTargetUser}!` : res.error || 'Trade failed.');
    if (res.ok) {
      setOfferSkinId('');
      setOfferPetId('');
      setOfferEggRarity('');
      setReqSkinId('');
      await refreshData();
    }
  };

  const handleAcceptIncomingTrade = async (t: TradeOfferRecord) => {
    const res = await acceptTradeAtomically({
      tradeId: t.id,
      recipientUid: uid,
      recipientState: state,
      isSandbox,
    });
    if (res.ok && res.nextState) {
      onUpdateState(() => res.nextState!);
      onNotify('TRADE COMPLETE', `Swapped items with ${t.fromUsername}!`);
      await refreshData();
    } else {
      setStatusMsg(res.error || 'Could not accept trade.');
    }
  };

  const handleFinalizeSenderTrade = async (t: TradeOfferRecord) => {
    const res = await claimCompletedSenderTradeAtomically({
      tradeId: t.id,
      senderState: state,
      isSandbox,
    });
    if (res.ok && res.nextState) {
      onUpdateState(() => res.nextState!);
      onNotify('TRADE SETTLED', `Received traded items from ${t.toUsername}!`);
      await refreshData();
    } else {
      setStatusMsg(res.error || 'Settlement error.');
    }
  };

  const tradableSkins = (state.unlockedSkins || []).filter((id) => id !== 'classic_matthew');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/96 backdrop-blur-xl flex flex-col p-4 sm:p-6 overflow-hidden select-none">
      <div className="flex items-center justify-between pb-4 border-b border-cyan-500/25 shrink-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-cyan-300" />
            <span>CLANS (MAX {SEASON_2_CONFIG.maxClanMembers}) &amp; ATOMIC TRADING</span>
          </h2>
          <p className="text-xs font-bold text-slate-400">
            Team up for Clan Leaderboard ranks or safely swap Skins, Pets &amp; Sealed Eggs!
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 py-3 shrink-0">
        {[
          { id: 'clans' as const, label: 'My Clan & Invites' },
          { id: 'clan_lb' as const, label: 'Clan Leaderboard' },
          { id: 'trading' as const, label: `Trade Skins / Pets / Eggs (${trades.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase cursor-pointer transition ${
              tab === t.id ? 'bg-cyan-400 text-slate-950' : 'bg-slate-900 text-slate-300 border border-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {statusMsg && (
        <div className="mb-3 px-4 py-2 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-xs font-black text-cyan-200 shrink-0">
          {statusMsg}
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-1 pb-4">
        {tab === 'clans' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              {myClan ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded bg-cyan-400/20 text-cyan-300 text-xs font-black mr-2">
                        [{myClan.tag}]
                      </span>
                      <span className="text-lg font-black text-white">{myClan.name}</span>
                    </div>
                    <button
                      onClick={handleLeaveClan}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-200 hover:text-white text-xs font-black cursor-pointer"
                    >
                      Leave
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {Object.values(myClan.members || {}).map((m) => (
                      <div
                        key={m.uid}
                        className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-bold"
                      >
                        <span className="text-white">
                          {m.username} {m.role === 'leader' ? '(Leader)' : ''}
                        </span>
                        <span className="text-amber-300">{formatCoins(m.score)}</span>
                      </div>
                    ))}
                  </div>
                  {Object.keys(myClan.members || {}).length < SEASON_2_CONFIG.maxClanMembers && (
                    <div className="flex gap-2">
                      <input
                        value={inviteUsername}
                        onChange={(e) => setInviteUsername(e.target.value)}
                        placeholder="Invite username..."
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                      />
                      <button
                        onClick={handleInvite}
                        className="px-4 py-2 rounded-xl bg-cyan-400 text-slate-950 font-black text-xs uppercase cursor-pointer"
                      >
                        Invite
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-base font-black text-white">Create a Frozen Apocalypse Clan</h3>
                  <div className="flex gap-2">
                    <input
                      value={newClanName}
                      onChange={(e) => setNewClanName(e.target.value)}
                      placeholder="Clan Name (e.g. FrostKings)"
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                    <input
                      value={newClanTag}
                      onChange={(e) => setNewClanTag(e.target.value)}
                      placeholder="TAG"
                      maxLength={4}
                      className="w-20 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white uppercase"
                    />
                  </div>
                  <button
                    onClick={handleCreateClan}
                    className="w-full py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs uppercase cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Clan</span>
                  </button>
                </div>
              )}
            </div>

            {/* Incoming Clan Invites */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <h3 className="text-base font-black text-white">Incoming Clan Invites</h3>
              {invites.length === 0 ? (
                <p className="text-xs font-bold text-slate-400">No pending clan invites.</p>
              ) : (
                invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="text-xs font-bold text-white">
                      [{inv.clanTag}] {inv.clanName}{' '}
                      <span className="text-slate-400">from {inv.fromUsername}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleRespondInvite(inv, true)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRespondInvite(inv, false)}
                        className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-black text-xs cursor-pointer"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'clan_lb' && (
          <div className="space-y-2 max-w-3xl mx-auto">
            {clanBoard.map((c, idx) => (
              <div
                key={c.id}
                className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 font-black text-sm flex items-center justify-center">
                    #{idx + 1}
                  </div>
                  <div>
                    <div className="text-sm font-black text-white">
                      [{c.tag}] {c.name}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400">
                      {Object.keys(c.members || {}).length}/{SEASON_2_CONFIG.maxClanMembers} Members • Leader: {c.leaderUsername}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-amber-300 font-black text-sm">
                  <Trophy className="w-4 h-4" />
                  <span>{formatCoins(c.totalScore)}</span>
                </div>
              </div>
            ))}
            {clanBoard.length === 0 && (
              <div className="text-center p-8 text-xs font-bold text-slate-400">
                No clans founded yet — be the first Clan #1!
              </div>
            )}
          </div>
        )}

        {tab === 'trading' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-cyan-300" />
                <span>Send Atomic Trade Offer</span>
              </h3>
              <input
                value={tradeTargetUser}
                onChange={(e) => setTradeTargetUser(e.target.value)}
                placeholder="Recipient Username..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
              />
              <select
                value={offerSkinId}
                onChange={(e) => setOfferSkinId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
              >
                <option value="">-- Offer a Skin (Optional) --</option>
                {tradableSkins.map((id) => (
                  <option key={id} value={id}>
                    Offer Skin: {getSkinById(id).name}
                  </option>
                ))}
              </select>
              <select
                value={offerPetId}
                onChange={(e) => setOfferPetId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
              >
                <option value="">-- Offer a Hatched Pet (Optional) --</option>
                {(state.pets || []).map((p) => (
                  <option key={p.instanceId} value={p.instanceId}>
                    Offer Pet: {p.name} (Lv.{p.level} {p.rarity})
                  </option>
                ))}
              </select>
              <select
                value={offerEggRarity}
                onChange={(e) => setOfferEggRarity(e.target.value as EggRarity | '')}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
              >
                <option value="">-- Offer 1× Sealed Egg (Optional) --</option>
                {EGG_RARITY_ORDER.filter((r) => (state.sealedEggs?.[r] || 0) > 0).map((r) => (
                  <option key={r} value={r}>
                    Offer 1× Sealed {r} (Owned: {state.sealedEggs?.[r] || 0})
                  </option>
                ))}
              </select>
              <input
                value={reqSkinId}
                onChange={(e) => setReqSkinId(e.target.value)}
                placeholder="Requested Skin ID (optional, e.g. snowy_matthew)"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
              />
              <button
                onClick={handleSubmitTrade}
                className="w-full py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs uppercase cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>Send Locked Trade</span>
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
              <h3 className="text-base font-black text-white">Active Trades</h3>
              {trades.length === 0 ? (
                <p className="text-xs font-bold text-slate-400">No active trades.</p>
              ) : (
                trades.map((t) => {
                  const isRecipient = t.normalizedTo === username.toLowerCase();
                  return (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex justify-between font-black">
                        <span className="text-cyan-300">
                          {t.fromUsername} ⇄ {t.toUsername}
                        </span>
                        <span className="uppercase text-amber-300">{t.status}</span>
                      </div>
                      <div className="text-slate-300 font-bold">
                        Offers: {t.offer.skinIds.join(', ') || ''}{' '}
                        {t.offer.pets.map((p) => `${p.name} Lv${p.level}`).join(', ')}{' '}
                        {Object.entries(t.offer.sealedEggs || {})
                          .filter(([, q]) => (q || 0) > 0)
                          .map(([r, q]) => `${q}× ${r}`)
                          .join(', ')}
                      </div>
                      <div className="flex gap-2">
                        {isRecipient && t.status === 'pending' && (
                          <button
                            onClick={() => handleAcceptIncomingTrade(t)}
                            className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black cursor-pointer"
                          >
                            Accept &amp; Swap
                          </button>
                        )}
                        {!isRecipient && t.status === 'accepted_by_recipient' && !t.fromSettled && (
                          <button
                            onClick={() => handleFinalizeSenderTrade(t)}
                            className="px-3 py-1 rounded-lg bg-amber-400 text-slate-950 font-black cursor-pointer"
                          >
                            Claim Settlement
                          </button>
                        )}
                        {t.status === 'pending' && (
                          <button
                            onClick={() =>
                              cancelOrDeclineTrade(
                                t.id,
                                isRecipient ? 'declined' : 'cancelled',
                                isSandbox
                              ).then(refreshData)
                            }
                            className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-black cursor-pointer"
                          >
                            {isRecipient ? 'Decline' : 'Cancel'}
                          </button>
                        )}
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
  );
};

