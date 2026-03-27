// ─── Primitives ────────────────────────────────────────────────────────────────

export type Suit = 'h' | 'd' | 'c' | 's';
export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type HandNotation = string; // e.g. "AKs", "72o", "JJ"

export type Position = 'UTG' | 'UTG+1' | 'MP' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

export type PokerAction = 'fold' | 'call' | 'raise' | '3bet' | 'allin' | 'check';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export type BoardTexture = 'dry' | 'wet' | 'paired' | 'monotone' | 'broadway' | 'coordinated';

// ─── Range Charts ───────────────────────────────────────────────────────────────

export type RangeAction = 'raise' | 'call' | 'fold' | 'raise_mixed' | 'call_mixed';

export interface RangeCell {
  hand: HandNotation;
  action: RangeAction;
  frequency?: number; // 0-100 for mixed strategies
  notes?: string;
}

export interface RangeChart {
  position: Position;
  scenario: 'RFI';
  cells: RangeCell[];
}

// ─── Drill Types ────────────────────────────────────────────────────────────────

export type PokerDrillType =
  | 'hand_selection'
  | 'pot_odds'
  | 'equity_estimation'
  | 'bet_sizing'
  | 'opponent_simulation'
  | 'ev_calculation'
  | 'range_reading';

export type Difficulty = 'easy' | 'medium' | 'hard';

// ─── Hand Selection ─────────────────────────────────────────────────────────────

export interface HandSelectionScenario {
  id: string;
  position: Position;
  hand: HandNotation;
  heroCard1: Card;
  heroCard2: Card;
  heroStack: number; // in BB
  correctAction: PokerAction;
  acceptableActions: PokerAction[];
  explanation: string;
  gtoFrequency?: number; // e.g. 0.7 = raise 70% of time
  difficulty: Difficulty;
}

// ─── Pot Odds ───────────────────────────────────────────────────────────────────

export interface PotOddsScenario {
  id: string;
  street: Street;
  potSizeBB: number;
  betSizeBB: number;
  heroHandDescription: string; // e.g. "flush draw (9 outs)"
  boardDescription: string;
  outCount: number;
  requiredEquityPct: number; // correct answer
  estimatedEquityPct: number; // rule of 4/2 result
  correctAnswer: 'call' | 'fold';
  explanation: string;
  difficulty: Difficulty;
}

// ─── Equity Estimation ──────────────────────────────────────────────────────────

export interface EquityEstimationScenario {
  id: string;
  heroCard1: Card;
  heroCard2: Card;
  board: Card[];
  street: 'flop' | 'turn';
  outCount: number;
  drawDescription: string;
  ruleMethod: 'x4' | 'x2';
  equityEstimatePct: number; // correct answer
  tolerancePct: number; // acceptable ±margin
  explanation: string;
  completingCards?: string; // e.g. "any heart"
  difficulty: Difficulty;
}

// ─── Bet Sizing ─────────────────────────────────────────────────────────────────

export type BetSizeOption = '1/4' | '1/3' | '1/2' | '2/3' | '3/4' | 'pot' | 'overbet';

export interface BetSizingScenario {
  id: string;
  street: Street;
  position: Position;
  heroRole: 'IP' | 'OOP';
  boardDescription: string;
  boardTexture: BoardTexture;
  rangeAdvantage: 'hero' | 'villain' | 'neutral';
  potSizeBB: number;
  stackDepthBB: number;
  scenarioDescription: string;
  options: BetSizeOption[];
  correctOption: BetSizeOption;
  acceptableOptions: BetSizeOption[];
  explanation: string;
  gtoRationale: string;
  difficulty: Difficulty;
}

// ─── EV Calculation ─────────────────────────────────────────────────────────────

export interface EvOutcome {
  description: string;
  probability: number; // 0-1
  netValueBB: number;  // can be negative
}

export interface EvScenario {
  id: string;
  scenarioDescription: string;
  potBeforeActionBB: number;
  heroActionDescription: string;
  outcomes: EvOutcome[];
  correctEvBB: number; // Σ(prob × value)
  toleranceBB: number;
  explanation: string;
  difficulty: Difficulty;
}

// ─── Opponent Simulation ────────────────────────────────────────────────────────

export type OpponentType = 'NIT' | 'TAG' | 'LAG' | 'calling_station' | 'maniac';

export interface OpponentProfile {
  type: OpponentType;
  displayName: string;
  description: string;
  icon: string;
  stats: {
    vpip: number;
    pfr: number;
    aggression: number; // 0-10
    foldToSteal: number; // %
    cbet: number; // %
    foldToCbet: number; // %
  };
  tendencies: string[];
  exploitTips: string[];
  color: string; // accent color for this profile
}

export interface SimScenario {
  id: string;
  street: Street;
  heroPosition: Position;
  heroCard1: Card;
  heroCard2: Card;
  board: Card[];
  potSizeBB: number;
  heroStackBB: number;
  villainStackBB: number;
  opponentType: OpponentType;
  villainAction: PokerAction;
  villainBetSizeBB?: number;
  availableActions: PokerAction[];
  correctAction: PokerAction;
  explanation: string;
  exploitRationale: string;
  difficulty: Difficulty;
}

// ─── Range Reading ───────────────────────────────────────────────────────────────

export interface RangeQuestion {
  prompt: string;
  options: string[];      // exactly 4 options
  correctIndex: number;   // 0-3
  explanation: string;    // shown after answering
}

export type VillainHandCategory = 'premium' | 'interesting' | 'any';

export interface RangeReadingScenario {
  id: string;
  villainHandCategory?: VillainHandCategory; // for filtering
  profile: OpponentType;
  profileLabel: string;       // e.g. "NIT — Nitty / Rock"
  profileDescription: string; // 1-2 sentence tendencies
  profileStats: string;       // e.g. "VPIP: 10% · PFR: 9%"
  profileColor: string;       // accent hex

  villainPosition: string;
  heroPosition: string;

  preflopAction: string;      // Narrative description

  flop: [Card, Card, Card];
  flopAction: string;
  flopQuestion: RangeQuestion;

  turn: Card;
  turnAction: string;
  turnNote: string;           // Brief range-update note (no question)

  river: Card;
  riverAction: string;
  riverQuestion: RangeQuestion; // Final hand guess

  revealCard1: Card;
  revealCard2: Card;
  revealHand: string;         // e.g. "A♥A♣ — Pocket Aces"
  revealExplanation: string;
}

// ─── Progress & Session ─────────────────────────────────────────────────────────

export interface PokerDrillProgress {
  drillType: PokerDrillType;
  totalAttempts: number;
  correctAttempts: number;
  lastPracticed: string; // ISO date
  scenarioAttempts: Record<string, { attempts: number; correct: number }>;
}

export interface PokerProgress {
  drills: Partial<Record<PokerDrillType, PokerDrillProgress>>;
}

export type DrillPhase =
  | 'idle'
  | 'question'
  | 'correct'
  | 'incorrect'
  | 'session_complete';

export interface PokerDrillSession {
  drillType: PokerDrillType;
  phase: DrillPhase;
  currentScenarioIndex: number;
  totalInSession: number;
  correctCount: number;
  scenarioIds: string[];
  userAnswer: string | null;
}
