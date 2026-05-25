import type { LiveStreet } from '../types/liveSession';
import type { Card } from '../types/poker';
import type { RecognizedBoard, RecognizedCard, VisionBoardCards } from '../types/vision';
import { cardKey } from './cardInput';

export const VISION_MIN_CARD_CONFIDENCE = 0.85;
export const VISION_STABLE_FRAME_COUNT = 3;

export type VisionBoardApplyStatus =
  | 'stable'
  | 'pending'
  | 'empty'
  | 'rejected';

export interface VisionBoardTrackerState {
  signature: string | null;
  stableFrames: number;
  appliedCount: number;
  board: VisionBoardCards;
}

export interface VisionBoardEvaluation {
  status: VisionBoardApplyStatus;
  board: VisionBoardCards;
  street: LiveStreet;
  cards: RecognizedCard[];
  stableFrames: number;
  reason?: string;
}

export interface VisionBoardOptions {
  minConfidence?: number;
  stableFrameCount?: number;
  allowRegression?: boolean;
}

const EMPTY_BOARD: VisionBoardCards = [null, null, null, null, null];

function boardCardCount(board: VisionBoardCards): number {
  return board.filter((card): card is Card => card !== null).length;
}

function streetForCount(count: number): LiveStreet {
  if (count >= 5) return 'river';
  if (count === 4) return 'turn';
  if (count === 3) return 'flop';
  return 'preflop';
}

function candidateX(candidate: RecognizedCard, index: number): number {
  if (!candidate.bounds) return index;
  return candidate.bounds.x + candidate.bounds.width / 2;
}

function boardFromCards(cards: RecognizedCard[]): VisionBoardCards {
  const board = [...EMPTY_BOARD] as VisionBoardCards;
  cards.forEach((candidate, index) => {
    if (index < board.length) board[index] = candidate.card;
  });
  return board;
}

function signatureForCards(cards: RecognizedCard[]): string {
  return cards.map(candidate => cardKey(candidate.card)).join('|');
}

export function createVisionBoardTrackerState(board: VisionBoardCards = EMPTY_BOARD): VisionBoardTrackerState {
  return {
    signature: null,
    stableFrames: 0,
    appliedCount: boardCardCount(board),
    board,
  };
}

export function evaluateRecognizedBoard(
  state: VisionBoardTrackerState,
  recognized: RecognizedBoard,
  options: VisionBoardOptions = {},
): { state: VisionBoardTrackerState; evaluation: VisionBoardEvaluation } {
  const minConfidence = options.minConfidence ?? VISION_MIN_CARD_CONFIDENCE;
  const stableFrameCount = options.stableFrameCount ?? VISION_STABLE_FRAME_COUNT;

  if (recognized.cards.some(candidate => candidate.confidence < minConfidence)) {
    const nextState = { ...state, signature: null, stableFrames: 0 };
    return {
      state: nextState,
      evaluation: {
        status: 'rejected',
        board: state.board,
        street: streetForCount(state.appliedCount),
        cards: recognized.cards,
        stableFrames: 0,
        reason: 'One or more board cards were below confidence threshold.',
      },
    };
  }

  const confidentCards = recognized.cards
    .slice()
    .sort((a, b) => candidateX(a, recognized.cards.indexOf(a)) - candidateX(b, recognized.cards.indexOf(b)));

  const count = confidentCards.length;

  if (count === 0) {
    const nextState = { ...state, signature: null, stableFrames: 0 };
    return {
      state: nextState,
      evaluation: {
        status: 'empty',
        board: state.board,
        street: streetForCount(state.appliedCount),
        cards: [],
        stableFrames: 0,
        reason: 'No confident board cards detected.',
      },
    };
  }

  if (count === 1 || count === 2) {
    const signature = signatureForCards(confidentCards);
    const stableFrames = signature === state.signature ? state.stableFrames + 1 : 1;
    const nextState = { ...state, signature, stableFrames };
    return {
      state: nextState,
      evaluation: {
        status: 'pending',
        board: state.board,
        street: streetForCount(state.appliedCount),
        cards: confidentCards,
        stableFrames,
        reason: 'Waiting for a complete flop before applying board cards.',
      },
    };
  }

  if (count > 5) {
    const nextState = { ...state, signature: null, stableFrames: 0 };
    return {
      state: nextState,
      evaluation: {
        status: 'rejected',
        board: state.board,
        street: streetForCount(state.appliedCount),
        cards: confidentCards,
        stableFrames: 0,
        reason: 'More than five board cards were detected.',
      },
    };
  }

  const keys = confidentCards.map(candidate => cardKey(candidate.card));
  if (new Set(keys).size !== keys.length) {
    const nextState = { ...state, signature: null, stableFrames: 0 };
    return {
      state: nextState,
      evaluation: {
        status: 'rejected',
        board: state.board,
        street: streetForCount(state.appliedCount),
        cards: confidentCards,
        stableFrames: 0,
        reason: 'Duplicate board cards were detected.',
      },
    };
  }

  if (!options.allowRegression && count < state.appliedCount) {
    const nextState = { ...state, signature: null, stableFrames: 0 };
    return {
      state: nextState,
      evaluation: {
        status: 'rejected',
        board: state.board,
        street: streetForCount(state.appliedCount),
        cards: confidentCards,
        stableFrames: 0,
        reason: 'Detected board regressed below the current street.',
      },
    };
  }

  const signature = signatureForCards(confidentCards);
  const stableFrames = signature === state.signature ? state.stableFrames + 1 : 1;
  const board = boardFromCards(confidentCards);
  const isStable = stableFrames >= stableFrameCount;
  const nextState: VisionBoardTrackerState = {
    signature,
    stableFrames,
    appliedCount: isStable ? count : state.appliedCount,
    board: isStable ? board : state.board,
  };

  return {
    state: nextState,
    evaluation: {
      status: isStable ? 'stable' : 'pending',
      board: isStable ? board : state.board,
      street: isStable ? streetForCount(count) : streetForCount(state.appliedCount),
      cards: confidentCards,
      stableFrames,
      reason: isStable ? undefined : `Waiting for ${stableFrameCount} stable frames.`,
    },
  };
}

export function visionBoardStreet(board: VisionBoardCards): LiveStreet {
  return streetForCount(boardCardCount(board));
}
