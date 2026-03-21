import { useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Opening, AppProgress } from '../types';
import { usePractice } from '../hooks/usePractice';
import { MoveExplanation } from './MoveExplanation';
import { QualityBadge } from './QualityBadge';
import type { Square } from 'chess.js';

interface Props {
  opening: Opening;
  startLineIndex: number;
  progress: AppProgress;
  onRecordAttempt: (openingId: string, lineId: string, firstTry: boolean) => void;
  onBack: () => void;
}

export function PracticeBoard({
  opening,
  startLineIndex,
  progress,
  onRecordAttempt,
  onBack,
}: Props) {
  const {
    session,
    currentLine,
    currentMoveStep,
    currentFen,
    currentPhase,
    startLine,
    submitMove,
    advance,
    nextLine,
    restartLine,
    resetSession,
    startPlayingFromIntro,
  } = usePractice(opening);

  // Start the line if not started yet
  if (!session) {
    startLine(startLineIndex);
    return null;
  }

  const boardOrientation = opening.learnerColor === 'white' ? 'white' : 'black';
  const isPlayerTurn =
    currentPhase === 'playing' && currentMoveStep?.isLearnerMove === true;

  const handlePieceDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square): boolean => {
      if (!isPlayerTurn) return false;
      const san = `${sourceSquare}${targetSquare}`;
      // Try the move — also try with promotion to queen
      const result = submitMove(san) || submitMove(san + 'q');
      return result;
    },
    [isPlayerTurn, submitMove],
  );

  const handleRecordAndNext = useCallback(() => {
    nextLine((lineId, firstTry) => {
      onRecordAttempt(opening.id, lineId, firstTry);
    });
  }, [nextLine, onRecordAttempt, opening.id]);

  const lineProgress = currentLine
    ? progress.lines[currentLine.id]
    : null;

  const totalLearnerMoves = currentLine
    ? currentLine.moves.filter((m) => m.isLearnerMove).length
    : 0;
  const foundSoFar = session
    ? currentLine?.moves
        .slice(0, session.moveIndex)
        .filter((m) => m.isLearnerMove).length ?? 0
    : 0;

  return (
    <div className="practice-view">
      {/* Top bar */}
      <div className="practice-topbar">
        <button
          className="back-btn"
          onClick={() => {
            resetSession();
            onBack();
          }}
        >
          ← Back to Lines
        </button>
        <div className="practice-title">
          <span className="opening-name">{opening.name}</span>
          {currentLine && (
            <>
              <span className="divider">/</span>
              <span className="line-name">{currentLine.name}</span>
              <QualityBadge quality={currentLine.opponentQuality} size="sm" />
            </>
          )}
        </div>
        <div className="practice-stats">
          {lineProgress && lineProgress.attempts > 0 && (
            <span className="accuracy-chip">
              {Math.round(
                (lineProgress.correctOnFirst / lineProgress.attempts) * 100,
              )}
              % accuracy
            </span>
          )}
        </div>
      </div>

      <div className="practice-content">
        {/* Board column */}
        <div className="board-column">
          {/* Move progress indicator */}
          <div className="move-progress">
            {currentLine?.moves.map((move, i) => (
              <div
                key={i}
                className={`move-pip ${
                  i < (session.moveIndex) ? 'done' : i === session.moveIndex ? 'current' : 'pending'
                } ${move.isLearnerMove ? 'learner' : 'opponent'}`}
                title={`${move.isLearnerMove ? 'You' : 'Opponent'}: ${move.san}`}
              />
            ))}
          </div>

          <div className="board-wrapper">
            <Chessboard
              position={currentFen}
              boardOrientation={boardOrientation}
              onPieceDrop={handlePieceDrop}
              arePiecesDraggable={isPlayerTurn}
              customBoardStyle={{
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
              customDarkSquareStyle={{ backgroundColor: '#769656' }}
              customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
            />
          </div>

          <div className="board-label">
            {opening.learnerColor === 'white'
              ? '♔ You play White'
              : '♚ You play Black'}
          </div>

          {/* Line nav controls */}
          <div className="board-controls">
            <button className="btn-ghost" onClick={restartLine}>
              ↺ Restart Line
            </button>
            <span className="move-counter">
              {foundSoFar}/{totalLearnerMoves} moves found
            </span>
          </div>
        </div>

        {/* Explanation column */}
        <div className="explanation-column">
          {(currentPhase === 'intro') && currentLine && (
            <div className="intro-wrapper">
              <MoveExplanation
                line={currentLine}
                moveStep={currentMoveStep}
                phase={currentPhase}
                wrongGuess={session.wrongGuess}
                moveIndex={session.moveIndex}
                onAdvance={advance}
              />
              <button className="btn-primary start-btn" onClick={startPlayingFromIntro}>
                Start Practicing →
              </button>
            </div>
          )}

          {(currentPhase === 'playing' ||
            currentPhase === 'correct' ||
            currentPhase === 'incorrect') &&
            currentLine && (
              <MoveExplanation
                line={currentLine}
                moveStep={currentMoveStep}
                phase={currentPhase}
                wrongGuess={session.wrongGuess}
                moveIndex={session.moveIndex}
                onAdvance={advance}
              />
            )}

          {(currentPhase === 'line_complete' || currentPhase === 'session_complete') &&
            currentLine && (
              <div className="complete-panel">
                <MoveExplanation
                  line={currentLine}
                  moveStep={currentMoveStep}
                  phase={currentPhase}
                  wrongGuess={session.wrongGuess}
                  moveIndex={session.moveIndex}
                  onAdvance={advance}
                />

                {currentPhase === 'line_complete' && (
                  <div className="complete-actions">
                    <button className="btn-ghost" onClick={restartLine}>
                      ↺ Practice Again
                    </button>
                    <button
                      className="btn-primary"
                      onClick={handleRecordAndNext}
                    >
                      Next Line →
                    </button>
                  </div>
                )}

                {currentPhase === 'session_complete' && (
                  <div className="complete-actions">
                    <p className="session-done">
                      🏆 You've practiced all {opening.lines.length} lines!
                    </p>
                    <button
                      className="btn-ghost"
                      onClick={() => startLine(0)}
                    >
                      ↺ Start Over
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        resetSession();
                        onBack();
                      }}
                    >
                      ← Back to Lines
                    </button>
                  </div>
                )}
              </div>
            )}

          {/* All moves in the line — review panel */}
          {currentLine && (
            <div className="line-moves-review">
              <h4>Line Moves</h4>
              <div className="moves-list">
                {currentLine.moves.map((move, i) => (
                  <div
                    key={i}
                    className={`move-row ${move.isLearnerMove ? 'learner-move' : 'opponent-move'} ${
                      i < session.moveIndex ? 'played' : i === session.moveIndex ? 'active' : 'future'
                    }`}
                  >
                    <span className="move-turn">
                      {move.isLearnerMove ? '▶ You' : '○ Opp'}
                    </span>
                    <span className="move-san">{move.san}</span>
                    <QualityBadge quality={move.quality} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
