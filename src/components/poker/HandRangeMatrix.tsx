import { useRef, useCallback } from 'react';
import type { Card } from '../../types/poker';

// ── Constants ──────────────────────────────────────────────────────────────────

export const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'] as const;
type RankStr = typeof RANKS[number];

export function cellHand(row: number, col: number): string {
  if (row === col) return RANKS[row] + RANKS[row];
  if (col > row) return RANKS[row] + RANKS[col] + 's'; // suited  — upper-right
  return RANKS[col] + RANKS[row] + 'o';                // offsuit  — lower-left
}

/** Convert two specific cards to their hand-matrix notation (e.g. "AKo", "87s", "JJ") */
export function cardsToHandNotation(c1: Card, c2: Card): string {
  const r1 = RANKS.indexOf(c1.rank as RankStr);
  const r2 = RANKS.indexOf(c2.rank as RankStr);
  if (c1.rank === c2.rank) return c1.rank + c2.rank;
  const [hi, lo] = r1 < r2 ? [c1, c2] : [c2, c1];
  return hi.rank + lo.rank + (hi.suit === lo.suit ? 's' : 'o');
}

/** Combo count for a hand notation */
function combos(hand: string): number {
  if (hand.length === 2) return 6;   // pair
  if (hand.endsWith('s')) return 4;  // suited
  return 12;                          // offsuit
}

/** Points awarded: 100 / sqrt(selected), capped 5-100. Zero if hand not found. */
export function scoreRange(targetHand: string, selected: Set<string>): number {
  if (!selected.size || !selected.has(targetHand)) return 0;
  return Math.max(5, Math.round(100 / Math.sqrt(selected.size)));
}

export function scoreLabel(score: number, size: number): string {
  if (score === 0) return 'Missed';
  if (size === 1)  return 'Perfect read!';
  if (score >= 71) return 'Very sharp';
  if (score >= 50) return 'Good read';
  if (score >= 33) return 'Decent';
  return 'Too wide';
}

// ── Hand tier classification (matches GTO open-raise colour chart) ─────────────

type Tier = 'premium' | 'strong' | 'speculative' | 'marginal';

const PREMIUM = new Set([
  'AA','KK','QQ','JJ',
  'AKs','AQs','AJs','ATs',
  'AKo','AQo','AJo',
  'KQs','KJs','QJs','KQo',
]);

const STRONG = new Set([
  'TT','99','88',
  'KTs','QTs','JTs','T9s','98s',
  'A9s','A8s',
  'KJo','QJo',
  'J9s','K9s',
]);

const SPECULATIVE = new Set([
  '77','66','55','44','33','22',
  'A7s','A6s','A5s','A4s','A3s','A2s',
  '87s','76s','65s','54s',
  'T8s','97s','86s','75s',
  'Q9s',
]);

const MARGINAL = new Set([
  '64s','53s','43s','74s','63s',
  'J8s','Q8s','K8s',
  'ATo','KTo','QTo',
  'A9o',
]);

function getTier(hand: string): Tier | null {
  if (PREMIUM.has(hand))      return 'premium';
  if (STRONG.has(hand))       return 'strong';
  if (SPECULATIVE.has(hand))  return 'speculative';
  if (MARGINAL.has(hand))     return 'marginal';
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────────

interface HandRangeMatrixProps {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
  /** Highlight this hand notation (the villain's actual hand) after reveal */
  revealHand?: string;
}

export function HandRangeMatrix({ selected, onChange, disabled = false, revealHand }: HandRangeMatrixProps) {
  const isDragging = useRef(false);
  const dragMode = useRef<'add' | 'remove'>('add');

  const handleMouseDown = useCallback((hand: string) => {
    if (disabled) return;
    const adding = !selected.has(hand);
    dragMode.current = adding ? 'add' : 'remove';
    isDragging.current = true;
    const next = new Set(selected);
    adding ? next.add(hand) : next.delete(hand);
    onChange(next);
  }, [disabled, selected, onChange]);

  const handleMouseEnter = useCallback((hand: string) => {
    if (disabled || !isDragging.current) return;
    const next = new Set(selected);
    dragMode.current === 'add' ? next.add(hand) : next.delete(hand);
    onChange(next);
  }, [disabled, selected, onChange]);

  const stopDrag = useCallback(() => { isDragging.current = false; }, []);

  const totalCombos = [...selected].reduce((s, h) => s + combos(h), 0);
  const pct = ((totalCombos / 1326) * 100).toFixed(1);

  return (
    <div
      className="hrm-wrapper"
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      {/* Rank labels row */}
      <div className="hrm-grid">
        {RANKS.map((rowRank, row) =>
          RANKS.map((_, col) => {
            const hand = cellHand(row, col);
            const tier = getTier(hand);
            const isSel = selected.has(hand);
            const isReveal = revealHand === hand;

            return (
              <div
                key={hand}
                className={[
                  'hrm-cell',
                  tier ? `tier-${tier}` : 'tier-fold',
                  isSel     ? 'hrm-selected' : '',
                  isReveal  ? 'hrm-reveal'   : '',
                  disabled  ? 'hrm-disabled' : '',
                  // diagonal / offsuit / suited label
                  row === col ? 'hrm-pair' : col > row ? 'hrm-suited' : 'hrm-offsuit',
                ].filter(Boolean).join(' ')}
                onMouseDown={() => handleMouseDown(hand)}
                onMouseEnter={() => handleMouseEnter(hand)}
              >
                {hand}
              </div>
            );
          })
        )}
      </div>

      {/* Stats footer */}
      <div className="hrm-stats">
        <span className="hrm-stat">{selected.size} <span className="hrm-stat-label">hands</span></span>
        <span className="hrm-sep">·</span>
        <span className="hrm-stat">{totalCombos} <span className="hrm-stat-label">combos</span></span>
        <span className="hrm-sep">·</span>
        <span className="hrm-stat">{pct}% <span className="hrm-stat-label">of range</span></span>
        {selected.size > 0 && !disabled && (
          <button className="hrm-clear" onClick={() => onChange(new Set())}>Clear</button>
        )}
      </div>
    </div>
  );
}
