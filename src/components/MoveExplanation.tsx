import type { MoveStep, OpeningLine, PracticePhase } from '../types';
import type { PlayedPair } from '../hooks/usePractice';
import { QualityBadge } from './QualityBadge';

interface Props {
  line: OpeningLine;
  phase: PracticePhase;
  wrongGuess: string | null;
  /** The target move when the player guessed wrong */
  incorrectMoveStep: MoveStep | null;
  /** The last learner move + opponent response, shown together above "your turn" */
  lastPlayedPair: PlayedPair | null;
  learnerMovesFound: number;
  totalLearnerMoves: number;
  onAdvance: () => void;
}

export function MoveExplanation({
  line,
  phase,
  wrongGuess,
  incorrectMoveStep,
  lastPlayedPair,
  learnerMovesFound,
  totalLearnerMoves,
  onAdvance,
}: Props) {
  if (phase === 'intro') {
    const learnerMoves = line.moves.filter((m) => m.isLearnerMove);
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
            You found {totalLearnerMoves} move{totalLearnerMoves !== 1 ? 's' : ''} correctly.
          </p>
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
            <span className="feedback-move">{incorrectMoveStep?.san}</span>
            {incorrectMoveStep && <QualityBadge quality={incorrectMoveStep.quality} />}
          </div>
          <p className="incorrect-label">The correct move was:</p>
          <p className="move-explanation">{incorrectMoveStep?.explanation}</p>
          {incorrectMoveStep?.strategicNote && (
            <div className="strategic-note">
              <span className="note-label">💡 Strategic Idea</span>
              <p>{incorrectMoveStep.strategicNote}</p>
            </div>
          )}
          <button className="btn-secondary advance-btn" onClick={onAdvance}>
            Got it — Try Again →
          </button>
        </div>
      </div>
    );
  }

  // playing phase
  return (
    <div className="explanation-panel">
      {lastPlayedPair && (
        <>
          {/* Learner's last move */}
          <div className="panel-section correct-section">
            <div className="feedback-header correct">
              <span className="feedback-icon">✓</span>
              <span className="feedback-move">{lastPlayedPair.learnerMove.san}</span>
              <QualityBadge quality={lastPlayedPair.learnerMove.quality} />
            </div>
            <p className="move-explanation">{lastPlayedPair.learnerMove.explanation}</p>
            {lastPlayedPair.learnerMove.strategicNote && (
              <div className="strategic-note">
                <span className="note-label">💡 Strategic Idea</span>
                <p>{lastPlayedPair.learnerMove.strategicNote}</p>
              </div>
            )}
          </div>

          {/* Opponent's response */}
          {lastPlayedPair.opponentMove && (
            <div className="panel-section opponent-section">
              <div className="opponent-header">
                <span className="opp-label">Opponent responds:</span>
                <span className="opp-move">{lastPlayedPair.opponentMove.san}</span>
                <QualityBadge quality={lastPlayedPair.opponentMove.quality} size="sm" />
              </div>
              <p className="move-explanation">{lastPlayedPair.opponentMove.explanation}</p>
              {lastPlayedPair.opponentMove.strategicNote && (
                <div className="strategic-note">
                  <span className="note-label">💡 Strategic Idea</span>
                  <p>{lastPlayedPair.opponentMove.strategicNote}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="panel-section prompt-section">
        <div className="prompt-text">
          <span className="prompt-icon">🤔</span>
          <strong>Your turn — what's the best move?</strong>
        </div>
        <p className="prompt-hint">Drag or tap a piece to make your move.</p>
        <div className="progress-moves">
          Move {learnerMovesFound + 1} of {totalLearnerMoves}
        </div>
      </div>
    </div>
  );
}
