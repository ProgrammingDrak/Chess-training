import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Card, VillainHandCategory } from '../../types/poker';
import { RANGE_READING_SCENARIOS } from '../../data/poker/rangeReadingScenarios';
import { PlayingCard, BoardDisplay } from './HandDisplay';
import { HandRangeMatrix, cardsToHandNotation, scoreRange, scoreLabel } from './HandRangeMatrix';

type Phase = 'preflop' | 'flop' | 'turn' | 'river' | 'reveal';

interface RangeReadingDrillProps {
  onRecordAttempt: (scenarioId: string, correct: boolean) => void;
  onBack: () => void;
}

const AUTO_ADVANCE_FLOP_MS = 1600;

const HAND_TYPE_OPTIONS: { value: VillainHandCategory; label: string; title: string }[] = [
  { value: 'any',         label: 'Random',    title: 'All scenario types' },
  { value: 'premium',     label: '★ Premium', title: 'Villain holds premium hands — sets, overpairs, strong top pair' },
  { value: 'interesting', label: '⚡ Spots',   title: 'Villain holds draws, bluffs, tricky semi-bluffs, monster traps' },
];

const filterPillStyle = (active: boolean) => ({
  padding: '3px 10px',
  borderRadius: 20,
  border: '1px solid',
  fontSize: '0.72rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s',
  borderColor: active ? 'var(--accent)' : 'var(--border)',
  background: active ? 'var(--accent)' : 'var(--bg-2)',
  color: active ? '#fff' : 'var(--text-secondary)',
});

