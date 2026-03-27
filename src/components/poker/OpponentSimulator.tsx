import { usePokerDrill } from '../../hooks/usePokerDrill';
import { SIM_SCENARIOS, OPPONENT_PROFILES } from '../../data/poker';
import { DrillFeedback } from './DrillFeedback';
import { SessionComplete } from './SessionComplete';
import { HandDisplay, BoardDisplay } from './HandDisplay';
import { POSITION_FULL } from '../../utils/poker';
import type { SimScenario, PokerAction } from '../../types/poker';

interface Props {
  onRecordAttempt: (scenarioId: string, correct: boolean) => void;
  onBack: () => void;
}

const ACTION_LABELS: Record<PokerAction, string> = {
  fold: 'Fold',
  call: 'Call',
  raise: 'Raise',
  '3bet': '3-Bet',
  allin: 'All-In',
  check: 'Check',
};

function StatBar({ label, value, max = 100, color }: { label: string; value: number; max?: number; color?: string }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-secondary)' }}>{value}%</span>
      </div>
      <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(value / max) * 100}%`, background: color ?? 'var(--accent)', borderRadius: 2 }} />
      </div>
    </div>
  );
}

function SimQuestion({ scenario, onAnswer }: { scenario: SimScenario; onAnswer: (action: PokerAction) => void }) {
  const profile = OPPONENT_PROFILES[scenario.opponentType];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Villain profile panel */}
      <div style={{
        background: 'var(--bg-2)',
        border: `1px solid ${profile.color}40`,
        borderLeft: `3px solid ${profile.color}`,
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: '2rem', lineHeight: 1 }}>{profile.icon}</div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: profile.color }}>{profile.displayName}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>{profile.description}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <StatBar label="VPIP" value={profile.stats.vpip} color={profile.color} />
            <StatBar label="PFR" value={profile.stats.pfr} color={profile.color} />
            <StatBar label="Fold to Steal" value={profile.stats.foldToSteal} color={profile.color} />
            <StatBar label="Fold to C-Bet" value={profile.stats.foldToCbet} color={profile.color} />
          </div>
        </div>
      </div>

      {/* Scenario card */}
      <div className="scenario-card">
        <div className="scenario-label">
          Opponent Simulation — {scenario.street.charAt(0).toUpperCase() + scenario.street.slice(1)}
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>Your Hand</div>
            <HandDisplay card1={scenario.heroCard1} card2={scenario.heroCard2} size="md" />
          </div>
          {scenario.board.length > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>Board ({scenario.street})</div>
              <BoardDisplay cards={scenario.board} size="md" />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="position-badge">{scenario.heroPosition}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{POSITION_FULL[scenario.heroPosition]}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pot: {scenario.potSizeBB} BB</span>
          </div>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg-3)', borderRadius: 6, padding: '8px 10px' }}>
          <strong style={{ color: profile.color }}>{profile.displayName}</strong> {scenario.villainAction === 'fold' ? 'has folded' : `has ${scenario.villainAction}${scenario.villainBetSizeBB ? `d ${scenario.villainBetSizeBB} BB` : 'd'}`}.
          {scenario.villainBetSizeBB && (
            <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', color: 'var(--yellow)' }}>
              Bet: {scenario.villainBetSizeBB} BB
            </span>
          )}
        </div>

        <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          What is your exploitative action?
        </div>

        <div className="drill-action-buttons">
          {scenario.availableActions.map((action) => (
            <button
              key={action}
              className={`drill-action-btn ${action}`}
              onClick={() => onAnswer(action)}
            >
              {ACTION_LABELS[action]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function OpponentSimulator({ onRecordAttempt, onBack }: Props) {
  const { session, currentScenario, difficulty, setDifficulty, startSession, submitAnswer, nextQuestion, resetSession } =
    usePokerDrill('opponent_simulation', SIM_SCENARIOS);

  const handleAnswer = (action: PokerAction) => {
    if (!currentScenario) return;
    const isCorrect = action === currentScenario.correctAction;
    submitAnswer(action, currentScenario.correctAction);
    onRecordAttempt(currentScenario.id, isCorrect);
  };

  if (!session) {
    return (
      <div className="poker-drill-view">
        <div className="drill-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h2>Opponent Simulator</h2>
        </div>
        <div className="drill-start-screen">
          <div className="drill-start-icon">👥</div>
          <h3>Opponent Type Simulation</h3>
          <p>
            Identify your opponent's player type and make the exploitative play.
            Different player types have specific weaknesses and tendencies to exploit.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
            {Object.values(OPPONENT_PROFILES).map((p) => (
              <span key={p.type} style={{ fontSize: '1.3rem' }} title={p.displayName}>{p.icon}</span>
            ))}
          </div>
          <div className="drill-difficulty-filter">
            {(['all', 'easy', 'medium', 'hard'] as const).map((d) => (
              <button key={d} className={`difficulty-btn ${difficulty === d ? 'active' : ''}`} onClick={() => setDifficulty(d)}>
                {d === 'all' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={startSession} style={{ marginTop: 8 }}>
            Start Session (10 hands)
          </button>
        </div>
      </div>
    );
  }

  if (session.phase === 'session_complete') {
    return (
      <div className="poker-drill-view">
        <div className="drill-header"><button className="back-btn" onClick={onBack}>← Back</button></div>
        <SessionComplete correctCount={session.correctCount} totalCount={session.totalInSession} drillName="Opponent Simulator" onRestart={resetSession} onBack={onBack} />
      </div>
    );
  }

  const progressPct = (session.currentScenarioIndex / session.totalInSession) * 100;
  const isAnswered = session.phase === 'correct' || session.phase === 'incorrect';
  const profile = currentScenario ? OPPONENT_PROFILES[currentScenario.opponentType] : null;

  return (
    <div className="poker-drill-view">
      <div className="drill-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>👥 Opponent Sim</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{session.currentScenarioIndex + 1}/{session.totalInSession}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--green)', fontFamily: 'var(--mono)' }}>{session.correctCount} ✓</span>
        </div>
      </div>
      <div className="drill-progress-bar">
        <div className="drill-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {currentScenario && !isAnswered && (
        <SimQuestion scenario={currentScenario} onAnswer={handleAnswer} />
      )}

      {isAnswered && currentScenario && profile && (
        <DrillFeedback
          isCorrect={session.phase === 'correct'}
          userAnswer={ACTION_LABELS[session.userAnswer as PokerAction] ?? session.userAnswer}
          correctAnswer={ACTION_LABELS[currentScenario.correctAction]}
          answerLabel="Action"
          explanation={currentScenario.explanation}
          extraContent={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="formula-display">
                <strong>Exploit Rationale vs {profile.icon} {profile.displayName}:</strong>
                <br />
                <span style={{ color: 'var(--text-secondary)' }}>{currentScenario.exploitRationale}</span>
              </div>
              <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Key exploits vs {profile.displayName}
                </div>
                {profile.exploitTips.slice(0, 3).map((tip, i) => (
                  <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: 6, marginBottom: 3 }}>
                    <span style={{ color: profile.color }}>▸</span>
                    {tip}
                  </div>
                ))}
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
