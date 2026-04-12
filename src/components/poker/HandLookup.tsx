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

// ─── Hand text parser ─────────────────────────────────────────────────────────
//
// Accepts:  JJ  AKs  AKo  AK  72o  T9s  (case-insensitive, "10" → "T")
// Returns:  canonical hand key  or  null if invalid

const RANK_SET = new Set(RANKS as unknown as string[]);

function parseHandInput(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/10/g, 'T');
  if (s.length < 2 || s.length > 3) return null;
  const r1 = s[0], r2 = s[1];
  if (!RANK_SET.has(r1) || !RANK_SET.has(r2)) return null;

  if (r1 === r2) {
    return s.length === 2 ? `${r1}${r2}` : null; // pair only if exactly 2 chars
  }

  const suffix = s.length === 3 ? s[2] : null;
  if (suffix && suffix !== 'S' && suffix !== 'O') return null;

  const idx1 = RANKS.indexOf(r1 as typeof RANKS[number]);
  const idx2 = RANKS.indexOf(r2 as typeof RANKS[number]);
  const [highR, lowR] = idx1 < idx2 ? [r1, r2] : [r2, r1];
  const suf = suffix ? suffix.toLowerCase() : 's'; // no suffix → default suited
  const hand = `${highR}${lowR}${suf}`;
  return HAND_RANK_MAP[hand] !== undefined ? hand : null;
}

// ─── Detect mobile (touch-primary device) ────────────────────────────────────

