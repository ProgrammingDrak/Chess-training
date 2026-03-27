import { useState, useMemo } from 'react';
import { usePokerDrill } from '../../hooks/usePokerDrill';
import { EV_SCENARIOS } from '../../data/poker';
import { DrillFeedback } from './DrillFeedback';
import { SessionComplete } from './SessionComplete';
import { generateEvDistractors, shuffle } from '../../utils/poker';
import type { EvScenario } from '../../types/poker';

interface Props {
  onRecordAttempt: (scenarioId: string, correct: boolean) => void;
  onBack: () => void;
}

function EvQuestion({ scenario, onAnswer }: { scenario: EvScenario; onAnswer: (answer: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;

  const correct = scenario.correctEvBB;
  const choices = useMemo(() => {
    const distractors = generateEvDistractors(correct, 3);
    return shuffle([correct, ...distractors]);
  }, [correct]);

  const handleClick = (choice: number) => {
    if (answered) return;
    setSelected(choice.toString());
    onAnswer(choice.toString());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="scenario-card">
        <div className="scenario-label">EV Calculation</div>
        <div className="scenario-description">{scenario.scenarioDescription}</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Action: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{scenario.heroActionDescription}</span>
          {' '} · Pot: <span style={{ fontFamily: 'var(--mono)', color: 'var(--yellow)' }}>{scenario.potBeforeActionBB} BB</span>
        </div>
      </div>

      {/* Outcomes table */}
      <div className="ev-outcomes-table">
        <div className="ev-outcome-header">
          <span>Outcome</span>
          <span>Probability</span>
          <span>Net Value</span>
        </div>
        {scenario.outcomes.map((outcome, i) => (
          <div key={i} className="ev-outcome-row">
            <span className="ev-outcome-desc">{outcome.description}</span>
            <span className="ev-outcome-prob">{(outcome.probability * 100).toFixed(0)}%</span>
            <span className={`ev-outcome-value ${outcome.netValueBB > 0 ? 'ev-positive' : outcome.netValueBB < 0 ? 'ev-negative' : 'ev-neutral'}`}>
              {outcome.netValueBB > 0 ? '+' : ''}{outcome.netValueBB} BB
            </span>
          </div>
        ))}
        <div className="ev-total-row">
          <span className="ev-total-label">EV = Σ(P × Value) = ?</span>
          <span className="ev-total-value" style={{ color: 'var(--text-muted)' }}>__ BB</span>
        </div>
      </div>

      <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        What is the expected value of this action?
      </div>

      <div className="ev-choices">
        {choices.map((choice) => (
          <button
            key={choice}
            className={`ev-choice-btn ${
              answered
                ? choice === correct
                  ? 'correct-choice'
                  : selected === choice.toString() && choice !== correct
                  ? 'wrong-choice'
                  : ''
                : ''
            }`}
            onClick={() => handleClick(choice)}
            disabled={answered}
          >
            {choice > 0 ? '+' : ''}{choice} BB
          </button>
        ))}
      </div>
    </div>
  );
}

export function EvCalculatorDrill({ onRecordAttempt, onBack }: Props) {
  const { session, currentScenario, difficulty, setDifficulty, startSession, submitAnswer, nextQuestion, resetSession } =
    usePokerDrill('ev_calculation', EV_SCENARIOS);

  const handleAnswer = (answer: string) => {
    if (!currentScenario) return;
    const answerNum = parseFloat(answer);
    const isCorrect = Math.abs(answerNum - currentScenario.correctEvBB) <= currentScenario.toleranceBB;
    submitAnswer(answer, currentScenario.correctEvBB.toString());
    onRecordAttempt(currentScenario.id, isCorrect);
  };

  if (!session) {
    return (
      <div className="poker-drill-view">
        <div className="drill-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h2>EV Calculator</h2>
        </div>
        <div className="drill-start-screen">
          <div className="drill-start-icon">EV</div>
          <h3>Expected Value Drill</h3>
          <p>
            Calculate the expected value of poker decisions from outcome probabilities.
            Formula: <code style={{ fontFamily: 'var(--mono)', color: 'var(--accent-hover)' }}>EV = Σ(probability × outcome)</code>
          </p>
          <div className="drill-difficulty-filter">
            {(['all', 'easy', 'medium', 'hard'] as const).map((d) => (
              <button key={d} className={`difficulty-btn ${difficulty === d ? 'active' : ''}`} onClick={() => setDifficulty(d)}>
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

  if (session.phase === 'session_complete') {
    return (
      <div className="poker-drill-view">
        <div className="drill-header"><button className="back-btn" onClick={onBack}>← Back</button></div>
        <SessionComplete correctCount={session.correctCount} totalCount={session.totalInSession} drillName="EV Calculator" onRestart={resetSession} onBack={onBack} />
      </div>
    );
  }

  const progressPct = (session.currentScenarioIndex / session.totalInSession) * 100;
  const isAnswered = session.phase === 'correct' || session.phase === 'incorrect';

  return (
    <div className="poker-drill-view">
      <div className="drill-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>EV Calculator</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{session.currentScenarioIndex + 1}/{session.totalInSession}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--green)', fontFamily: 'var(--mono)' }}>{session.correctCount} ✓</span>
        </div>
      </div>
      <div className="drill-progress-bar">
        <div className="drill-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {currentScenario && !isAnswered && (
        <EvQuestion scenario={currentScenario} onAnswer={handleAnswer} />
      )}

      {isAnswered && currentScenario && (
        <DrillFeedback
          isCorrect={session.phase === 'correct'}
          userAnswer={`${session.userAnswer} BB`}
          correctAnswer={`${currentScenario.correctEvBB > 0 ? '+' : ''}${currentScenario.correctEvBB} BB`}
          answerLabel="EV"
          explanation={currentScenario.explanation}
          extraContent={
            <div className="ev-outcomes-table">
              <div className="ev-outcome-header">
                <span>Outcome</span>
                <span>Probability</span>
                <span>Contribution</span>
              </div>
              {currentScenario.outcomes.map((outcome, i) => {
                const contribution = outcome.probability * outcome.netValueBB;
                return (
                  <div key={i} className="ev-outcome-row">
                    <span className="ev-outcome-desc">{outcome.description}</span>
                    <span className="ev-outcome-prob">{(outcome.probability * 100).toFixed(0)}%</span>
                    <span className={`ev-outcome-value ${contribution > 0 ? 'ev-positive' : contribution < 0 ? 'ev-negative' : 'ev-neutral'}`}>
                      {contribution > 0 ? '+' : ''}{contribution.toFixed(2)} BB
                    </span>
                  </div>
                );
              })}
              <div className="ev-total-row">
                <span className="ev-total-label">Total EV</span>
                <span className={`ev-total-value ${currentScenario.correctEvBB > 0 ? 'ev-positive' : currentScenario.correctEvBB < 0 ? 'ev-negative' : 'ev-neutral'}`}>
                  {currentScenario.correctEvBB > 0 ? '+' : ''}{currentScenario.correctEvBB} BB
                </span>
              </div>
            </div>
          }
          onNext={nextQuestion}
          isLastQuestion={session.currentScenarioIndex >= session.totalInSession - 1}
        />
      )}
    </div>
  );
}
