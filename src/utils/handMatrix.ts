// Shared hand-matrix utilities used by both the grid components and data builders.

export const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'] as const;
export type RankStr = typeof RANKS[number];

/** Return the canonical hand notation for grid position (row, col).
 *  Diagonal = pair (AA..22), above diagonal = suited (col > row), below = offsuit. */
export function cellHand(row: number, col: number): string {
  if (row === col) return RANKS[row] + RANKS[row];
  if (col > row)  return RANKS[row] + RANKS[col] + 's'; // suited  — upper-right
  return RANKS[col] + RANKS[row] + 'o';                 // offsuit — lower-left
}

/** Combo count: pairs=6, suited=4, offsuit=12 */
export function handCombos(hand: string): number {
  if (hand.length === 2 && hand[0] === hand[1]) return 6;
  if (hand.endsWith('s')) return 4;
  return 12;
}
