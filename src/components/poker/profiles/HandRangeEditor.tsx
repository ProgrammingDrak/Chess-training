import { useRef, useCallback, useState } from 'react';
import { RANKS, cellHand, handCombos } from '../../../utils/handMatrix';
import { HAND_RANK_MAP, buildRangeFromPercentile } from '../../../data/poker/profileTemplates';
import type { RangeAction } from '../../../types/profiles';

// ─── Action config ────────────────────────────────────────────────────────────

const ACTION_CYCLE: RangeAction[] = ['fold', 'limp', 'call', 'raise'];

export const ACTION_CFG: Record<RangeAction, { label: string; emoji: string; bg: string; border: string; text: string }> = {
  fold:  { label: 'Fold',           emoji: '🔴', bg: 'rgba(255,85,85,0.28)',   border: 'rgba(255,85,85,0.6)',    text: '#ff7070' },
  limp:  { label: 'Limp',           emoji: '🟡', bg: 'rgba(255,215,64,0.28)',  border: 'rgba(255,215,64,0.6)',   text: '#ffd740' },
  call:  { label: 'Call',           emoji: '🔵', bg: 'rgba(80,140,255,0.28)',  border: 'rgba(80,140,255,0.6)',   text: '#6699ff' },
  raise: { label: 'Raise to all-in', emoji: '🟢', bg: 'rgba(48,232,122,0.28)',  border: 'rgba(48,232,122,0.6)',   text: '#30e87a' },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface HandRangeEditorProps {
  range: Record<string, RangeAction>;
  onChange: (next: Record<string, RangeAction>) => void;
  callThresholdBB: number;
  onChangeCallThreshold: (bb: number) => void;
  /** Position-aware VPIP suggestion — pre-seeds the quick-start slider. */
  suggestedPct?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HandRangeEditor({
  range,
  onChange,
  callThresholdBB,
  onChangeCallThreshold,
  suggestedPct,
}: HandRangeEditorProps) {
  const [activeBrush, setActiveBrush] = useState<RangeAction>('raise');
  const [playPct, setPlayPct] = useState(suggestedPct ?? 20);
  const isDragging = useRef(false);

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
    const idx = ACTION_CYCLE.indexOf(cur);
    const next = ACTION_CYCLE[(idx + 1) % ACTION_CYCLE.length];
    onChange({ ...range, [hand]: next });
  }, [range, onChange, getAction]);

  const applyPercentile = () => {
    onChange(buildRangeFromPercentile(playPct));
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats: Record<RangeAction, { hands: number; combos: number }> = {
    fold:  { hands: 0, combos: 0 },
    limp:  { hands: 0, combos: 0 },
    call:  { hands: 0, combos: 0 },
    raise: { hands: 0, combos: 0 },
  };
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const hand = cellHand(row, col);
      const action = getAction(hand);
      const c = handCombos(hand);
      stats[action].hands++;
      stats[action].combos += c;
    }
  }
  const playedCombos = stats.limp.combos + stats.call.combos + stats.raise.combos;
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

      {/* Call-or-raise threshold */}
      <div className="hre-threshold">
        <span>🔵 Call or raise (to all-in) up to</span>
        <input
          type="number"
          min={1} max={999}
          value={callThresholdBB}
          onChange={e => onChangeCallThreshold(Math.max(1, Number(e.target.value)))}
          className="hre-bb-input"
        />
        <span>BB — short-stack zone. Above this, you need green to continue.</span>
      </div>

      {/* Brush selector */}
      <div className="hre-brush-row">
        <span className="hre-brush-label">Paint brush:</span>
        {ACTION_CYCLE.map(action => {
          const cfg = ACTION_CFG[action];
          const isActive = activeBrush === action;
          return (
            <button
              key={action}
              className={`hre-brush-btn${isActive ? ' active' : ''}`}
              style={{ '--hre-action-color': cfg.text } as React.CSSProperties}
              onClick={() => setActiveBrush(action)}
            >
              {cfg.emoji} {cfg.label}
              {action === 'call'  ? ` ≤${callThresholdBB}BB` : ''}
              {action === 'limp'  ? ' ★fun' : ''}
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
              const cfg = ACTION_CFG[action];
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
        {ACTION_CYCLE.map(action => {
          const cfg = ACTION_CFG[action];
          const s = stats[action];
          return (
            <div key={action} className="hre-stat-chip" style={{ color: cfg.text, borderColor: cfg.border }}>
              <span className="hre-stat-emoji">{cfg.emoji}</span>
              <span className="hre-stat-name">{cfg.label}</span>
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
