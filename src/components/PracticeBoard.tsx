import { useCallback, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Opening, AppProgress, MoveStep } from '../types';
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
    effectiveMoves,
    currentMoveStep,
    currentFen,
    currentPhase,
    lastPlayedPair,
    startLine,
    submitMove,
    advance,
    nextLine,
    restartLine,
    resetSession,
    startPlayingFromIntro,
  } = usePractice(opening);

  // Start the line on mount
  useEffect(() => {
    startLine(startLineIndex);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startLineIndex]);

  const isPlayerTurn =
    currentPhase === 'playing' && currentMoveStep?.isLearnerMove === true;

  const handlePieceDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square): boolean => {
      if (!isPlayerTurn) return false;
      return submitMove(sourceSquare, targetSquare);
    },
    [isPlayerTurn, submitMove],
  );

  const handleRecordAndNext = useCallback(() => {
    nextLine((lineId, firstTry) => {
      onRecordAttempt(opening.id, lineId, firstTry);
    });
  }, [nextLine, onRecordAttempt, opening.id]);

  if (!session) return null;

  const boardOrientation = opening.learnerColor === 'white' ? 'white' : 'black';

  const lineProgress = currentLine
    ? progress.lines[currentLine.id]
    : null;

  // Number of setup moves so we can convert between effectiveMoves index and line.moves index
  const setupCount = opening.setupMoves.length;

  // How many of the learner's moves in the current line have been completed
  const lineRelativeIndex = Math.max(0, session.moveIndex - setupCount);
  const learnerMovesFound = currentLine
    ? currentLine.moves.slice(0, lineRelativeIndex).filter((m) => m.isLearnerMove).length
    : 0;
  const totalLearnerMoves = currentLine
    ? currentLine.moves.filter((m) => m.isLearnerMove).length
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
          {/* Move progress indicator — one pip per move in the line (not setup) */}
          <div className="move-progress">
            {currentLine?.moves.map((move, i) => {
              const effIdx = setupCount + i;
              const state =
                effIdx < session.moveIndex ? 'done'
                : effIdx === session.moveIndex ? 'current'
                : 'pending';
              return (
                <div
                  key={i}
                  className={`move-pip ${state} ${move.isLearnerMove ? 'learner' : 'opponent'}`}
                  title={`${move.isLearnerMove ? 'You' : 'Opponent'}: ${move.san}`}
                />
              );
            })}
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
              {learnerMovesFound}/{totalLearnerMoves} moves found
            </span>
          </div>
        </div>

        {/* Explanation column */}
        <div className="explanation-column">
          {currentPhase === 'intro' && currentLine && (
            <div className="intro-wrapper">
              <MoveExplanation
                line={currentLine}
                phase={currentPhase}
                wrongGuess={null}
                incorrectMoveStep={null}
                lastPlayedPair={null}
                learnerMovesFound={0}
                totalLearnerMoves={totalLearnerMoves}
                onAdvance={advance}
              />
              <button className="btn-primary start-btn" onClick={startPlayingFromIntro}>
                Start Practicing →
              </button>
            </div>
          )}

          {(currentPhase === 'playing' || currentPhase === 'incorrect') && currentLine && (
            <MoveExplanation
              line={currentLine}
              phase={currentPhase}
              wrongGuess={session.wrongGuess}
              incorrectMoveStep={currentMoveStep}
              lastPlayedPair={lastPlayedPair}
              learnerMovesFound={learnerMovesFound}
              totalLearnerMoves={totalLearnerMoves}
              onAdvance={advance}
            />
          )}

          {(currentPhase === 'line_complete' || currentPhase === 'session_complete') &&
            currentLine && (
              <div className="complete-panel">
                <MoveExplanation
                  line={currentLine}
                  phase={currentPhase}
                  wrongGuess={null}
                  incorrectMoveStep={null}
                  lastPlayedPair={null}
                  learnerMovesFound={learnerMovesFound}
                  totalLearnerMoves={totalLearnerMoves}
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
          {currentLine && (() => {
            // Group moves into White/Black pairs (all moves from starting position)
            type PairCell = { move: MoveStep; idx: number };
            const pairs: { fullMove: number; white: PairCell | null; black: PairCell | null }[] = [];
            effectiveMoves.forEach((move, i) => {
              const fullMoveNum = Math.floor(i / 2) + 1;
              const isBlack = i % 2 === 1;
              if (!isBlack) {
                pairs.push({ fullMove: fullMoveNum, white: { move, idx: i }, black: null });
              } else {
                const last = pairs[pairs.length - 1];
                if (last && last.black === null && last.white !== null) {
                  last.black = { move, idx: i };
                } else {
                  pairs.push({ fullMove: fullMoveNum, white: null, black: { move, idx: i } });
                }
              }
            });

            const cellState = (idx: number) =>
              idx < session.moveIndex ? 'played' : idx === session.moveIndex ? 'active' : 'future';

            return (
              <div className="line-moves-review">
                <h4>Line Moves</h4>
                <div className="moves-list">
                  {pairs.map(({ fullMove, white, black }) => (
                    <div key={fullMove} className="move-pair-row">
                      <span className="move-pair-num">{fullMove}.</span>
                      <div className={`move-pair-cell ${white ? `${cellState(white.idx)} ${white.move.isLearnerMove ? 'learner-move' : 'opponent-move'}` : 'ellipsis-cell'}`}>
                        {white ? (
                          <>
                            <span className="move-cell-indicator">{white.move.isLearnerMove ? '▶' : '○'}</span>
                            <span className="move-san">{white.move.san}</span>
                            <QualityBadge quality={white.move.quality} size="sm" />
                          </>
                        ) : <span className="move-ellipsis">…</span>}
                      </div>
                      <div className={`move-pair-cell ${black ? `${cellState(black.idx)} ${black.move.isLearnerMove ? 'learner-move' : 'opponent-move'}` : ''}`}>
                        {black && (
                          <>
                            <span className="move-cell-indicator">{black.move.isLearnerMove ? '▶' : '○'}</span>
                            <span className="move-san">{black.move.san}</span>
                            <QualityBadge quality={black.move.quality} size="sm" />
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
