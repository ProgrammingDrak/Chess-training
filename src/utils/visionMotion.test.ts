import { describe, expect, it } from 'vitest';
import { compareImageMotion } from './visionMotion';

function makeImageData(width: number, height: number, rgb: [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = rgb[0];
    data[index + 1] = rgb[1];
    data[index + 2] = rgb[2];
    data[index + 3] = 255;
  }
  return { data, width, height } as ImageData;
}

describe('compareImageMotion', () => {
  it('does not report motion without a previous frame', () => {
    const next = makeImageData(10, 10, [20, 20, 20]);
    expect(compareImageMotion(null, next).motion).toBe(false);
  });

  it('does not report motion for identical frames', () => {
    const previous = makeImageData(10, 10, [20, 20, 20]);
    const next = makeImageData(10, 10, [20, 20, 20]);
    const sample = compareImageMotion(previous, next);
    expect(sample.motion).toBe(false);
    expect(sample.changedRatio).toBe(0);
  });

  it('reports motion when enough sampled pixels change', () => {
    const previous = makeImageData(10, 10, [20, 20, 20]);
    const next = makeImageData(10, 10, [220, 220, 220]);
    const sample = compareImageMotion(previous, next, { pixelStep: 1, changedRatioThreshold: 0.2 });
    expect(sample.motion).toBe(true);
    expect(sample.changedRatio).toBe(1);
  });

  it('ignores tiny color noise below the delta threshold', () => {
    const previous = makeImageData(10, 10, [20, 20, 20]);
    const next = makeImageData(10, 10, [25, 25, 25]);
    const sample = compareImageMotion(previous, next, { pixelStep: 1, deltaThreshold: 28 });
    expect(sample.motion).toBe(false);
  });
});
