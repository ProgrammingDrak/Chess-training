import type { BlackjackProgress, BlackjackDrillType } from '../../types/blackjack';

interface DrillModule {
  type: BlackjackDrillType;
  icon: string;
  name: string;
  description: string;
  scenarioCount: number;
}

const DRILL_MODULES: DrillModule[] = [
  {
    type: 'basic_strategy',
    icon: '🃏',
    name: 'Basic Strategy',
    description: 'Given your hand and the dealer upcard, choose the correct action. Master perfect basic strategy for 6-deck S17 rules.',
    scenarioCount: 40,
  },
  {
    type: 'card_counting',
    icon: '🔢',
    name: 'Card Counting',
    description: 'Track the Hi-Lo running count through a sequence of cards. Build the mental speed needed at a real table.',
    scenarioCount: 20,
  },
  {
    type: 'true_count',
    icon: '÷',
    name: 'True Count',
    description: 'Convert running count to true count by dividing by decks remaining. The true count is what drives your betting decisions.',
    scenarioCount: 20,
  },
  {
    type: 'bet_spread',
    icon: '💰',
    name: 'Bet Spread',
    description: 'Given the true count, what multiple of your base bet should you wager? Learn the 1-8 spread for maximum EV.',
    scenarioCount: 20,
  },
];

interface BlackjackHomeProps {
  bjProgress: BlackjackProgress;
  getDrillStats: (type: BlackjackDrillType) => { totalAttempts: number; correctAttempts: number; accuracy: number };
  onSelectDrill: (type: BlackjackDrillType) => void;
  onViewDashboard: () => void;
  onBack: () => void;
}

export function BlackjackHome({
  getDrillStats,
  onSelectDrill,
}: BlackjackHomeProps) {
  return (
    <div className="bj-home">
      <div className="poker-home-header">
        <div>
          <h1>🃏 Blackjack Training</h1>
          <p className="poker-home-subtitle">
            Four targeted drill modules covering basic strategy, card counting, true count conversion,
            and bet spreading. Master the skills that flip the house edge in your favor.
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
                    style={{
                      color: stats.accuracy >= 70 ? 'var(--green)' : stats.accuracy >= 50 ? 'var(--yellow)' : 'var(--red)',
                    }}
                  >
                    {stats.accuracy}%
                  </span>
                )}
              </div>
              {hasStarted && (
                <div className="drill-module-bar">
                  <div
                    className="drill-module-bar-fill"
                    style={{
                      width: `${stats.accuracy}%`,
                      background: stats.accuracy >= 70 ? 'var(--green)' : stats.accuracy >= 50 ? 'var(--yellow)' : 'var(--red)',
                    }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Basic strategy info box */}
      <div style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
          About Basic Strategy
        </div>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 700 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Perfect basic strategy</strong> reduces the house edge to approximately{' '}
          <strong style={{ color: 'var(--green)' }}>0.5%</strong> in a standard 6-deck S17 game —
          compared to <strong style={{ color: 'var(--red)' }}>2–3%</strong> for average players who guess.
          Combined with Hi-Lo card counting and a proper bet spread, skilled players can achieve a positive expected value of around +0.5% to +1.5%.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: '0.8rem' }}>
          {[
            'House edge with BS: ~0.5%',
            'House edge without BS: ~2–3%',
            'Hi-Lo: 2-6=+1, 7-9=0, 10-A=−1',
            'True Count = Running ÷ Decks',
          ].map((fact) => (
            <code
              key={fact}
              style={{
                background: 'var(--bg-3)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '4px 10px',
                fontFamily: 'var(--mono)',
                color: 'var(--accent-hover)',
              }}
            >
              {fact}
            </code>
          ))}
        </div>
      </div>
    </div>
  );
}
