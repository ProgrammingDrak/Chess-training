import type { PokerProgress, PokerDrillType } from '../../types/poker';

interface DrillModule {
  type: PokerDrillType;
  icon: string;
  name: string;
  description: string;
  scenarioCount: number;
}

const DRILL_MODULES: DrillModule[] = [
  {
    type: 'hand_selection',
    icon: '🃏',
    name: 'Hand Selection',
    description: 'Given your position and hole cards, decide: fold, call, or raise? Master GTO preflop ranges.',
    scenarioCount: 40,
  },
  {
    type: 'pot_odds',
    icon: '%',
    name: 'Pot Odds',
    description: 'Calculate the required equity to profitably call a bet. Core math every poker player must know.',
    scenarioCount: 25,
  },
  {
    type: 'equity_estimation',
    icon: '~',
    name: 'Equity Estimator',
    description: 'Use the Rule of 4 & 2 to quickly estimate your draw equity on the flop and turn.',
    scenarioCount: 20,
  },
  {
    type: 'bet_sizing',
    icon: '$',
    name: 'Bet Sizing',
    description: 'Choose the GTO-optimal bet size based on board texture, position, and range advantage.',
    scenarioCount: 24,
  },
  {
    type: 'opponent_simulation',
    icon: '👤',
    name: 'Opponent Simulator',
    description: 'Play against different player types — NITs, LAGs, Calling Stations, Maniacs. Learn to exploit each.',
    scenarioCount: 30,
  },
  {
    type: 'ev_calculation',
    icon: 'EV',
    name: 'EV Calculator',
    description: 'Calculate expected value from outcomes and probabilities. Make every decision mathematically sound.',
    scenarioCount: 20,
  },
  {
    type: 'range_reading',
    icon: '🔍',
    name: 'Range Reading',
    description: 'Street-by-street, narrow an opponent\'s range. Identify their hand type by the flop — then guess the exact holding by the river.',
    scenarioCount: 8,
  },
];

interface PokerHomeProps {
  pokerProgress: PokerProgress;
  getDrillStats: (drillType: PokerDrillType) => { totalAttempts: number; correctAttempts: number; accuracy: number };
  onSelectDrill: (drillType: PokerDrillType) => void;
  onViewDashboard: () => void;
  onViewProfiles: () => void;
  onViewHandLookup: () => void;
  onViewLiveSession: () => void;
  onBack: () => void;
}

export function PokerHome({
  getDrillStats,
  onSelectDrill,
  onViewProfiles,
  onViewHandLookup,
  onViewLiveSession,
}: PokerHomeProps) {
  return (
    <div className="poker-home">
      <div className="poker-home-header">
        <div>
          <h1>♠ Poker GTO Training</h1>
          <p className="poker-home-subtitle">
            Seven targeted drill modules built on Game Theory Optimal fundamentals.
            Master the math, ranges, and exploitative adjustments that separate winning players.
          </p>
        </div>
      </div>

      <div className="drill-modules-grid">
        {DRILL_MODULES.map((module) => {
          const stats = getDrillStats(module.type);
          const hasStarted = stats.totalAttempts > 0;

          return (
            <button
              key={module.type}
              className="drill-module-card"
              onClick={() => onSelectDrill(module.type)}
            >
              <div className="drill-module-icon">{module.icon}</div>
              <div className="drill-module-name">{module.name}</div>
              <div className="drill-module-desc">{module.description}</div>
              <div className="drill-module-meta">
                <span className="drill-module-difficulty">{module.scenarioCount} scenarios</span>
                {hasStarted && (
                  <span
                    className="drill-module-accuracy"
                    style={{ color: stats.accuracy >= 70 ? 'var(--green)' : stats.accuracy >= 50 ? 'var(--yellow)' : 'var(--red)' }}
                  >
                    {stats.accuracy}%
                  </span>
                )}
              </div>
              {hasStarted && (
                <div className="drill-module-bar">
                  <div
                    className="drill-module-bar-fill"
                    style={{ width: `${stats.accuracy}%`, background: stats.accuracy >= 70 ? 'var(--green)' : stats.accuracy >= 50 ? 'var(--yellow)' : 'var(--red)' }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Tools section: Hand Lookup + Profiles */}
      <button
        className="drill-module-card"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 16, textAlign: 'left', justifyContent: 'flex-start' }}
        onClick={onViewHandLookup}
      >
        <div className="drill-module-icon" style={{ fontSize: '1.6rem', flexShrink: 0 }}>🔎</div>
        <div style={{ flex: 1 }}>
          <div className="drill-module-name">What Should I Do?</div>
          <div className="drill-module-desc">
            Pick your hole cards, position, and table size. Get the GTO recommendation for RFI and compare
            it to any saved profile — with the hand highlighted on the range grid.
          </div>
        </div>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)', flexShrink: 0 }}>→</div>
      </button>
      <button
        className="drill-module-card"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 16, textAlign: 'left', justifyContent: 'flex-start' }}
        onClick={onViewProfiles}
      >
        <div className="drill-module-icon" style={{ fontSize: '1.6rem', flexShrink: 0 }}>📋</div>
        <div style={{ flex: 1 }}>
          <div className="drill-module-name">Player Profiles</div>
          <div className="drill-module-desc">
            Build hand-range profiles for yourself and opponents. 4-color action grid (fold/limp/call/raise),
            per-position ranges, post-flop thresholds. Use them to benchmark decisions against any playing style.
          </div>
        </div>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)', flexShrink: 0 }}>→</div>
      </button>
      <button
        className="drill-module-card"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 16, textAlign: 'left', justifyContent: 'flex-start' }}
        onClick={onViewLiveSession}
      >
        <div className="drill-module-icon" style={{ fontSize: '1.6rem', flexShrink: 0 }}>🎲</div>
        <div style={{ flex: 1 }}>
          <div className="drill-module-name">Live Session Tracker</div>
          <div className="drill-module-desc">
            Track real hands at a real table. Tap the winner of each hand; the button advances
            automatically. Per-session stats: hands played, hands per hour, win % per player, win %
            by position.
          </div>
        </div>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)', flexShrink: 0 }}>→</div>
      </button>

      {/* GTO Info Section */}
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
          About GTO Play
        </div>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 700 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Game Theory Optimal (GTO)</strong> is a mathematically unexploitable strategy based on Nash Equilibrium —
          a balance point where neither player can improve by changing their strategy alone.
          Mastering GTO fundamentals allows you to identify when opponents deviate from optimal play,
          enabling powerful exploitative adjustments.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: '0.8rem' }}>
          {[
            'Pot Odds = Call / (Pot + Call)',
            'Rule of 4: Outs × 4 on flop',
            'Rule of 2: Outs × 2 on turn',
            'EV = Σ(P × outcome)',
          ].map((formula) => (
            <code
              key={formula}
              style={{
                background: 'var(--bg-3)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '4px 10px',
                fontFamily: 'var(--mono)',
                color: 'var(--accent-hover)',
              }}
            >
              {formula}
            </code>
          ))}
        </div>
      </div>
    </div>
  );
}
