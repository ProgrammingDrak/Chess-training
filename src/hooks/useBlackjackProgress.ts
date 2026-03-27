import { useState, useCallback } from 'react';
import type {
  BlackjackProgress,
  BlackjackDrillProgress,
  BlackjackDrillType,
} from '../types/blackjack';

const STORAGE_KEY = 'bj-trainer-progress';

function emptyDrillProgress(drillType: BlackjackDrillType): BlackjackDrillProgress {
  return {
    drillType,
    totalAttempts: 0,
    correctAttempts: 0,
    lastPracticed: new Date().toISOString(),
    scenarioAttempts: {},
  };
}

function loadProgress(): BlackjackProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as BlackjackProgress;
  } catch {
    // ignore corrupt data
  }
  return { drills: {} };
}

function saveProgress(progress: BlackjackProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore storage errors
  }
}

export function useBlackjackProgress() {
  const [progress, setProgress] = useState<BlackjackProgress>(loadProgress);

  const recordAttempt = useCallback(
    (drillType: BlackjackDrillType, scenarioId: string, correct: boolean) => {
      setProgress((prev) => {
        const existing = prev.drills[drillType] ?? emptyDrillProgress(drillType);
        const scenarioRecord = existing.scenarioAttempts[scenarioId] ?? { attempts: 0, correct: 0 };

        const updated: BlackjackDrillProgress = {
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

        const next: BlackjackProgress = {
          drills: { ...prev.drills, [drillType]: updated },
        };
        saveProgress(next);
        return next;
      });
    },
    [],
  );

  const resetProgress = useCallback(() => {
    const empty: BlackjackProgress = { drills: {} };
    saveProgress(empty);
    setProgress(empty);
  }, []);

  const getDrillStats = useCallback(
    (drillType: BlackjackDrillType) => {
      const drill = progress.drills[drillType];
      if (!drill) return { totalAttempts: 0, correctAttempts: 0, accuracy: 0 };
      const accuracy =
        drill.totalAttempts > 0
          ? Math.round((drill.correctAttempts / drill.totalAttempts) * 100)
          : 0;
      return { totalAttempts: drill.totalAttempts, correctAttempts: drill.correctAttempts, accuracy };
    },
    [progress],
  );

  return { progress, recordAttempt, resetProgress, getDrillStats };
}
