import { SEASON_2_CONFIG } from '../config/gameConfig';
import { EggRarity, GameState, PetInstance } from '../types/game';
import {
  rtdbRestConditionalPut,
  rtdbRestDelete,
  rtdbRestGet,
  rtdbRestGetWithETag,
  rtdbRestWrite,
  scopeRtdbPath,
} from './config';

// ============================================================================
// CLANS (MAX 5 MEMBERS + CLAN LEADERBOARD)
// ============================================================================

export interface ClanMemberRecord {
  uid: string;
  username: string;
  score: number;
  joinedAtMs: number;
  role: 'leader' | 'member';
}

export interface ClanRecord {
  id: string;
  name: string;
  tag: string;
  leaderUid: string;
  leaderUsername: string;
  createdAtMs: number;
  updatedAtMs: number;
  members: Record<string, ClanMemberRecord>;
  totalScore: number;
}

export interface ClanInviteRecord {
  id: string;
  clanId: string;
  clanName: string;
  clanTag: string;
  fromUid: string;
  fromUsername: string;
  toUsername: string;
  normalizedTo: string;
  createdAtMs: number;
}

export async function createClan(params: {
  uid: string;
  username: string;
  clanName: string;
  tag: string;
  playerScore: number;
  isSandbox?: boolean;
}): Promise<{ ok: boolean; clan?: ClanRecord; error?: string }> {
  const cleanName = params.clanName.trim();
  const cleanTag = params.tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'ICE';
  if (cleanName.length < 3 || cleanName.length > 22) {
    return { ok: false, error: 'Clan name must be 3 to 22 characters.' };
  }

  const clanId = `clan_${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`;
  const now = Date.now();
  const clan: ClanRecord = {
    id: clanId,
    name: cleanName,
    tag: cleanTag,
    leaderUid: params.uid,
    leaderUsername: params.username,
    createdAtMs: now,
    updatedAtMs: now,
    totalScore: Math.max(0, Math.floor(params.playerScore)),
    members: {
      [params.uid]: {
        uid: params.uid,
        username: params.username,
        score: Math.max(0, Math.floor(params.playerScore)),
        joinedAtMs: now,
        role: 'leader',
      },
    },
  };

  const ok = await rtdbRestWrite(scopeRtdbPath(`clans/${clanId}`, params.isSandbox), clan, 'PUT');
  if (!ok) return { ok: false, error: 'Failed to create clan on server.' };
  return { ok: true, clan };
}