export function RangeReadingDrill({ onRecordAttempt, onBack }: RangeReadingDrillProps) {
  const [handTypeFilter, setHandTypeFilter] = useState<VillainHandCategory>('any');

  const filteredScenarios = useMemo(() => {
    const base = [...RANGE_READING_SCENARIOS].sort(() => Math.random() - 0.5);
    if (handTypeFilter === 'any') return base;
    return base.filter(s => s.villainHandCategory === handTypeFilter);
  }, [handTypeFilter]);

  const [handIndex, setHandIndex]   = useState(0);
  const [phase, setPhase]           = useState<Phase>('preflop');
  const [flopAnswer, setFlopAnswer] = useState<number | null>(null);

  // River range-selection state
  const [riverSelected, setRiverSelected] = useState<Set<string>>(new Set());
  const [riverScore, setRiverScore]       = useState<number | null>(null);
  const [riverSubmitted, setRiverSubmitted] = useState(false);

  // Session totals
  const [flopCorrect, setFlopCorrect]   = useState(0);
  const [flopTotal, setFlopTotal]       = useState(0);
  const [totalRangePoints, setTotalRangePoints] = useState(0);
  const [handsComplete, setHandsComplete] = useState(0);

  // Reset index and per-hand state when filter changes so we don't land out-of-bounds
  useEffect(() => {
    setHandIndex(0);
    setFlopAnswer(null);
    setRiverSelected(new Set());
    setRiverScore(null);
    setRiverSubmitted(false);
  }, [filteredScenarios]);

  const activeQueue = filteredScenarios.length > 0 ? filteredScenarios : RANGE_READING_SCENARIOS;
  const scenario = activeQueue[handIndex % activeQueue.length];
  const targetHand = cardsToHandNotation(scenario.revealCard1, scenario.revealCard2);

  const advancePhase = useCallback(() => {
    setPhase(p => {
      if (p === 'preflop') return 'flop';
      if (p === 'flop')    return 'turn';
      if (p === 'turn')    return 'river';
      if (p === 'river')   return 'reveal';
      return p;
    });
  }, []);

  const nextHand = useCallback(() => {
    setHandIndex(i => i + 1);
    setPhase('preflop');
    setFlopAnswer(null);
    setRiverSelected(new Set());
    setRiverScore(null);
    setRiverSubmitted(false);
    setHandsComplete(h => h + 1);
  }, []);

  function handleFlopAnswer(idx: number) {
    setFlopAnswer(idx);
    const correct = idx === scenario.flopQuestion.correctIndex;
    onRecordAttempt(scenario.id + '-flop', correct);
    setFlopTotal(t => t + 1);
    if (correct) setFlopCorrect(c => c + 1);
  }

  function handleRiverSubmit() {
    if (riverSubmitted || riverSelected.size === 0) return;
    const pts = scoreRange(targetHand, riverSelected);
    setRiverScore(pts);
    setRiverSubmitted(true);
    setTotalRangePoints(p => p + pts);
    onRecordAttempt(scenario.id + '-river', pts >= 50);
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = e.key;

      if (phase === 'flop' && flopAnswer === null) {
        const idx = parseInt(key) - 1;
        if (idx >= 0 && idx <= 3) { handleFlopAnswer(idx); return; }
      }

      if (phase === 'preflop' || phase === 'turn') {
        if (key === ' ' || key === 'Enter' || key === 'ArrowRight') {
          e.preventDefault(); advancePhase();
        }
      }

      if (phase === 'flop' && flopAnswer !== null) {
        if (key === ' ' || key === 'Enter' || key === 'ArrowRight') {
          e.preventDefault(); advancePhase();
        }
      }

      if (phase === 'river' && !riverSubmitted) {
        if (key === 'Enter' && riverSelected.size > 0) {
          e.preventDefault(); handleRiverSubmit();
        }
      }

      // River feedback → reveal requires explicit button click (no keyboard shortcut)
      // This prevents accidentally skipping the score feedback.

      if (phase === 'reveal') {
        if (key === ' ' || key === 'Enter' || key === 'ArrowRight') {
          e.preventDefault(); nextHand();
        }
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, flopAnswer, riverSubmitted, riverSelected, advancePhase, nextHand]);

  // Auto-advance flop after answering
  useEffect(() => {
    if (phase === 'flop' && flopAnswer !== null) {
      const t = setTimeout(() => setPhase('turn'), AUTO_ADVANCE_FLOP_MS);
      return () => clearTimeout(t);
    }
  }, [phase, flopAnswer]);

  const boardCards: Card[] = [];
  if (phase !== 'preflop') boardCards.push(...scenario.flop);
  if (phase === 'turn' || phase === 'river' || phase === 'reveal') boardCards.push(scenario.turn);
  if (phase === 'river' || phase === 'reveal') boardCards.push(scenario.river);

  const flopAcc = flopTotal > 0 ? Math.round((flopCorrect / flopTotal) * 100) : null;

  return (
    <div className="rr-drill">
      {/* Header */}
      <div className="rr-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="rr-title">
          <span className="rr-title-icon">🔍</span>
          Range Reading
        </div>
        <div className="rr-score">
          {flopTotal > 0 && (
            <span title="Flop MCQ accuracy" style={{ color: flopAcc! >= 70 ? 'var(--green)' : flopAcc! >= 50 ? 'var(--yellow)' : 'var(--red)' }}>
              {flopCorrect}/{flopTotal}
            </span>
          )}
          {totalRangePoints > 0 && (
            <span title="Total range points" style={{ color: 'var(--accent-hover)' }}>
              +{totalRangePoints}pts
            </span>
          )}
          <span className="rr-hand-count">Hand {handsComplete + 1}</span>
        </div>
      </div>

      {/* ── Hand Type Filter ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 2px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Villain Hand
        </span>
        {HAND_TYPE_OPTIONS.map(({ value, label, title }) => (
          <button
            key={value}
            onClick={() => setHandTypeFilter(value)}
            title={title}
            style={filterPillStyle(handTypeFilter === value)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Profile Badge */}
      <div className="rr-profile-badge" style={{ borderColor: scenario.profileColor }}>
        <div className="rr-profile-type" style={{ color: scenario.profileColor }}>{scenario.profileLabel}</div>
        <div className="rr-profile-desc">{scenario.profileDescription}</div>
        <div className="rr-profile-stats">{scenario.profileStats}</div>
      </div>

      {/* Board */}
      {phase !== 'preflop' && (
        <div className="rr-board">
          <div className="rr-board-label">Board</div>
          <BoardDisplay cards={boardCards} size="md" />
        </div>
      )}

      {/* Villain cards */}
      <div className="rr-villain-hand">
        <div className="rr-villain-label">Villain's Hand</div>
        <div className="hand-display">
          {phase === 'reveal' ? (
            <>
              <PlayingCard card={scenario.revealCard1} size="lg" />
              <PlayingCard card={scenario.revealCard2} size="lg" />
            </>
          ) : (
            <>
              <PlayingCard card={scenario.revealCard1} size="lg" faceDown />
              <PlayingCard card={scenario.revealCard2} size="lg" faceDown />
            </>
          )}
        </div>
        {phase === 'reveal' && (
          <div className="rr-reveal-hand">{scenario.revealHand}</div>
        )}
      </div>

      {/* Positions */}
      <div className="rr-positions">
        <span className="rr-pos villain">Villain: <strong>{scenario.villainPosition}</strong></span>
        <span className="rr-pos-vs">vs</span>
        <span className="rr-pos hero">You: <strong>{scenario.heroPosition}</strong></span>
      </div>

      {/* Phase Content */}
      <div className="rr-phase-content">

        {phase === 'preflop' && (
          <div className="rr-street-card">
            <div className="rr-street-label">Pre-Flop</div>
            <p className="rr-action-text">{scenario.preflopAction}</p>
            <button className="rr-advance-btn" onClick={advancePhase}>
              Deal Flop <span className="rr-key-hint">Space / →</span>
            </button>
          </div>
        )}

        {phase === 'flop' && (
          <div className="rr-street-card">
            <div className="rr-street-label">Flop</div>
            <p className="rr-action-text">{scenario.flopAction}</p>
            {flopAnswer === null ? (
              <QuestionPanel question={scenario.flopQuestion} onAnswer={handleFlopAnswer} />
            ) : (
              <AnswerFeedback
                question={scenario.flopQuestion}
                chosen={flopAnswer}
                onContinue={advancePhase}
                nextLabel="See Turn"
              />
            )}
          </div>
        )}

        {phase === 'turn' && (
          <div className="rr-street-card">
            <div className="rr-street-label">Turn</div>
            <p className="rr-action-text">{scenario.turnAction}</p>
            <div className="rr-turn-note">{scenario.turnNote}</div>
            <button className="rr-advance-btn" onClick={advancePhase}>
              See River <span className="rr-key-hint">Space / →</span>
            </button>
          </div>
        )}

        {phase === 'river' && (
          <div className="rr-street-card">
            <div className="rr-street-label">River</div>
            <p className="rr-action-text">{scenario.riverAction}</p>

            {!riverSubmitted ? (
              <RangeChallenge
                targetHand={targetHand}
                selected={riverSelected}
                onChange={setRiverSelected}
                onSubmit={handleRiverSubmit}
              />
            ) : (
              <RangeFeedback
                score={riverScore!}
                size={riverSelected.size}
                targetHand={targetHand}
                selected={riverSelected}
                onContinue={advancePhase}
              />
            )}
          </div>
        )}

        {phase === 'reveal' && (
          <div className="rr-street-card rr-reveal-card">
            <div className="rr-street-label">Showdown</div>

            {/* River matrix replay — disabled, target highlighted */}
            {riverSelected.size > 0 && (
              <div className="rr-reveal-matrix">
                <HandRangeMatrix
                  selected={riverSelected}
                  onChange={() => {}}
                  disabled
                  revealHand={targetHand}
                />
              </div>
            )}

            <p className="rr-reveal-explanation">{scenario.revealExplanation}</p>

            <div className="rr-hand-score">
              <span className={flopAnswer === scenario.flopQuestion.correctIndex ? 'rr-q-correct' : 'rr-q-wrong'}>
                Flop: {flopAnswer === scenario.flopQuestion.correctIndex ? '✓' : '✗'}
              </span>
              <span className={riverScore! > 0 ? 'rr-q-correct' : 'rr-q-wrong'}>
                Range: {riverScore !== null ? `+${riverScore} pts` : '—'}
              </span>
            </div>

            <button className="rr-advance-btn rr-next-hand-btn" onClick={nextHand}>
              Next Hand <span className="rr-key-hint">Space / →</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function QuestionPanel({
  question,
  onAnswer,
}: {
  question: { prompt: string; options: string[]; correctIndex: number; explanation: string };
  onAnswer: (idx: number) => void;
}) {
  return (
    <div className="rr-question">
      <p className="rr-question-prompt">{question.prompt}</p>
      <div className="rr-options">
        {question.options.map((opt, i) => (
          <button key={i} className="rr-option-btn" onClick={() => onAnswer(i)}>
            <span className="rr-option-key">{i + 1}</span>
            <span className="rr-option-text">{opt}</span>
          </button>
        ))}
      </div>
      <div className="rr-kbd-hint">Press <kbd>1</kbd>–<kbd>4</kbd> to answer</div>
    </div>
  );
}

function AnswerFeedback({
  question,
  chosen,
  onContinue,
  nextLabel,
}: {
  question: { prompt: string; options: string[]; correctIndex: number; explanation: string };
  chosen: number;
  onContinue: () => void;
  nextLabel: string;
}) {
  const correct = chosen === question.correctIndex;
  return (
    <div className={`rr-feedback ${correct ? 'correct' : 'incorrect'}`}>
      <div className="rr-feedback-result">{correct ? '✓ Correct' : '✗ Incorrect'}</div>
      {!correct && (
        <div className="rr-feedback-correct-ans">
          Best answer: <em>{question.options[question.correctIndex]}</em>
        </div>
      )}
      <div className="rr-feedback-explanation">{question.explanation}</div>
      <button className="rr-advance-btn" onClick={onContinue}>
        {nextLabel} <span className="rr-key-hint">Space / →</span>
      </button>
    </div>
  );
}

function RangeChallenge({
  selected,
  onChange,
  onSubmit,
}: {
  targetHand: string;
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="rr-range-challenge">
      <p className="rr-range-prompt">
        Select every hand you think villain could have here. Narrower = more points.
      </p>
      <HandRangeMatrix selected={selected} onChange={onChange} />
      <div className="rr-range-legend">
        <span className="hrm-legend-item tier-premium">Premium</span>
        <span className="hrm-legend-item tier-strong">Strong</span>
        <span className="hrm-legend-item tier-speculative">Speculative</span>
        <span className="hrm-legend-item tier-marginal">Marginal</span>
        <span className="hrm-legend-item tier-fold">Fold</span>
      </div>
      <button
        className={`rr-range-submit-btn ${selected.size === 0 ? 'disabled' : ''}`}
        onClick={onSubmit}
        disabled={selected.size === 0}
      >
        Lock In Range
        <span className="rr-key-hint">Enter</span>
      </button>
    </div>
  );
}

function RangeFeedback({
  score,
  size,
  targetHand,
  selected,
  onContinue,
}: {
  score: number;
  size: number;
  targetHand: string;
  selected: Set<string>;
  onContinue: () => void;
}) {
  const found = selected.has(targetHand);
  const label = scoreLabel(score, size);

  return (
    <div className={`rr-range-feedback ${found ? 'found' : 'missed'}`}>
      <div className="rr-range-feedback-header">
        <span className="rr-range-feedback-label">{label}</span>
        <span className="rr-range-feedback-pts">{found ? `+${score} pts` : '0 pts'}</span>
      </div>
      <div className="rr-range-feedback-detail">
        {found
          ? `You found ${targetHand} in a range of ${size} hand${size > 1 ? 's' : ''}.`
          : `${targetHand} was not in your selected range.`
        }
        {found && score < 50 && ` Try narrowing your range for more points.`}
      </div>
      <button className="rr-reveal-confirm-btn" onClick={onContinue}>
        Reveal Villain's Hand →
      </button>
    </div>
  );
}
