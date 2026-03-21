import type { MoveStep, OpeningLine, PracticePhase } from '../types';
import { QualityBadge } from './QualityBadge';

interface Props {
  line: OpeningLine;
  moveStep: MoveStep | null;
  phase: PracticePhase;
  wrongGuess: string | null;
  moveIndex: number;
  onAdvance: () => void;
}

export function MoveExplanation({
  line,
  moveStep,
  phase,
  wrongGuess,
  moveIndex,
  onAdvance,
}: Props) {
  const learnerMoves = line.moves.filter((m) => m.isLearnerMove);
  const currentLearnerIdx = line.moves
    .slice(0, moveIndex)
    .filter((m) => m.isLearnerMove).length;

  if (phase === 'intro') {
    return (
      <div className="explanation-panel">
        <div className="panel-section">
          <div className="line-intro-header">
            <h3>{line.name}</h3>
            <QualityBadge quality={line.opponentQuality} />
          </div>
          <p className="line-intro-summary">{line.summary}</p>
          <div className="line-intro-theme">
            <span className="theme-icon">📌</span>
            <strong>Strategic Theme:</strong> {line.strategicTheme}
          </div>
          <div className="line-intro-freq">
            <span className="freq-icon">📊</span>
            <strong>Frequency:</strong> {line.frequencyPercent}% of games reach this line
          </div>
          <div className="line-intro-moves">
            <strong>Learner moves to find:</strong> {learnerMoves.length}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'line_complete' || phase === 'session_complete') {
    return (
      <div className="explanation-panel">
        <div className="panel-section complete-section">
          <div className="complete-icon">🎉</div>
          <h3>Line Complete!</h3>
          <p>You've finished practicing <strong>{line.name}</strong>.</p>
          <p className="complete-note">
            You found {learnerMoves.length} move{learnerMoves.length !== 1 ? 's' : ''} correctly.
          </p>
        </div>
      </div>
    );
  }

  if (!moveStep) return null;

  if (phase === 'correct') {
    return (
      <div className="explanation-panel">
        <div className="panel-section correct-section">
          <div className="feedback-header correct">
            <span className="feedback-icon">✓</span>
            <span className="feedback-move">{moveStep.san}</span>
            <QualityBadge quality={moveStep.quality} />
          </div>
          <p className="move-explanation">{moveStep.explanation}</p>
          {moveStep.strategicNote && (
            <div className="strategic-note">
              <span className="note-label">💡 Strategic Idea</span>
              <p>{moveStep.strategicNote}</p>
            </div>
          )}
          <div className="progress-moves">
            Move {currentLearnerIdx + 1} of {learnerMoves.length} found
          </div>
          <button className="btn-primary advance-btn" onClick={onAdvance}>
            Continue →
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'incorrect') {
    return (
      <div className="explanation-panel">
        <div className="panel-section incorrect-section">
          <div className="feedback-header incorrect">
            <span className="feedback-icon">✗</span>
            <span className="feedback-wrong">{wrongGuess}</span>
            <span className="feedback-arrow">→</span>
            <span className="feedback-move">{moveStep.san}</span>
            <QualityBadge quality={moveStep.quality} />
          </div>
          <p className="incorrect-label">The correct move was:</p>
          <p className="move-explanation">{moveStep.explanation}</p>
          {moveStep.strategicNote && (
            <div className="strategic-note">
              <span className="note-label">💡 Strategic Idea</span>
              <p>{moveStep.strategicNote}</p>
            </div>
          )}
          <button className="btn-secondary advance-btn" onClick={onAdvance}>
            Got it — Continue →
          </button>
        </div>
      </div>
    );
  }

  // playing phase — show what the opponent just played (last opponent move)
  const lastOpponentMove = line.moves
    .slice(0, moveIndex)
    .reverse()
    .find((m) => !m.isLearnerMove);

  return (
    <div className="explanation-panel">
      {lastOpponentMove && (
        <div className="panel-section opponent-section">
          <div className="opponent-header">
            <span className="opp-label">Opponent played:</span>
            <span className="opp-move">{lastOpponentMove.san}</span>
            <QualityBadge quality={lastOpponentMove.quality} size="sm" />
          </div>
          <p className="move-explanation">{lastOpponentMove.explanation}</p>
        </div>
      )}
      <div className="panel-section prompt-section">
        <div className="prompt-text">
          <span className="prompt-icon">🤔</span>
          <strong>Your turn — what's the best move?</strong>
        </div>
        <p className="prompt-hint">Drag a piece on the board to make your move.</p>
        <div className="progress-moves">
          Move {currentLearnerIdx + 1} of {learnerMoves.length}
        </div>
      </div>
    </div>
  );
}
