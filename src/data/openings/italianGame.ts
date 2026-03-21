import type { Opening } from '../../types';

// Italian Game / Giuoco Piano — practiced from White's perspective
// Setup: 1.e4 e5 2.Nf3 Nc6 3.Bc4 — all lines begin here
export const italianGame: Opening = {
  id: 'italian-game',
  name: 'Italian Game',
  eco: 'C50–C59',
  learnerColor: 'white',
  description:
    "One of the oldest openings in chess. White develops the bishop to c4 targeting the f7 pawn and the center. The Italian Game has seen a massive revival in modern chess — Magnus Carlsen uses it extensively. The positions are rich with long-term strategic ideas.",
  tags: ['classical', 'strategic', 'bishop pair', 'e4'],
  setupMoves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
  lines: [
    // ──────────────────────────────────────────────
    // 1. Giuoco Piano — classical main line
    // ──────────────────────────────────────────────
    {
      id: 'italian-giuoco-piano',
      name: 'Giuoco Piano — Classical',
      opponentQuality: 'best',
      frequencyPercent: 30,
      summary:
        "The 'Quiet Game'. Black mirrors White's development with …Bc5. Both sides fight for the center. White should play c3 and d4 to strike in the center and gain a slight space advantage.",
      strategicTheme: 'Central control with c3+d4, bishop pair, open center',
      moves: [
        {
          san: 'Bc5',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "The Giuoco Piano! Black mirrors White and develops the bishop actively, targeting the center. A classical and strong move.",
        },
        {
          san: 'c3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Prepare d4! This is the modern approach — support the d4 break with c3 first. The c3–d4 advance gives White a strong center.",
          strategicNote:
            "After c3, you'll play d4 on the next move. This is the core of the Italian Game: control the center with pawns, then use your better-developed pieces. Avoid playing d3 too early — that leads to a passive position.",
        },
        {
          san: 'Nf6',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black develops and attacks e4, preparing to castle.",
        },
        {
          san: 'd4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Strike the center! The d4 pawn challenge is the whole point of c3 on the last move.",
          strategicNote:
            "After d4, the position opens up. If Black takes: exd4 cxd4 Bb4+ Bd2 Bxd2+ Nbxd2 — White has excellent development and central control. Black's bishop had to trade itself.",
        },
        {
          san: 'exd4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black releases the tension by capturing on d4.",
        },
        {
          san: 'cxd4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Recapture with the c-pawn, maintaining a strong center. The d4 pawn gives White a small but lasting advantage.",
          strategicNote:
            "You now have a strong center (e4+d4) and good development. The main plan: O-O, Nc3, and then use the center to launch an attack. Don't let Black get comfortable with …d5.",
        },
        {
          san: 'Bb4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black pins the c3-knight (which doesn't exist yet), creating complications.",
        },
        {
          san: 'Nc3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the knight and meet the pin. This is the standard response — ignore the pin and keep developing.",
          strategicNote:
            "After …Bxc3+ bxc3, White gets the bishop pair and open b-file for the rook. The doubled c-pawns look weak but give White strong center control and attacking chances.",
        },
        {
          san: 'O-O',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black castles, getting the king to safety.",
        },
        {
          san: 'O-O',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Castle! Your king is safe and your pieces are all well-placed. The position is rich and slightly better for White.",
          strategicNote:
            "From here, the typical plans include: Re1 to support e4, Bg5 to pin the Nf6, and a kingside attack. You have excellent piece activity and the bishop pair.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 2. Two Knights Defense — Black counterattacks
    // ──────────────────────────────────────────────
    {
      id: 'italian-two-knights',
      name: 'Two Knights Defense',
      opponentQuality: 'excellent',
      frequencyPercent: 22,
      summary:
        "Black plays …Nf6, attacking e4 immediately instead of developing the bishop. If White plays Ng5, there are sharp tactical complications (the Fried Liver Attack). The modern approach is 4.d3 — solid and positional.",
      strategicTheme: 'Solid center with d3, avoid tactical tricks, positional squeeze',
      moves: [
        {
          san: 'Nf6',
          isLearnerMove: false,
          quality: 'excellent',
          explanation:
            "The Two Knights Defense! Black attacks e4 immediately rather than developing the bishop. Very dynamic and sharp.",
        },
        {
          san: 'd3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "The modern, solid approach. Solidify the center and avoid the complications of Ng5 (which leads to the Fried Liver Attack). 4.d3 is currently the most popular White choice at the top level.",
          strategicNote:
            "4.d3 is the 'Carlsen approach' — solid, avoiding all the theory of the Fried Liver. White plans: Nc3, O-O, a4 (to stop …b5), and Re1 with a long-term squeeze. Very effective.",
        },
        {
          san: 'Be7',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black prepares to castle. A solid and flexible move.",
        },
        {
          san: 'O-O',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Castle! Safety first. Your pieces are all well-placed.",
        },
        {
          san: 'O-O',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black also castles.",
        },
        {
          san: 'Nc3',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Develop the knight. Control d5 and e4.",
        },
        {
          san: 'd6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black solidifies the center and makes room for the c8-bishop.",
        },
        {
          san: 'a4',
          isLearnerMove: true,
          quality: 'excellent',
          explanation:
            "Prevent …b5! This is the key prophylactic move in the Italian Game. If you let Black play …b5, they gain queenside space and it becomes uncomfortable.",
          strategicNote:
            "After a4, Black can't easily expand on the queenside. You now have a small but stable advantage. Plans: h3 (prevent …Bg4), Re1, and slowly prepare the d4 break. Carlsen wins with this technique.",
        },
        {
          san: 'Na5',
          isLearnerMove: false,
          quality: 'good',
          explanation:
            "Black attacks the bishop on c4. Now you must decide where to put the bishop.",
        },
        {
          san: 'Ba2',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Retreat the bishop to a2, where it's safe and still eyes f7. Don't trade or retreat to b3 — a2 is the best square.",
          strategicNote:
            "The bishop on a2 is a long-term asset. It will become very powerful once you push d4 and open the diagonal. Black's knight on a5 is temporarily offside — use this time to build your position.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 3. Hungarian Defense — passive …Be7
    // ──────────────────────────────────────────────
    {
      id: 'italian-hungarian',
      name: 'Hungarian Defense — …Be7',
      opponentQuality: 'good',
      frequencyPercent: 8,
      summary:
        "Black plays the passive …Be7 instead of the active …Bc5 or …Nf6. This is very solid but gives White a free hand to build a strong center. White should play for a big center and active piece play.",
      strategicTheme: 'Strong center, f4–f5 attack, exploiting passivity',
      moves: [
        {
          san: 'Be7',
          isLearnerMove: false,
          quality: 'good',
          explanation:
            "The Hungarian Defense — very solid and passive. Black opts for maximum safety over counterplay.",
        },
        {
          san: 'd4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Immediately strike the center! When Black plays passively, you should expand aggressively.",
          strategicNote:
            "When Black plays passively, you should be aggressive. After d4, exd4 Nxd4 Nxd4 Qxd4, White has a dominating center. Play: O-O, Nc3, Bg5 and enjoy the space advantage.",
        },
        {
          san: 'exd4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black must capture — the e5 pawn is attacked.",
        },
        {
          san: 'Nxd4',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Recapture with the knight, dominating the center.",
        },
        {
          san: 'Nf6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black develops and attacks e4.",
        },
        {
          san: 'Nc3',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Develop and protect e4.",
        },
        {
          san: 'O-O',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black castles.",
        },
        {
          san: 'O-O',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Castle and prepare for the attack.",
        },
        {
          san: 'd6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black solidifies the center.",
        },
        {
          san: 'f4',
          isLearnerMove: true,
          quality: 'excellent',
          explanation:
            "Push f4! Prepare a kingside attack. Against Black's passive setup, you have the space to be very aggressive.",
          strategicNote:
            "After f4, the plan is f5, opening the f-file and creating a direct kingside attack. Black's passive …Be7 has no counterplay. You should win with direct attack: f5, Bg5, Qf3, Raf1.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 4. Evans Gambit — bold 19th century attack
    // ──────────────────────────────────────────────
    {
      id: 'italian-evans-gambit',
      name: 'Evans Gambit',
      opponentQuality: 'excellent',
      frequencyPercent: 5,
      summary:
        "After 3…Bc5, White sacrifices the b4 pawn to gain rapid development and a huge center. Kasparov famously revived this in 1995. Against unprepared opponents, it's devastating.",
      strategicTheme: 'Rapid development, huge center, direct king attack',
      moves: [
        {
          san: 'Bc5',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black plays the Giuoco Piano — now you have a surprise in store!",
        },
        {
          san: 'b4',
          isLearnerMove: true,
          quality: 'excellent',
          explanation:
            "The Evans Gambit! Sacrifice the b4 pawn for a massive development lead and central domination. Very tricky for unprepared opponents.",
          strategicNote:
            "The Evans Gambit gives you: (1) the c4 square for your bishop, (2) a strong center with d4, (3) faster development. The pawn is well worth it. This was a Kasparov favorite!",
        },
        {
          san: 'Bxb4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black accepts the gambit — greedy but objectively fine with correct play.",
        },
        {
          san: 'c3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Drive the bishop away and prepare d4. The whole plan: c3, d4, establishing a massive pawn center.",
        },
        {
          san: 'Ba5',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "Black retreats the bishop to a5. The main line — keeping the bishop safe.",
        },
        {
          san: 'd4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Establish the center! This is what you sacrificed the pawn for. White now has an overwhelming center.",
          strategicNote:
            "After d4, exd4 cxd4 d5 (Black tries to hold) e5 — White has a huge center and Black is cramped. The attack practically plays itself: O-O, Bg5, Qb3, and go!",
        },
        {
          san: 'exd4',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black captures in the center.",
        },
        {
          san: 'O-O',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Castle! Get the king safe and the rook into the game. The attack follows naturally.",
          strategicNote:
            "From O-O, the attack is automatic: play Bg5, Nbd2, and then launch with Ng5 or f4. Black is cramped and on the defensive. The Evans Gambit is extremely dangerous for the unprepared!",
        },
        {
          san: 'd6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black tries to hold the position.",
        },
        {
          san: 'Bg5',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Pin the Nf6 and increase pressure. The attack is overwhelming — Black has no good answer to all of White's threats.",
          strategicNote:
            "With Bg5, Nbd2, Qb3+, and Re1, White has a devastating attack. The pawn sacrifice was completely worth it — Black's position is very difficult to defend.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 5. …d6 + passive setup (common amateur)
    // ──────────────────────────────────────────────
    {
      id: 'italian-passive-d6',
      name: 'Black Plays Passively — …d6 and …Be7',
      opponentQuality: 'inaccuracy',
      frequencyPercent: 15,
      summary:
        "Many club players adopt a passive 'just develop' approach with …d6, …Be7, and slow play. You should be aggressive: build a strong center and then convert your space advantage into a kingside attack.",
      strategicTheme: 'Space advantage, kingside attack, outpost on d5',
      moves: [
        {
          san: 'd6',
          isLearnerMove: false,
          quality: 'inaccuracy',
          explanation:
            "A passive move. Black plays …d6 without clear purpose, planning a slow setup. White should immediately take space.",
        },
        {
          san: 'c3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Prepare d4. Against passive play, expand in the center immediately.",
        },
        {
          san: 'Be7',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black develops solidly but passively.",
        },
        {
          san: 'd4',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Strike! The d4 break gives you a large center advantage.",
        },
        {
          san: 'exd4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black captures.",
        },
        {
          san: 'cxd4',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Recapture with a strong center (e4+d4).",
        },
        {
          san: 'Nf6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black develops and attacks e4.",
        },
        {
          san: 'Nc3',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Develop and protect e4. You now have a dream position.",
        },
        {
          san: 'O-O',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black castles.",
        },
        {
          san: 'O-O',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Castle and prepare the attack.",
        },
        {
          san: 'Bg4',
          isLearnerMove: false,
          quality: 'playable',
          explanation: "Black tries to pin the Nf3 and relieve pressure.",
        },
        {
          san: 'h3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Drive the bishop away! After …Bh5, play g4! and the bishop is misplaced. You gain kingside space and can attack.",
          strategicNote:
            "After h3 …Bh5 g4 Bg6 Nh4, you're winning the bishop pair and have a strong kingside attack. Black's passive play has backfired completely.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 6. Fried Liver Attack — sacrificial attack on f7
    // ──────────────────────────────────────────────
    {
      id: 'italian-fried-liver',
      name: 'Fried Liver Attack',
      opponentQuality: 'dubious',
      frequencyPercent: 4,
      summary:
        "If Black plays …Nf6 and then …d5 (Two Knights), White can sacrifice the knight on f7! The Fried Liver Attack. Objectively Black can defend with precise play, but the attack is devastating in practice. A devastating weapon at the club level.",
      strategicTheme: 'Sacrificial attack, king exposure, devastating tactics',
      moves: [
        {
          san: 'Nf6',
          isLearnerMove: false,
          quality: 'excellent',
          explanation:
            "Black plays the Two Knights Defense — heading for the sharp …d5 variation.",
        },
        {
          san: 'Ng5',
          isLearnerMove: true,
          quality: 'excellent',
          explanation:
            "The aggressive option! Ng5 attacks the f7 pawn and forces Black to react. This leads to the Fried Liver if Black plays …d5.",
          strategicNote:
            "After Ng5, if Black plays …d5 (the natural response), you can sacrifice the knight on f7: Nxf7! The Fried Liver Attack. Black's king gets exposed and the attack is very dangerous.",
        },
        {
          san: 'd5',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "The best response: Black counterattacks in the center to stop the Ng5 attack.",
        },
        {
          san: 'exd5',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Capture on d5 — forced.",
        },
        {
          san: 'Na5',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "Black attacks the bishop. The modern and best response — avoid the Fried Liver.",
        },
        {
          san: 'Bb5',
          isLearnerMove: true,
          quality: 'good',
          explanation:
            "Protect the bishop and keep the initiative. After …c6, dxc6 bxc6 Be2, White has a solid extra pawn.",
          strategicNote:
            "After Bb5+ c6 dxc6 bxc6 Be2, White has an extra pawn and a good game. Don't try to hold onto d5 at all costs — just develop and convert the material advantage.",
        },
        {
          san: 'c6',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black challenges White's d5 pawn with c6.",
        },
        {
          san: 'dxc6',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Capture on c6, creating the pawn chain White wants.",
        },
        {
          san: 'bxc6',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black recaptures on c6.",
        },
        {
          san: 'Be2',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop and consolidate. White is a pawn up with a solid position.",
          strategicNote:
            "After Be2, develop normally: O-O, d3 or d4, and convert the extra pawn in the endgame. The Fried Liver line gave White a tangible advantage without needing to sacrifice anything.",
        },
      ],
    },
  ],
};
