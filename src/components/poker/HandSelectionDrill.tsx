import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HAND_SELECTION_SCENARIOS } from '../../data/poker';
import { HandDisplay } from './HandDisplay';
import { POSITION_FULL, classifyHandType } from '../../utils/poker';
import type { HandSelectionScenario, PokerAction, Position } from '../../types/poker';
import type { HandTypeFilter } from '../../utils/poker';

interface Props {
  onRecordAttempt: (scenarioId: string, correct: boolean) => void;
  onBack: () => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const ACTIONS: { action: PokerAction; label: string; key: string }[] = [
  { action: 'fold',  label: 'Fold',  key: 'F' },
  { action: 'call',  label: 'Call',  key: 'C' },
  { action: 'raise', label: 'Raise', key: 'R' },
];

const ALL_POSITIONS: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

const AUTO_ADVANCE_CORRECT_MS   = 700;
const AUTO_ADVANCE_INCORRECT_MS = 1800;

// Brief one-liner shown under the position name
const POSITION_DESC: Record<Position, string> = {
  UTG:    'First to act — play tight',
  'UTG+1':'Second to act — nearly as tight as UTG',
  MP:     'Middle position — slightly wider range',
  HJ:     'Hijack — good position, wider range',
  CO:     'Cutoff — wide, aggressive range',
  BTN:    'Button — dealer, best position',
  SB:     'Small Blind — forced bet, out of position',
  BB:     'Big Blind — forced bet, last to act preflop',
};

// Seat layout around a mini oval (x%, y% in a 130×78 box)
const TABLE_SEATS: { pos: Position; x: number; y: number }[] = [
  { pos: 'SB',  x:  5, y: 40 },
  { pos: 'BB',  x: 28, y:  6 },
  { pos: 'UTG', x: 72, y:  6 },
  { pos: 'HJ',  x: 95, y: 40 },
  { pos: 'CO',  x: 72, y: 75 },
  { pos: 'BTN', x: 28, y: 75 },
];

// ─── Sub-components ─────────────────────────────────────────────────────────────

function PositionTable({ active }: { active: Position }) {
  // Map UTG+1/MP onto the UTG seat for the diagram (9-max fallback)
  const displayActive = (active === 'UTG+1' || active === 'MP') ? 'UTG' : active;
  return (
    <div style={{ position: 'relative', width: 130, height: 78, flexShrink: 0 }}>
      {/* Felt */}
      <div style={{
        position: 'absolute',
        left: '17%', top: '17%',
        width: '66%', height: '66%',
        borderRadius: '50%',
        background: '#1a3a1a',
        border: '2px solid #2d5a2d',
      }} />
      {TABLE_SEATS.map(({ pos, x, y }) => {
        const isActive = pos === displayActive;
        return (
          <div key={pos} style={{
            position: 'absolute',
            left: `${x}%`,
            top: `${y}%`,
            transform: 'translate(-50%, -50%)',
            fontSize: '0.58rem',
            fontWeight: 700,
            padding: '2px 5px',
            borderRadius: 4,
            background: isActive ? 'var(--accent)' : 'var(--bg-3)',
            color: isActive ? '#fff' : 'var(--text-muted)',
            border: `1px solid ${isActive ? 'var(--accent-hover)' : 'var(--border)'}`,
            zIndex: 1,
            letterSpacing: '0.03em',
            boxShadow: isActive ? '0 0 8px var(--accent)' : 'none',
          }}>
            {pos}
          </div>
        );
      })}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 18,
  height: 18,
  padding: '0 4px',
  background: 'var(--bg-3)',
  border: '1px solid var(--border)',
  borderBottomWidth: 2,
  borderRadius: 3,
  fontFamily: 'var(--mono)',
  fontSize: '0.7rem',
  color: 'var(--text-secondary)',
  marginRight: 4,
};

// ─── Component ──────────────────────────────────────────────────────────────────

export function HandSelectionDrill({ onRecordAttempt, onBack }: Props) {
  // ── Filters ──
  const [posFilter, setPosFilter]       = useState<Position | 'ALL'>('ALL');
  const [diffFilter, setDiffFilter]     = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [handTypeFilter, setHandTypeFilter] = useState<HandTypeFilter>('any');

  // ── Drill state ──
  const [queue, setQueue]               = useState<HandSelectionScenario[]>([]);
  const [queueIndex, setQueueIndex]     = useState(0);
  const [answered, setAnswered]         = useState<PokerAction | null>(null);
  const [streak, setStreak]             = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [totalCorrect, setTotalCorrect]   = useState(0);

  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Filtered pool ──
  const pool = useMemo(() => {
    let scenarios = HAND_SELECTION_SCENARIOS;
    if (posFilter !== 'ALL') scenarios = scenarios.filter((s) => s.position === posFilter);
    if (diffFilter !== 'all') scenarios = scenarios.filter((s) => s.difficulty === diffFilter);
    if (handTypeFilter !== 'any') {
      scenarios = scenarios.filter((s) => classifyHandType(s.hand) === handTypeFilter);
    }
    return scenarios;
  }, [posFilter, diffFilter, handTypeFilter]);

  // ── Build / rebuild queue whenever pool changes ──
  const buildQueue = useCallback(() => {
    const shuffled = shuffle(pool);
    setQueue(shuffled);
    setQueueIndex(0);
    setAnswered(null);
    // Reset session stats on filter change so stale numbers don't confuse
    setTotalAnswered(0);
    setTotalCorrect(0);
    setStreak(0);
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
  }, [pool]);

  useEffect(() => { buildQueue(); }, [buildQueue]);

  const currentScenario: HandSelectionScenario | null = queue[queueIndex] ?? null;

  // ── Advance to next question ──
  const advance = useCallback(() => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    setAnswered(null);
    setQueueIndex((i) => {
      const next = i + 1;
      if (next >= queue.length) {
        setQueue(shuffle(pool));
        return 0;
      }
      return next;
    });
  }, [queue.length, pool]);

  // ── Handle answer ──
  const handleAnswer = useCallback(
    (action: PokerAction) => {
      if (!currentScenario || answered !== null) return;
      const isCorrect = currentScenario.acceptableActions.includes(action);

      setAnswered(action);
      setTotalAnswered((n) => n + 1);
      setTotalCorrect((n) => n + (isCorrect ? 1 : 0));
      setStreak((s) => (isCorrect ? s + 1 : 0));
      onRecordAttempt(currentScenario.id, isCorrect);

      autoAdvanceTimer.current = setTimeout(
        advance,
        isCorrect ? AUTO_ADVANCE_CORRECT_MS : AUTO_ADVANCE_INCORRECT_MS,
      );
    },
    [currentScenario, answered, advance, onRecordAttempt],
  );

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const key = e.key.toUpperCase();
      if (key === 'F') handleAnswer('fold');
      if (key === 'C') handleAnswer('call');
      if (key === 'R') handleAnswer('raise');
      if (answered !== null && key !== 'F' && key !== 'C' && key !== 'R') advance();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleAnswer, answered, advance]);

  // ── Cleanup on unmount ──
  useEffect(() => () => { if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current); }, []);

  // ── Derived ──
  const isAnswered = answered !== null;
  const isCorrect  = isAnswered && currentScenario
    ? currentScenario.acceptableActions.includes(answered!)
    : false;
  // Only show accuracy after 5+ answers to avoid misleading 0% or 100% after 1 question
  const accuracy = totalAnswered >= 5 ? Math.round((totalCorrect / totalAnswered) * 100) : null;
  const progressPct = queue.length > 0 ? (queueIndex / queue.length) * 100 : 0;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="poker-drill-view">

      {/* ── Header ── */}
      <div className="drill-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>🃏 Preflop Hand Selection</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {streak >= 3 && (
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--yellow)' }}>
              🔥 {streak}
            </span>
          )}
          {accuracy !== null && (
            <span style={{
              fontSize: '0.8rem',
              fontFamily: 'var(--mono)',
              color: accuracy >= 75 ? 'var(--green)' : accuracy >= 50 ? 'var(--yellow)' : 'var(--red)',
            }}>
              {accuracy}% ({totalCorrect}/{totalAnswered})
            </span>
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
            {queueIndex + 1}/{queue.length}
          </span>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="drill-progress-bar">
        <div className="drill-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '10px 0 4px', alignItems: 'center' }}>
        {/* Position filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Position
          </span>
          {(['ALL', ...ALL_POSITIONS] as const).map((pos) => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos)}
              title={pos === 'ALL' ? 'All positions' : `${pos} — ${POSITION_FULL[pos as Position]}`}
              style={{
                padding: '3px 10px',
                borderRadius: 20,
                border: '1px solid',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                borderColor: posFilter === pos ? 'var(--accent)' : 'var(--border)',
                background: posFilter === pos ? 'var(--accent)' : 'var(--bg-2)',
                color: posFilter === pos ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {pos === 'ALL' ? 'Any' : pos}
            </button>
          ))}
        </div>

        {/* Hand Type filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Hand Type
          </span>
          {([
            { value: 'any',         label: 'Random',      title: 'All hands' },
            { value: 'premium',     label: '★ Premium',   title: 'TT+, AKs-ATs, KQs, AKo-AQo' },
            { value: 'interesting', label: '⚡ Spots',     title: 'Tricky position-dependent decisions: suited connectors, Axs, borderline pairs' },
          ] as const).map(({ value, label, title }) => (
            <button
              key={value}
              onClick={() => setHandTypeFilter(value)}
              title={title}
              style={{
                padding: '3px 10px',
                borderRadius: 20,
                border: '1px solid',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                borderColor: handTypeFilter === value ? 'var(--accent)' : 'var(--border)',
                background: handTypeFilter === value ? 'var(--accent)' : 'var(--bg-2)',
                color: handTypeFilter === value ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Difficulty filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Difficulty
          </span>
          {(['all', 'easy', 'medium', 'hard'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDiffFilter(d)}
              style={{
                padding: '3px 9px',
                borderRadius: 20,
                border: '1px solid',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                borderColor: diffFilter === d ? 'var(--accent)' : 'var(--border)',
                background: diffFilter === d ? 'var(--accent)' : 'transparent',
                color: diffFilter === d ? '#fff' : 'var(--text-muted)',
              }}
            >
              {d === 'all' ? 'Any' : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── No scenarios ── */}
      {pool.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          No scenarios match these filters. Try a different position, difficulty, or hand type.
        </div>
      )}

      {/* ── Question card ── */}
      {currentScenario && (
        <div
          className="scenario-card"
          style={{
            border: isAnswered
              ? `2px solid ${isCorrect ? 'var(--green)' : 'var(--red)'}`
              : '2px solid var(--border)',
            transition: 'border-color 0.15s',
          }}
        >
          {/* Top row: cards + position info + table diagram */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>

            {/* Cards */}
            <HandDisplay card1={currentScenario.heroCard1} card2={currentScenario.heroCard2} size="lg" />

            {/* Position + hand label */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="position-badge">{currentScenario.position}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                  {POSITION_FULL[currentScenario.position]}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {POSITION_DESC[currentScenario.position]}
              </span>
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginTop: 4,
              }}>
                {currentScenario.hand}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {currentScenario.heroStack} BB effective · 6-max · Folds to you
              </span>
            </div>

            {/* Mini table diagram */}
            <PositionTable active={currentScenario.position} />

            {/* Result emoji */}
            {isAnswered && (
              <div style={{ fontSize: '1.6rem', animation: 'fadeIn 0.15s ease', alignSelf: 'center' }}>
                {isCorrect ? '✅' : '❌'}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="drill-action-buttons" style={{ marginTop: 16 }}>
            {ACTIONS.map(({ action, label, key }) => {
              const isThis = answered === action;
              const isCorrectAction = currentScenario.acceptableActions.includes(action);
              let bg = 'var(--bg-3)';
              let borderColor = 'var(--border)';
              let textColor = 'var(--text-primary)';
              if (isAnswered) {
                if (isCorrectAction) {
                  bg = 'rgba(48,232,122,0.12)';
                  borderColor = 'var(--green)';
                  textColor = 'var(--green)';
                } else if (isThis) {
                  bg = 'rgba(255,85,85,0.12)';
                  borderColor = 'var(--red)';
                  textColor = 'var(--red)';
                }
              }
              return (
                <button
                  key={action}
                  onClick={() => handleAnswer(action)}
                  disabled={isAnswered}
                  style={{
                    flex: 1,
                    padding: '14px 0',
                    borderRadius: 10,
                    border: `2px solid ${borderColor}`,
                    background: bg,
                    color: textColor,
                    fontWeight: 700,
                    fontSize: '1rem',
                    cursor: isAnswered ? 'default' : 'pointer',
                    transition: 'all 0.12s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>{label}</span>
                  {!isAnswered && (
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '1px 5px',
                    }}>
                      {key}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Feedback */}
          {isAnswered && (
            <div style={{
              marginTop: 14,
              padding: '10px 14px',
              borderRadius: 8,
              background: isCorrect ? 'rgba(48,232,122,0.07)' : 'rgba(255,85,85,0.07)',
              borderLeft: `3px solid ${isCorrect ? 'var(--green)' : 'var(--red)'}`,
              fontSize: '0.85rem',
              lineHeight: 1.5,
              color: 'var(--text-secondary)',
              animation: 'fadeIn 0.1s ease',
            }}>
              {isCorrect ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--green)' }}>✓ Correct</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>any key →</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--red)' }}>
                      ✗ Should be: {currentScenario.correctAction.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>any key →</span>
                  </div>
                  <span>{currentScenario.explanation}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Keyboard hint ── */}
      {currentScenario && (
        <div style={{
          textAlign: 'center',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          marginTop: 4,
          display: 'flex',
          gap: 16,
          justifyContent: 'center',
        }}>
          {!isAnswered ? (
            <>
              <span><kbd style={kbdStyle}>F</kbd> Fold</span>
              <span><kbd style={kbdStyle}>C</kbd> Call</span>
              <span><kbd style={kbdStyle}>R</kbd> Raise</span>
            </>
          ) : (
            <span>press any key to continue</span>
          )}
        </div>
      )}
    </div>
  );
}
