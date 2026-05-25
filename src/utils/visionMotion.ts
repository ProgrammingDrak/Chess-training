export interface MotionSample {
  changedRatio: number;
  averageDelta: number;
  motion: boolean;
}

export interface MotionOptions {
  pixelStep?: number;
  deltaThreshold?: number;
  changedRatioThreshold?: number;
}

export const DEFAULT_MOTION_OPTIONS: Required<MotionOptions> = {
  pixelStep: 4,
  deltaThreshold: 28,
  changedRatioThreshold: 0.025,
};

export function compareImageMotion(
  previous: ImageData | null,
  next: ImageData,
  options: MotionOptions = {},
): MotionSample {
  if (!previous || previous.width !== next.width || previous.height !== next.height) {
    return { changedRatio: 0, averageDelta: 0, motion: false };
  }

  const config = { ...DEFAULT_MOTION_OPTIONS, ...options };
  const step = Math.max(1, config.pixelStep);
  let changed = 0;
  let total = 0;
  let deltaSum = 0;

  for (let y = 0; y < next.height; y += step) {
    for (let x = 0; x < next.width; x += step) {
      const index = (y * next.width + x) * 4;
      const delta = (
        Math.abs(previous.data[index] - next.data[index])
        + Math.abs(previous.data[index + 1] - next.data[index + 1])
        + Math.abs(previous.data[index + 2] - next.data[index + 2])
      ) / 3;
      total += 1;
      deltaSum += delta;
      if (delta >= config.deltaThreshold) changed += 1;
    }
  }

  const changedRatio = total > 0 ? changed / total : 0;
  const averageDelta = total > 0 ? deltaSum / total : 0;
  return {
    changedRatio,
    averageDelta,
    motion: changedRatio >= config.changedRatioThreshold,
  };
}
