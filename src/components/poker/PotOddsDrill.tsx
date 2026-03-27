import { useState, useMemo } from 'react';
import { usePokerDrill } from '../../hooks/usePokerDrill';
import { POT_ODDS_SCENARIOS } from '../../data/poker';
import { DrillFeedback } from './DrillFeedback';
import { SessionComplete } from './SessionComplete';
import { generatePctDistractors, shuffle, calcRequiredEquity } from '../../utils/poker';
import type { PotOddsScenario } from '../../types/poker';

interface Props {
  onRecordAttempt: (scenarioId: string, correct: boolean) => void;
  onBack: () => void;
}

function PotOddsQuestion({
  scenario,
  onAnswer,
}: {
  scenario: PotOddsScenario;
  onAnswer: (answer: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;

  const correct = scenario.requiredEquityPct;
  const choices = useMemo(() => {
    const distractors = generatePctDistractors(correct, 3);
    return shuffle([correct, ...distractors]);
  }, [correct]);

  const handleClick = (choice: number) => {
    if (answered) return;
    setSelected(choice.toString());
    onAnswer(choice.toString());
  };

  return (
    <div className="scenario-card">
      <div className="scenario-label">Pot Odds Challenge</div>

      {/* Numbers */}
      <div className="pot-odds-display">
        <div className="pot-stat">
          <div className="pot-stat-label">Pot</div>
          <div className="pot-stat-value">{scenario.potSizeBB}</div>
          <div className="pot-stat-unit">BB</div>
        </div>
        <div className="pot-stat" style={{ color: 'var(--red)' }}>
          <div className="pot-stat-label">Villain Bet</div>
          <div className="pot-stat-value">{scenario.betSizeBB}</div>
          <div className="pot-stat-unit">BB</div>
        </div>
        <div className="pot-stat" style={{ color: 'var(--accent-hover)' }}>
          <div className="pot-stat-label">To Call</div>
          <div className="pot-stat-value">{scenario.betSizeBB}</div>
          <div className="pot-stat-unit">BB</div>
        </div>
        <div className="pot-stat">
          <div className="pot-stat-label">Street</div>
          <div className="pot-stat-value" style={{ fontSize: '0.9rem', textTransform: 'capitalize' }}>{scenario.street}</div>
        </div>
      </div>

      <div className="scenario-description">
        <strong>{scenario.heroHandDescription}</strong>
        <br />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Board: {scenario.boardDescription}</span>
      </div>

      <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        What minimum equity % do you need to profitably call?
      </div>

      <div className="formula-display">
        Required Equity = <span className="formula-highlight">Call</span> / (<span className="formula-highlight">Pot</span> + <span className="formula-highlight">Bet</span> + <span className="formula-highlight">Call</span>) × 100
        <br />= {scenario.betSizeBB} / ({scenario.potSizeBB} + {scenario.betSizeBB} + {scenario.betSizeBB}) = ?
      </div>

      <div className="pot-odds-choices">
        {choices.map((choice) => (
          <button
            key={choice}
            className={`pot-odds-choice-btn ${
              selected !== null
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
            {choice}%
          </button>
        ))}
      </div>
    </div>
  );
}

export function PotOddsDrill({ onRecordAttempt, onBack }: Props) {
  const { session, currentScenario, difficulty, setDifficulty, startSession, submitAnswer, nextQuestion, resetSession } =
    usePokerDrill('pot_odds', POT_ODDS_SCENARIOS);

  const handleAnswer = (answer: string) => {
    if (!currentScenario) return;
    const correct = submitAnswer(answer, currentScenario.requiredEquityPct.toString());
    onRecordAttempt(currentScenario.id, correct);
  };

  if (!session) {
    return (
      <div className="poker-drill-view">
        <div className="drill-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h2>Pot Odds Calculator</h2>
        </div>
        <div className="drill-start-screen">
          <div className="drill-start-icon">%</div>
          <h3>Pot Odds Drill</h3>
          <p>
            Calculate the minimum equity percentage needed to profitably call a bet.
            Formula: <code style={{ fontFamily: 'var(--mono)', color: 'var(--accent-hover)' }}>Call / (Pot + Call + Call) × 100</code>
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

  if (session.phase === 'session_complete') {
    return (
      <div className="poker-drill-view">
        <div className="drill-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
        </div>
        <SessionComplete
          correctCount={session.correctCount}
          totalCount={session.totalInSession}
          drillName="Pot Odds"
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
        <h2>% Pot Odds</h2>
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
        <PotOddsQuestion scenario={currentScenario} onAnswer={handleAnswer} />
      )}

      {isAnswered && currentScenario && (
        <DrillFeedback
          isCorrect={session.phase === 'correct'}
          userAnswer={`${session.userAnswer}%`}
          correctAnswer={`${currentScenario.requiredEquityPct}%`}
          answerLabel="Required equity"
          explanation={currentScenario.explanation}
          extraContent={
            <div className="formula-display">
              <strong>Solution:</strong>
              <br />
              {currentScenario.betSizeBB} / ({currentScenario.potSizeBB} + {currentScenario.betSizeBB} + {currentScenario.betSizeBB}) ×100
              {' = '}
              <span className="formula-highlight">
                {Math.round(calcRequiredEquity(currentScenario.potSizeBB, currentScenario.betSizeBB))}%
              </span>
              <br />
              Your draw estimate: ~<span className="formula-highlight">{currentScenario.estimatedEquityPct}%</span>
              {' → '}
              <span style={{ color: currentScenario.correctAnswer === 'call' ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                {currentScenario.correctAnswer.toUpperCase()}
              </span>
            </div>
          }
          onNext={nextQuestion}
          isLastQuestion={session.currentScenarioIndex >= session.totalInSession - 1}
        />
      )}
    </div>
  );
}
