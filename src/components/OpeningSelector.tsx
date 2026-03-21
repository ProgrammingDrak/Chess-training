import type { Opening } from '../types';
import { ALL_OPENINGS } from '../data/openings';
import { QualityBadge } from './QualityBadge';
import type { AppProgress } from '../types';

interface Props {
  progress: AppProgress;
  onSelect: (opening: Opening) => void;
}

export function OpeningSelector({ progress, onSelect }: Props) {
  return (
    <div className="opening-selector">
      <div className="selector-header">
        <h1>Chess Opening Trainer</h1>
        <p className="subtitle">
          Practice every possible response — from grandmaster moves to amateur
          blunders — with explanations for each.
        </p>
      </div>

      <div className="openings-grid">
        {ALL_OPENINGS.map((opening) => {
          const lineEntries = Object.values(progress.lines).filter(
            (l) => l.openingId === opening.id,
          );
          const mastered = lineEntries.filter((l) => l.mastered).length;
          const attempted = lineEntries.filter((l) => l.attempts > 0).length;
          const total = opening.lines.length;
          const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;

          return (
            <button
              key={opening.id}
              className="opening-card"
              onClick={() => onSelect(opening)}
            >
              <div className="opening-card-top">
                <div>
                  <div className="opening-card-name">{opening.name}</div>
                  <div className="opening-card-eco">{opening.eco}</div>
                </div>
                <div
                  className="opening-card-color"
                  style={{
                    background: opening.learnerColor === 'white' ? '#f0d9b5' : '#2c2c2c',
                    color: opening.learnerColor === 'white' ? '#2c2c2c' : '#f0d9b5',
                  }}
                >
                  Play as {opening.learnerColor === 'white' ? '♔ White' : '♚ Black'}
                </div>
              </div>

              <p className="opening-card-desc">{opening.description}</p>

              <div className="opening-card-tags">
                {opening.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>

              <div className="opening-card-lines">
                <span className="lines-count">{total} lines</span>
                <span className="lines-range">
                  {opening.lines[0] && (
                    <>
                      <QualityBadge quality={opening.lines[0].opponentQuality} size="sm" />
                      {' → '}
                      <QualityBadge
                        quality={opening.lines[opening.lines.length - 1].opponentQuality}
                        size="sm"
                      />
                    </>
                  )}
                </span>
              </div>

              {attempted > 0 && (
                <div className="opening-card-progress">
                  <div className="progress-bar-track">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="progress-label">
                    {mastered}/{total} mastered
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
