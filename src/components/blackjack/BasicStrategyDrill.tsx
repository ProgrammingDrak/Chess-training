import { useBlackjackDrill } from '../../hooks/useBlackjackDrill';
import { BASIC_STRATEGY_SCENARIOS } from '../../data/blackjack';
import { DrillFeedback } from '../poker/DrillFeedback';
import { SessionComplete } from '../poker/SessionComplete';
import { CardDisplay } from './CardDisplay';
import type { BasicStrategyScenario, BJAction } from '../../types/blackjack';

interface Props {
  onRecordAttempt: (id: string, correct: boolean) => void;
  onBack: () => void;
}

const ACTION_LABELS: Record<BJAction, string> = {
  H: 'Hit',
  S: 'Stand',
  D: 'Double',
  P: 'Split',
  R: 'Surrender',
};

const SUITS_FOR_DISPLAY = ['♠', '♣', '♥', '♦'] as const;

function pickSuit(rank: string): string {
  // deterministic pseudo-random suit based on rank char code
  return SUITS_FOR_DISPLAY[rank.charCodeAt(0) % SUITS_FOR_DISPLAY.length];
}

export function BasicStrategyDrill({ onRecordAttempt, onBack }: Props) {
  const {
    session,
    currentScenario,
    difficulty,
    setDifficulty,
    startSession,
    submitAnswer,
    nextQuestion,
    resetSession,
  } = useBlackjackDrill<BasicStrategyScenario>('basic_strategy', BASIC_STRATEGY_SCENARIOS);

  const handleAction = (action: BJAction) => {
    if (!currentScenario || session?.phase !== 'question') return;
    const correct = submitAnswer(action, currentScenario.correctAction);
    onRecordAttempt(currentScenario.id, correct);
  };

  const handleNext = () => {
    nextQuestion();
  };

  // ── Idle / start screen ──────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="poker-drill-view">
        <div className="drill-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h2>Basic Strategy</h2>
        </div>
        <div className="drill-start-screen">
          <div className="drill-start-icon">🃏</div>
          <h3>Basic Strategy Drill</h3>
          <p>
            Given your hand and the dealer upcard, choose the correct action.
            Master perfect basic strategy for 6-deck S17 rules.
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
          drillName="Basic Strategy"
          onRestart={resetSession}
          onBack={onBack}
        />
      </div>
    );
  }

  const progressPct = (session.currentScenarioIndex / session.totalInSession) * 100;
  const isAnswered = session.phase === 'correct' || session.phase === 'incorrect';

  return (
    <div className="poker-drill-view">
      <div className="drill-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>🃏 Basic Strategy</h2>
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
          <div className="scenario-label">Basic Strategy Challenge</div>

          {/* Dealer section */}
          <div className="bj-dealer-section">
            <div className="bj-section-label">Dealer shows:</div>
            <div className="bj-cards-row">
              <CardDisplay
                rank={currentScenario.dealerUpcard}
                suit={pickSuit(currentScenario.dealerUpcard)}
                size="md"
              />
            </div>
          </div>

          {/* Player section */}
          <div className="bj-player-section">
            <div className="bj-section-label">Your hand:</div>
            <div className="bj-cards-row">
              {currentScenario.playerCards.map((card, i) => (
                <CardDisplay
                  key={i}
                  rank={card}
                  suit={pickSuit(card + i)}
                  size="md"
                />
              ))}
            </div>
            <div className="bj-hand-meta">
              <span className={`bj-hand-type-badge bj-hand-type-${currentScenario.handType}`}>
                {currentScenario.handType.charAt(0).toUpperCase() + currentScenario.handType.slice(1)}
              </span>
              <span className="bj-hand-total">Total: {currentScenario.playerTotal}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="bj-action-row">
            {(['H', 'S', 'D', 'P', 'R'] as BJAction[]).map((action) => {
              const isPair = currentScenario.handType === 'pair';
              const disabled = action === 'P' && !isPair;
              return (
                <button
                  key={action}
                  className={`bj-action-btn ${disabled ? 'bj-action-btn-disabled' : ''}`}
                  onClick={() => !disabled && handleAction(action)}
                  disabled={disabled}
                  title={ACTION_LABELS[action]}
                >
                  <span className="bj-action-letter">{action}</span>
                  <span className="bj-action-name">{ACTION_LABELS[action]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isAnswered && currentScenario && (
        <DrillFeedback
          isCorrect={session.phase === 'correct'}
          userAnswer={session.userAnswer ? ACTION_LABELS[session.userAnswer as BJAction] ?? session.userAnswer : ''}
          correctAnswer={ACTION_LABELS[currentScenario.correctAction]}
          answerLabel="Action"
          explanation={currentScenario.explanation}
          onNext={handleNext}
          isLastQuestion={session.currentScenarioIndex >= session.totalInSession - 1}
        />
      )}
    </div>
  );
}
