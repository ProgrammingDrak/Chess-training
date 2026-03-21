import type { MoveQuality } from '../types';

export const QUALITY_LABELS: Record<MoveQuality, string> = {
  best: 'Best',
  excellent: 'Excellent',
  good: 'Good',
  playable: 'Playable',
  inaccuracy: 'Inaccuracy',
  dubious: 'Dubious',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

export const QUALITY_COLORS: Record<MoveQuality, string> = {
  best: '#00c853',      // bright green
  excellent: '#64dd17', // light green
  good: '#aeea00',      // yellow-green
  playable: '#ffd600',  // yellow
  inaccuracy: '#ff9100',// orange
  dubious: '#ff6d00',   // deep orange
  mistake: '#dd2c00',   // red-orange
  blunder: '#b71c1c',   // dark red
};

export const QUALITY_BG: Record<MoveQuality, string> = {
  best: '#003d1a',
  excellent: '#1a3000',
  good: '#2d3600',
  playable: '#3d3000',
  inaccuracy: '#3d2000',
  dubious: '#3d1a00',
  mistake: '#3d0800',
  blunder: '#2d0000',
};

export const QUALITY_ORDER: MoveQuality[] = [
  'best',
  'excellent',
  'good',
  'playable',
  'inaccuracy',
  'dubious',
  'mistake',
  'blunder',
];

export function qualitySymbol(q: MoveQuality): string {
  const map: Record<MoveQuality, string> = {
    best: '!!',
    excellent: '!',
    good: '',
    playable: '',
    inaccuracy: '?!',
    dubious: '?!',
    mistake: '?',
    blunder: '??',
  };
  return map[q];
}
