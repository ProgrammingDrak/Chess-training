import { useState } from 'react';
import { usePokerDrill } from '../../hooks/usePokerDrill';
import { EQUITY_SCENARIOS } from '../../data/poker';
import { DrillFeedback } from './DrillFeedback';
import { SessionComplete } from './SessionComplete';
import { HandDisplay, BoardDisplay } from './HandDisplay';
import type { EquityEstimationScenario } from '../../types/poker';

interface Props {
  onRecordAttempt: (scenarioId: string, correct: boolean) => void;
  onBack: () => void;
}

function EquityQuestion({ scenario, onAnswer }: { scenario: EquityEstimationScenario; onAnswer: (value: number) => void }) {
  const [value, setValue] = useState(20);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (submitted) return;
    setSubmitted(true);
    onAnswer(value);
  };

  return (
    <div className="scenario-card">
      <div className="scenario-label">Equity Estimation — {scenario.street === 'flop' ? 'Use × 4' : 'Use × 2'}</div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>Your Hand</div>
          <HandDisplay card1={scenario.heroCard1} card2={scenario.heroCard2} size="md" />
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>Board ({scenario.street})</div>
          <BoardDisplay cards={scenario.board} size="md" />
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          {scenario.drawDescription}
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Outs: <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent-hover)', fontWeight: 700 }}>{scenario.outCount}</span>
          {scenario.completingCards && <span style={{ marginLeft: 8 }}>({scenario.completingCards})</span>}
        </div>
      </div>

      <div className="formula-display">
        Rule of {scenario.ruleMethod === 'x4' ? '4 (flop — 2 cards to come)' : '2 (turn — 1 card to come)'}:
        <br />
        {scenario.outCount} outs × {scenario.ruleMethod === 'x4' ? 4 : 2} = <span className="formula-highlight">?%</span>
      </div>

      <div className="equity-slider-section">
        <div className="equity-slider-label">
          <span>Estimate your equity:</span>
          <span className="equity-slider-value">{value}%</span>
        </div>
        <input
          className="equity-slider"
          type="range"
          min={0}
          max={100}
          step={2}
          value={value}
          onChange={(e) => !submitted && setValue(Number(e.target.value))}
          disabled={submitted}
        />
        <div className="equity-slider-ticks">
          {[0, 20, 40, 60, 80, 100].map((v) => <span key={v}>{v}%</span>)}
        </div>
      </div>

      {!submitted && (
        <button className="btn-primary" onClick={handleSubmit} style={{ alignSelf: 'flex-start' }}>
          Submit Answer
        </button>
      )}
    </div>
  );
}

export function EquityEstimatorDrill({ onRecordAttempt, onBack }: Props) {
  const { session, currentScenario, difficulty, setDifficulty, startSession, submitNumericAnswer, nextQuestion, resetSession } =
    usePokerDrill('equity_estimation', EQUITY_SCENARIOS);

  const handleAnswer = (value: number) => {
    if (!currentScenario) return;
    const isCorrect = submitNumericAnswer(value, currentScenario.equityEstimatePct, currentScenario.tolerancePct);
    onRecordAttempt(currentScenario.id, isCorrect);
  };

  if (!session) {
    return (
      <div className="poker-drill-view">
        <div className="drill-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h2>Equity Estimator</h2>
        </div>
        <div className="drill-start-screen">
          <div className="drill-start-icon">~</div>
          <h3>Rule of 4 & 2</h3>
          <p>
            Estimate your draw equity using the Rule of 4 & 2.
            On the <strong>flop</strong>: outs × 4. On the <strong>turn</strong>: outs × 2.
          </p>
          <div className="drill-difficulty-filter">
            {(['all', 'easy', 'medium', 'hard'] as const).map((d) => (
              <button key={d} className={`difficulty-btn ${difficulty === d ? 'active' : ''}`} onClick={() => setDifficulty(d)}>
                {d === 'all' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={startSession} style={{ marginTop: 8 }}>Start Session</button>
        </div>
      </div>
    );
  }

  if (session.phase === 'session_complete') {
    return (
      <div className="poker-drill-view">
        <div className="drill-header"><button className="back-btn" onClick={onBack}>← Back</button></div>
        <SessionComplete correctCount={session.correctCount} totalCount={session.totalInSession} drillName="Equity Estimator" onRestart={resetSession} onBack={onBack} />
      </div>
    );
  }

  const isAnswered = session.phase === 'correct' || session.phase === 'incorrect';
  const progressPct = (session.currentScenarioIndex / session.totalInSession) * 100;

  return (
    <div className="poker-drill-view">
      <div className="drill-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>~ Equity Estimator</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{session.currentScenarioIndex + 1}/{session.totalInSession}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--green)', fontFamily: 'var(--mono)' }}>{session.correctCount} ✓</span>
        </div>
      </div>
      <div className="drill-progress-bar">
        <div className="drill-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {currentScenario && !isAnswered && (
        <EquityQuestion scenario={currentScenario} onAnswer={handleAnswer} />
      )}

      {isAnswered && currentScenario && (
        <DrillFeedback
          isCorrect={session.phase === 'correct'}
          userAnswer={`${session.userAnswer}%`}
          correctAnswer={`${currentScenario.equityEstimatePct}% (±${currentScenario.tolerancePct}%)`}
          answerLabel="Equity estimate"
          explanation={currentScenario.explanation}
          extraContent={
            <div className="formula-display">
              <strong>Calculation:</strong>
              <br />
              {currentScenario.outCount} outs × {currentScenario.ruleMethod === 'x4' ? '4' : '2'}{' '}
              = <span className="formula-highlight">{currentScenario.equityEstimatePct}%</span>
              <br />
              <span style={{ color: 'var(--text-muted)' }}>
                ({currentScenario.street === 'flop' ? 'Flop: 2 cards to come → ×4' : 'Turn: 1 card to come → ×2'})
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
