import { usePokerDrill } from '../../hooks/usePokerDrill';
import { BET_SIZING_SCENARIOS } from '../../data/poker';
import { DrillFeedback } from './DrillFeedback';
import { SessionComplete } from './SessionComplete';
import type { BetSizingScenario, BetSizeOption } from '../../types/poker';

interface Props {
  onRecordAttempt: (scenarioId: string, correct: boolean) => void;
  onBack: () => void;
}

const TEXTURE_LABELS: Record<string, string> = {
  dry: 'Dry / Uncoordinated',
  wet: 'Wet / Coordinated',
  monotone: 'Monotone',
  paired: 'Paired',
  drawy: 'Draw-heavy',
};

const BET_SIZE_PCT: Record<BetSizeOption, string> = {
  '1/4': '25% pot',
  '1/3': '33% pot',
  '1/2': '50% pot',
  '2/3': '67% pot',
  '3/4': '75% pot',
  'pot': '100% pot',
  'overbet': '125%+ overbet',
};

function BetSizingQuestion({
  scenario,
  onAnswer,
}: {
  scenario: BetSizingScenario;
  onAnswer: (option: BetSizeOption) => void;
}) {
  return (
    <div className="scenario-card">
      <div className="scenario-label">Bet Sizing — {scenario.street.charAt(0).toUpperCase() + scenario.street.slice(1)}</div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="position-badge">{scenario.position}</span>
        <span className="board-texture-tag">{TEXTURE_LABELS[scenario.boardTexture] ?? scenario.boardTexture}</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {scenario.heroRole} · Pot: {scenario.potSizeBB} BB · Stack: {scenario.stackDepthBB} BB
        </span>
      </div>

      <div style={{ fontFamily: 'var(--mono)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
        Board: {scenario.boardDescription}
      </div>

      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        {scenario.scenarioDescription}
      </div>

      <div style={{ fontSize: '0.78rem', display: 'flex', gap: 16, color: 'var(--text-muted)' }}>
        <span>Range advantage: <strong style={{ color: scenario.rangeAdvantage === 'hero' ? 'var(--green)' : scenario.rangeAdvantage === 'villain' ? 'var(--red)' : 'var(--text-secondary)' }}>{scenario.rangeAdvantage}</strong></span>
      </div>

      <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        What is the correct bet size?
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {scenario.options.map((opt) => (
          <button
            key={opt}
            className="bet-size-btn"
            onClick={() => onAnswer(opt)}
          >
            <span style={{ fontWeight: 700 }}>{opt}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 4 }}>({BET_SIZE_PCT[opt]})</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function BetSizingDrill({ onRecordAttempt, onBack }: Props) {
  const { session, currentScenario, difficulty, setDifficulty, startSession, submitAnswer, nextQuestion, resetSession } =
    usePokerDrill('bet_sizing', BET_SIZING_SCENARIOS);

  const handleAnswer = (option: BetSizeOption) => {
    if (!currentScenario) return;
    const isCorrect = option === currentScenario.correctOption;
    submitAnswer(option, currentScenario.correctOption);
    onRecordAttempt(currentScenario.id, isCorrect);
  };

  if (!session) {
    return (
      <div className="poker-drill-view">
        <div className="drill-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h2>Bet Sizing</h2>
        </div>
        <div className="drill-start-screen">
          <div className="drill-start-icon">$</div>
          <h3>Bet Sizing Theory</h3>
          <p>
            Choose the right bet size based on board texture, position, and range advantage.
            <br />
            <strong>Dry boards</strong> → small (1/3). <strong>Wet/draw-heavy</strong> → large (2/3+). <strong>Nut advantage</strong> → overbet.
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
        <SessionComplete correctCount={session.correctCount} totalCount={session.totalInSession} drillName="Bet Sizing" onRestart={resetSession} onBack={onBack} />
      </div>
    );
  }

  const progressPct = (session.currentScenarioIndex / session.totalInSession) * 100;
  const isAnswered = session.phase === 'correct' || session.phase === 'incorrect';

  return (
    <div className="poker-drill-view">
      <div className="drill-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>$ Bet Sizing</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{session.currentScenarioIndex + 1}/{session.totalInSession}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--green)', fontFamily: 'var(--mono)' }}>{session.correctCount} ✓</span>
        </div>
      </div>
      <div className="drill-progress-bar">
        <div className="drill-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {currentScenario && !isAnswered && (
        <BetSizingQuestion scenario={currentScenario} onAnswer={handleAnswer} />
      )}

      {isAnswered && currentScenario && (
        <DrillFeedback
          isCorrect={session.phase === 'correct'}
          userAnswer={`${session.userAnswer} (${BET_SIZE_PCT[session.userAnswer as BetSizeOption] ?? session.userAnswer})`}
          correctAnswer={`${currentScenario.correctOption} (${BET_SIZE_PCT[currentScenario.correctOption]})`}
          answerLabel="Bet size"
          explanation={currentScenario.explanation}
          extraContent={
            <div className="formula-display">
              <strong>GTO Rationale:</strong>
              <br />
              <span style={{ color: 'var(--text-secondary)' }}>{currentScenario.gtoRationale}</span>
              <br />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Also acceptable: {currentScenario.acceptableOptions.join(', ')}
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
