interface SessionCompleteProps {
  correctCount: number;
  totalCount: number;
  onRestart: () => void;
  onBack: () => void;
  drillName: string;
}

export function SessionComplete({ correctCount, totalCount, onRestart, onBack, drillName }: SessionCompleteProps) {
  const pct = Math.round((correctCount / totalCount) * 100);
  const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '📚';
  const message = pct >= 80 ? 'Excellent work!' : pct >= 60 ? 'Good progress!' : 'Keep practicing!';

  return (
    <div className="session-complete">
      <div className="session-complete-icon">{emoji}</div>
      <h2>{message}</h2>
      <div className="session-score-display">
        <div className="session-score-number" style={{ color: pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--yellow)' : 'var(--red)' }}>
          {correctCount}/{totalCount}
        </div>
        <div className="session-score-pct" style={{ color: pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--yellow)' : 'var(--red)' }}>
          {pct}%
        </div>
        <div className="session-score-label">correct — {drillName}</div>
      </div>
      <div className="session-complete-actions">
        <button className="btn-primary" onClick={onRestart}>Practice Again</button>
        <button className="btn-secondary" onClick={onBack}>Back to Drills</button>
      </div>
    </div>
  );
}
