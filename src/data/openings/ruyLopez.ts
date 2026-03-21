import type { Opening } from '../../types';

// Ruy Lopez (Spanish Game) — practiced from White's perspective
// Setup: 1.e4 e5 2.Nf3 Nc6 3.Bb5 — all lines begin here
export const ruyLopez: Opening = {
  id: 'ruy-lopez',
  name: 'Ruy Lopez (Spanish Game)',
  eco: 'C60–C99',
  learnerColor: 'white',
  description:
    "The most classical and prestigious 1.e4 opening. By playing Bb5, White pins the knight that defends e5. White doesn't win the pawn immediately but creates long-term pressure. This opening has been used in virtually every World Chess Championship match.",
  tags: ['classical', 'positional', 'long-term pressure', 'e4'],
  setupMoves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
  lines: [
    // ──────────────────────────────────────────────
    // 1. Morphy Defense — the main line
    // ──────────────────────────────────────────────
    {
      id: 'ruy-morphy',
      name: 'Morphy Defense — Main Line',
      opponentQuality: 'best',
      frequencyPercent: 55,
      summary:
        "Black plays 3…a6, attacking the bishop. After 4.Ba4, Black can capture on e4 (Open Spanish) or develop normally. The main line continues with …Nf6, …Be7, O-O — the Closed Spanish, one of the most profound positions in chess.",
      strategicTheme: 'Long-term pressure on e5, Rook on e1, d4 break, king attack',
      moves: [
        {
          san: 'a6',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "The Morphy Defense! Black attacks the bishop, forcing it to declare its intentions. The most popular and theoretically sound response.",
        },
        {
          san: 'Ba4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Retreat the bishop to a4, keeping the pin on Nc6. Don't trade the bishop for the knight — you want to keep the long-term pressure on e5.",
          strategicNote:
            "The Ba4 retreat maintains the pressure. If Black tries …b5, you'll play Bb3 and the bishop is safe on b3, still eyeing f7. Don't rush to play Ba4 then trade — patience is key.",
        },
        {
          san: 'Nf6',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "Black attacks e4! Natural development. Now you can't simply castle without addressing the threat.",
        },
        {
          san: 'O-O',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Castle and welcome the complications! If Black takes on e4, the Open Spanish arises — White gets great compensation with Re1 and d4.",
          strategicNote:
            "After O-O, if Black plays …Nxe4 (the Open Spanish), play Re1 d4 and the position is very sharp but fine for White. If Black plays …Be7 (Closed Spanish), continue with Re1, Bb3, c3, d4.",
        },
        {
          san: 'Be7',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "Black chooses the Closed Spanish — solid development and prepares to castle.",
        },
        {
          san: 'Re1',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Put the rook on e1, supporting the e4 pawn and preparing the d4 break.",
          strategicNote:
            "Re1 is a key Ruy Lopez move — the rook belongs on e1 to support the center. Now Bb3 and c3 will follow, and then d4. A long, strategic battle lies ahead.",
        },
        {
          san: 'b5',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black chases the bishop with b5, gaining queenside space.",
        },
        {
          san: 'Bb3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Retreat to b3 — excellent square! The bishop is safe and still eyes the d5 and f7 squares.",
          strategicNote:
            "The Bb3 bishop is a long-term asset. It will become very powerful once you break with d4. Don't trade it without good reason.",
        },
        {
          san: 'O-O',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black castles. Now the real Ruy Lopez battle begins.",
        },
        {
          san: 'c3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Prepare d4! The c3–d4 advance is the central plan of the Ruy Lopez.",
          strategicNote:
            "After c3 and d4, the position explodes into tactical complications — or stays positional. Either way, White has a small but lasting advantage. The Ruy Lopez is a marathon, not a sprint.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 2. Berlin Defense — the 'Berlin Wall'
    // ──────────────────────────────────────────────
    {
      id: 'ruy-berlin',
      name: 'Berlin Defense — The Berlin Wall',
      opponentQuality: 'best',
      frequencyPercent: 20,
      summary:
        "Black plays 3…Nf6 and after 4.O-O Nxe4, trades knights. The endgame that follows (the Berlin Endgame) is very drawish but requires precise play. Vladimir Kramnik used this to beat Kasparov in 2000.",
      strategicTheme: 'Endgame technique, rook activity, queenside pawns',
      moves: [
        {
          san: 'Nf6',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "The Berlin Defense! Black attacks e4 directly. A very solid and respected defense — used by many top players to draw with Black.",
        },
        {
          san: 'O-O',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Castle and invite the complications. The Berlin is fine for White — you get a small edge in the endgame.",
          strategicNote:
            "After O-O, if Black plays …Nxe4, you enter the Berlin Endgame. If Black plays …a6 (Morphy-Berlin hybrid), treat it like a normal Ruy Lopez. The endgame is slightly better for White.",
        },
        {
          san: 'Nxe4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black captures the pawn — the Berlin Endgame begins.",
        },
        {
          san: 'd4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "The key move! Attack the Ne4 with d4. This begins the sequence leading to the Berlin Endgame.",
        },
        {
          san: 'Nd6',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "Black retreats the knight to d6, attacking your bishop and preparing to develop.",
        },
        {
          san: 'Bxc6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Trade bishop for knight, doubling Black's pawns. This gives you an endgame advantage — a good pawn structure vs. Black's doubled pawns on c6.",
          strategicNote:
            "After Bxc6 dxc6 dxe5 Nf5, queens come off and the endgame begins. White has better pawn structure — single c-file pawns vs. Black's doubled c-pawns. Very technical but winnable.",
        },
        {
          san: 'dxc6',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black recaptures, creating doubled c-pawns.",
        },
        {
          san: 'dxe5',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Capture the e5 pawn, exposing the queen.",
        },
        {
          san: 'Nf5',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black attacks the queen and prepares to force the queen trade.",
        },
        {
          san: 'Qxd8+',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Trade queens! Enter the Berlin Endgame. White has a small but real advantage due to better pawn structure.",
          strategicNote:
            "After the queen trade, the position looks equal but White has a subtle edge: better pawn structure and the active rook. The technique is to use your rooks and king actively. A long endgame — but you're slightly better.",
        },
        {
          san: 'Kxd8',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black recaptures with the king — now in the endgame.",
        },
        {
          san: 'Nc3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the knight and start activating your pieces. The endgame is very technical — use your king actively and target the weak c6/c7 pawns.",
          strategicNote:
            "In the Berlin Endgame, activate your king quickly (go to e3, d4), use your rooks to attack the c-pawns, and convert the pawn structure advantage. Don't rush — this endgame requires patience.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 3. Steinitz Defense — passive and slightly inferior
    // ──────────────────────────────────────────────
    {
      id: 'ruy-steinitz',
      name: 'Steinitz Defense — …d6',
      opponentQuality: 'good',
      frequencyPercent: 5,
      summary:
        "Black plays 3…d6, a passive but solid defense. White should play d4 immediately to exploit the passive setup and gain a strong center. Very common at the club level.",
      strategicTheme: 'Strong center, space advantage, bishop pair',
      moves: [
        {
          san: 'd6',
          isLearnerMove: false,
          quality: 'good',
          explanation:
            "The Steinitz Defense — passive but solid. Black supports e5 with a pawn. White should take space immediately.",
        },
        {
          san: 'd4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Strike the center immediately! Against passive play, d4 is always the right answer.",
          strategicNote:
            "After d4, if Black plays exd4, you recapture and have a beautiful center. If Black holds with …Bd7, just continue developing. You have a very comfortable game.",
        },
        {
          san: 'Bd7',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black develops the bishop, keeping the tension.",
        },
        {
          san: 'c3',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Prepare the d4 break and support the center.",
        },
        {
          san: 'Nf6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black develops and attacks e4.",
        },
        {
          san: 'O-O',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Castle and prepare the attack.",
        },
        {
          san: 'Be7',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black develops and prepares to castle.",
        },
        {
          san: 'Re1',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Support the center and prepare the d4 break.",
        },
        {
          san: 'O-O',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black castles.",
        },
        {
          san: 'Nbd2',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the queenside knight to d2 (not c3 which would block the c-pawn) and prepare Nf1–g3 or Nf1–e3.",
          strategicNote:
            "After Nbd2, you have a very comfortable position: Re1, c3, d4 break ready. Black's passive setup gives you a clear space advantage. Play: d4, exd4 cxd4 — powerful center.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 4. Classical Defense — …Bc5
    // ──────────────────────────────────────────────
    {
      id: 'ruy-classical',
      name: 'Classical Defense — …Bc5',
      opponentQuality: 'good',
      frequencyPercent: 5,
      summary:
        "Black plays 3…Bc5, developing the bishop actively and fighting for e4. White can try c3+d4 for a center battle, or play more quietly. A sharp and complex response.",
      strategicTheme: 'Center battle, bishop pair, tactical play',
      moves: [
        {
          san: 'Bc5',
          isLearnerMove: false,
          quality: 'good',
          explanation:
            "The Classical Defense! Black develops the bishop actively to c5, aiming at f2.",
        },
        {
          san: 'c3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Prepare d4 — fight for the center. Against 3…Bc5, the c3+d4 plan is the sharpest.",
          strategicNote:
            "After c3, you'll play d4 next and the position becomes very tactical. Black's bishop on c5 looks active but may be misplaced after d4 exd4 cxd4 Bb4+ Nc3.",
        },
        {
          san: 'Nf6',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black develops and attacks e4.",
        },
        {
          san: 'd4',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Strike the center!",
        },
        {
          san: 'exd4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black recaptures.",
        },
        {
          san: 'cxd4',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Recapture with the c-pawn — strong center.",
        },
        {
          san: 'Bb4+',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black checks with the bishop, creating complications.",
        },
        {
          san: 'Nc3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Block the check with the knight. After …Bxc3+ bxc3, White has the bishop pair and strong center.",
          strategicNote:
            "After Nc3 Bxc3+ bxc3, White's pawn structure is slightly damaged but the bishop pair and strong center more than compensate. Play: O-O, Bg5, e5 to gain more space.",
        },
        {
          san: 'Bxc3',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black captures the knight, giving White the bishop pair.",
        },
        {
          san: 'bxc3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Recapture and accept the bishop pair. White's position is excellent despite the doubled pawns.",
          strategicNote:
            "After bxc3, castle and play Bg5, then e5 to gain space. The bishop pair in an open position is worth the slightly damaged pawn structure. White is better.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 5. Bird's Defense — 3…Nd4 (Unusual, tricky)
    // ──────────────────────────────────────────────
    {
      id: 'ruy-bird',
      name: "Bird's Defense — 3…Nd4",
      opponentQuality: 'playable',
      frequencyPercent: 2,
      summary:
        "Black plays the unusual 3…Nd4, attacking the bishop and e2 pawn. This looks aggressive but is objectively dubious. White should NOT trade with Nxe5 immediately (it falls into a trap) but simply develop.",
      strategicTheme: 'Avoid traps, simple development, material advantage',
      moves: [
        {
          san: 'Nd4',
          isLearnerMove: false,
          quality: 'playable',
          explanation:
            "Bird's Defense! Black attacks the bishop and the e2 pawn. Tricky but objectively dubious. Be careful of tricks!",
        },
        {
          san: 'Nxd4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Capture the knight immediately! Don't be greedy with Nxe5 (which drops the bishop after …Qg5). Just take the knight.",
          strategicNote:
            "DO NOT play Nxe5?? — Black plays …Qg5 attacking both the Bb5 and Ne5, winning material! Instead, Nxd4 exd4 O-O is simple and good for White.",
        },
        {
          san: 'exd4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black recaptures with the e-pawn.",
        },
        {
          san: 'O-O',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Castle! You have a solid position with extra space. Just develop naturally.",
        },
        {
          san: 'c6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black attacks the bishop.",
        },
        {
          san: 'Ba4',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Retreat the bishop safely to a4.",
        },
        {
          san: 'Nf6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black develops.",
        },
        {
          san: 'd3',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Solidify the center and prepare to develop the bishop.",
        },
        {
          san: 'Bd6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black develops the bishop.",
        },
        {
          san: 'Nc3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop and control the center. White has a comfortable advantage with better pawn structure and development.",
          strategicNote:
            "After Nc3, you have a very comfortable position. Black's Bird's Defense gave you no real problems — just develop naturally and convert your structural advantage in the middlegame.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 6. Schliemann Defense — aggressive 3…f5
    // ──────────────────────────────────────────────
    {
      id: 'ruy-schliemann',
      name: 'Schliemann Defense — 3…f5 (Aggressive and Dubious)',
      opponentQuality: 'dubious',
      frequencyPercent: 2,
      summary:
        "Black plays the aggressive 3…f5, counter-attacking in the center. Objectively dubious but creates chaos in practice. White should play Nc3 to challenge the f5–e4 pawn chain.",
      strategicTheme: 'Refuting aggressive play, simplification, material advantage',
      moves: [
        {
          san: 'f5',
          isLearnerMove: false,
          quality: 'dubious',
          explanation:
            "The Schliemann Defense! Black plays aggressively, counter-attacking e4 with f5. This looks very forcing but is dubious with correct White play.",
        },
        {
          san: 'Nc3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "The best response! Develop the knight and challenge the f5–e4 pawn chain. Don't be tempted by d4 or other pawn moves.",
          strategicNote:
            "After Nc3, if Black plays exf4, you play d4 and gain a strong center. If Black plays fxe4, you play Nxe4 and Black's position is very difficult. Stay principled — development beats aggression.",
        },
        {
          san: 'fxe4',
          isLearnerMove: false,
          quality: 'playable',
          explanation: "Black captures on e4, trying to hold the extra pawn.",
        },
        {
          san: 'Nxe4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Recapture with the knight. You now have excellent central control and the initiative.",
        },
        {
          san: 'd5',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black pushes d5, trying to challenge your center.",
        },
        {
          san: 'Nxe5',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Capture the e5 pawn with the knight — you win material and have the initiative.",
        },
        {
          san: 'Nf6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black develops and attacks your knight.",
        },
        {
          san: 'Nxf6+',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Trade knight for knight, maintaining the material advantage.",
          strategicNote:
            "After Nxf6+ gxf6, White has an extra pawn and Black has a weakened king position. Develop normally: O-O, d4, and convert the material advantage. The Schliemann gets refuted with principled play.",
        },
        {
          san: 'gxf6',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black recaptures, creating doubled and isolated f-pawns.",
        },
        {
          san: 'd4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Expand in the center. You're up material with a great position. Just develop and convert.",
          strategicNote:
            "After d4, you have a clear extra pawn and better structure. Castle and develop your remaining pieces. Black's aggressive Schliemann has been refuted by principled play.",
        },
      ],
    },
  ],
};
