import type { Rank, Suit } from '../types/poker';
import type { RecognizedCard, VisionRegion, VisionSourceKind } from '../types/vision';

export interface VisionCardCandidate {
  x: number;
  y: number;
  width: number;
  height: number;
  faceConfidence: number;
}

interface TemplateImage {
  label: Rank | Suit;
  data: ImageData;
}

const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS: Suit[] = ['s', 'h', 'd', 'c'];

const GLYPHS: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  '9': ['01110', '10001', '10001', '01111', '00001', '10001', '01110'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '4': ['10010', '10010', '10010', '11111', '00010', '00010', '00010'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  s: ['00100', '01110', '11111', '11111', '01110', '00100', '01110'],
  h: ['01010', '11111', '11111', '01110', '00100', '00000', '00000'],
  d: ['00100', '01110', '11111', '01110', '00100', '00000', '00000'],
  c: ['00100', '01110', '00100', '11111', '10101', '00100', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
};

let rankTemplates: TemplateImage[] | null = null;
let suitTemplates: TemplateImage[] | null = null;

function pixelIndex(width: number, x: number, y: number): number {
  return (y * width + x) * 4;
}

function isCardFacePixel(data: Uint8ClampedArray, index: number): boolean {
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  return r > 172 && g > 172 && b > 162 && Math.max(r, g, b) - Math.min(r, g, b) < 72;
}

function foregroundMask(data: ImageData): Uint8Array {
  const mask = new Uint8Array(data.width * data.height);
  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i];
    const g = data.data[i + 1];
    const b = data.data[i + 2];
    const pixel = i / 4;
    const isWhite = r > 205 && g > 205 && b > 195;
    const isBorderGrey = Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && r > 135 && r < 210;
    mask[pixel] = !isWhite && !isBorderGrey ? 1 : 0;
  }
  return mask;
}

function maskSimilarity(first: ImageData, second: ImageData): number {
  const a = foregroundMask(first);
  const b = foregroundMask(second);
  let intersection = 0;
  let union = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] || b[i]) union += 1;
    if (a[i] && b[i]) intersection += 1;
  }
  return union > 0 ? intersection / union : 0;
}

function makeBlankImageData(width: number, height: number, color: [number, number, number] = [255, 255, 255]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
    data[i + 3] = 255;
  }
  return { data, width, height } as ImageData;
}

function setPixel(image: ImageData, x: number, y: number, color: [number, number, number]): void {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const index = pixelIndex(image.width, x, y);
  image.data[index] = color[0];
  image.data[index + 1] = color[1];
  image.data[index + 2] = color[2];
  image.data[index + 3] = 255;
}

export function drawVisionGlyph(
  image: ImageData,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: [number, number, number],
): void {
  let cursorX = x;
  for (const char of text) {
    const glyph = GLYPHS[char];
    if (!glyph) {
      cursorX += 2 * scale;
      continue;
    }
    for (let gy = 0; gy < glyph.length; gy += 1) {
      for (let gx = 0; gx < glyph[gy].length; gx += 1) {
        if (glyph[gy][gx] !== '1') continue;
        for (let sy = 0; sy < scale; sy += 1) {
          for (let sx = 0; sx < scale; sx += 1) {
            setPixel(image, cursorX + gx * scale + sx, y + gy * scale + sy, color);
          }
        }
      }
    }
    cursorX += (glyph[0].length + 1) * scale;
  }
}

function templateImage(text: string, color: [number, number, number], width: number, height: number, scale: number): ImageData {
  const image = makeBlankImageData(width, height);
  drawVisionGlyph(image, text, 2, 2, scale, color);
  return image;
}

function getRankTemplates(width: number, height: number): TemplateImage[] {
  if (rankTemplates) return rankTemplates;
  rankTemplates = RANKS.flatMap(rank => {
    const labels = rank === 'T' ? ['T', '10'] : [rank];
    return labels.map(text => ({ label: rank, data: templateImage(text, [12, 12, 12], width, height, 4) }));
  });
  return rankTemplates;
}

