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

## Admins and notifications

Set `ADMIN_EMAILS` to a comma-separated list of verified Cloudflare Access email addresses that should receive the `admin` role when their local account is created through Access. Existing admins can also be promoted directly in the database. New and existing users are currently treated as Diamond status while tier gating is disabled.

Bug reports sent to `POST /api/bug-reports` notify `BUG_NOTIFICATION_EMAILS`, or fall back to `ADMIN_EMAILS`. Feedback sent from the bottom feedback button posts to `POST /api/feedback` and notifies `ADMIN_EMAILS`. Welcome emails are sent after signup when the account has an email address. Email delivery uses Resend when `RESEND_API_KEY` and sender env vars are configured; otherwise emails are logged server-side with the intended recipients. Set `WELCOME_FROM_EMAIL` for welcome emails, or omit it to fall back to `NOTIFICATION_FROM_EMAIL`.

## Cloudflare Access

Cloudflare Access can be enabled as the production login layer with email one-time PINs. Set `CLOUDFLARE_ACCESS_ENABLED=true`, `CLOUDFLARE_ACCESS_TEAM_DOMAIN`, and the Access application `CLOUDFLARE_ACCESS_AUD`. The backend verifies the signed Access JWT and creates or loads the local user by verified email.

Configure the Access application or policy session duration in Cloudflare for the "save this device" window. A practical default is 30 days for regular users and a shorter admin policy.

## Tech Stack

- React 18 + TypeScript
- Vite
- chess.js + react-chessboard
- Vitest + @testing-library/react
