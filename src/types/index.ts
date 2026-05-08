// Quality rating for a move or line
export type MoveQuality =
  | 'best'       // Best theoretical move
  | 'excellent'  // Very strong, commonly played at high level
  | 'good'       // Solid, reasonable choice
  | 'playable'   // Not ideal but not losing
  | 'inaccuracy' // Slightly inferior, can be exploited
  | 'dubious'    // Questionable, concedes something important
  | 'mistake'    // Clear error that should be punished
  | 'blunder';   // Serious blunder

export interface MoveStep {
  san: string;           // Standard Algebraic Notation: "e4", "Nf3", "O-O"
  isLearnerMove: boolean; // true = learner must find this; false = opponent plays it
  quality: MoveQuality;  // Quality of this move
  explanation: string;   // Why this move is played
  strategicNote?: string; // Longer strategic context shown after guessing correctly
}

export interface OpeningLine {
  id: string;
  name: string;             // e.g. "Orthodox Variation", "Albin Countergambit"
  opponentQuality: MoveQuality; // How good are the OPPONENT's moves in this line
  frequencyPercent: number; // 0–100: how often played in real games
  summary: string;          // 2–3 sentence overview of the line
  strategicTheme: string;   // e.g. "Minority attack", "King safety"
  moves: MoveStep[];        // Full sequence of moves for this line
}

export interface Opening {
  id: string;
  name: string;
  eco: string;
  learnerColor: 'white' | 'black';
  description: string;
  tags: string[];
  setupMoves: string[]; // Moves from starting position to where lines begin
  lines: OpeningLine[]; // Ordered: best opponent lines first, worst last
}

// Progress tracking (stored in localStorage)
export interface LineProgress {
  lineId: string;
  openingId: string;
  attempts: number;
  correctOnFirst: number; // Times guessed first-move correctly on first try
  lastPracticed: string;  // ISO date string
  mastered: boolean;      // True if >80% correct over 5+ attempts
}

export interface AppProgress {
  lines: Record<string, LineProgress>; // keyed by lineId
}

// Practice session state
export type PracticePhase =
  | 'idle'
  | 'intro'       // Showing line summary before practice
  | 'playing'     // Active practice
  | 'correct'     // Just got a move right
  | 'incorrect'   // Just got a move wrong (showing correct answer)
  | 'line_complete' // Finished all moves in the line
  | 'session_complete'; // Finished all lines

export interface PracticeSession {
  openingId: string;
  lineIndex: number;       // Which line we're practicing (index into opening.lines)
  moveIndex: number;       // Where in the line we are
  phase: PracticePhase;
  wrongGuess: string | null; // SAN of the wrong move guessed
  moveHistory: string[];   // Moves played so far this session (for board display)
}

// View state
export type AppView =
  | 'home'           // Game Selector (root)
  | 'chess_home'     // Chess opening selector
  | 'opening_detail'
  | 'practice'
  | 'challenge'           // Challenge mode (5-streak)
  | 'dashboard'
  | 'poker_home'
  | 'poker_drills'
  | 'poker_drill'
  | 'poker_dashboard'
  | 'poker_profiles'
  | 'poker_hand_lookup'
  | 'poker_live_home'
  | 'poker_live_active'
  | 'blackjack_home'
  | 'blackjack_drill'
  | 'blackjack_dashboard';
