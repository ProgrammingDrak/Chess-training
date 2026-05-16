import { useRef, useCallback, useState } from 'react';
import { RANKS, cellHand, handCombos } from '../../../utils/handMatrix';
import { HAND_RANK_MAP, buildRangeFromPercentile } from '../../../data/poker/profileTemplates';
import type { RangeAction, RangeActionBucket, RangeBucketKind } from '../../../types/profiles';
import {
  actionBucketFor,
  bucketColorsFromAccent,
  defaultActionBuckets,
  makeThresholdBucket,
  nextBucketColorIndex,
} from '../../../utils/profileActionBuckets';

// ─── Action config ────────────────────────────────────────────────────────────

export const ACTION_CFG = Object.fromEntries(defaultActionBuckets(10, 1).map(bucket => [bucket.id, bucket]));

const COLOR_INPUT_FALLBACK = '#40b2ff';

function colorInputValue(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : COLOR_INPUT_FALLBACK;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface HandRangeEditorProps {
  range: Record<string, RangeAction>;
  onChange: (next: Record<string, RangeAction>) => void;
  actionBuckets: RangeActionBucket[];
  onChangeActionBuckets: (next: RangeActionBucket[]) => void;
  onChangeCallThreshold?: (bb: number) => void;
  /** Position-aware VPIP suggestion — pre-seeds the quick-start slider. */
  suggestedPct?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HandRangeEditor({
  range,
  onChange,
  actionBuckets,
  onChangeActionBuckets,
  onChangeCallThreshold,
  suggestedPct,
}: HandRangeEditorProps) {
  const [activeBrush, setActiveBrush] = useState<RangeAction>('raise');
  const [playPct, setPlayPct] = useState(suggestedPct ?? 20);
  const isDragging = useRef(false);
  const buckets = actionBuckets.length > 0 ? actionBuckets : defaultActionBuckets(10, 1);
  const actionCycle = buckets.map(bucket => bucket.id);

  const getAction = (hand: string): RangeAction => range[hand] ?? 'fold';

  // Click = paint with active brush
  const handleMouseDown = useCallback((hand: string) => {
    isDragging.current = true;
    onChange({ ...range, [hand]: activeBrush });
  }, [range, onChange, activeBrush]);

  const handleMouseEnter = useCallback((hand: string) => {
    if (!isDragging.current) return;
    onChange({ ...range, [hand]: activeBrush });
  }, [range, onChange, activeBrush]);

  const stopDrag = useCallback(() => { isDragging.current = false; }, []);

  // Right-click = cycle through fold→limp→call→raise
  const handleContextMenu = useCallback((hand: string, e: React.MouseEvent) => {
    e.preventDefault();
    const cur = getAction(hand);
    const idx = actionCycle.indexOf(cur);
    const next = actionCycle[(idx + 1) % actionCycle.length] ?? 'fold';
    onChange({ ...range, [hand]: next });
  }, [range, onChange, getAction, actionCycle]);

  const applyPercentile = () => {
    onChange(buildRangeFromPercentile(playPct, 'call'));
  };

  const updateBucket = (id: RangeAction, updates: Partial<RangeActionBucket>) => {
    const next = buckets.map(bucket => {
      if (bucket.id !== id) return bucket;
      const nextBucket = { ...bucket, ...updates };
      if (nextBucket.kind === 'callRaise' && nextBucket.maxBB !== undefined) {
        nextBucket.label = `Call/Raise to ${nextBucket.maxBB}BB`;
      }
      if (nextBucket.kind === 'limp' && nextBucket.maxBB !== undefined) {
        nextBucket.label = `Limp to ${nextBucket.maxBB}BB`;
      }
      return nextBucket;
    });
    onChangeActionBuckets(next);

    if (id === 'call' && updates.maxBB !== undefined) {
      onChangeCallThreshold?.(updates.maxBB);
    }
  };

  const addThresholdBucket = (kind: Extract<RangeBucketKind, 'callRaise' | 'limp'>, maxBB: number) => {
    const base = makeThresholdBucket(kind, maxBB, nextBucketColorIndex(buckets));
    let nextBucket = base;
    let suffix = 2;
    while (buckets.some(bucket => bucket.id === nextBucket.id)) {
      nextBucket = { ...base, id: `${base.id}_${suffix}` };
      suffix += 1;
    }
    onChangeActionBuckets([...buckets, nextBucket]);
    setActiveBrush(nextBucket.id);
  };

  const removeBucket = (id: RangeAction) => {
    if (['fold', 'limp', 'call', 'raise'].includes(id)) return;
    onChangeActionBuckets(buckets.filter(bucket => bucket.id !== id));
    onChange(Object.fromEntries(Object.entries(range).map(([hand, action]) => [
      hand,
      action === id ? 'fold' : action,
    ])));
    if (activeBrush === id) setActiveBrush('fold');
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats: Record<string, { hands: number; combos: number }> = Object.fromEntries(
    buckets.map(bucket => [bucket.id, { hands: 0, combos: 0 }])
  );
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const hand = cellHand(row, col);
      const action = getAction(hand);
      const c = handCombos(hand);
      const key = stats[action] ? action : 'fold';
      stats[key].hands++;
      stats[key].combos += c;
    }
  }
  const playedCombos = buckets
    .filter(bucket => bucket.kind !== 'fold')
    .reduce((sum, bucket) => sum + (stats[bucket.id]?.combos ?? 0), 0);
  const vpipPct = ((playedCombos / 1326) * 100).toFixed(1);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="hre-wrapper">

      {/* Quick-start percentile slider */}
      <div className="hre-quickstart">
        <span className="hre-qs-label">Quick start — play top</span>
        <input
          type="range"
          min={1} max={100}
          value={playPct}
          onChange={e => setPlayPct(Number(e.target.value))}
          className="hre-slider"
        />
        <input
          type="number"
          min={1} max={100}
          value={playPct}
          onChange={e => setPlayPct(Math.max(1, Math.min(100, Number(e.target.value))))}
          className="hre-pct-input"
        />
        <span>% of hands</span>
        <button className="btn-secondary hre-apply-btn" onClick={applyPercentile}>
          Apply
        </button>
        <span className="hre-qs-hint">
          ≈ {Math.round((playPct / 100) * 1326)} combos of 1326
          {suggestedPct !== undefined && (
            <> · <span title="GTO-ish open range for this position">suggested {suggestedPct}%</span></>
          )}
        </span>
      </div>

      {/* Threshold bucket controls */}
      <div className="hre-thresholds">
        <div className="hre-threshold-copy">
          <strong>Green</strong> is premium/all-in. Blue buckets build the pot up to a cap.
          Yellow buckets try to see a flop cheaply up to a cap.
        </div>

        <div className="hre-bucket-grid">
          {buckets
            .filter(bucket => bucket.kind === 'callRaise' || bucket.kind === 'limp')
            .map(bucket => (
              <div key={bucket.id} className="hre-bucket-row" style={{ '--hre-action-color': bucket.text } as React.CSSProperties}>
                <span className="hre-bucket-swatch" style={{ background: bucket.bg, borderColor: bucket.border }} />
                <span className="hre-bucket-label">{bucket.kind === 'callRaise' ? 'Call/Raise to' : 'Limp to'}</span>
                <input
                  type="number"
                  min={0.5}
                  max={999}
                  step={0.5}
                  value={bucket.maxBB ?? 1}
                  onChange={e => updateBucket(bucket.id, { maxBB: Math.max(0.5, Number(e.target.value) || 0.5) })}
                  className="hre-bb-input"
                />
                <span className="hre-bucket-unit">BB</span>
                <label className="hre-color-control" title={`Change ${bucket.label} color`}>
                  <span className="sr-only">Change {bucket.label} color</span>
                  <input
                    type="color"
                    value={colorInputValue(bucket.text)}
                    onChange={e => updateBucket(bucket.id, bucketColorsFromAccent(e.target.value))}
                  />
                </label>
                {!['limp', 'call'].includes(bucket.id) && (
                  <button className="hre-bucket-remove" onClick={() => removeBucket(bucket.id)} title="Remove bucket">
                    x
                  </button>
                )}
              </div>
            ))}
        </div>

        <div className="hre-add-buckets">
          <button className="btn-secondary hre-add-btn" onClick={() => addThresholdBucket('callRaise', 20)}>
            Add Call
          </button>
          <button className="btn-secondary hre-add-btn" onClick={() => addThresholdBucket('limp', 2)}>
            Add Limp
          </button>
        </div>
      </div>

      {/* Brush selector */}
      <div className="hre-brush-row">
        <span className="hre-brush-label">Paint brush:</span>
        {buckets.map(bucket => {
          const isActive = activeBrush === bucket.id;
          return (
            <button
              key={bucket.id}
              className={`hre-brush-btn${isActive ? ' active' : ''}`}
              style={{ '--hre-action-color': bucket.text } as React.CSSProperties}
              onClick={() => setActiveBrush(bucket.id)}
            >
              {bucket.emoji} {bucket.label}
            </button>
          );
        })}
        <span className="hre-brush-hint">Right-click a cell to cycle its action</span>
      </div>

      {/* Grid */}
      <div
        className="hre-grid-container"
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onContextMenu={e => e.preventDefault()}
      >
        {/* Column rank headers */}
        <div className="hre-col-headers">
          <div className="hre-axis-corner" />
          {RANKS.map(r => (
            <div key={r} className="hre-axis-label">{r}</div>
          ))}
        </div>

        {/* Rows */}
        {RANKS.map((rowRank, row) => (
          <div key={rowRank} className="hre-grid-row">
            {/* Row rank header */}
            <div className="hre-axis-label hre-axis-label-row">{rowRank}</div>

            {/* Cells */}
            {RANKS.map((_, col) => {
              const hand = cellHand(row, col);
              const action = getAction(hand);
              const cfg = actionBucketFor(action, buckets);
              const rank = HAND_RANK_MAP[hand] ?? 169;
              const isPair   = row === col;
              const isSuited = col > row;

              return (
                <div
                  key={hand}
                  className={[
                    'hre-cell',
                    isPair ? 'hre-pair' : isSuited ? 'hre-suited' : 'hre-offsuit',
                    `hre-action-${action}`,
                  ].join(' ')}
                  style={{
                    background: cfg.bg,
                    borderColor: cfg.border,
                    color: cfg.text,
                  }}
                  onMouseDown={() => handleMouseDown(hand)}
                  onMouseEnter={() => handleMouseEnter(hand)}
                  onContextMenu={e => handleContextMenu(hand, e)}
                  title={`${hand} · rank #${rank} of 169 · ${isSuited ? 'suited' : isPair ? 'pair' : 'offsuit'}`}
                >
                  <span className="hre-cell-hand">{hand}</span>
                  <span className="hre-cell-rank">#{rank}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Stats footer */}
      <div className="hre-stats-row">
        {buckets.map(bucket => {
          const s = stats[bucket.id] ?? { hands: 0, combos: 0 };
          return (
            <div key={bucket.id} className="hre-stat-chip" style={{ color: bucket.text, borderColor: bucket.border }}>
              <span className="hre-stat-emoji">{bucket.emoji}</span>
              <span className="hre-stat-name">{bucket.label}</span>
              <span className="hre-stat-nums">{s.hands}h · {s.combos}c</span>
            </div>
          );
        })}
        <div className="hre-stat-vpip">
          VPIP <strong>{vpipPct}%</strong>
        </div>
      </div>
    </div>
  );
}
