import { useState, useCallback } from 'react';
import type { PokerProgress, PokerDrillProgress, PokerDrillType } from '../types/poker';

const STORAGE_KEY = 'poker-gto-trainer-progress';

function emptyDrillProgress(drillType: PokerDrillType): PokerDrillProgress {
  return {
    drillType,
    totalAttempts: 0,
    correctAttempts: 0,
    lastPracticed: new Date().toISOString(),
    scenarioAttempts: {},
  };
}

function loadProgress(): PokerProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PokerProgress;
  } catch {
    // ignore corrupt data
  }
  return { drills: {} };
}

function saveProgress(progress: PokerProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore storage errors
  }
}

export function usePokerProgress() {
  const [progress, setProgress] = useState<PokerProgress>(loadProgress);

  const recordAttempt = useCallback(
    (drillType: PokerDrillType, scenarioId: string, correct: boolean) => {
      setProgress((prev) => {
        const existing = prev.drills[drillType] ?? emptyDrillProgress(drillType);
        const scenarioRecord = existing.scenarioAttempts[scenarioId] ?? { attempts: 0, correct: 0 };

        const updated: PokerDrillProgress = {
          ...existing,
          totalAttempts: existing.totalAttempts + 1,
          correctAttempts: existing.correctAttempts + (correct ? 1 : 0),
          lastPracticed: new Date().toISOString(),
          scenarioAttempts: {
            ...existing.scenarioAttempts,
            [scenarioId]: {
              attempts: scenarioRecord.attempts + 1,
              correct: scenarioRecord.correct + (correct ? 1 : 0),
            },
          },
        };

        const next: PokerProgress = {
          drills: { ...prev.drills, [drillType]: updated },
        };
        saveProgress(next);
        return next;
      });
    },
    [],
  );

  const resetProgress = useCallback(() => {
    const empty: PokerProgress = { drills: {} };
    saveProgress(empty);
    setProgress(empty);
  }, []);

  const getDrillStats = useCallback(
    (drillType: PokerDrillType) => {
      const drill = progress.drills[drillType];
      if (!drill) return { totalAttempts: 0, correctAttempts: 0, accuracy: 0 };
      const accuracy = drill.totalAttempts > 0
        ? Math.round((drill.correctAttempts / drill.totalAttempts) * 100)
        : 0;
      return { totalAttempts: drill.totalAttempts, correctAttempts: drill.correctAttempts, accuracy };
    },
    [progress],
  );

  return { progress, recordAttempt, resetProgress, getDrillStats };
}
