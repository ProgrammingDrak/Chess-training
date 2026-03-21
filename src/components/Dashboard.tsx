import type { AppProgress } from '../types';
import { ALL_OPENINGS } from '../data/openings';

interface Props {
  progress: AppProgress;
  onReset: () => void;
  onBack: () => void;
}

export function Dashboard({ progress, onReset, onBack }: Props) {
  const totalLines = ALL_OPENINGS.reduce((sum, o) => sum + o.lines.length, 0);
  const allAttempted = Object.values(progress.lines).filter((l) => l.attempts > 0).length;
  const allMastered = Object.values(progress.lines).filter((l) => l.mastered).length;
  const overallPct = totalLines > 0 ? Math.round((allMastered / totalLines) * 100) : 0;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h2>Progress Dashboard</h2>
      </div>

      <div className="dashboard-overview">
        <div className="stat-card">
          <div className="stat-number">{allAttempted}</div>
          <div className="stat-label">Lines Attempted</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{allMastered}</div>
          <div className="stat-label">Lines Mastered</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{overallPct}%</div>
          <div className="stat-label">Overall Progress</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{totalLines}</div>
          <div className="stat-label">Total Lines</div>
        </div>
      </div>

      <div className="dashboard-openings">
        {ALL_OPENINGS.map((opening) => {
          const lineEntries = Object.values(progress.lines).filter(
            (l) => l.openingId === opening.id,
          );
          const mastered = lineEntries.filter((l) => l.mastered).length;
          const attempted = lineEntries.filter((l) => l.attempts > 0).length;
          const total = opening.lines.length;
          const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;

          return (
            <div key={opening.id} className="opening-progress-card">
              <div className="opc-header">
                <span className="opc-name">{opening.name}</span>
                <span className="opc-eco">{opening.eco}</span>
                <span className="opc-pct">{pct}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="opc-stats">
                <span>{mastered}/{total} mastered</span>
                <span>{attempted} attempted</span>
              </div>

              <div className="opc-lines">
                {opening.lines.map((line) => {
                  const lp = progress.lines[line.id];
                  const lineRate =
                    lp && lp.attempts > 0
                      ? Math.round((lp.correctOnFirst / lp.attempts) * 100)
                      : null;
                  return (
                    <div key={line.id} className="opc-line-row">
                      <span className="opc-line-name">{line.name}</span>
                      {lp?.mastered ? (
                        <span className="opc-mastered">✓</span>
                      ) : lineRate !== null ? (
                        <span
                          className="opc-rate"
                          style={{
                            color:
                              lineRate >= 80
                                ? '#00c853'
                                : lineRate >= 50
                                ? '#ffd600'
                                : '#ff6d00',
                          }}
                        >
                          {lineRate}%
                        </span>
                      ) : (
                        <span className="opc-untried">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="dashboard-actions">
        <button
          className="btn-danger"
          onClick={() => {
            if (window.confirm('Reset all progress? This cannot be undone.')) {
              onReset();
            }
          }}
        >
          Reset All Progress
        </button>
      </div>
    </div>
  );
}
