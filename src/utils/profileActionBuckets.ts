import type { RangeAction, RangeActionBucket, RangeBucketKind, SituationRange } from '../types/profiles';

const EXTRA_COLORS = [
  { bg: 'rgba(64,178,255,0.28)', border: 'rgba(64,178,255,0.68)', text: '#40b2ff' },
  { bg: 'rgba(44,214,179,0.28)', border: 'rgba(44,214,179,0.68)', text: '#2cd6b3' },
  { bg: 'rgba(172,119,255,0.28)', border: 'rgba(172,119,255,0.68)', text: '#ac77ff' },
  { bg: 'rgba(255,157,66,0.28)', border: 'rgba(255,157,66,0.68)', text: '#ff9d42' },
  { bg: 'rgba(255,112,168,0.28)', border: 'rgba(255,112,168,0.68)', text: '#ff70a8' },
  { bg: 'rgba(173,226,93,0.28)', border: 'rgba(173,226,93,0.68)', text: '#ade25d' },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.trim().replace(/^#/, '');
  const normalized = clean.length === 3
    ? clean.split('').map(char => `${char}${char}`).join('')
    : clean;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

export function bucketColorsFromAccent(accent: string): Pick<RangeActionBucket, 'bg' | 'border' | 'text'> {
  const rgb = hexToRgb(accent);
  if (!rgb) {
    return { bg: 'rgba(64,178,255,0.28)', border: 'rgba(64,178,255,0.68)', text: '#40b2ff' };
  }

  const text = `#${[rgb.r, rgb.g, rgb.b]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')}`;

  return {
    bg: `rgba(${rgb.r},${rgb.g},${rgb.b},0.28)`,
    border: `rgba(${rgb.r},${rgb.g},${rgb.b},0.68)`,
    text,
  };
}

const DEFAULT_FOLD: RangeActionBucket = {
  id: 'fold',
  kind: 'fold',
  label: 'Fold',
  emoji: 'F',
  bg: 'rgba(255,85,85,0.28)',
  border: 'rgba(255,85,85,0.6)',
  text: '#ff7070',
};

const DEFAULT_PREMIUM: RangeActionBucket = {
  id: 'raise',
  kind: 'premium',
  label: 'Premium / all-in',
  emoji: 'AI',
  bg: 'rgba(48,232,122,0.28)',
  border: 'rgba(48,232,122,0.6)',
  text: '#30e87a',
};

function formatBB(bb: number): string {
  return Number.isInteger(bb) ? String(bb) : String(Number(bb.toFixed(1)));
}

export function makeThresholdBucket(
  kind: Extract<RangeBucketKind, 'callRaise' | 'limp'>,
  maxBB: number,
  usedCount = 0,
): RangeActionBucket {
  const bb = Math.max(0.5, Number(maxBB) || 1);
  const color = EXTRA_COLORS[usedCount % EXTRA_COLORS.length];
  const prefix = kind === 'callRaise' ? 'cr' : 'limp';
  return {
    id: `${prefix}_${formatBB(bb).replace('.', '_')}`,
    kind,
    label: kind === 'callRaise'
      ? `Call/Raise to ${formatBB(bb)}BB`
      : `Limp to ${formatBB(bb)}BB`,
    emoji: kind === 'callRaise' ? 'CR' : 'LP',
    maxBB: bb,
    ...color,
  };
}

export function defaultActionBuckets(callThresholdBB = 10, limpThresholdBB = 1): RangeActionBucket[] {
  return [
    DEFAULT_FOLD,
    makeThresholdBucket('limp', limpThresholdBB, 3),
    makeThresholdBucket('callRaise', callThresholdBB, 0),
    DEFAULT_PREMIUM,
  ].map(bucket => {
    if (bucket.kind === 'limp') return { ...bucket, id: 'limp' };
    if (bucket.kind === 'callRaise') return { ...bucket, id: 'call' };
    return bucket;
  });
}

export function ensureActionBuckets(situation: SituationRange): RangeActionBucket[] {
  const defaults = defaultActionBuckets(situation.callThresholdBB, situation.limpThresholdBB ?? 1);
  const custom = situation.actionBuckets ?? [];
  const byId = new Map<RangeAction, RangeActionBucket>();

  for (const bucket of [...defaults, ...custom]) {
    byId.set(bucket.id, bucket);
  }

  return [...byId.values()];
}

export function actionBucketFor(
  action: RangeAction | null | undefined,
  buckets: RangeActionBucket[],
): RangeActionBucket {
  return buckets.find(bucket => bucket.id === action) ?? buckets.find(bucket => bucket.id === 'fold') ?? DEFAULT_FOLD;
}

export function actionLabel(action: RangeAction | null | undefined, buckets: RangeActionBucket[]): string {
  return actionBucketFor(action, buckets).label;
}

export function nextBucketColorIndex(buckets: RangeActionBucket[]): number {
  return Math.max(0, buckets.filter(bucket => !['fold', 'limp', 'call', 'raise'].includes(bucket.id)).length);
}
