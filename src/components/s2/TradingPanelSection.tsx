import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, Send } from 'lucide-react';
import { EggRarity, GameState } from '../../types/game';
import {
  TradeOfferRecord,
  acceptTradeAtomically,
  cancelOrDeclineTrade,
  claimCompletedSenderTradeAtomically,
  createTradeOffer,
  fetchTradesForPlayer,
} from '../../firebase/clansAndTrades';
import { getSkinById } from '../../data/skins';
import { EGG_RARITY_ORDER } from '../../data/petsAndEggs';

interface TradingPanelSectionProps {
  state: GameState;
  isSandbox: boolean;
  onUpdateState: (updater: (prev: GameState) => GameState) => void;
  onNotify: (title: string, subtitle?: string) => void;
}

export const TradingPanelSection: React.FC<TradingPanelSectionProps> = ({
  state,
  isSandbox,
  onUpdateState,
  onNotify,
}) => {
  const [trades, setTrades] = useState<TradeOfferRecord[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [tradeTargetUser, setTradeTargetUser] = useState('');
  const [offerSkinId, setOfferSkinId] = useState('');
  const [offerPetId, setOfferPetId] = useState('');
  const [offerEggRarity, setOfferEggRarity] = useState<EggRarity | ''>('');
  const [reqSkinId, setReqSkinId] = useState('');

  const uid = state.cloudAccount?.uid || '';
  const username = state.cloudAccount?.displayUsername || state.cloudAccount?.username || '';
  const tradableSkins = (state.unlockedSkins || []).filter((id) => id !== 'classic_matthew');

  const refreshTrades = async () => {
    if (!uid || !username) return;
    const list = await fetchTradesForPlayer(uid, username, isSandbox);
    setTrades(list);
  };

  useEffect(() => {
    refreshTrades();
  }, [uid, username, isSandbox]);

  const handleSubmitTrade = async () => {
    if (!uid || !username) {
      setStatusMsg('Sign in to an account to trade.');
      return;
    }
    const pet = offerPetId ? (state.pets || []).find((p) => p.instanceId === offerPetId) : undefined;
    const res = await createTradeOffer({
      fromUid: uid,
      fromUsername: username,
      toUsername: tradeTargetUser,
      offer: {
        skinIds: offerSkinId ? [offerSkinId] : [],
        pets: pet ? [pet] : [],
        sealedEggs: offerEggRarity ? { [offerEggRarity]: 1 } : {},
      },
      request: {
        skinIds: reqSkinId ? [reqSkinId] : [],
        pets: [],
        sealedEggs: {},
      },
      isSandbox,
    });
    setStatusMsg(res.ok ? `Sent trade to ${tradeTargetUser}!` : res.error || 'Trade failed.');
    if (res.ok) {
      setOfferSkinId('');
      setOfferPetId('');
      setOfferEggRarity('');
      setReqSkinId('');
      await refreshTrades();
    }
  };

  const handleAccept = async (t: TradeOfferRecord) => {
    const res = await acceptTradeAtomically({
      tradeId: t.id,
      recipientUid: uid,
      recipientState: state,
      isSandbox,
    });
    if (res.ok && res.nextState) {
      onUpdateState(() => res.nextState!);
      onNotify('TRADE COMPLETE', `Swapped with ${t.fromUsername}!`);
      await refreshTrades();
    } else {
      setStatusMsg(res.error || 'Could not accept trade.');
    }
  };

  const handleClaim = async (t: TradeOfferRecord) => {
    const res = await claimCompletedSenderTradeAtomically({
      tradeId: t.id,
      senderState: state,
      isSandbox,
    });
    if (res.ok && res.nextState) {
      onUpdateState(() => res.nextState!);
      onNotify('TRADE SETTLED', `Received items from ${t.toUsername}!`);
      await refreshTrades();
    } else {
      setStatusMsg(res.error || 'Settlement error.');
    }
  };

  return (
    <div className="space-y-3">
      {statusMsg && (
        <div className="px-3 py-2 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-[11px] font-black text-cyan-200">
          {statusMsg}
        </div>
      )}

      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
        <div className="text-xs font-black text-white flex items-center gap-1.5">
          <ArrowLeftRight className="w-4 h-4 text-cyan-300" />
          <span>Trade Skins, Pets &amp; Eggs</span>
        </div>

        <input
          value={tradeTargetUser}
          onChange={(e) => setTradeTargetUser(e.target.value)}
          placeholder="Player username..."
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
        />

        <select
          value={offerSkinId}
          onChange={(e) => setOfferSkinId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
        >
          <option value="">-- Offer Skin --</option>
          {tradableSkins.map((id) => (
            <option key={id} value={id}>
              {getSkinById(id).name}
            </option>
          ))}
        </select>

        <select
          value={offerPetId}
          onChange={(e) => setOfferPetId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
        >
          <option value="">-- Offer Pet --</option>
          {(state.pets || []).map((p) => (
            <option key={p.instanceId} value={p.instanceId}>
              {p.name} (Lv.{p.level})
            </option>
          ))}
        </select>

        <select
          value={offerEggRarity}
          onChange={(e) => setOfferEggRarity(e.target.value as EggRarity | '')}
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
        >
          <option value="">-- Offer Sealed Egg --</option>
          {EGG_RARITY_ORDER.filter((r) => (state.sealedEggs?.[r] || 0) > 0).map((r) => (
            <option key={r} value={r}>
              {r} ({state.sealedEggs?.[r] || 0})
            </option>
          ))}
        </select>

        <input
          value={reqSkinId}
          onChange={(e) => setReqSkinId(e.target.value)}
          placeholder="Request Skin ID (optional)"
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
        />

        <button
          onClick={handleSubmitTrade}
          className="w-full py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs uppercase cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send Trade</span>
        </button>
      </div>

      <div className="space-y-2">
        {trades.map((t) => {
          const isRecipient = t.normalizedTo === username.toLowerCase();
          return (
            <div
              key={t.id}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-[11px]"
            >
              <div className="flex justify-between font-black">
                <span className="text-cyan-300">
                  {t.fromUsername} ⇄ {t.toUsername}
                </span>
                <span className="uppercase text-amber-300">{t.status}</span>
              </div>
              <div className="flex gap-2">
                {isRecipient && t.status === 'pending' && (
                  <button
                    onClick={() => handleAccept(t)}
                    className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black cursor-pointer"
                  >
                    Accept
                  </button>
                )}
                {!isRecipient && t.status === 'accepted_by_recipient' && !t.fromSettled && (
                  <button
                    onClick={() => handleClaim(t)}
                    className="px-3 py-1 rounded-lg bg-amber-400 text-slate-950 font-black cursor-pointer"
                  >
                    Claim
                  </button>
                )}
                {t.status === 'pending' && (
                  <button
                    onClick={() =>
                      cancelOrDeclineTrade(
                        t.id,
                        isRecipient ? 'declined' : 'cancelled',
                        isSandbox
                      ).then(refreshTrades)
                    }
                    className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-black cursor-pointer"
                  >
                    {isRecipient ? 'Decline' : 'Cancel'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

