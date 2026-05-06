import type { Card } from '../types/poker';
import type { PlayerProfile, RangeAction, RangeActionBucket } from '../types/profiles';
import { DEFAULT_ACTION_CONTEXT } from '../types/profiles';
import {
  HAND_RANK_MAP,
  buildRangeFromPercentile,
  getGtoChartEntry,
  suggestedVpip,
} from '../data/poker/profileTemplates';
import { RANKS } from './handMatrix';
import { actionLabel, defaultActionBuckets, ensureActionBuckets } from './profileActionBuckets';

const RANK_SET = new Set(RANKS as unknown as string[]);

export type RecommendationSource = 'profile' | 'gto';

export interface LiveHandRecommendation {
  handNotation: string;
  tableSize: number;
  position: string;
  source: RecommendationSource;
  action: RangeAction;
  actionLabel: string;
  buckets: RangeActionBucket[];
  profileId?: string;
  profileName?: string;
  profileAction?: RangeAction;
  profileActionLabel?: string;
  gtoAction: RangeAction;
  gtoActionLabel: string;
  gtoNote: string;
  rank: number | null;
}

export function parseHandNotation(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/10/g, 'T');
  if (s.length < 2 || s.length > 3) return null;

  const r1 = s[0];
  const r2 = s[1];
  if (!RANK_SET.has(r1) || !RANK_SET.has(r2)) return null;

  if (r1 === r2) {
    return s.length === 2 ? `${r1}${r2}` : null;
  }

  const suffix = s.length === 3 ? s[2] : null;
  if (suffix && suffix !== 'S' && suffix !== 'O') return null;

  const idx1 = RANKS.indexOf(r1 as typeof RANKS[number]);
  const idx2 = RANKS.indexOf(r2 as typeof RANKS[number]);
  const [highR, lowR] = idx1 < idx2 ? [r1, r2] : [r2, r1];
  const suitedness = suffix ? suffix.toLowerCase() : 's';
  const hand = `${highR}${lowR}${suitedness}`;
  return HAND_RANK_MAP[hand] !== undefined ? hand : null;
}

export function cardsToHandNotation(card1: Card, card2: Card): string {
  if (card1.rank === card2.rank) return `${card1.rank}${card2.rank}`;

  const idx1 = RANKS.indexOf(card1.rank);
  const idx2 = RANKS.indexOf(card2.rank);
  const [high, low] = idx1 < idx2 ? [card1, card2] : [card2, card1];
  const suitedness = card1.suit === card2.suit ? 's' : 'o';
  return `${high.rank}${low.rank}${suitedness}`;
}

export function getLiveHandRecommendation({
  handNotation,
  tableSize,
  position,
  profile,
}: {
  handNotation: string;
  tableSize: number;
  position: string;
  profile?: PlayerProfile | null;
}): LiveHandRecommendation {
  const parsedHand = parseHandNotation(handNotation) ?? handNotation;
  const exactGtoChart = getGtoChartEntry(tableSize, position);
  const vpip = exactGtoChart?.publishedPct ?? suggestedVpip(tableSize, position);
  const gtoRange = exactGtoChart?.range ?? buildRangeFromPercentile(vpip, 'call');
  const gtoBuckets = defaultActionBuckets(10, position === 'SB' ? 2 : 1);
  const gtoAction: RangeAction = gtoRange[parsedHand] ?? 'fold';
  const gtoActionLabel = actionLabel(gtoAction, gtoBuckets);

  const profileSituation = profile
    ?.positions.find(p => p.position === position)
    ?.situations[DEFAULT_ACTION_CONTEXT];
  const profileBuckets = profileSituation ? ensureActionBuckets(profileSituation) : null;
  const profileAction: RangeAction | undefined = profileSituation
    ? profileSituation.range[parsedHand] ?? 'fold'
    : undefined;
  const profileActionLabel = profileAction && profileBuckets
    ? actionLabel(profileAction, profileBuckets)
    : undefined;

  const source: RecommendationSource = profileAction ? 'profile' : 'gto';
  const action = profileAction ?? gtoAction;
  const buckets = profileBuckets ?? gtoBuckets;

  const gtoNote = exactGtoChart
    ? exactGtoChart.position === 'BB'
      ? `${position} · defend blind · ${exactGtoChart.note}`
      : exactGtoChart.publishedPct === null
        ? `${position} · no RFI open · ${exactGtoChart.note}`
        : `${position} · RFI · ${exactGtoChart.publishedPct}% chart.`
    : `${position} · RFI · top ${vpip}% fallback range.`;

  return {
    handNotation: parsedHand,
    tableSize,
    position,
    source,
    action,
    actionLabel: actionLabel(action, buckets),
    buckets,
    ...(profile ? { profileId: profile.id, profileName: profile.name } : {}),
    ...(profileAction ? { profileAction, profileActionLabel } : {}),
    gtoAction,
    gtoActionLabel,
    gtoNote,
    rank: HAND_RANK_MAP[parsedHand] ?? null,
  };
}
