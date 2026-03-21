import type { Opening, AppProgress } from '../types';
import { QualityBadge } from './QualityBadge';

interface Props {
  opening: Opening;
  progress: AppProgress;
  onSelectLine: (lineIndex: number) => void;
  onBack: () => void;
}

export function LineSelector({ opening, progress, onSelectLine, onBack }: Props) {
  return (
    <div className="line-selector">
      <div className="line-selector-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <div>
          <h2>{opening.name}</h2>
          <span className="eco-badge">{opening.eco}</span>
          <span
            className="color-badge"
            style={{
              background: opening.learnerColor === 'white' ? '#f0d9b5' : '#2c2c2c',
              color: opening.learnerColor === 'white' ? '#2c2c2c' : '#f0d9b5',
            }}
          >
            {opening.learnerColor === 'white' ? '♔ White' : '♚ Black'}
          </span>
        </div>
      </div>

      <p className="opening-full-desc">{opening.description}</p>

      <h3 className="lines-heading">
        All Lines — Best to Worst Opponent Play
      </h3>
      <p className="lines-subheading">
        Lines are ordered from the strongest opponent moves (top) down to the
        most common amateur mistakes (bottom). Practice them all!
      </p>

      <div className="lines-list">
        {opening.lines.map((line, idx) => {
          const lp = progress.lines[line.id];
          const rate =
            lp && lp.attempts > 0
              ? Math.round((lp.correctOnFirst / lp.attempts) * 100)
              : null;

          return (
            <button
              key={line.id}
              className={`line-card ${lp?.mastered ? 'mastered' : ''}`}
              onClick={() => onSelectLine(idx)}
            >
              <div className="line-card-top">
                <div className="line-card-name">
                  <span className="line-number">{idx + 1}.</span>
                  {line.name}
                  {lp?.mastered && <span className="mastered-badge">✓ Mastered</span>}
                </div>
                <div className="line-card-meta">
                  <QualityBadge quality={line.opponentQuality} />
                  <span className="frequency">{line.frequencyPercent}% freq.</span>
                </div>
              </div>

              <p className="line-summary">{line.summary}</p>

              <div className="line-card-footer">
                <span className="theme-label">📌 {line.strategicTheme}</span>
                <span className="move-count">{line.moves.length} moves</span>
                {rate !== null && (
                  <span
                    className="accuracy-badge"
                    style={{ color: rate >= 80 ? '#00c853' : rate >= 50 ? '#ffd600' : '#ff6d00' }}
                  >
                    {rate}% accuracy ({lp!.attempts} tries)
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="practice-all-row">
        <button className="btn-primary" onClick={() => onSelectLine(0)}>
          Practice All Lines (Best → Worst)
        </button>
      </div>
    </div>
  );
}
