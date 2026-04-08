/**
 * True when the primary input is a coarse pointer (touch screen).
 * Matches the same heuristic react-chessboard uses to pick the
 * TouchBackend vs HTML5Backend, so disabling drag on touch devices
 * ensures onSquareClick fires reliably for click-to-move.
 */
export const isTouchDevice =
  typeof window !== 'undefined' && 'ontouchstart' in window;
