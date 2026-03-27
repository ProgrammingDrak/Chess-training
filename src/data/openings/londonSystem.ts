import type { Opening } from '../../types';

// London System — practiced from White's perspective
// Setup: 1.d4 d5 2.Nf3 Nf6 3.Bf4 — all lines begin here (Black to move)
export const londonSystem: Opening = {
  id: 'london-system',
  name: 'London System',
  eco: 'D02–D05',
  learnerColor: 'white',
  description:
    "The London System is White's ultimate setup opening — play d4, Nf3, Bf4 regardless of Black's response. Extremely popular at all levels due to its reliability. You develop your pieces to their natural squares with minimal theory.",
  tags: ['systematic', 'solid', 'positional', 'd4', 'setup'],
  setupMoves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'],
  lines: [
    // ──────────────────────────────────────────────
    // 1. Classical Approach — Black plays e6
    // ──────────────────────────────────────────────
    {
      id: 'london-classical',
      name: 'Classical Approach (3...e6)',
      opponentQuality: 'best',
      frequencyPercent: 35,
      summary:
        "Black solidifies the center with e6. White completes the London setup with e3, then handles the bishop challenge on d6 and prepares for central tension with c3+d4.",
      strategicTheme: 'Solid center with e3+c3, bishop pair, central tension',
      moves: [
        {
          san: 'e6',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black solidifies the center with e6, preparing to develop the kingside naturally.",
        },
        {
          san: 'e3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Solidify the center. The London bishop on f4 is now safe — e3 locks the pawn chain and prepares Bd3 and Nbd2.",
          strategicNote:
            "e3 is the cornerstone of the London System. It keeps the structure solid, allows Bd3 to challenge Black's pieces, and avoids any tactics on the bishop. Your plan: Bd3, Nbd2, O-O, then c3 and push for central play.",
        },
        {
          san: 'Bd6',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black challenges the bishop immediately, hoping to trade or force a concession.",
        },
        {
          san: 'Bg3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Preserve the bishop by retreating to g3. The bishop on g3 remains influential on the long diagonal and can trade favourably for the d6-bishop later.",
          strategicNote:
            "Bg3 keeps the bishop active and avoids giving Black an easy trade. From g3 the bishop controls the h2–b8 diagonal. You can later engineer Bxd6 at a moment of your choosing.",
        },
        {
          san: 'O-O',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black castles for king safety.",
        },
        {
          san: 'Nbd2',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Flexible knight development. Nbd2 keeps c3 available for a pawn, supports e4, and avoids blocking the c-pawn.",
          strategicNote:
            "Nbd2 is the London knight's ideal square — it supports the e4 advance and can reroute to f1–e3 or b3. Avoid Nc3 here; it blocks the c3 pawn push that you need to fight for the center.",
        },
        {
          san: 'c5',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black counterattacks in the center, the most principled response.",
        },
        {
          san: 'c3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Reinforce d4 against Black's c5 counterattack. c3 prepares Bd3, keeps the center stable, and sets up a future pawn advance.",
          strategicNote:
            "With c3, you have a rock-solid center. If Black plays cxd4 you recapture exd4 with a healthy pawn structure. The bishop on g3 and knight on d2 are both well-placed for the middlegame battle.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 2. Bishop Mirror — Black plays Bf5
    // ──────────────────────────────────────────────
    {
      id: 'london-bf5',
      name: 'Bishop Mirror (3...Bf5)',
      opponentQuality: 'good',
      frequencyPercent: 25,
      summary:
        "Black mirrors White's bishop development with Bf5. White responds with e3 and Bd3, forcing a favourable trade. After Bxd3 Qxd3 White has a centralised queen and a comfortable position.",
      strategicTheme: 'Forcing favourable bishop trade, centralised queen, active play',
      moves: [
        {
          san: 'Bf5',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black mirrors White's bishop development. A reasonable but slightly premature sortie.",
        },
        {
          san: 'e3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Solid center — prepare Bd3 to challenge Black's bishop directly. e3 secures the f4-bishop's future retreat square.",
        },
        {
          san: 'e6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black supports d5 and prepares kingside development.",
        },
        {
          san: 'Bd3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Challenge Black's bishop on f5 directly. The trade on d3 is favourable for White — you get the queen centralised and Black gives up the bishop pair.",
          strategicNote:
            "Bd3 is the key move in this variation. After Bxd3 Qxd3, White's queen is powerfully centralised and applies instant pressure on Black's position. The trade has freed your position.",
        },
        {
          san: 'Bxd3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black trades to simplify, giving White the open d-file with tempo.",
        },
        {
          san: 'Qxd3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Recapture with the queen, centralising it beautifully. The queen on d3 eyes h7 and supports a future e4 push.",
          strategicNote:
            "With Qxd3, your queen is active, your development is ahead, and Black has given up the bishop pair. Plan: Nbd2, O-O-O or O-O, and look to push e4 to open the position.",
        },
        {
          san: 'c6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black prepares queenside play with Qa5 or Nbd7.",
        },
        {
          san: 'O-O',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Complete development with king safety. Castle kingside and then target the center with c4 or Ne5.",
          strategicNote:
            "After O-O, your position is fully developed and harmonious. The queen on d3, bishop on f4, and knight on f3 form a well-coordinated force. Black's c6 structure is slightly passive.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 3. Slav Hybrid — Black plays c5 immediately
    // ──────────────────────────────────────────────
    {
      id: 'london-c5',
      name: 'Slav Hybrid (3...c5)',
      opponentQuality: 'good',
      frequencyPercent: 20,
      summary:
        "Black strikes the center immediately with c5. White maintains d4 with e3 and c3, then develops flexibly with Nbd2. The bishop retreats to g3 to challenge Black's active bishop on d6.",
      strategicTheme: 'Holding d4, flexible knight on d2, bishop activity on g3',
      moves: [
        {
          san: 'c5',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black strikes the center immediately, the most combative reply to the London.",
        },
        {
          san: 'e3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Hold d4 solidly. e3 is the London's backbone — it supports the pawn chain and prepares Bd3 and castling.",
        },
        {
          san: 'Nc6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black develops and maintains pressure on d4.",
        },
        {
          san: 'c3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Reinforce d4 against Black's central pressure. c3 makes d4 unassailable and prepares a stable pawn structure.",
          strategicNote:
            "With c3, you have a solid d4 pawn that Black cannot dislodge easily. The London's strength is exactly this — you build a reliable structure and then outplay your opponent piece by piece.",
        },
        {
          san: 'e6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black solidifies the center and prepares kingside development.",
        },
        {
          san: 'Nbd2',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Flexible development. Nbd2 prepares Be2 and O-O while keeping all options open. The knight can later go to f1–e3 or b3.",
        },
        {
          san: 'Bd6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black develops the bishop actively, challenging White's f4-bishop.",
        },
        {
          san: 'Bg3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Trade off Black's strong bishop. Bg3 invites Bxg3 hxg3, opening the h-file for White's rook and giving White the bishop pair.",
          strategicNote:
            "After Bg3 Bxg3 hxg3, White has the bishop pair and the open h-file. Black's center is solid but White has long-term pressure. Castle and target d5 or c5 weaknesses.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 4. KID Setup — Black fianchettoes with g6
    // ──────────────────────────────────────────────
    {
      id: 'london-aggressive',
      name: "Black Plays ...g6 (KID Setup)",
      opponentQuality: 'playable',
      frequencyPercent: 15,
      summary:
        "Black opts for a King's Indian structure with g6 and Bg7. White sticks to the London setup with e3, Be2, and castles. Then c3 holds the center and White keeps a slight edge with the bishop pair.",
      strategicTheme: 'Solid London vs fianchetto, bishop pair advantage, central grip',
      moves: [
        {
          san: 'g6',
          isLearnerMove: false,
          quality: 'playable',
          explanation: "Black opts for a King's Indian setup, planning to fianchetto the bishop.",
        },
        {
          san: 'e3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Maintain the solid London setup. e3 keeps the bishop on f4 safe and prepares Be2 and castling.",
        },
        {
          san: 'Bg7',
          isLearnerMove: false,
          quality: 'playable',
          explanation: "Black completes the fianchetto — the g7-bishop will pressure d4 long-term.",
        },
        {
          san: 'Be2',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop quietly and prepare castling. Be2 is solid and avoids any bishop tactics. The bishop is safe on e2 and supports the kingside.",
          strategicNote:
            "Be2 is the right choice against a fianchetto setup. You don't need the bishop on d3 here — Be2 simply completes development and gets you castled quickly.",
        },
        {
          san: 'O-O',
          isLearnerMove: false,
          quality: 'playable',
          explanation: "Black castles kingside, activating the g7-bishop's influence on d4.",
        },
        {
          san: 'O-O',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Castle for safety. Your king is secure and your position is solid and well-coordinated.",
        },
        {
          san: 'c5',
          isLearnerMove: false,
          quality: 'playable',
          explanation: "Black counterattacks in the center, the logical follow-up to the KID setup.",
        },
        {
          san: 'c3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Maintain the center with c3. White has a slight edge — the bishop pair and solid pawn structure outweigh Black's fianchetto pressure.",
          strategicNote:
            "With c3, d4 is rock-solid. Black's g7-bishop is powerful in theory but White's two bishops and spatial advantage are a lasting practical edge. Plan: Nbd2, Re1, and push e4 when the time is right.",
        },
      ],
    },
  ],
};
