import { describe, expect, it } from 'vitest';
import type { Card } from '../types/poker';
import type { RecognizedBoard, RecognizedCard, VisionBoardCards } from '../types/vision';
import {
  createVisionBoardTrackerState,
  evaluateRecognizedBoard,
  visionBoardStreet,
} from './visionBoardState';

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

function recognized(cards: Card[], confidences: number[] = []): RecognizedBoard {
  const observedAt = '2026-05-17T12:00:00.000Z';
  return {
    sourceKind: 'screen',
    observedAt,
    cards: cards.map((item, index): RecognizedCard => ({
      card: item,
      confidence: confidences[index] ?? 0.95,
      sourceKind: 'screen',
      observedAt,
      bounds: {
        id: `card-${index}`,
        label: `Card ${index + 1}`,
        shape: 'rect',
        x: index * 0.1,
        y: 0.2,
        width: 0.08,
        height: 0.16,
      },
    })),
  };
}

function stabilize(board: RecognizedBoard, initialBoard?: VisionBoardCards) {
  let state = createVisionBoardTrackerState(initialBoard);
  let result = evaluateRecognizedBoard(state, board);
  state = result.state;
  result = evaluateRecognizedBoard(state, board);
  state = result.state;
  result = evaluateRecognizedBoard(state, board);
  return result;
}

describe('visionBoardState', () => {
  it('applies three stable sorted cards as the flop', () => {
    const result = stabilize(recognized([card('A', 's'), card('K', 'd'), card('Q', 'h')]));
    expect(result.evaluation.status).toBe('stable');
    expect(result.evaluation.street).toBe('flop');
    expect(result.evaluation.board.slice(0, 3)).toEqual([card('A', 's'), card('K', 'd'), card('Q', 'h')]);
  });

  it('applies four stable cards as flop plus turn', () => {
    const result = stabilize(recognized([card('A', 's'), card('K', 'd'), card('Q', 'h'), card('J', 'c')]));
    expect(result.evaluation.street).toBe('turn');
    expect(result.evaluation.board[3]).toEqual(card('J', 'c'));
  });

  it('applies five stable cards as flop plus turn plus river', () => {
    const result = stabilize(recognized([
      card('A', 's'),
      card('K', 'd'),
      card('Q', 'h'),
      card('J', 'c'),
      card('T', 's'),
    ]));
    expect(result.evaluation.street).toBe('river');
    expect(result.evaluation.board[4]).toEqual(card('T', 's'));
  });

  it('keeps one or two cards pending instead of applying them', () => {
    const result = stabilize(recognized([card('A', 's'), card('K', 'd')]));
    expect(result.evaluation.status).toBe('pending');
    expect(result.evaluation.street).toBe('preflop');
    expect(result.evaluation.board).toEqual([null, null, null, null, null]);
  });

  it('rejects duplicate board cards', () => {
    const result = stabilize(recognized([card('A', 's'), card('A', 's'), card('Q', 'h')]));
    expect(result.evaluation.status).toBe('rejected');
    expect(result.evaluation.reason).toContain('Duplicate');
  });

  it('rejects low-confidence cards before applying', () => {
    const result = stabilize(recognized(
      [card('A', 's'), card('K', 'd'), card('Q', 'h')],
      [0.99, 0.8, 0.99],
    ));
    expect(result.evaluation.status).toBe('rejected');
    expect(result.evaluation.board).toEqual([null, null, null, null, null]);
  });

  it('sorts board order by candidate x-position', () => {
    const board = recognized([card('Q', 'h'), card('A', 's'), card('K', 'd')]);
    board.cards[0].bounds!.x = 0.3;
    board.cards[1].bounds!.x = 0.1;
    board.cards[2].bounds!.x = 0.2;
    const result = stabilize(board);
    expect(result.evaluation.board.slice(0, 3)).toEqual([card('A', 's'), card('K', 'd'), card('Q', 'h')]);
  });

  it('does not apply unstable changes until the third matching frame', () => {
    let state = createVisionBoardTrackerState();
    const first = recognized([card('A', 's'), card('K', 'd'), card('Q', 'h')]);
    const changed = recognized([card('A', 's'), card('K', 'd'), card('J', 'h')]);

    let result = evaluateRecognizedBoard(state, first);
    state = result.state;
    result = evaluateRecognizedBoard(state, changed);
    state = result.state;
    result = evaluateRecognizedBoard(state, changed);

    expect(result.evaluation.status).toBe('pending');
    expect(result.evaluation.board).toEqual([null, null, null, null, null]);

    result = evaluateRecognizedBoard(result.state, changed);
    expect(result.evaluation.status).toBe('stable');
    expect(result.evaluation.board[2]).toEqual(card('J', 'h'));
  });

  it('infers street from an existing board tuple', () => {
    expect(visionBoardStreet([card('A', 's'), card('K', 'd'), card('Q', 'h'), null, null])).toBe('flop');
  });
});