export async function sendClanInvite(params: {
  clan: ClanRecord;
  fromUid: string;
  fromUsername: string;
  targetUsername: string;
  isSandbox?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const cleanTarget = params.targetUsername.trim();
  if (cleanTarget.length < 3) return { ok: false, error: 'Enter a valid player username.' };
  const memberCount = Object.keys(params.clan.members || {}).length;
  if (memberCount >= SEASON_2_CONFIG.maxClanMembers) {
    return { ok: false, error: `Clan is full (${SEASON_2_CONFIG.maxClanMembers} max members).` };
  }
  const normalizedTo = cleanTarget.toLowerCase();
  const inviteId = `inv_${params.clan.id}_${normalizedTo}`;
  const invite: ClanInviteRecord = {
    id: inviteId,
    clanId: params.clan.id,
    clanName: params.clan.name,
    clanTag: params.clan.tag,
    fromUid: params.fromUid,
    fromUsername: params.fromUsername,
    toUsername: cleanTarget,
    normalizedTo,
    createdAtMs: Date.now(),
  };

  const ok = await rtdbRestWrite(
    scopeRtdbPath(`clan_invites/${normalizedTo}/${inviteId}`, params.isSandbox),
    invite,
    'PUT'
  );
  return ok ? { ok: true } : { ok: false, error: 'Could not deliver clan invite.' };
}

export async function fetchIncomingClanInvites(
  username: string,
  isSandbox: boolean = false
): Promise<ClanInviteRecord[]> {
  if (!username) return [];
  const norm = username.trim().toLowerCase();
  const map = await rtdbRestGet<Record<string, ClanInviteRecord>>(
    scopeRtdbPath(`clan_invites/${norm}`, isSandbox),
    3500
  );
  if (!map || typeof map !== 'object') return [];
  return Object.values(map).filter((inv) => Boolean(inv && inv.clanId));
}

export async function respondToClanInvite(params: {
  invite: ClanInviteRecord;
  accept: boolean;
  uid: string;
  username: string;
  playerScore: number;
  isSandbox?: boolean;
}): Promise<{ ok: boolean; clan?: ClanRecord; error?: string }> {
  const invitePath = scopeRtdbPath(
    `clan_invites/${params.invite.normalizedTo}/${params.invite.id}`,
    params.isSandbox
  );
  await rtdbRestDelete(invitePath).catch(() => false);

  if (!params.accept) {
    return { ok: true };
  }

  const clanPath = scopeRtdbPath(`clans/${params.invite.clanId}`, params.isSandbox);
  const { ok, data: clan, etag } = await rtdbRestGetWithETag<ClanRecord>(clanPath, 4000);
  if (!ok || !clan) {
    return { ok: false, error: 'Clan no longer exists.' };
  }

  const members = { ...(clan.members || {}) };
  if (
    !members[params.uid] &&
    Object.keys(members).length >= SEASON_2_CONFIG.maxClanMembers
  ) {
    return {
      ok: false,
      error: `Clan is already full (max ${SEASON_2_CONFIG.maxClanMembers} members).`,
    };
  }

  members[params.uid] = {
    uid: params.uid,
    username: params.username,
    score: Math.max(0, Math.floor(params.playerScore)),
    joinedAtMs: Date.now(),
    role: 'member',
  };

  const nextClan: ClanRecord = {
    ...clan,
    members,
    totalScore: Object.values(members).reduce((s, m) => s + (m.score || 0), 0),
    updatedAtMs: Date.now(),
  };

  if (etag) {
    const cas = await rtdbRestConditionalPut(clanPath, nextClan, etag, 4000);
    if (cas.conflict) {
      return { ok: false, error: 'Clan updated concurrently — please try accepting again.' };
    }
    return cas.ok ? { ok: true, clan: nextClan } : { ok: false, error: 'Failed to join clan.' };
  }

  const wrote = await rtdbRestWrite(clanPath, nextClan, 'PUT');
  return wrote ? { ok: true, clan: nextClan } : { ok: false, error: 'Failed to join clan.' };
}

export async function leaveOrUpdateClanScore(params: {
  clanId: string;
  uid: string;
  playerScore: number;
  leave?: boolean;
  isSandbox?: boolean;
}): Promise<ClanRecord | null> {
  const clanPath = scopeRtdbPath(`clans/${params.clanId}`, params.isSandbox);
  const clan = await rtdbRestGet<ClanRecord>(clanPath, 3500);
  if (!clan) return null;

  const members = { ...(clan.members || {}) };
  if (params.leave) {
    delete members[params.uid];
    if (Object.keys(members).length === 0) {
      await rtdbRestDelete(clanPath).catch(() => false);
      return null;
    }
  } else if (members[params.uid]) {
    members[params.uid] = {
      ...members[params.uid],
      score: Math.max(members[params.uid].score || 0, Math.floor(params.playerScore)),
    };
  }

  const updated: ClanRecord = {
    ...clan,
    members,
    totalScore: Object.values(members).reduce((s, m) => s + (m.score || 0), 0),
    updatedAtMs: Date.now(),
  };
  await rtdbRestWrite(clanPath, updated, 'PUT').catch(() => false);
  return updated;
}

export async function fetchClanLeaderboard(
  isSandbox: boolean = false
): Promise<ClanRecord[]> {
  const map = await rtdbRestGet<Record<string, ClanRecord>>(
    scopeRtdbPath('clans', isSandbox),
    4500
  );
  if (!map || typeof map !== 'object') return [];
  return Object.values(map)
    .filter((c) => Boolean(c && c.id && c.name))
    .map((c) => ({
      ...c,
      totalScore: Object.values(c.members || {}).reduce((s, m) => s + (m.score || 0), 0),
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

// ============================================================================
// ATOMIC TRADING (SKINS, PETS, SEALED EGGS — ANTI-DUPE ETAG CAS)
// ============================================================================

export interface TradeBundle {
  skinIds: string[];
  pets: PetInstance[];
  sealedEggs: Partial<Record<EggRarity, number>>;
}

export interface TradeOfferRecord {
  id: string;
  fromUid: string;
  fromUsername: string;
  toUsername: string;
  normalizedTo: string;
  offer: TradeBundle;
  request: TradeBundle;
  status: 'pending' | 'accepted_by_recipient' | 'settled' | 'declined' | 'cancelled';
  createdAtMs: number;
  updatedAtMs: number;
  settledByUid?: string;
  fromSettled?: boolean;
}

export async function createTradeOffer(params: {
  fromUid: string;
  fromUsername: string;
  toUsername: string;
  offer: TradeBundle;
  request: TradeBundle;
  isSandbox?: boolean;
}): Promise<{ ok: boolean; trade?: TradeOfferRecord; error?: string }> {
  const cleanTo = params.toUsername.trim();
  if (cleanTo.length < 3) return { ok: false, error: 'Target username is required.' };
  if (cleanTo.toLowerCase() === params.fromUsername.trim().toLowerCase()) {
    return { ok: false, error: 'You cannot trade with yourself.' };
  }

  const hasOffer =
    params.offer.skinIds.length > 0 ||
    params.offer.pets.length > 0 ||
    Object.values(params.offer.sealedEggs || {}).some((n) => (n || 0) > 0);
  if (!hasOffer) {
    return { ok: false, error: 'Offer at least one skin, pet, or sealed egg.' };
  }

  const tradeId = `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const trade: TradeOfferRecord = {
    id: tradeId,
    fromUid: params.fromUid,
    fromUsername: params.fromUsername,
    toUsername: cleanTo,
    normalizedTo: cleanTo.toLowerCase(),
    offer: params.offer,
    request: params.request,
    status: 'pending',
    createdAtMs: now,
    updatedAtMs: now,
    fromSettled: false,
  };

  const ok = await rtdbRestWrite(scopeRtdbPath(`trades/${tradeId}`, params.isSandbox), trade, 'PUT');
  return ok ? { ok: true, trade } : { ok: false, error: 'Failed to submit trade offer.' };
}

export async function fetchTradesForPlayer(
  uid: string,
  username: string,
  isSandbox: boolean = false
): Promise<TradeOfferRecord[]> {
  const all = await rtdbRestGet<Record<string, TradeOfferRecord>>(
    scopeRtdbPath('trades', isSandbox),
    4000
  );
  if (!all || typeof all !== 'object') return [];
  const norm = username.trim().toLowerCase();
  return Object.values(all)
    .filter(
      (t) =>
        t &&
        (t.fromUid === uid || t.normalizedTo === norm) &&
        t.status !== 'declined' &&
        t.status !== 'cancelled'
    )
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
}

/**
 * Pure deterministic local state validator & swap helper for atomic trading.
 * Verifies ownership of requested/offered items and ensures non-duplicative settlement.
 */
export function applyTradeSwapToState(
  state: GameState,
  give: TradeBundle,
  receive: TradeBundle
): { ok: boolean; nextState?: GameState; error?: string } {
  const unlocked = new Set(state.unlockedSkins || ['classic_matthew']);
  for (const skinId of give.skinIds) {
    if (skinId === 'classic_matthew' || !unlocked.has(skinId)) {
      return { ok: false, error: `Missing or untradable skin: ${skinId}` };
    }
  }

  const ownedPets = [...(state.pets || [])];
  const givePetIds = new Set(give.pets.map((p) => p.instanceId));
  for (const pet of give.pets) {
    if (!ownedPets.some((p) => p.instanceId === pet.instanceId)) {
      return { ok: false, error: `Missing pet: ${pet.name}` };
    }
  }

  const nextEggs = { ...state.sealedEggs };
  for (const [rarity, qty] of Object.entries(give.sealedEggs || {})) {
    const count = qty || 0;
    if ((nextEggs[rarity as EggRarity] || 0) < count) {
      return { ok: false, error: `Not enough sealed ${rarity}s.` };
    }
    nextEggs[rarity as EggRarity] = Math.max(0, (nextEggs[rarity as EggRarity] || 0) - count);
  }

  // Deduct gave skins & add received skins
  for (const skinId of give.skinIds) unlocked.delete(skinId);
  for (const skinId of receive.skinIds) unlocked.add(skinId);

  // Deduct gave pets & add received pets with fresh instanceIds if needed
  const remainingPets = ownedPets.filter((p) => !givePetIds.has(p.instanceId));
  const receivedPets = receive.pets.map((p) => ({
    ...p,
    instanceId: remainingPets.some((x) => x.instanceId === p.instanceId)
      ? `${p.instanceId}_rx_${Date.now().toString(36)}`
      : p.instanceId,
  }));

  for (const [rarity, qty] of Object.entries(receive.sealedEggs || {})) {
    nextEggs[rarity as EggRarity] = (nextEggs[rarity as EggRarity] || 0) + (qty || 0);
  }

  const nextEquippedPets = (state.equippedPetIds || []).filter((id) => !givePetIds.has(id));
  const nextEquippedSkin = unlocked.has(state.equippedSkin) ? state.equippedSkin : 'classic_matthew';

  return {
    ok: true,
    nextState: {
      ...state,
      unlockedSkins: Array.from(unlocked),
      equippedSkin: nextEquippedSkin,
      pets: [...remainingPets, ...receivedPets],
      equippedPetIds: nextEquippedPets,
      sealedEggs: nextEggs,
    },
  };
}

/**
 * Accepts a pending trade atomically via RTDB ETag CAS so the recipient cannot double-accept
 * or receive duplicated items across two tabs/requests.
 */
export async function acceptTradeAtomically(params: {
  tradeId: string;
  recipientUid: string;
  recipientState: GameState;
  isSandbox?: boolean;
}): Promise<{ ok: boolean; nextState?: GameState; error?: string }> {
  const path = scopeRtdbPath(`trades/${params.tradeId}`, params.isSandbox);
  const { ok, data: trade, etag } = await rtdbRestGetWithETag<TradeOfferRecord>(path, 4000);
  if (!ok || !trade) return { ok: false, error: 'Trade not found.' };
  if (trade.status !== 'pending') {
    return { ok: false, error: 'Trade was already settled or cancelled.' };
  }

  const swap = applyTradeSwapToState(params.recipientState, trade.request, trade.offer);
  if (!swap.ok || !swap.nextState) {
    return { ok: false, error: swap.error || 'Missing requested items to accept trade.' };
  }

  const nextTrade: TradeOfferRecord = {
    ...trade,
    status: 'accepted_by_recipient',
    settledByUid: params.recipientUid,
    updatedAtMs: Date.now(),
  };

  if (etag) {
    const cas = await rtdbRestConditionalPut(path, nextTrade, etag, 4000);
    if (cas.conflict || !cas.ok) {
      return { ok: false, error: 'Trade lock conflict — please refresh trades.' };
    }
  } else {
    const wrote = await rtdbRestWrite(path, nextTrade, 'PUT');
    if (!wrote) return { ok: false, error: 'Network error committing trade.' };
  }

  return { ok: true, nextState: swap.nextState };
}

export async function claimCompletedSenderTradeAtomically(params: {
  tradeId: string;
  senderState: GameState;
  isSandbox?: boolean;
}): Promise<{ ok: boolean; nextState?: GameState; error?: string }> {
  const path = scopeRtdbPath(`trades/${params.tradeId}`, params.isSandbox);
  const { ok, data: trade, etag } = await rtdbRestGetWithETag<TradeOfferRecord>(path, 4000);
  if (!ok || !trade) return { ok: false, error: 'Trade missing.' };
  if (trade.status !== 'accepted_by_recipient' || trade.fromSettled) {
    return { ok: false, error: 'Trade already finalized.' };
  }

  const swap = applyTradeSwapToState(params.senderState, trade.offer, trade.request);
  if (!swap.ok || !swap.nextState) {
    return { ok: false, error: swap.error || 'Could not settle offered items.' };
  }

  const finalized: TradeOfferRecord = {
    ...trade,
    status: 'settled',
    fromSettled: true,
    updatedAtMs: Date.now(),
  };
  if (etag) {
    const cas = await rtdbRestConditionalPut(path, finalized, etag, 4000);
    if (cas.conflict || !cas.ok) return { ok: false, error: 'Trade settlement lock failed.' };
  } else {
    await rtdbRestWrite(path, finalized, 'PUT');
  }
  return { ok: true, nextState: swap.nextState };
}

export async function cancelOrDeclineTrade(
  tradeId: string,
  action: 'declined' | 'cancelled',
  isSandbox: boolean = false
): Promise<boolean> {
  return rtdbRestWrite(
    scopeRtdbPath(`trades/${tradeId}`, isSandbox),
    { status: action, updatedAtMs: Date.now() },
    'PATCH'
  );
}

