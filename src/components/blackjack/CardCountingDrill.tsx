import { useState } from 'react';
import { useBlackjackDrill } from '../../hooks/useBlackjackDrill';
import { CARD_COUNTING_SCENARIOS } from '../../data/blackjack';
import { DrillFeedback } from '../poker/DrillFeedback';
import { SessionComplete } from '../poker/SessionComplete';
import { CardDisplay } from './CardDisplay';
import type { CardCountingScenario } from '../../types/blackjack';

interface Props {
  onRecordAttempt: (id: string, correct: boolean) => void;
  onBack: () => void;
}

function hiLoValue(rank: string): number {
  if (['2', '3', '4', '5', '6'].includes(rank)) return 1;
  if (['7', '8', '9'].includes(rank)) return 0;
  return -1; // T, J, Q, K, A
}

function hiLoLabel(val: number): string {
  return val > 0 ? `+${val}` : `${val}`;
}

const SUITS_FOR_DISPLAY = ['♠', '♣', '♥', '♦'] as const;

function pickSuit(card: string, index: number): string {
  return SUITS_FOR_DISPLAY[(card.charCodeAt(0) + index) % SUITS_FOR_DISPLAY.length];
}

export function CardCountingDrill({ onRecordAttempt, onBack }: Props) {
  const [inputValue, setInputValue] = useState('');

  const {
    session,
    currentScenario,
    difficulty,
    setDifficulty,
    startSession,
    submitNumericAnswer,
    nextQuestion,
    resetSession,
  } = useBlackjackDrill<CardCountingScenario>('card_counting', CARD_COUNTING_SCENARIOS);

  const handleSubmit = () => {
    if (!currentScenario || session?.phase !== 'question') return;
    const value = parseInt(inputValue, 10);
    if (isNaN(value)) return;
    const correct = submitNumericAnswer(value, currentScenario.correctCount, 0);
    onRecordAttempt(currentScenario.id, correct);
  };

  const handleNext = () => {
    setInputValue('');
    nextQuestion();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit();
  };

  // ── Idle / start screen ──────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="poker-drill-view">
        <div className="drill-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h2>Card Counting</h2>
        </div>
        <div className="drill-start-screen">
          <div className="drill-start-icon">🔢</div>
          <h3>Card Counting Drill</h3>
          <p>
            Track the Hi-Lo running count through a sequence of cards.
            Build the mental speed needed at a real table.
          </p>
          <div className="drill-difficulty-filter">
            {(['all', 'easy', 'medium', 'hard'] as const).map((d) => (
              <button
                key={d}
                className={`difficulty-btn ${difficulty === d ? 'active' : ''}`}
                onClick={() => setDifficulty(d)}
              >
                {d === 'all' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={startSession} style={{ marginTop: 8 }}>
            Start Session (10 questions)
          </button>
        </div>
      </div>
    );
  }

  // ── Session complete ─────────────────────────────────────────────────────────
  if (session.phase === 'session_complete') {
    return (
      <div className="poker-drill-view">
        <div className="drill-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
        </div>
        <SessionComplete
          correctCount={session.correctCount}
          totalCount={session.totalInSession}
          drillName="Card Counting"
          onRestart={() => { resetSession(); setInputValue(''); }}
          onBack={onBack}
        />
      </div>
    );
  }

  const progressPct = (session.currentScenarioIndex / session.totalInSession) * 100;
  const isAnswered = session.phase === 'correct' || session.phase === 'incorrect';

  // Build step-by-step explanation for feedback
  const buildStepExplanation = (scenario: CardCountingScenario): string => {
    let running = scenario.startingCount;
    const steps = scenario.cards.map((card) => {
      const val = hiLoValue(card === 'T' ? 'T' : card);
      running += val;
      return `${card === 'T' ? '10' : card}(${hiLoLabel(val)})→${running}`;
    });
    return `Hi-Lo steps: ${steps.join(' | ')}. Final count: ${scenario.correctCount}`;
  };

  return (
    <div className="poker-drill-view">
      <div className="drill-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>🔢 Card Counting</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {session.currentScenarioIndex + 1}/{session.totalInSession}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--green)', fontFamily: 'var(--mono)' }}>
            {session.correctCount} ✓
          </span>
        </div>
      </div>

      <div className="drill-progress-bar">
        <div className="drill-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {currentScenario && !isAnswered && (
        <div className="scenario-card">
          <div className="scenario-label">Card Counting Challenge</div>

          {/* Hi-Lo reference */}
          <div className="bj-hilo-reference">
            <span className="bj-hilo-pos">2–6 = +1</span>
            <span className="bj-hilo-neutral">7–8–9 = 0</span>
            <span className="bj-hilo-neg">10–A = −1</span>
          </div>

          {/* Starting count notice */}
          {currentScenario.startingCount !== 0 && (
            <div className="bj-starting-count">
              Starting count: <strong style={{ fontFamily: 'var(--mono)', color: 'var(--accent-hover)' }}>
                {currentScenario.startingCount > 0 ? `+${currentScenario.startingCount}` : currentScenario.startingCount}
              </strong>
            </div>
          )}

          {/* Card sequence */}
          <div className="bj-card-sequence">
            {currentScenario.cards.map((card, i) => (
              <CardDisplay
                key={i}
                rank={card}
                suit={pickSuit(card, i)}
                size="sm"
              />
            ))}
          </div>

          {/* Numeric input */}
          <div className="bj-count-input-row">
            <label className="bj-count-label">Running count:</label>
            <input
              type="number"
              className="bj-count-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. +3"
              autoFocus
            />
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={inputValue === ''}
            >
              Submit
            </button>
          </div>
        </div>
      )}

      {isAnswered && currentScenario && (
        <DrillFeedback
          isCorrect={session.phase === 'correct'}
          userAnswer={session.userAnswer ?? ''}
          correctAnswer={String(currentScenario.correctCount)}
          answerLabel="Count"
          explanation={buildStepExplanation(currentScenario)}
          onNext={handleNext}
          isLastQuestion={session.currentScenarioIndex >= session.totalInSession - 1}
        />
      )}
    </div>
  );
}
