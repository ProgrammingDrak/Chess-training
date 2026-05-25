import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Card } from '../types/poker';
import {
  detectCardCandidates,
  drawVisionGlyph,
  recognizeCardsFromImageData,
  type VisionCardCandidate,
} from './visionCardRecognition';

function imageWithCards(width: number, height: number, cards: Array<{ x: number; y: number; width: number; height: number }>): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 20;
    data[i + 1] = 90;
    data[i + 2] = 36;
    data[i + 3] = 255;
  }
  for (const card of cards) {
    for (let y = card.y; y < card.y + card.height; y += 1) {
      for (let x = card.x; x < card.x + card.width; x += 1) {
        const index = (y * width + x) * 4;
        data[index] = 246;
        data[index + 1] = 246;
        data[index + 2] = 238;
      }
    }
  }
  return { data, width, height } as ImageData;
}

function setPixel(image: ImageData, x: number, y: number, rgb: [number, number, number]): void {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const index = (y * image.width + x) * 4;
  image.data[index] = rgb[0];
  image.data[index + 1] = rgb[1];
  image.data[index + 2] = rgb[2];
  image.data[index + 3] = 255;
}

function fillRect(image: ImageData, x: number, y: number, width: number, height: number, rgb: [number, number, number]): void {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      setPixel(image, px, py, rgb);
    }
  }
}

function drawFakePokerStarsCard(image: ImageData, x: number, y: number, card: Card): void {
  const red = card.suit === 'h' || card.suit === 'd';
  const ink: [number, number, number] = red ? [210, 18, 28] : [12, 12, 12];
  fillRect(image, x - 1, y - 1, 64, 94, [180, 180, 186]);
  fillRect(image, x, y, 62, 92, [248, 248, 239]);
  drawVisionGlyph(image, card.rank, x + 4, y + 4, 2, ink);
  drawVisionGlyph(image, card.suit, x + 5, y + 24, 2, ink);
  drawVisionGlyph(image, card.suit, x + 38, y + 36, 3, ink);
}

function fakePokerStarsBoard(): ImageData {
  const image = imageWithCards(520, 180, []);
  const cards: Card[] = [
    { rank: '4', suit: 's' },
    { rank: 'T', suit: 'h' },
    { rank: '2', suit: 'c' },
    { rank: '7', suit: 's' },
  ];
  cards.forEach((card, index) => drawFakePokerStarsCard(image, 78 + index * 84, 42, card));
  return image;
}

function writeDebugBmp(name: string, image: ImageData, candidates: VisionCardCandidate[] = []): void {
  const output = join(process.cwd(), '.vision-debug');
  mkdirSync(output, { recursive: true });
  const copy = new Uint8ClampedArray(image.data);
  const boxed = { data: copy, width: image.width, height: image.height } as ImageData;
  for (const candidate of candidates) {
    for (let x = candidate.x; x < candidate.x + candidate.width; x += 1) {
      setPixel(boxed, x, candidate.y, [255, 0, 0]);
      setPixel(boxed, x, candidate.y + candidate.height - 1, [255, 0, 0]);
    }
    for (let y = candidate.y; y < candidate.y + candidate.height; y += 1) {
      setPixel(boxed, candidate.x, y, [255, 0, 0]);
      setPixel(boxed, candidate.x + candidate.width - 1, y, [255, 0, 0]);
    }
  }

  const rowStride = Math.ceil((image.width * 3) / 4) * 4;
  const pixelBytes = rowStride * image.height;
  const fileSize = 54 + pixelBytes;
  const buffer = Buffer.alloc(fileSize);
  buffer.write('BM', 0);
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(image.width, 18);
  buffer.writeInt32LE(image.height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(pixelBytes, 34);

  for (let y = 0; y < image.height; y += 1) {
    const sourceY = image.height - 1 - y;
    for (let x = 0; x < image.width; x += 1) {
      const sourceIndex = (sourceY * image.width + x) * 4;
      const targetIndex = 54 + y * rowStride + x * 3;
      buffer[targetIndex] = boxed.data[sourceIndex + 2];
      buffer[targetIndex + 1] = boxed.data[sourceIndex + 1];
      buffer[targetIndex + 2] = boxed.data[sourceIndex];
    }
  }
  writeFileSync(join(output, name), buffer);
}

describe('detectCardCandidates', () => {
  it('finds white card rectangles on a dark felt crop', () => {
    const image = imageWithCards(240, 120, [
      { x: 20, y: 25, width: 34, height: 56 },
      { x: 68, y: 25, width: 34, height: 56 },
      { x: 116, y: 25, width: 34, height: 56 },
    ]);
    const candidates = detectCardCandidates(image);
    expect(candidates).toHaveLength(3);
    expect(candidates.map(candidate => candidate.x)).toEqual([20, 68, 116]);
  });

  it('ignores tiny white specks', () => {
    const image = imageWithCards(240, 120, [
      { x: 20, y: 25, width: 4, height: 4 },
      { x: 68, y: 25, width: 34, height: 56 },
    ]);
    const candidates = detectCardCandidates(image);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].x).toBe(68);
  });
});

describe('recognizeCardsFromImageData', () => {
  it('recognizes a fake PokerStars-style board screenshot and writes debug screenshots', () => {
    const image = fakePokerStarsBoard();
    const candidates = detectCardCandidates(image);
    writeDebugBmp('fake-pokerstars-board.bmp', image);
    writeDebugBmp('fake-pokerstars-board-detected.bmp', image, candidates);

    expect(candidates).toHaveLength(4);
    expect(recognizeCardsFromImageData(image, 'screen').map(result => result.card)).toEqual([
      { rank: '4', suit: 's' },
      { rank: 'T', suit: 'h' },
      { rank: '2', suit: 'c' },
      { rank: '7', suit: 's' },
    ]);
  });
});
