import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { ALL_OPENINGS } from './index';

describe('Opening data integrity', () => {
  ALL_OPENINGS.forEach((opening) => {
    describe(opening.name, () => {
      it('has required fields', () => {
        expect(opening.id).toBeTruthy();
        expect(opening.name).toBeTruthy();
        expect(opening.eco).toMatch(/^[A-E]\d{2}/);
        expect(['white', 'black']).toContain(opening.learnerColor);
        expect(opening.lines.length).toBeGreaterThan(0);
      });

      it('has valid setupMoves that form legal chess', () => {
        const chess = new Chess();
        for (const move of opening.setupMoves) {
          const result = chess.move(move);
          expect(result, `Invalid setup move "${move}" in ${opening.name}`).not.toBeNull();
        }
      });

      opening.lines.forEach((line) => {
        it(`line "${line.name}" has valid moves`, () => {
          const chess = new Chess();
          // Play setup moves first
          for (const move of opening.setupMoves) {
            chess.move(move);
          }
          // Then play line moves
          for (const step of line.moves) {
            const result = chess.move(step.san);
            expect(
              result,
              `Invalid move "${step.san}" in line "${line.name}" of ${opening.name}. FEN: ${chess.fen()}`
            ).not.toBeNull();
          }
        });

        it(`line "${line.name}" has frequency 0-100`, () => {
          expect(line.frequencyPercent).toBeGreaterThanOrEqual(0);
          expect(line.frequencyPercent).toBeLessThanOrEqual(100);
        });
      });
    });
  });
});
