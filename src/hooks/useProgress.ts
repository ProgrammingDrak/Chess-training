import { useState, useCallback } from 'react';
import type { AppProgress, LineProgress } from '../types';

const STORAGE_KEY = 'chess-opening-trainer-progress';

function loadProgress(): AppProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppProgress;
  } catch {
    // ignore corrupt data
  }
  return { lines: {} };
}

function saveProgress(progress: AppProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore storage errors
  }
}

export function useProgress() {
  const [progress, setProgress] = useState<AppProgress>(loadProgress);

  const recordAttempt = useCallback(
    (openingId: string, lineId: string, correctOnFirst: boolean) => {
      setProgress((prev) => {
        const existing: LineProgress = prev.lines[lineId] ?? {
          lineId,
          openingId,
          attempts: 0,
          correctOnFirst: 0,
          lastPracticed: new Date().toISOString(),
          mastered: false,
        };

        const updated: LineProgress = {
          ...existing,
          attempts: existing.attempts + 1,
          correctOnFirst: existing.correctOnFirst + (correctOnFirst ? 1 : 0),
          lastPracticed: new Date().toISOString(),
        };

        // Mark mastered if >80% correct rate over at least 5 attempts
        const rate = updated.correctOnFirst / updated.attempts;
        updated.mastered = updated.attempts >= 5 && rate >= 0.8;

        const next: AppProgress = {
          lines: { ...prev.lines, [lineId]: updated },
        };
        saveProgress(next);
        return next;
      });
    },
    [],
  );

  const resetProgress = useCallback(() => {
    const empty: AppProgress = { lines: {} };
    saveProgress(empty);
    setProgress(empty);
  }, []);

  const getLineProgress = useCallback(
    (lineId: string): LineProgress | null => {
      return progress.lines[lineId] ?? null;
    },
    [progress],
  );

  const getOpeningStats = useCallback(
    (openingId: string) => {
      const lineEntries = Object.values(progress.lines).filter(
        (l) => l.openingId === openingId,
      );
      const total = lineEntries.length;
      const mastered = lineEntries.filter((l) => l.mastered).length;
      const attempted = lineEntries.filter((l) => l.attempts > 0).length;
      return { total, mastered, attempted };
    },
    [progress],
  );

  return { progress, recordAttempt, resetProgress, getLineProgress, getOpeningStats };
}
