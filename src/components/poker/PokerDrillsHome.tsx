import type { PokerDrillType } from '../../types/poker';

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
    icon: 'HC',
    name: 'Hand Selection',
    description: 'Given your position and hole cards, decide: fold, call, or raise. Master GTO preflop ranges.',
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
    description: 'Use the Rule of 4 and 2 to quickly estimate your draw equity on the flop and turn.',
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
    icon: 'OP',
    name: 'Opponent Simulator',
    description: 'Play against different player types: NITs, LAGs, Calling Stations, and Maniacs. Learn to exploit each.',
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
    icon: 'RG',
    name: 'Range Reading',
    description: 'Street by street, narrow an opponent range. Identify their hand type by the flop, then guess the exact holding by the river.',
    scenarioCount: 8,
  },
];

interface PokerDrillsHomeProps {
  getDrillStats: (drillType: PokerDrillType) => { totalAttempts: number; correctAttempts: number; accuracy: number };
  onSelectDrill: (drillType: PokerDrillType) => void;
  onBack: () => void;
}

export function PokerDrillsHome({
  getDrillStats,
  onSelectDrill,
  onBack,
}: PokerDrillsHomeProps) {
  return (
    <div className="poker-home">
      <div className="poker-home-header">
        <button className="back-btn" onClick={onBack}>← Poker GTO</button>
        <div>
          <h1>Drills</h1>
          <p className="poker-home-subtitle">
            Targeted poker training modules for hand selection, pot odds, equity estimation,
            bet sizing, opponent simulation, EV, and range reading.
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
              <div className="drill-module-name">
                {module.name}
              </div>
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
    </div>
  );
}
