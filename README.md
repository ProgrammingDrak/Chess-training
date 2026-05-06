# GTO Training

A training platform for mastering Game Theory Optimal play in chess, poker, and blackjack.

## Features

### Chess Opening Training
- 10 openings with annotated variations (Queen's Gambit, Sicilian, Italian, Ruy Lopez, London, French, Caro-Kann, King's Gambit, King's Indian, English)
- Interactive board with move-by-move feedback
- Challenge mode: 5-streak across random lines
- Progress tracking with mastery system

### Poker GTO Training
- **Hand Selection**: Preflop ranges by position (40 scenarios)
- **Pot Odds**: Call/fold decisions with pot odds math (25 scenarios)
- **Equity Estimation**: Rule of 4 and 2 (20 scenarios)
- **Bet Sizing**: Board texture-based sizing (24 scenarios)
- **EV Calculation**: Expected value computation (20 scenarios)
- **Range Reading**: Multi-street hand reading (6 multi-stage scenarios)
- **Opponent Simulation**: Exploit-based play vs 5 opponent profiles

### Blackjack Training
- **Basic Strategy**: 6-deck S17/DAS decisions (60 scenarios)
- **Card Counting**: Hi-Lo running count drills (20 scenarios)
- **True Count**: RC / decks remaining conversion (20 scenarios)
- **Bet Spread**: 1-2-4-8 spread optimization (20 scenarios)

## Development

```bash
npm install
npm run dev       # Start dev server
npm test          # Run tests (570 tests)
npm run build     # Production build
```

## Tech Stack

- React 18 + TypeScript
- Vite
- chess.js + react-chessboard
- Vitest + @testing-library/react