function defaultShowGrid(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

// ─── HandPickerGrid ───────────────────────────────────────────────────────────
// Interactive 13×13 grid — tap a cell to select that hand.
// Cells are color-coded by the supplied range.

function HandPickerGrid({
  selectedHand,
  range,
  onSelect,
}: {
  selectedHand: string;
  range: Record<string, RangeAction>;
  onSelect: (hand: string) => void;
}) {
  return (
    <div className="hlpg-wrapper">
      {/* Column headers */}
      <div className="hlpg-col-headers">
        <div className="hlpg-corner" />
        {RANKS.map(r => <div key={r} className="hlpg-axis">{r}</div>)}
      </div>

      {RANKS.map((rowRank, row) => (
        <div key={rowRank} className="hlpg-row">
          <div className="hlpg-axis">{rowRank}</div>
          {RANKS.map((_, col) => {
            const hand = cellHand(row, col);
            const action = range[hand] ?? 'fold';
            const cfg = ACTION_CFG[action];
            const isSelected = hand === selectedHand;
            const isPair   = row === col;
            const isSuited = col > row;

            return (
              <button
                key={hand}
                className={[
                  'hlpg-cell',
                  isPair ? 'hlpg-pair' : isSuited ? 'hlpg-suited' : 'hlpg-offsuit',
                  isSelected ? 'hlpg-selected' : '',
                ].join(' ')}
                style={{
                  background: cfg.bg,
                  borderColor: isSelected ? '#ffffff' : cfg.border,
                  color: cfg.text,
                }}
                onClick={() => onSelect(hand)}
                title={`${hand}${isSuited ? ' (suited)' : isPair ? ' (pair)' : ' (offsuit)'}`}
              >
                {hand}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── ResultPanel ──────────────────────────────────────────────────────────────

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

// ─── MiniGrid (display-only) ──────────────────────────────────────────────────

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
  // ── Hand input state ────────────────────────────────────────────────────────
  const [selectedHand, setSelectedHand] = useState<string>('AKs');
  const [textInput, setTextInput]       = useState<string>('AKs');
  const [textError, setTextError]       = useState(false);
  const [showGrid, setShowGrid]         = useState(defaultShowGrid);

  // ── Situation state ─────────────────────────────────────────────────────────
  const [tableSize, setTableSize]               = useState(6);
  const [position, setPosition]                 = useState('BTN');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [facingBetBB, setFacingBetBB]           = useState<number>(3);
  const [potSizeBB, setPotSizeBB]               = useState<number>(4.5);
  // Raw string state so the inputs don't snap while the user is mid-type
  const [facingBetRaw, setFacingBetRaw]         = useState('3');
  const [potSizeRaw, setPotSizeRaw]             = useState('4.5');

  // ── Position helpers ────────────────────────────────────────────────────────
  const positions = getPositionsForTableSize(tableSize);
  const safePosition = positions.includes(position)
    ? position
    : (positions.find(p => p === 'BTN') ?? positions[0]);

  const handleTableSizeChange = (n: number) => {
    setTableSize(n);
    const pos = getPositionsForTableSize(n);
    if (!pos.includes(position)) setPosition(pos.find(p => p === 'BTN') ?? pos[0]);
  };

  // ── Input handlers ──────────────────────────────────────────────────────────
  function selectFromGrid(hand: string) {
    setSelectedHand(hand);
    setTextInput(hand);
    setTextError(false);
  }

  function handleTextChange(value: string) {
    setTextInput(value);
    const parsed = parseHandInput(value);
    if (parsed) {
      setSelectedHand(parsed);
      setTextError(false);
    } else if (value.trim() === '') {
      setTextError(false);
    } else {
      setTextError(true);
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const rank = HAND_RANK_MAP[selectedHand] ?? null;
  const vpip = suggestedVpip(tableSize, safePosition);

  const gtoRange    = useMemo(() => buildRangeFromPercentile(vpip, 'raise'), [vpip]);
  const gtoAction: RangeAction = gtoRange[selectedHand] ?? 'fold';

  const selectedProfile = profiles.find(p => p.id === selectedProfileId) ?? null;

  const profileAction = useMemo((): RangeAction | null => {
    if (!selectedProfile) return null;
    const pos = selectedProfile.positions.find(p => p.position === safePosition);
    const sit = pos?.situations[DEFAULT_ACTION_CONTEXT];
    return sit ? (sit.range[selectedHand] ?? 'fold') : null;
  }, [selectedHand, selectedProfile, safePosition]);

  // Range used for both the picker grid and the display mini grid
  const activeRange = useMemo((): Record<string, RangeAction> => {
    if (!selectedProfile) return gtoRange;
    const pos = selectedProfile.positions.find(p => p.position === safePosition);
    return pos?.situations[DEFAULT_ACTION_CONTEXT]?.range ?? gtoRange;
  }, [selectedProfile, safePosition, gtoRange]);

  const potOddsReq = useMemo(() => {
    if (facingBetBB <= 0 || potSizeBB <= 0) return null;
    return (facingBetBB / (potSizeBB + 2 * facingBetBB) * 100).toFixed(1);
  }, [facingBetBB, potSizeBB]);

  const profileMismatch = profileAction !== null && gtoAction !== profileAction;

  const gtoNote = gtoAction === 'raise'
    ? `In the top ${vpip}% GTO opening range for ${safePosition}.`
    : `Outside the ${vpip}% GTO opening range for ${safePosition}.`;

  const profileNote = profileAction === null
    ? `Profile has no data for ${safePosition}.`
    : profileAction === 'raise' ? 'In your raise range.'
    : profileAction === 'call'  ? 'In your call range.'
    : profileAction === 'limp'  ? 'In your limp range (★ fun / not GTO).'
    : 'Not in your range — fold.';

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="hl-wrapper">
      {/* Header */}
      <div className="hl-header">
        <button className="back-btn" onClick={onBack}>← Poker GTO</button>
        <div>
          <h1 className="hl-title">What Should I Do?</h1>
          <p className="hl-desc">
            Select a hand and position to get a GTO recommendation
            {profiles.length > 0 ? ' and compare it to any saved profile.' : '.'}
          </p>
        </div>
      </div>

      <div className="hl-body">

        {/* ── Left: inputs ── */}
        <div className="hl-inputs">

          {/* ── Hand input section ── */}
          <div className="hl-section">
            <div className="hl-hand-header">
              <h3 className="hl-section-title">Hand</h3>
              {/* Mode toggle */}
              <div className="hl-mode-toggle">
                <button
                  className={`hl-mode-btn${!showGrid ? ' active' : ''}`}
                  onClick={() => setShowGrid(false)}
                  title="Type hand notation (e.g. AKs, JJ, 72o)"
                >
                  Text
                </button>
                <button
                  className={`hl-mode-btn${showGrid ? ' active' : ''}`}
                  onClick={() => setShowGrid(true)}
                  title="Tap a cell to select a hand"
                >
                  Grid
                </button>
              </div>
            </div>

            {/* Text input — always visible */}
            <div className="hl-text-input-row">
              <input
                className={`hl-text-input${textError ? ' hl-text-error' : ''}`}
                value={textInput}
                onChange={e => handleTextChange(e.target.value)}
                placeholder="e.g. AKs, JJ, 72o, T9s"
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="characters"
              />
              <div className="hl-hand-badge">
                {!textError && selectedHand ? (
                  <>
                    <span className="hl-hand-notation">{selectedHand}</span>
                    {rank && <span className="hl-hand-rank">#{rank}</span>}
                  </>
                ) : textError ? (
                  <span className="hl-hand-invalid">?</span>
                ) : null}
              </div>
            </div>
            {textError && (
              <div className="hl-text-hint">
                Type a hand: <code>AKs</code> <code>AKo</code> <code>AK</code> <code>JJ</code> <code>T9s</code>
              </div>
            )}

            {/* Grid picker */}
            {showGrid && (
              <div className="hl-grid-picker-wrap">
                <HandPickerGrid
                  selectedHand={selectedHand}
                  range={activeRange}
                  onSelect={selectFromGrid}
                />
                <div className="hl-grid-picker-hint">
                  Cells colored by {selectedProfile ? `"${selectedProfile.name}"` : 'GTO'} range · tap to select
                </div>
              </div>
            )}
          </div>

          {/* ── Situation ── */}
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
                <label className="hl-label">Position</label>
                <select className="hl-select" value={safePosition} onChange={e => setPosition(e.target.value)}>
                  {positions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="hl-sit-field">
                <label className="hl-label">Action before</label>
                <select className="hl-select" disabled>
                  <option>All folded (RFI)</option>
                </select>
                <span className="hl-coming-soon">More contexts soon</span>
              </div>
            </div>
          </div>

          {/* ── Profile compare ── */}
          {profiles.length > 0 && (
            <div className="hl-section">
              <h3 className="hl-section-title">Compare Profile</h3>
              <select
                className="hl-select hl-profile-sel"
                value={selectedProfileId ?? ''}
                onChange={e => setSelectedProfileId(e.target.value || null)}
              >
                <option value="">— No profile (show GTO) —</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type} · {p.tableSize}-max)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ── Pot odds helper ── */}
          <div className="hl-section">
            <h3 className="hl-section-title">Pot Odds Helper</h3>
            <div className="hl-potodds-row">
              <div className="hl-sit-field">
                <label className="hl-label">Pot (BB)</label>
                <input
                  type="number" min={0} step={0.5}
                  className="hl-num-input"
                  value={potSizeRaw}
                  onChange={e => setPotSizeRaw(e.target.value)}
                  onBlur={e => {
                    const v = Math.max(0.5, Number(e.target.value) || 0.5);
                    setPotSizeBB(v);
                    setPotSizeRaw(String(v));
                  }}
                />
              </div>
              <div className="hl-sit-field">
                <label className="hl-label">Facing bet (BB)</label>
                <input
                  type="number" min={0} step={0.5}
                  className="hl-num-input"
                  value={facingBetRaw}
                  onChange={e => setFacingBetRaw(e.target.value)}
                  onBlur={e => {
                    const v = Math.max(0.5, Number(e.target.value) || 0.5);
                    setFacingBetBB(v);
                    setFacingBetRaw(String(v));
                  }}
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
              <span className="hl-grid-legend"> · {selectedHand} highlighted</span>
            </div>
            <MiniGrid hand={selectedHand} range={activeRange} />
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
        </div>

      </div>
    </div>
  );
}