function getSuitTemplates(width: number, height: number): TemplateImage[] {
  if (suitTemplates) return suitTemplates;
  suitTemplates = SUITS.flatMap(suit => {
    const color: [number, number, number] = suit === 'h' || suit === 'd' ? [210, 18, 28] : [12, 12, 12];
    const data = templateImage(suit, color, width, height, 3);
    return [{ label: suit, data }];
  });
  return suitTemplates;
}

function cropImageData(source: ImageData, bounds: { x: number; y: number; width: number; height: number }, width: number, height: number): ImageData | null {
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  const target = makeBlankImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.max(0, Math.min(source.width - 1, Math.floor(bounds.x + (x / width) * bounds.width)));
      const sy = Math.max(0, Math.min(source.height - 1, Math.floor(bounds.y + (y / height) * bounds.height)));
      const sourceIndex = pixelIndex(source.width, sx, sy);
      const targetIndex = pixelIndex(width, x, y);
      target.data[targetIndex] = source.data[sourceIndex];
      target.data[targetIndex + 1] = source.data[sourceIndex + 1];
      target.data[targetIndex + 2] = source.data[sourceIndex + 2];
      target.data[targetIndex + 3] = 255;
    }
  }
  return target;
}

function bestTemplate<T extends Rank | Suit>(sample: ImageData, templates: Array<TemplateImage & { label: T }>): { label: T; score: number } | null {
  let best: { label: T; score: number } | null = null;
  for (const template of templates) {
    const score = maskSimilarity(sample, template.data);
    if (!best || score > best.score) best = { label: template.label, score };
  }
  return best;
}

function sampleLooksRed(sample: ImageData): boolean {
  let redPixels = 0;
  let darkPixels = 0;
  for (let i = 0; i < sample.data.length; i += 4) {
    const r = sample.data[i];
    const g = sample.data[i + 1];
    const b = sample.data[i + 2];
    const isInk = !(r > 205 && g > 205 && b > 195);
    if (!isInk) continue;
    if (r > g + 45 && r > b + 45) redPixels += 1;
    if (r < 90 && g < 90 && b < 90) darkPixels += 1;
  }
  return redPixels > darkPixels;
}

function maskBounds(mask: Uint8Array, width: number, height: number): { minX: number; maxX: number; minY: number; maxY: number } | null {
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX >= minX && maxY >= minY ? { minX, maxX, minY, maxY } : null;
}

function rowForegroundWidth(mask: Uint8Array, width: number, y: number): number {
  let minX = width;
  let maxX = -1;
  for (let x = 0; x < width; x += 1) {
    if (!mask[y * width + x]) continue;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  }
  return maxX >= minX ? maxX - minX + 1 : 0;
}

function rowComponents(mask: Uint8Array, width: number, y: number): number {
  let components = 0;
  let inComponent = false;
  for (let x = 0; x < width; x += 1) {
    const filled = Boolean(mask[y * width + x]);
    if (filled && !inComponent) components += 1;
    inComponent = filled;
  }
  return components;
}

function classifySuitByShape(sample: ImageData, redSuit: boolean, fallback: Suit): Suit {
  const mask = foregroundMask(sample);
  const bounds = maskBounds(mask, sample.width, sample.height);
  if (!bounds) return fallback;
  const glyphHeight = Math.max(1, bounds.maxY - bounds.minY + 1);
  if (redSuit) {
    const upperRow = Math.min(sample.height - 1, bounds.minY + Math.round(glyphHeight * 0.18));
    return rowComponents(mask, sample.width, upperRow) >= 2 ? 'h' : 'd';
  }
  const upperRow = Math.min(sample.height - 1, bounds.minY + Math.round(glyphHeight * 0.35));
  const middleRow = Math.min(sample.height - 1, bounds.minY + Math.round(glyphHeight * 0.55));
  return rowForegroundWidth(mask, sample.width, upperRow) >= rowForegroundWidth(mask, sample.width, middleRow) * 0.75 ? 's' : 'c';
}

