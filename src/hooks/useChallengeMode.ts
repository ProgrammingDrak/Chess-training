import { useState, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import type { Opening, MoveStep, MoveQuality, AppProgress } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ChallengeItem {
  opening: Opening;
  lineIndex: number;
}

export type ChallengePhase = 'idle' | 'playing' | 'mistake' | 'line_done' | 'complete';

export interface ChallengeLastPair {
  learnerMove: MoveStep;
  opponentMove: MoveStep | null;
}

interface ChallengeState {
  queue: ChallengeItem[];
  queueIndex: number;          // 0 – (STREAK_TARGET-1)
  streak: number;              // completed lines without a mistake
  moveHistory: string[];       // moves played in current attempt (for FEN)
  moveIndex: number;           // position in effectiveMoves
  phase: ChallengePhase;
  wrongGuessSan: string | null;
  correctMoveSan: string | null;
  correctMoveExplanation: string | null;
  lastPair: ChallengeLastPair | null;
}

export const STREAK_TARGET = 5;

// ── Helpers ────────────────────────────────────────────────────────────────

function buildFenHistory(moves: string[]): string {
  const chess = new Chess();
  for (const move of moves) {
    try { chess.move(move); } catch { break; }
  }
  return chess.fen();
}

function buildEffectiveMoves(opening: Opening, lineIndex: number): MoveStep[] {
  const line = opening.lines[lineIndex];
  if (!line) return [];
  const setupSteps: MoveStep[] = opening.setupMoves.map((san, i) => {
    const isWhiteMove = i % 2 === 0;
    const isLearnerMove = opening.learnerColor === 'white' ? isWhiteMove : !isWhiteMove;
    return {
      san,
      isLearnerMove,
      quality: 'best' as MoveQuality,
      explanation: `Opening move: ${san}`,
    };
  });
  return [...setupSteps, ...line.moves];
}

/** Advance past all consecutive opponent (non-learner) moves from the given position. */
function skipOpponentMoves(
  moveIndex: number,
  moveHistory: string[],
  effectiveMoves: MoveStep[],
): { moveIndex: number; moveHistory: string[]; done: boolean } {
  let mi = moveIndex;
  let mh = [...moveHistory];
  while (mi < effectiveMoves.length && !effectiveMoves[mi].isLearnerMove) {
    mh = [...mh, effectiveMoves[mi].san];
    mi++;
  }
  return { moveIndex: mi, moveHistory: mh, done: mi >= effectiveMoves.length };
}

/**
 * Pick `count` items with replacement from `pool`.
 * If `pinFirst` is supplied it goes at index 0; the remaining slots
 * are filled by sampling pool with replacement (repeats allowed).
 */
function pickQueue(
  pool: ChallengeItem[],
  count: number,
  pinFirst?: ChallengeItem,
): ChallengeItem[] {
  if (pool.length === 0) return [];
  const rest: ChallengeItem[] = [];
  const slots = pinFirst ? count - 1 : count;
  for (let i = 0; i < slots; i++) {
    rest.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return pinFirst ? [pinFirst, ...rest] : rest;
}

/** Build the pool of practiced lines from allOpenings filtered by progress. */
function buildPool(allOpenings: Opening[], progress: AppProgress): ChallengeItem[] {
  const practiced: ChallengeItem[] = [];
  for (const opening of allOpenings) {
    for (let lineIndex = 0; lineIndex < opening.lines.length; lineIndex++) {
      const lineId = opening.lines[lineIndex].id;
      if ((progress.lines[lineId]?.attempts ?? 0) > 0) {
        practiced.push({ opening, lineIndex });
      }
    }
  }
  return practiced;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useChallengeMode(allOpenings: Opening[], progress: AppProgress) {
  const [state, setState] = useState<ChallengeState | null>(null);

  // Rebuild pool whenever progress changes (new lines practiced)
  const pool = useMemo(
    () => buildPool(allOpenings, progress),
    [allOpenings, progress],
  );

  const currentItem: ChallengeItem | null = state
    ? state.queue[state.queueIndex] ?? null
    : null;

  const effectiveMoves = useMemo((): MoveStep[] => {
    if (!currentItem) return [];
    return buildEffectiveMoves(currentItem.opening, currentItem.lineIndex);
  }, [currentItem]);

  const currentFen = useMemo((): string => {
    if (!state) return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    return buildFenHistory(state.moveHistory);
  }, [state]);

  const currentMoveStep = useMemo((): MoveStep | null => {
    if (!state) return null;
    return effectiveMoves[state.moveIndex] ?? null;
  }, [state, effectiveMoves]);

  // ── Actions ──

  const startChallenge = useCallback(() => {
    if (pool.length === 0) return;
    const queue = pickQueue(pool, STREAK_TARGET);
    const firstEff = buildEffectiveMoves(queue[0].opening, queue[0].lineIndex);
    const { moveIndex, moveHistory } = skipOpponentMoves(0, [], firstEff);
    setState({
      queue,
      queueIndex: 0,
      streak: 0,
      moveHistory,
      moveIndex,
      phase: 'playing',
      wrongGuessSan: null,
      correctMoveSan: null,
      correctMoveExplanation: null,
      lastPair: null,
    });
  }, [pool]);

  const submitMove = useCallback(
    (from: string, to: string): boolean => {
      if (!state || state.phase !== 'playing') return false;
      if (!currentMoveStep?.isLearnerMove) return false;

      const chess = new Chess();
      for (const san of state.moveHistory) chess.move(san);

      let actualSan: string;
      try {
        const result = chess.move({ from, to, promotion: 'q' });
        actualSan = result.san;
      } catch {
        // Illegal move — treat as wrong
        const wrongItem = state.queue[state.queueIndex];
        const nextEff = buildEffectiveMoves(wrongItem.opening, wrongItem.lineIndex);
        const { moveIndex, moveHistory } = skipOpponentMoves(0, [], nextEff);
        setState({
          queue: pickQueue(pool, STREAK_TARGET, wrongItem),
          queueIndex: 0,
          streak: 0,
          moveHistory,
          moveIndex,
          phase: 'mistake',
          wrongGuessSan: 'Illegal move',
          correctMoveSan: currentMoveStep.san,
          correctMoveExplanation: currentMoveStep.explanation,
          lastPair: null,
        });
        return false;
      }

      const isCorrect = actualSan === currentMoveStep.san;

      if (isCorrect) {
        const learnerMove = currentMoveStep;
        const nextIdx = state.moveIndex + 1;
        const opponentStep = effectiveMoves[nextIdx];
        const opponentMove =
          opponentStep && !opponentStep.isLearnerMove ? opponentStep : null;

        const { moveIndex: mi, moveHistory: mh, done } = skipOpponentMoves(
          nextIdx,
          [...state.moveHistory, currentMoveStep.san],
          effectiveMoves,
        );

        const newPair: ChallengeLastPair = { learnerMove, opponentMove };

        if (done) {
          const newStreak = state.streak + 1;
          setState((s) =>
            s
              ? {
                  ...s,
                  moveHistory: mh,
                  moveIndex: mi,
                  streak: newStreak,
                  phase: newStreak >= STREAK_TARGET ? 'complete' : 'line_done',
                  wrongGuessSan: null,
                  correctMoveSan: null,
                  correctMoveExplanation: null,
                  lastPair: newPair,
                }
              : null,
          );
        } else {
          setState((s) =>
            s
              ? {
                  ...s,
                  moveHistory: mh,
                  moveIndex: mi,
                  wrongGuessSan: null,
                  correctMoveSan: null,
                  correctMoveExplanation: null,
                  lastPair: newPair,
                }
              : null,
          );
        }
        return true;
      } else {
        // Wrong move — streak resets, current item restarts at top of new queue
        const wrongItem = state.queue[state.queueIndex];
        const nextEff = buildEffectiveMoves(wrongItem.opening, wrongItem.lineIndex);
        const { moveIndex, moveHistory } = skipOpponentMoves(0, [], nextEff);
        setState({
          queue: pickQueue(pool, STREAK_TARGET, wrongItem),
          queueIndex: 0,
          streak: 0,
          moveHistory,
          moveIndex,
          phase: 'mistake',
          wrongGuessSan: actualSan,
          correctMoveSan: currentMoveStep.san,
          correctMoveExplanation: currentMoveStep.explanation,
          lastPair: null,
        });
        return false;
      }
    },
    [state, currentMoveStep, effectiveMoves, pool],
  );

  /** Resume playing after acknowledging a mistake (board already reset). */
  const dismissMistake = useCallback(() => {
    setState((s) => (s ? { ...s, phase: 'playing', wrongGuessSan: null, correctMoveSan: null, correctMoveExplanation: null } : null));
  }, []);

  /** Advance to the next opening in the queue after completing a line. */
  const advanceToNext = useCallback(() => {
    if (!state) return;
    const nextQueueIndex = state.queueIndex + 1;
    const nextItem = state.queue[nextQueueIndex];
    if (!nextItem) return;
    const nextEff = buildEffectiveMoves(nextItem.opening, nextItem.lineIndex);
    const { moveIndex, moveHistory } = skipOpponentMoves(0, [], nextEff);
    setState({
      ...state,
      queueIndex: nextQueueIndex,
      moveHistory,
      moveIndex,
      phase: 'playing',
      wrongGuessSan: null,
      correctMoveSan: null,
      correctMoveExplanation: null,
      lastPair: null,
    });
  }, [state]);

  const resetChallenge = useCallback(() => {
    setState(null);
  }, []);

  return {
    state,
    pool,
    currentItem,
    effectiveMoves,
    currentFen,
    currentMoveStep,
    startChallenge,
    submitMove,
    dismissMistake,
    advanceToNext,
    resetChallenge,
    streakTarget: STREAK_TARGET,
  };
}
