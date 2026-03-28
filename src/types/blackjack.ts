// ── Drill type union ──────────────────────────────────────────────────────────
export type BlackjackDrillType =
  | 'basic_strategy'
  | 'card_counting'
  | 'true_count'
  | 'bet_spread';

// ── Shared types ──────────────────────────────────────────────────────────────
export type Difficulty = 'easy' | 'medium' | 'hard';

/** Hit / Stand / Double / sPlit / suRrender */
export type BJAction = 'H' | 'S' | 'D' | 'P' | 'R';

export type DrillPhase = 'idle' | 'question' | 'correct' | 'incorrect' | 'session_complete';

// ── Scenario types ────────────────────────────────────────────────────────────

/** 6-deck S17 / DAS rules basic-strategy scenario */
export interface BasicStrategyScenario {
  id: string;
  difficulty: Difficulty;
  /** Two player cards as rank strings: '2'–'9', 'T', 'J', 'Q', 'K', 'A' */
  playerCards: [string, string];
  /** Dealer upcard rank */
  dealerUpcard: string;
  handType: 'hard' | 'soft' | 'pair';
  playerTotal: number;
  correctAction: BJAction;
  /** Other actions that are close-enough (rarely used — same as correct for strict) */
  acceptableActions: BJAction[];
  explanation: string;
}

/** Hi-Lo running-count drill: show a sequence of cards, compute the count */
export interface CardCountingScenario {
  id: string;
  difficulty: Difficulty;
  /** Card ranks shown in order */
  cards: string[];
  /** Running count before the sequence starts */
  startingCount: number;
  /** Running count after the full sequence */
  correctCount: number;
  explanation: string;
}

/** True count drill: RC ÷ decks remaining, rounded */
export interface TrueCountScenario {
  id: string;
  difficulty: Difficulty;
  runningCount: number;
  /** Decks remaining in the shoe (0.5 increments) */
  decksRemaining: number;
  /** Four answer options to display */
  options: number[];
  correctTrueCount: number;
  explanation: string;
}

/** Bet spread drill: given true count → correct bet multiple */
export interface BetSpreadScenario {
  id: string;
  difficulty: Difficulty;
  trueCount: number;
  /** Descriptive context (e.g. bankroll size) */
  bankrollUnits: number;
  /** 1, 2, 4, or 8 */
  correctMultiplier: number;
  explanation: string;
}

// ── Session state ─────────────────────────────────────────────────────────────
export interface BlackjackDrillSession {
  drillType: BlackjackDrillType;
  phase: DrillPhase;
  currentScenarioIndex: number;
  totalInSession: number;
  correctCount: number;
  scenarioIds: string[];
  userAnswer: string | null;
}

// ── Progress (mirrors PokerProgress shape) ────────────────────────────────────
export interface BlackjackDrillProgress {
  drillType: BlackjackDrillType;
  totalAttempts: number;
  correctAttempts: number;
  lastPracticed: string;
  scenarioAttempts: Record<string, { attempts: number; correct: number }>;
}

export interface BlackjackProgress {
  drills: Partial<Record<BlackjackDrillType, BlackjackDrillProgress>>;
}