export function detectCardCandidates(image: ImageData): VisionCardCandidate[] {
  const visited = new Uint8Array(image.width * image.height);
  const candidates: VisionCardCandidate[] = [];
  const minArea = Math.max(120, image.width * image.height * 0.012);

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const seed = y * image.width + x;
      if (visited[seed]) continue;
      visited[seed] = 1;
      if (!isCardFacePixel(image.data, pixelIndex(image.width, x, y))) continue;

      const queue: Array<[number, number]> = [[x, y]];
      let cursor = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;

      while (cursor < queue.length) {
        const [cx, cy] = queue[cursor];
        cursor += 1;
        area += 1;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);

        const neighbors: Array<[number, number]> = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue;
          const next = ny * image.width + nx;
          if (visited[next]) continue;
          visited[next] = 1;
          if (isCardFacePixel(image.data, pixelIndex(image.width, nx, ny))) queue.push([nx, ny]);
        }
      }

      const width = maxX - minX + 1;
      const height = maxY - minY + 1;
      const aspect = width / Math.max(1, height);
      const fill = area / Math.max(1, width * height);
      if (area >= minArea && width >= 22 && height >= 30 && aspect >= 0.42 && aspect <= 0.95 && fill >= 0.28) {
        candidates.push({
          x: minX,
          y: minY,
          width,
          height,
          faceConfidence: Math.min(1, fill * 1.7),
        });
      }
    }
  }

  return candidates
    .sort((a, b) => a.x - b.x)
    .slice(0, 7);
}

export function recognizeCardsFromImageData(image: ImageData, sourceKind: VisionSourceKind, observedAt = new Date().toISOString()): RecognizedCard[] {
  const rankTemplateList = getRankTemplates(42, 30) as Array<TemplateImage & { label: Rank }>;
  const suitTemplateList = getSuitTemplates(30, 30) as Array<TemplateImage & { label: Suit }>;
  if (rankTemplateList.length === 0 || suitTemplateList.length === 0) return [];

  return detectCardCandidates(image).flatMap((bounds, index) => {
    const rankSample = cropImageData(image, {
      x: bounds.x + bounds.width * 0.04,
      y: bounds.y + bounds.height * 0.02,
      width: bounds.width * 0.42,
      height: bounds.height * 0.22,
    }, 42, 30);
    const suitSample = cropImageData(image, {
      x: bounds.x + bounds.width * 0.52,
      y: bounds.y + bounds.height * 0.32,
      width: bounds.width * 0.42,
      height: bounds.height * 0.38,
    }, 30, 30);
    if (!rankSample || !suitSample) return [];
    const rank = bestTemplate(rankSample, rankTemplateList);
    const redSuit = sampleLooksRed(suitSample);
    const suitCandidates = suitTemplateList.filter(template => (
      redSuit ? template.label === 'h' || template.label === 'd' : template.label === 's' || template.label === 'c'
    ));
    const suit = bestTemplate(suitSample, suitCandidates);
    if (!rank || !suit) return [];
    const suitLabel = classifySuitByShape(suitSample, redSuit, suit.label);

    const confidence = Math.max(0, Math.min(0.99, 0.46 + rank.score * 0.32 + suit.score * 0.17 + bounds.faceConfidence * 0.05));
    return [{
      card: { rank: rank.label, suit: suitLabel },
      confidence,
      sourceKind,
      observedAt,
      bounds: {
        id: `detected-card-${index}`,
        label: `Detected card ${index + 1}`,
        shape: 'rect',
        x: bounds.x / image.width,
        y: bounds.y / image.height,
        width: bounds.width / image.width,
        height: bounds.height / image.height,
      } satisfies VisionRegion,
    }];
  });
}
