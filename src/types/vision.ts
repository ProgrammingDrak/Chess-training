import type { SeatId } from './liveSession';
import type { Card } from './poker';

export type VisionSourceKind = 'screen' | 'camera';
export type VisionApplyMode = 'confirm' | 'autoStable';
export type VisionRegionShape = 'rect' | 'polygon';

export interface VisionRegion {
  id: string;
  label: string;
  shape: VisionRegionShape;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisionChipColor {
  id: string;
  label: string;
  value: number;
  color: string;
  tolerance: number;
}

export interface VisionCalibrationProfile {
  version: 1;
  sourceKind: VisionSourceKind;
  boardRegion: VisionRegion | null;
  heroRegion: VisionRegion | null;
  villainRegions: Array<{
    seatId: SeatId;
    region: VisionRegion;
  }>;
  betRegions: Array<{
    id: string;
    label: string;
    seatId?: SeatId;
    region: VisionRegion;
  }>;
  chipColors: VisionChipColor[];
  applyMode: VisionApplyMode;
  updatedAt: string;
}

export interface RecognizedCard {
  card: Card;
  confidence: number;
  sourceKind: VisionSourceKind;
  observedAt: string;
  bounds?: VisionRegion;
}

export interface RecognizedBoard {
  cards: RecognizedCard[];
  sourceKind: VisionSourceKind;
  observedAt: string;
}

export interface RecognizedBet {
  area: 'pot' | 'seat-bet';
  seatId?: SeatId;
  amount: number | null;
  confidence: number;
  source: 'ocr' | 'chip-vision' | 'manual';
  observedAt: string;
  components?: Array<{
    denomination: number;
    count: number;
    confidence: number;
  }>;
}

export type VisionBoardCards = [Card | null, Card | null, Card | null, Card | null, Card | null];
