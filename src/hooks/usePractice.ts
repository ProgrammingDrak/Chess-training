import { useState, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import type { Opening, OpeningLine, PracticeSession, PracticePhase } from '../types';

function buildFenHistory(setupMoves: string[], lineMoves: string[]): string {
  const chess = new Chess();
  for (const move of [...setupMoves, ...lineMoves]) {
    try {
      chess.move(move);
    } catch {
      break;
    }
  }
  return chess.fen();
}

export function usePractice(opening: Opening | null) {
  const [session, setSession] = useState<PracticeSession | null>(null);
  // Track whether the current learner-move was guessed correctly on first try
  const [firstTryCorrect, setFirstTryCorrect] = useState(true);

  const currentLine = useMemo((): OpeningLine | null => {
    if (!opening || session === null) return null;
    return opening.lines[session.lineIndex] ?? null;
  }, [opening, session]);

  const currentMoveStep = useMemo(() => {
    if (!currentLine || session === null) return null;
    return currentLine.moves[session.moveIndex] ?? null;
  }, [currentLine, session]);

  const currentFen = useMemo(() => {
    if (!session) return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    return buildFenHistory(opening?.setupMoves ?? [], session.moveHistory);
  }, [session, opening]);

  const startLine = useCallback(
    (lineIndex: number) => {
      if (!opening) return;
      setFirstTryCorrect(true);
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
    (sess: PracticeSession, line: OpeningLine): PracticeSession => {
      let s = { ...sess };
      while (
        s.moveIndex < line.moves.length &&
        !line.moves[s.moveIndex].isLearnerMove
      ) {
        const move = line.moves[s.moveIndex];
        s = {
          ...s,
          moveHistory: [...s.moveHistory, move.san],
          moveIndex: s.moveIndex + 1,
          wrongGuess: null,
        };
      }
      if (s.moveIndex >= line.moves.length) {
        s.phase = 'line_complete';
      }
      return s;
    },
    [],
  );

  const submitMove = useCallback(
    (from: string, to: string): boolean => {
      if (!session || !currentLine || !currentMoveStep) return false;
      if (!currentMoveStep.isLearnerMove) return false;

      // Rebuild the position and convert coordinate move to SAN
      const chess = new Chess();
      for (const moveSan of [...(opening?.setupMoves ?? []), ...session.moveHistory]) {
        chess.move(moveSan);
      }

      let actualSan: string;
      try {
        const result = chess.move({ from, to, promotion: 'q' });
        actualSan = result.san;
      } catch {
        // Illegal move
        setSession((prev) =>
          prev ? { ...prev, phase: 'incorrect', wrongGuess: `${from}-${to}` } : null,
        );
        setFirstTryCorrect(false);
        return false;
      }

      const isCorrect = actualSan === currentMoveStep.san;

      if (isCorrect) {
        const nextMoveIndex = session.moveIndex + 1;
        const next: PracticeSession = {
          ...session,
          moveHistory: [...session.moveHistory, currentMoveStep.san],
          moveIndex: nextMoveIndex,
          phase: 'correct',
          wrongGuess: null,
        };
        setSession(next);
        setFirstTryCorrect((prev) => prev && true);
        return true;
      } else {
        setSession((prev) =>
          prev ? { ...prev, phase: 'incorrect', wrongGuess: actualSan } : null,
        );
        setFirstTryCorrect(false);
        return false;
      }
    },
    [session, currentLine, currentMoveStep],
  );

  // Called after showing correct/incorrect feedback — advance to next step
  const advance = useCallback(() => {
    if (!session || !currentLine) return;

    // If we're in 'correct' state, moveIndex was already incremented — advance opponent moves
    let next: PracticeSession = {
      ...session,
      phase: 'playing',
    };
    next = advanceOpponentMoves(next, currentLine);
    setSession(next);
  }, [session, currentLine, advanceOpponentMoves]);

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
  }, []);

  // After 'intro' phase, auto-advance opponent opening moves
  const startPlayingFromIntro = useCallback(() => {
    if (!session || !currentLine) return;
    let next: PracticeSession = { ...session, phase: 'playing' };
    next = advanceOpponentMoves(next, currentLine);
    setSession(next);
  }, [session, currentLine, advanceOpponentMoves]);

  const currentPhase: PracticePhase = session?.phase ?? 'idle';

  return {
    session,
    currentLine,
    currentMoveStep,
    currentFen,
    currentPhase,
    firstTryCorrect,
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
