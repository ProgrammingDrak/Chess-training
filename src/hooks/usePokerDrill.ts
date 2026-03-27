import { useState, useMemo, useCallback } from 'react';
import type { PokerDrillType, PokerDrillSession, DrillPhase, Difficulty } from '../types/poker';

const SESSION_SIZE = 10;

interface ScenarioBase {
  id: string;
  difficulty: Difficulty;
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function usePokerDrill<T extends ScenarioBase>(
  drillType: PokerDrillType,
  allScenarios: T[],
) {
  const [session, setSession] = useState<PokerDrillSession | null>(null);
  const [difficulty, setDifficulty] = useState<'all' | Difficulty>('all');

  const filteredScenarios = useMemo(
    () =>
      difficulty === 'all'
        ? allScenarios
        : allScenarios.filter((s) => s.difficulty === difficulty),
    [allScenarios, difficulty],
  );

  const currentScenario: T | null = useMemo(() => {
    if (!session) return null;
    const id = session.scenarioIds[session.currentScenarioIndex];
    return allScenarios.find((s) => s.id === id) ?? null;
  }, [session, allScenarios]);

  const startSession = useCallback(() => {
    const shuffled = shuffleArray(filteredScenarios);
    const picked = shuffled.slice(0, Math.min(SESSION_SIZE, shuffled.length));
    setSession({
      drillType,
      phase: 'question',
      currentScenarioIndex: 0,
      totalInSession: picked.length,
      correctCount: 0,
      scenarioIds: picked.map((s) => s.id),
      userAnswer: null,
    });
  }, [drillType, filteredScenarios]);

  // Returns whether the answer was correct
  const submitAnswer = useCallback(
    (answer: string, correctAnswer: string): boolean => {
      const isCorrect = answer === correctAnswer;
      setSession((prev) =>
        prev
          ? {
              ...prev,
              phase: isCorrect ? 'correct' : 'incorrect',
              correctCount: prev.correctCount + (isCorrect ? 1 : 0),
              userAnswer: answer,
            }
          : null,
      );
      return isCorrect;
    },
    [],
  );

  // Returns whether the answer is within tolerance (for numeric drills)
  const submitNumericAnswer = useCallback(
    (value: number, correctValue: number, tolerance: number): boolean => {
      const isCorrect = Math.abs(value - correctValue) <= tolerance;
      const answerStr = value.toString();
      setSession((prev) =>
        prev
          ? {
              ...prev,
              phase: isCorrect ? 'correct' : 'incorrect',
              correctCount: prev.correctCount + (isCorrect ? 1 : 0),
              userAnswer: answerStr,
            }
          : null,
      );
      return isCorrect;
    },
    [],
  );

  const nextQuestion = useCallback(() => {
    setSession((prev) => {
      if (!prev) return null;
      const next = prev.currentScenarioIndex + 1;
      if (next >= prev.totalInSession) {
        return { ...prev, phase: 'session_complete' as DrillPhase };
      }
      return {
        ...prev,
        phase: 'question' as DrillPhase,
        currentScenarioIndex: next,
        userAnswer: null,
      };
    });
  }, []);

  const resetSession = useCallback(() => {
    setSession(null);
  }, []);

  return {
    session,
    currentScenario,
    difficulty,
    setDifficulty,
    startSession,
    submitAnswer,
    submitNumericAnswer,
    nextQuestion,
    resetSession,
  };
}
