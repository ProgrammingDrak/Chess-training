import { useState, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import type { Opening, OpeningLine, PracticeSession, PracticePhase, MoveStep, MoveQuality } from '../types';

export interface PlayedPair {
  learnerMove: MoveStep;
  opponentMove: MoveStep | null;
}

function buildFenHistory(moves: string[]): string {
  const chess = new Chess();
  for (const move of moves) {
    try {
      chess.move(move);
    } catch {
      break;
    }
  }
  return chess.fen();
}

// Prepend setupMoves as real MoveStep objects so practice starts from the initial position
function buildEffectiveMoves(opening: Opening, line: OpeningLine): MoveStep[] {
  const setupSteps: MoveStep[] = opening.setupMoves.map((san, i) => {
    const isWhiteMove = i % 2 === 0;
    const isLearnerMove = opening.learnerColor === 'white' ? isWhiteMove : !isWhiteMove;
    return {
      san,
      isLearnerMove,
      quality: 'best' as MoveQuality,
      explanation: isLearnerMove
        ? `Play ${san} to begin the opening.`
        : `Opponent responds with ${san}.`,
    };
  });
  return [...setupSteps, ...line.moves];
}

export function usePractice(opening: Opening | null) {
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [firstTryCorrect, setFirstTryCorrect] = useState(true);
  const [lastPlayedPair, setLastPlayedPair] = useState<PlayedPair | null>(null);

  const currentLine = useMemo((): OpeningLine | null => {
    if (!opening || session === null) return null;
    return opening.lines[session.lineIndex] ?? null;
  }, [opening, session]);

  // Full move sequence including setup moves prepended
  const effectiveMoves = useMemo((): MoveStep[] => {
    if (!opening || !currentLine) return [];
    return buildEffectiveMoves(opening, currentLine);
  }, [opening, currentLine]);

  const currentMoveStep = useMemo(() => {
    if (session === null) return null;
    return effectiveMoves[session.moveIndex] ?? null;
  }, [effectiveMoves, session]);

  // FEN built from the starting position using the full move history
  const currentFen = useMemo(() => {
    if (!session) return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    return buildFenHistory(session.moveHistory);
  }, [session]);

  const startLine = useCallback(
    (lineIndex: number) => {
      if (!opening) return;
      setFirstTryCorrect(true);
      setLastPlayedPair(null);
      setSession({
        openingId: opening.id,
        lineIndex,
        moveIndex: 0,
        phase: 'intro',
        wrongGuess: null,
        moveHistory: [],
      });
    },
    [opening],
  );

  const beginPractice = useCallback(() => {
    setSession((prev) =>
      prev ? { ...prev, phase: 'playing', moveIndex: 0 } : null,
    );
  }, []);

  // Advance through opponent (non-learner) moves automatically
  const advanceOpponentMoves = useCallback(
    (sess: PracticeSession, moves: MoveStep[]): PracticeSession => {
      let s = { ...sess };
      while (
        s.moveIndex < moves.length &&
        !moves[s.moveIndex].isLearnerMove
      ) {
        const move = moves[s.moveIndex];
        s = {
          ...s,
          moveHistory: [...s.moveHistory, move.san],
          moveIndex: s.moveIndex + 1,
          wrongGuess: null,
        };
      }
      if (s.moveIndex >= moves.length) {
        s.phase = 'line_complete';
      }
      return s;
    },
    [],
  );

  const submitMove = useCallback(
    (from: string, to: string): boolean => {
      if (!session || !currentMoveStep) return false;
      if (!currentMoveStep.isLearnerMove) return false;

      // Rebuild the position from scratch using the full move history
      const chess = new Chess();
      for (const moveSan of session.moveHistory) {
        chess.move(moveSan);
      }

      let actualSan: string;
      try {
        const result = chess.move({ from, to, promotion: 'q' });
        actualSan = result.san;
      } catch {
        setSession((prev) =>
          prev ? { ...prev, phase: 'incorrect', wrongGuess: `${from}-${to}` } : null,
        );
        setFirstTryCorrect(false);
        return false;
      }

      const isCorrect = actualSan === currentMoveStep.san;

      if (isCorrect) {
        const learnerMove = currentMoveStep;
        const nextMoveIndex = session.moveIndex + 1;

        // Peek at the opponent's immediate response (if it exists and is not a learner move)
        const opponentMoveStep = effectiveMoves[nextMoveIndex];
        const opponentMove =
          opponentMoveStep && !opponentMoveStep.isLearnerMove ? opponentMoveStep : null;

        // Build next session: apply learner move then auto-advance all opponent moves
        let next: PracticeSession = {
          ...session,
          moveHistory: [...session.moveHistory, currentMoveStep.san],
          moveIndex: nextMoveIndex,
          phase: 'playing',
          wrongGuess: null,
        };
        next = advanceOpponentMoves(next, effectiveMoves);

        setLastPlayedPair({ learnerMove, opponentMove });
        setSession(next);
        return true;
      } else {
        setSession((prev) =>
          prev ? { ...prev, phase: 'incorrect', wrongGuess: actualSan } : null,
        );
        setFirstTryCorrect(false);
        return false;
      }
    },
    [session, currentMoveStep, effectiveMoves, advanceOpponentMoves],
  );

  // Used only after an incorrect guess — returns to 'playing' at the same moveIndex
  const advance = useCallback(() => {
    if (!session) return;
    let next: PracticeSession = { ...session, phase: 'playing' };
    next = advanceOpponentMoves(next, effectiveMoves);
    setSession(next);
  }, [session, effectiveMoves, advanceOpponentMoves]);

  const nextLine = useCallback(
    (onRecordAttempt?: (lineId: string, firstTry: boolean) => void) => {
      if (!opening || session === null) return;
      const line = opening.lines[session.lineIndex];
      if (line && onRecordAttempt) {
        onRecordAttempt(line.id, firstTryCorrect);
      }

      const nextLineIndex = session.lineIndex + 1;
      if (nextLineIndex >= opening.lines.length) {
        setSession((prev) => (prev ? { ...prev, phase: 'session_complete' } : null));
        return;
      }

      setFirstTryCorrect(true);
      setLastPlayedPair(null);
      setSession({
        openingId: opening.id,
        lineIndex: nextLineIndex,
        moveIndex: 0,
        phase: 'intro',
        wrongGuess: null,
        moveHistory: [],
      });
    },
    [opening, session, firstTryCorrect],
  );

  const restartLine = useCallback(() => {
    if (!session) return;
    setFirstTryCorrect(true);
    setLastPlayedPair(null);
    setSession({
      ...session,
      moveIndex: 0,
      phase: 'playing',
      wrongGuess: null,
      moveHistory: [],
    });
  }, [session]);

  const resetSession = useCallback(() => {
    setSession(null);
    setFirstTryCorrect(true);
    setLastPlayedPair(null);
  }, []);

  const startPlayingFromIntro = useCallback(() => {
    if (!session) return;
    setLastPlayedPair(null);
    let next: PracticeSession = { ...session, phase: 'playing' };
    next = advanceOpponentMoves(next, effectiveMoves);
    setSession(next);
  }, [session, effectiveMoves, advanceOpponentMoves]);

  const currentPhase: PracticePhase = session?.phase ?? 'idle';

  return {
    session,
    currentLine,
    effectiveMoves,
    currentMoveStep,
    currentFen,
    currentPhase,
    firstTryCorrect,
    lastPlayedPair,
    startLine,
    beginPractice,
    submitMove,
    advance,
    nextLine,
    restartLine,
    resetSession,
    startPlayingFromIntro,
  };
}
