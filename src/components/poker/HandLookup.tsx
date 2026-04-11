import { useState, useMemo } from 'react';
import { RANKS, cellHand } from '../../utils/handMatrix';
import {
  HAND_RANK_MAP,
  buildRangeFromPercentile,
  suggestedVpip,
  getPositionsForTableSize,
} from '../../data/poker/profileTemplates';
import { ACTION_CFG } from './profiles/HandRangeEditor';
import type { PlayerProfile, RangeAction } from '../../types/profiles';
import { DEFAULT_ACTION_CONTEXT } from '../../types/profiles';

// ─── Suit config ──────────────────────────────────────────────────────────────

const SUITS = ['♠', '♥', '♦', '♣'] as const;
type Suit = typeof SUITS[number];
const SUIT_COLOR: Record<Suit, string> = {
  '♠': 'var(--text-primary)',
  '♥': '#e05555',
  '♦': '#e05555',
  '♣': 'var(--text-primary)',
};

// ─── Hand notation ────────────────────────────────────────────────────────────

function getHandNotation(
  r1: string, s1: Suit,
  r2: string, s2: Suit,
): string | null {
  if (!r1 || !r2) return null;
  if (r1 === r2) {
    if (s1 === s2) return null; // same card twice
    return `${r1}${r2}`;        // pair
  }
  const idx1 = RANKS.indexOf(r1 as typeof RANKS[number]);
  const idx2 = RANKS.indexOf(r2 as typeof RANKS[number]);
  const [highR, highS, lowR, lowS] =
    idx1 < idx2 ? [r1, s1, r2, s2] : [r2, s2, r1, s1];
  return `${highR}${lowR}${highS === lowS ? 's' : 'o'}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CardPicker({
  rank, suit, label,
  onRank, onSuit,
}: {
  rank: string; suit: Suit; label: string;
  onRank: (r: string) => void; onSuit: (s: Suit) => void;
}) {
  return (
    <div className="hl-card-picker">
      <label className="hl-label">{label}</label>
      <div className="hl-card-selects">
        <select className="hl-select hl-card-rank-sel" value={rank} onChange={e => onRank(e.target.value)}>
          {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="hl-select hl-card-suit-sel" value={suit} onChange={e => onSuit(e.target.value as Suit)}>
          {SUITS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="hl-card-display" style={{ color: SUIT_COLOR[suit] }}>
        <span className="hl-card-rank-display">{rank}</span>
        <span className="hl-card-suit-display">{suit}</span>
      </div>
    </div>
  );
}

function ResultPanel({
  title, subtitle, action, note, mismatch,
}: {
  title: string; subtitle: string;
  action: RangeAction | null; note: string;
  mismatch?: boolean;
}) {
  const cfg = action ? ACTION_CFG[action] : null;
  return (
    <div
      className={`hl-result-panel${mismatch ? ' hl-mismatch' : ''}`}
      style={cfg ? { borderColor: cfg.border } : {}}
    >
      <div className="hl-result-title">{title}</div>
      <div className="hl-result-subtitle">{subtitle}</div>
      {cfg && action ? (
        <div className="hl-result-action" style={{ color: cfg.text, background: cfg.bg }}>
          <span className="hl-result-emoji">{cfg.emoji}</span>
          <span className="hl-result-label">{cfg.label}</span>
        </div>
      ) : (
        <div className="hl-result-action hl-result-na">—</div>
      )}
      <div className="hl-result-note">{note}</div>
      {mismatch && (
        <div className="hl-mismatch-badge">⚠ Differs from GTO</div>
      )}
    </div>
  );
}

function MiniGrid({
  hand, range,
}: {
  hand: string; range: Record<string, RangeAction>;
}) {
  return (
    <div className="hl-mini-grid">
      {RANKS.map((_, row) => (
        <div key={row} className="hl-mini-row">
          {RANKS.map((__, col) => {
            const h = cellHand(row, col);
            const action = range[h] ?? 'fold';
            const cfg = ACTION_CFG[action];
            const isSelected = h === hand;
            return (
              <div
                key={h}
                className={`hl-mini-cell${isSelected ? ' hl-mini-selected' : ''}`}
                style={{ background: cfg.bg, borderColor: isSelected ? '#ffffff' : cfg.border }}
                title={h}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface HandLookupProps {
  profiles: PlayerProfile[];
  onBack: () => void;
}

export function HandLookup({ profiles, onBack }: HandLookupProps) {
  const [rank1, setRank1] = useState('A');
  const [suit1, setSuit1] = useState<Suit>('♠');
  const [rank2, setRank2] = useState('K');
  const [suit2, setSuit2] = useState<Suit>('♦');
  const [tableSize, setTableSize] = useState(6);
  const [position, setPosition] = useState('BTN');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  // Pot odds helper (independent of action context)
  const [facingBetBB, setFacingBetBB] = useState<number>(3);
  const [potSizeBB, setPotSizeBB] = useState<number>(4.5);

  // Keep position valid when table size changes
  const positions = getPositionsForTableSize(tableSize);
  const safePosition = positions.includes(position) ? position : (positions.find(p => p === 'BTN') ?? positions[0]);

  const handleTableSizeChange = (n: number) => {
    setTableSize(n);
    const pos = getPositionsForTableSize(n);
    if (!pos.includes(position)) {
      setPosition(pos.find(p => p === 'BTN') ?? pos[0]);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const hand = useMemo(() => getHandNotation(rank1, suit1, rank2, suit2), [rank1, suit1, rank2, suit2]);
  const rank = hand ? (HAND_RANK_MAP[hand] ?? null) : null;
  const vpip = suggestedVpip(tableSize, safePosition);

  const gtoRange = useMemo(() => buildRangeFromPercentile(vpip, 'raise'), [vpip]);
  const gtoAction: RangeAction | null = hand ? (gtoRange[hand] ?? 'fold') : null;

  const selectedProfile = profiles.find(p => p.id === selectedProfileId) ?? null;
  const profileAction = useMemo((): RangeAction | null => {
    if (!hand || !selectedProfile) return null;
    const pos = selectedProfile.positions.find(p => p.position === safePosition);
    if (!pos) return null;
    const sit = pos.situations[DEFAULT_ACTION_CONTEXT];
    return sit ? (sit.range[hand] ?? 'fold') : null;
  }, [hand, selectedProfile, safePosition]);

  const profileRange = useMemo((): Record<string, RangeAction> => {
    if (!selectedProfile) return gtoRange;
    const pos = selectedProfile.positions.find(p => p.position === safePosition);
    return pos?.situations[DEFAULT_ACTION_CONTEXT]?.range ?? {};
  }, [selectedProfile, safePosition, gtoRange]);

  // Pot odds
  const potOddsReq = useMemo(() => {
    if (facingBetBB <= 0 || potSizeBB <= 0) return null;
    return (facingBetBB / (potSizeBB + 2 * facingBetBB) * 100).toFixed(1);
  }, [facingBetBB, potSizeBB]);

  const profileMismatch = gtoAction !== null && profileAction !== null && gtoAction !== profileAction;

  const gtoNote = gtoAction === 'raise'
    ? `In the top ${vpip}% GTO opening range for ${safePosition}.`
    : `Outside the ${vpip}% GTO opening range for ${safePosition}.`;

  const profileNote = profileAction === null
    ? `Profile has no data for ${safePosition}.`
    : profileAction === 'raise' ? 'In your raise range.'
    : profileAction === 'call'  ? 'In your call range.'
    : profileAction === 'limp'  ? 'In your limp range (★ fun / not GTO).'
    : 'Not in your range — fold.';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="hl-wrapper">
      {/* Header */}
      <div className="hl-header">
        <button className="back-btn" onClick={onBack}>← Poker GTO</button>
        <div>
          <h1 className="hl-title">What Should I Do?</h1>
          <p className="hl-desc">
            Pick your hole cards and position to get a GTO recommendation
            {profiles.length > 0 ? ' and compare it to any saved profile.' : '.'}
          </p>
        </div>
      </div>

      <div className="hl-body">

        {/* ── Left: inputs ── */}
        <div className="hl-inputs">

          {/* Hole cards */}
          <div className="hl-section">
            <h3 className="hl-section-title">Your Hole Cards</h3>
            <div className="hl-cards-row">
              <CardPicker rank={rank1} suit={suit1} label="Card 1" onRank={setRank1} onSuit={setSuit1} />
              <CardPicker rank={rank2} suit={suit2} label="Card 2" onRank={setRank2} onSuit={setSuit2} />

              <div className="hl-hand-info">
                {hand ? (
                  <>
                    <div className="hl-hand-notation">{hand}</div>
                    {rank && <div className="hl-hand-rank">#{rank} of 169</div>}
                  </>
                ) : (
                  <div className="hl-hand-invalid">
                    {rank1 === rank2 && suit1 === suit2
                      ? 'Same card twice — change a suit'
                      : '—'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Situation */}
          <div className="hl-section">
            <h3 className="hl-section-title">Situation</h3>
            <div className="hl-sit-row">
              <div className="hl-sit-field">
                <label className="hl-label">Table size</label>
                <select className="hl-select" value={tableSize} onChange={e => handleTableSizeChange(Number(e.target.value))}>
                  {[2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                    <option key={n} value={n}>{n === 2 ? 'HU (2)' : `${n}-max`}</option>
                  ))}
                </select>
              </div>
              <div className="hl-sit-field">
                <label className="hl-label">Your position</label>
                <select className="hl-select" value={safePosition} onChange={e => setPosition(e.target.value)}>
                  {positions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="hl-sit-field">
                <label className="hl-label">Action before you</label>
                <select className="hl-select" disabled>
                  <option>All folded (RFI)</option>
                </select>
                <span className="hl-coming-soon">More contexts coming soon</span>
              </div>
            </div>
          </div>

          {/* Profile compare */}
          {profiles.length > 0 && (
            <div className="hl-section">
              <h3 className="hl-section-title">Compare Profile</h3>
              <select
                className="hl-select hl-profile-sel"
                value={selectedProfileId ?? ''}
                onChange={e => setSelectedProfileId(e.target.value || null)}
              >
                <option value="">— No profile —</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type} · {p.tableSize}-max)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Pot odds helper */}
          <div className="hl-section">
            <h3 className="hl-section-title">Pot Odds Helper</h3>
            <div className="hl-potodds-row">
              <div className="hl-sit-field">
                <label className="hl-label">Pot size (BB)</label>
                <input
                  type="number" min={0.5} step={0.5}
                  className="hl-num-input"
                  value={potSizeBB}
                  onChange={e => setPotSizeBB(Math.max(0.5, Number(e.target.value)))}
                />
              </div>
              <div className="hl-sit-field">
                <label className="hl-label">Facing bet (BB)</label>
                <input
                  type="number" min={0.5} step={0.5}
                  className="hl-num-input"
                  value={facingBetBB}
                  onChange={e => setFacingBetBB(Math.max(0.5, Number(e.target.value)))}
                />
              </div>
              {potOddsReq && (
                <div className="hl-potodds-result">
                  <span className="hl-potodds-label">Required equity</span>
                  <span className="hl-potodds-value">{potOddsReq}%</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── Right: results ── */}
        <div className="hl-results">
          {hand ? (
            <>
              <ResultPanel
                title="GTO Recommendation"
                subtitle={`${safePosition} · RFI · ${tableSize}-max · top ${vpip}% range`}
                action={gtoAction}
                note={gtoNote}
              />

              {selectedProfile && (
                <ResultPanel
                  title={`"${selectedProfile.name}"`}
                  subtitle={`${safePosition} · RFI · ${selectedProfile.tableSize}-max profile`}
                  action={profileAction}
                  note={profileNote}
                  mismatch={profileMismatch}
                />
              )}

              <div className="hl-grid-section">
                <div className="hl-grid-label">
                  {selectedProfile
                    ? `${selectedProfile.name} — ${safePosition} RFI range`
                    : `GTO range — ${safePosition} in ${tableSize}-max`}
                  <span className="hl-grid-legend"> (highlighted: {hand})</span>
                </div>
                <MiniGrid hand={hand} range={profileRange} />
                <div className="hl-grid-legend-row">
                  {(['fold', 'call', 'raise', 'limp'] as RangeAction[]).map(a => {
                    const cfg = ACTION_CFG[a];
                    return (
                      <span key={a} className="hl-legend-chip" style={{ color: cfg.text, borderColor: cfg.border }}>
                        {cfg.emoji} {cfg.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="hl-empty">
              <div className="hl-empty-icon">🃏</div>
              <p className="hl-empty-text">Pick two hole cards to see the recommendation.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
