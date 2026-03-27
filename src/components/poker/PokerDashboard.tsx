import { usePokerProgress } from '../../hooks/usePokerProgress';
import type { PokerDrillType } from '../../types/poker';

type PokerProgressHook = ReturnType<typeof usePokerProgress>;

interface Props {
  pokerProgress: PokerProgressHook['progress'];
  onReset: PokerProgressHook['resetProgress'];
  onBack: () => void;
}

const DRILL_META: { type: PokerDrillType; label: string; icon: string; description: string }[] = [
  { type: 'hand_selection', label: 'Hand Selection', icon: '🃏', description: 'Preflop GTO ranges by position' },
  { type: 'pot_odds', label: 'Pot Odds', icon: '%', description: 'Required equity to call profitably' },
  { type: 'equity_estimation', label: 'Equity Estimator', icon: '~', description: 'Rule of 4 & 2 draw equity' },
  { type: 'bet_sizing', label: 'Bet Sizing', icon: '$', description: 'Board texture-based bet sizes' },
  { type: 'opponent_simulation', label: 'Opponent Sim', icon: '👥', description: 'Exploit specific player types' },
  { type: 'ev_calculation', label: 'EV Calculator', icon: 'EV', description: 'Expected value math' },
];

function AccuracyRing({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--yellow)' : 'var(--red)';
  return (
    <div style={{
      width: 52,
      height: 52,
      borderRadius: '50%',
      border: `3px solid ${color}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      background: `${color}15`,
    }}>
      <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '0.85rem', color }}>{pct}%</span>
    </div>
  );
}

export function PokerDashboard({ pokerProgress, onReset, onBack }: Props) {
  const getDrillStats = (drillType: PokerDrillType) => {
    const drill = pokerProgress.drills[drillType];
    if (!drill) return { totalAttempts: 0, correctAttempts: 0, accuracy: 0 };
    const accuracy = drill.totalAttempts > 0 ? Math.round((drill.correctAttempts / drill.totalAttempts) * 100) : 0;
    return { totalAttempts: drill.totalAttempts, correctAttempts: drill.correctAttempts, accuracy };
  };

  const allDrills = DRILL_META.map((meta) => {
    const stats = getDrillStats(meta.type);
    return { ...meta, ...stats };
  });

  const totalAttempts = allDrills.reduce((s, d) => s + d.totalAttempts, 0);
  const totalCorrect = allDrills.reduce((s, d) => s + d.correctAttempts, 0);
  const overallPct = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  const handleReset = () => {
    if (window.confirm('Reset all poker progress? This cannot be undone.')) {
      onReset();
    }
  };

  return (
    <div className="poker-dashboard">
      <div className="drill-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>Poker GTO Progress</h2>
      </div>

      {/* Overall summary */}
      <div style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <AccuracyRing pct={overallPct} />
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Overall Accuracy</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {totalCorrect} correct / {totalAttempts} total attempts across all drills
          </div>
        </div>
      </div>

      {/* Per-drill stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {allDrills.map((drill) => (
          <div
            key={drill.type}
            style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'var(--bg-3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'var(--accent)',
              flexShrink: 0,
              fontFamily: typeof drill.icon === 'string' && drill.icon.length <= 2 ? 'var(--mono)' : undefined,
            }}>
              {drill.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{drill.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{drill.description}</div>
              {drill.totalAttempts > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${drill.accuracy}%`,
                      background: drill.accuracy >= 80 ? 'var(--green)' : drill.accuracy >= 60 ? 'var(--yellow)' : 'var(--red)',
                      borderRadius: 2,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              )}
            </div>
            {drill.totalAttempts > 0 ? (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontWeight: 700,
                  fontSize: '1rem',
                  color: drill.accuracy >= 80 ? 'var(--green)' : drill.accuracy >= 60 ? 'var(--yellow)' : 'var(--red)',
                }}>
                  {drill.accuracy}%
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{drill.totalAttempts} tried</div>
              </div>
            ) : (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>Not started</div>
            )}
          </div>
        ))}
      </div>

      {/* Weak areas */}
      {(() => {
        const practiced = allDrills.filter((d) => d.totalAttempts > 0);
        if (practiced.length === 0) return null;
        const weakest = practiced.sort((a, b) => a.accuracy - b.accuracy)[0];
        return (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 6 }}>
              Focus Area
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Your weakest drill is <strong style={{ color: 'var(--red)' }}>{weakest.label}</strong> at {weakest.accuracy}% accuracy.
              Practice this drill to improve your overall GTO fundamentals.
            </div>
          </div>
        );
      })()}

      {totalAttempts > 0 && (
        <button
          onClick={handleReset}
          style={{
            alignSelf: 'flex-start',
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            padding: '6px 14px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '0.78rem',
          }}
        >
          Reset Progress
        </button>
      )}
    </div>
  );
}
