import { useCallback, useEffect, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Opening, AppProgress } from '../types';
import type { Square } from 'chess.js';
import { useChallengeMode, STREAK_TARGET } from '../hooks/useChallengeMode';
import { ALL_OPENINGS } from '../data/openings';

interface Props {
  progress: AppProgress;
  onBack: () => void;
}

export function ChallengeBoard({ progress, onBack }: Props) {
  const {
    state,
    currentItem,
    effectiveMoves,
    currentFen,
    currentMoveStep,
    pool,
    startChallenge,
    submitMove,
    dismissMistake,
    advanceToNext,
    resetChallenge,
  } = useChallengeMode(ALL_OPENINGS, progress);

  const currentOpening: Opening | null = currentItem?.opening ?? null;
  const currentLine = currentOpening?.lines[currentItem?.lineIndex ?? 0] ?? null;
  const boardOrientation = currentOpening?.learnerColor === 'black' ? 'black' : 'white';
  const isPlayerTurn = state?.phase === 'playing' && currentMoveStep?.isLearnerMove === true;

  // Click-to-move state
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const playerPrefix = currentOpening?.learnerColor === 'white' ? 'w' : 'b';

  // Clear selection when it's no longer the player's turn
  useEffect(() => {
    if (!isPlayerTurn) setSelectedSquare(null);
  }, [isPlayerTurn]);

  const handlePieceDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square): boolean => {
      if (state?.phase !== 'playing') return false;
      if (!currentMoveStep?.isLearnerMove) return false;
      setSelectedSquare(null);
      return submitMove(sourceSquare, targetSquare);
    },
    [state, currentMoveStep, submitMove],
  );

  const handleSquareClick = useCallback(
    (square: Square, piece: string | undefined) => {
      if (!isPlayerTurn) {
        setSelectedSquare(null);
        return;
      }

      if (selectedSquare === null) {
        if (piece && piece[0] === playerPrefix) {
          setSelectedSquare(square);
        }
      } else if (square === selectedSquare) {
        setSelectedSquare(null);
      } else if (piece && piece[0] === playerPrefix) {
        setSelectedSquare(square);
      } else {
        submitMove(selectedSquare, square);
        setSelectedSquare(null);
      }
    },
    [isPlayerTurn, selectedSquare, playerPrefix, submitMove],
  );

  const selectedSquareStyles = selectedSquare
    ? { [selectedSquare]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' } }
    : {};

  // Count learner moves in the current line for progress display
  const setupCount = currentOpening?.setupMoves.length ?? 0;
  const lineRelIdx = Math.max(0, (state?.moveIndex ?? 0) - setupCount);
  const learnerMovesFound = currentLine?.moves
    .slice(0, lineRelIdx)
    .filter((m) => m.isLearnerMove).length ?? 0;
  const totalLearnerMoves = currentLine?.moves.filter((m) => m.isLearnerMove).length ?? 0;

  // ── Idle screen ───────────────────────────────────────────────────────────
  if (!state) {
    return (
      <div className="challenge-idle">
        <div className="challenge-idle-inner">
          <div className="challenge-idle-icon">⚡</div>
          <h2 className="challenge-idle-title">Challenge Mode</h2>

          {pool.length === 0 ? (
            <>
              <p className="challenge-idle-desc">
                Challenge Mode only uses lines you've already practiced.<br />
                Head to <strong>Openings</strong>, pick a line, and drill it at least once —
                then come back and test yourself here.
              </p>
              <button className="btn-ghost" onClick={onBack}>
                ← Go Practice Some Lines
              </button>
            </>
          ) : (
            <>
              <p className="challenge-idle-desc">
                Play through <strong>5 random lines</strong> from your practiced openings —
                perfectly.<br />
                One mistake resets your streak and you restart that same line.<br />
                Can you go 5 for 5?
              </p>
              <p className="challenge-pool-info">
                {pool.length} line{pool.length !== 1 ? 's' : ''} in your pool
              </p>
              <div className="challenge-streak-preview">
                {Array.from({ length: STREAK_TARGET }).map((_, i) => (
                  <div key={i} className="streak-bubble empty">
                    <span className="streak-num">{i + 1}</span>
                  </div>
                ))}
              </div>
              <button className="btn-primary challenge-start-btn" onClick={startChallenge}>
                Start Challenge →
              </button>
              <button className="btn-ghost" onClick={onBack}>
                ← Back
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Challenge Complete screen ─────────────────────────────────────────────
  if (state.phase === 'complete') {
    return (
      <div className="challenge-complete">
        <div className="challenge-complete-inner">
          <div className="challenge-complete-icon">🏆</div>
          <h2>Perfect Streak!</h2>
          <p className="challenge-complete-sub">
            You completed <strong>5 opening lines</strong> without a single mistake.
          </p>
          <div className="challenge-streak-preview">
            {Array.from({ length: STREAK_TARGET }).map((_, i) => (
              <div key={i} className="streak-bubble done">✓</div>
            ))}
          </div>
          <div className="challenge-complete-actions">
            <button
              className="btn-primary"
              onClick={() => {
                resetChallenge();
                startChallenge();
              }}
            >
              Play Again ⚡
            </button>
            <button className="btn-ghost" onClick={onBack}>
              ← Back to Chess
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main playing view ─────────────────────────────────────────────────────
  return (
    <div className="challenge-view">
      {/* Top bar */}
      <div className="challenge-topbar">
        <button
          className="back-btn"
          onClick={() => { resetChallenge(); onBack(); }}
        >
          ← Back
        </button>

        <div className="challenge-streak-bar">
          {Array.from({ length: STREAK_TARGET }).map((_, i) => (
            <div
              key={i}
              className={`streak-bubble ${
                i < state.streak ? 'done' : i === state.streak ? 'current' : 'empty'
              }`}
              title={`Opening ${i + 1} of ${STREAK_TARGET}`}
            >
              {i < state.streak ? '✓' : <span className="streak-num">{i + 1}</span>}
            </div>
          ))}
          <span className="streak-label">
            {state.streak}/{STREAK_TARGET} streak
          </span>
        </div>

        <div className="challenge-opening-badge">
          {currentOpening && (
            <>
              <span className="challenge-opening-name">{currentOpening.name}</span>
              {currentLine && (
                <span className="challenge-line-name"> / {currentLine.name}</span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="challenge-content">
        {/* Board column */}
        <div className="board-column">
          {/* Move pips for the line (not setup moves) */}
          <div className="move-progress">
            {currentLine?.moves.map((move, i) => {
              const effIdx = setupCount + i;
              const pipState =
                effIdx < state.moveIndex ? 'done'
                : effIdx === state.moveIndex ? 'current'
                : 'pending';
              return (
                <div
                  key={i}
                  className={`move-pip ${pipState} ${move.isLearnerMove ? 'learner' : 'opponent'}`}
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
              onSquareClick={handleSquareClick}
              arePiecesDraggable={isPlayerTurn}
              customSquareStyles={selectedSquareStyles}
              customBoardStyle={{
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
              customDarkSquareStyle={{ backgroundColor: '#769656' }}
              customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
            />
          </div>

          <div className="board-label">
            {currentOpening?.learnerColor === 'white' ? '♔ You play White' : '♚ You play Black'}
          </div>

          <div className="board-controls">
            <span className="move-counter">
              {learnerMovesFound}/{totalLearnerMoves} moves found
            </span>
          </div>
        </div>

        {/* Info / feedback column */}
        <div className="explanation-column">

          {/* Mistake overlay */}
          {state.phase === 'mistake' && (
            <div className="challenge-feedback-panel mistake-panel">
              <div className="feedback-icon-large">✗</div>
              <h3 className="mistake-title">Wrong Move!</h3>
              <div className="mistake-moves">
                <div className="mistake-row">
                  <span className="mistake-label">You played:</span>
                  <span className="mistake-wrong">{state.wrongGuessSan}</span>
                </div>
                <div className="mistake-row">
                  <span className="mistake-label">Correct was:</span>
                  <span className="mistake-correct">{state.correctMoveSan}</span>
                </div>
              </div>
              {state.correctMoveExplanation && (
                <p className="mistake-explanation">{state.correctMoveExplanation}</p>
              )}
              <div className="mistake-streak-reset">
                <span className="streak-reset-icon">↺</span>
                Streak reset — this opening restarts as #1 of a new set
              </div>
              <button className="btn-primary" onClick={dismissMistake}>
                Try Again →
              </button>
            </div>
          )}

          {/* Line complete overlay */}
          {state.phase === 'line_done' && (
            <div className="challenge-feedback-panel line-done-panel">
              <div className="feedback-icon-large">✓</div>
              <h3 className="line-done-title">Perfect!</h3>
              <p className="line-done-sub">{currentLine?.name} completed without a mistake.</p>
              <div className="line-done-streak">
                <span className="streak-count">{state.streak}</span>
                <span className="streak-of">/ {STREAK_TARGET}</span>
              </div>
              <div className="challenge-streak-bar centered">
                {Array.from({ length: STREAK_TARGET }).map((_, i) => (
                  <div
                    key={i}
                    className={`streak-bubble ${i < state.streak ? 'done' : 'empty'}`}
                  >
                    {i < state.streak ? '✓' : <span className="streak-num">{i + 1}</span>}
                  </div>
                ))}
              </div>
              <button className="btn-primary" onClick={advanceToNext}>
                Next Opening →
              </button>
            </div>
          )}

          {/* Playing panel */}
          {state.phase === 'playing' && (
            <div className="challenge-playing-panel">
              {/* Last played pair */}
              {state.lastPair && (
                <>
                  <div className="panel-section correct-section">
                    <div className="feedback-header correct">
                      <span className="feedback-icon">✓</span>
                      <span className="feedback-move">{state.lastPair.learnerMove.san}</span>
                    </div>
                    <p className="move-explanation">{state.lastPair.learnerMove.explanation}</p>
                    {state.lastPair.learnerMove.strategicNote && (
                      <div className="strategic-note">
                        <span className="note-label">💡 Strategic Idea</span>
                        <p>{state.lastPair.learnerMove.strategicNote}</p>
                      </div>
                    )}
                  </div>
                  {state.lastPair.opponentMove && (
                    <div className="panel-section opponent-section">
                      <div className="opponent-header">
                        <span className="opp-label">Opponent responds:</span>
                        <span className="opp-move">{state.lastPair.opponentMove.san}</span>
                      </div>
                      <p className="move-explanation">{state.lastPair.opponentMove.explanation}</p>
                    </div>
                  )}
                </>
              )}

              <div className="panel-section prompt-section">
                <div className="prompt-text">
                  <span className="prompt-icon">🤔</span>
                  <strong>What's the best move?</strong>
                </div>
                <p className="prompt-hint">Drag or tap a piece to move it — no mistakes allowed!</p>
              </div>

              {/* Move list */}
              {currentLine && (() => {
                type Cell = { san: string; effIdx: number; isLearner: boolean };
                const pairs: { num: number; white: Cell | null; black: Cell | null }[] = [];
                effectiveMoves.forEach((move, i) => {
                  const num = Math.floor(i / 2) + 1;
                  const isBlack = i % 2 === 1;
                  const cell: Cell = { san: move.san, effIdx: i, isLearner: move.isLearnerMove };
                  if (!isBlack) {
                    pairs.push({ num, white: cell, black: null });
                  } else {
                    const last = pairs[pairs.length - 1];
                    if (last && last.black === null) last.black = cell;
                    else pairs.push({ num, white: null, black: cell });
                  }
                });

                const cs = (idx: number) =>
                  idx < state.moveIndex ? 'played' : idx === state.moveIndex ? 'active' : 'future';

                return (
                  <div className="line-moves-review">
                    <h4>Line Moves</h4>
                    <div className="moves-list">
                      {pairs.map(({ num, white, black }) => (
                        <div key={num} className="move-pair-row">
                          <span className="move-pair-num">{num}.</span>
                          <div className={`move-pair-cell ${white ? `${cs(white.effIdx)} ${white.isLearner ? 'learner-move' : 'opponent-move'}` : 'ellipsis-cell'}`}>
                            {white
                              ? <><span className="move-cell-indicator">{white.isLearner ? '▶' : '○'}</span><span className="move-san">{white.san}</span></>
                              : <span className="move-ellipsis">…</span>}
                          </div>
                          <div className={`move-pair-cell ${black ? `${cs(black.effIdx)} ${black.isLearner ? 'learner-move' : 'opponent-move'}` : ''}`}>
                            {black && <><span className="move-cell-indicator">{black.isLearner ? '▶' : '○'}</span><span className="move-san">{black.san}</span></>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
