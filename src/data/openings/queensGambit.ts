import type { Opening } from '../../types';

// Queen's Gambit — practiced from Black's perspective
// Setup: 1.d4 d5 2.c4 — all lines begin here
// Lines are ordered: best White play → worst/most-amateur White play
export const queensGambit: Opening = {
  id: 'queens-gambit',
  name: "Queen's Gambit",
  eco: 'D06–D69',
  learnerColor: 'black',
  description:
    "White offers a pawn sacrifice on move 2 to gain central control. One of the oldest and most respected openings in chess, played at the highest levels for over a century. As Black, your goal is to maintain the center, develop actively, and neutralize White's space advantage.",
  tags: ['classical', 'positional', 'd4', 'central control'],
  lines: [
    // ──────────────────────────────────────────────
    // 1. Orthodox QGD — best White play
    // ──────────────────────────────────────────────
    {
      id: 'qg-orthodox',
      name: "Queen's Gambit Declined — Orthodox Variation",
      opponentQuality: 'best',
      frequencyPercent: 32,
      summary:
        "Black declines the gambit with 2…e6, fortifying d5 with a pawn. White develops with maximum classical strength: Nc3, Bg5, e3, Nf3. This is the sharpest, most theoretically demanding line. Mastering it gives you a rock-solid foundation.",
      strategicTheme: 'Central tension, minority attack, kingside castling',
      moves: [
        {
          san: 'e6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Decline the gambit. 2…e6 solidifies d5 and opens the diagonal for your dark-squared bishop. The most classical and reliable response — used by world champions from Lasker to Carlsen.",
          strategicNote:
            "You're choosing solidity over dynamics. The pawn on d5 stays put, and you'll fight for equality by completing development and challenging White's center later with …c5.",
        },
        {
          san: 'Nc3',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "White develops the knight, eyes d5, and prepares e4. The most natural developing move.",
        },
        {
          san: 'Nf6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the knight to its best square, attacking e4 and preparing to castle. This is the mainline response — virtually mandatory.",
          strategicNote:
            "The knight on f6 is a key defensive piece that also eyes d5. Never rush …Be7 before developing the knight.",
        },
        {
          san: 'Bg5',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "White pins your knight against the queen and creates pressure on d5 indirectly. This is the Cambridge Springs and Orthodox tabiya.",
        },
        {
          san: 'Be7',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Unpinning the knight and preparing to castle. 4…Be7 is the solid, classical choice — you're not looking for complications yet, just safe development.",
          strategicNote:
            "4…Nbd7 is the Cambridge Springs setup. 4…Be7 is more solid. Both are excellent. Be7 says: I'll castle safely and fight later.",
        },
        {
          san: 'e3',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "White completes the bishop chain and prepares to develop the kingside. Solid and typical.",
        },
        {
          san: 'O-O',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Castle immediately! Your king is safe, your rook becomes active, and you're ready to meet any central challenges. King safety first.",
          strategicNote:
            "After castling, your plan is …Nbd7, …c6, and eventually …c5 to strike the center. White will often aim for a minority attack on the queenside (b4–b5xc6).",
        },
        {
          san: 'Nf3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White completes development, prepares to castle, and controls the center.",
        },
        {
          san: 'Nbd7',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the queenside knight to support the center. 7…Nbd7 is the classical move — the knight heads to f8 or supports …c6–c5.",
          strategicNote:
            "You now have a solid, complete setup. Typical plans: …c6 followed by …dxc4 and …c5, or …Re8 and …Nf8–e6 to challenge the bishop.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 2. Exchange QGD — White equalizes with a trade
    // ──────────────────────────────────────────────
    {
      id: 'qg-exchange',
      name: "Queen's Gambit Exchange Variation",
      opponentQuality: 'excellent',
      frequencyPercent: 14,
      summary:
        "White captures on d5 early, simplifying the position. This leads to an IQP (Isolated Queen Pawn) structure or a symmetrical pawn structure. White often uses the minority attack: pushing b4–b5 to create a weakness on c6.",
      strategicTheme: 'Minority attack, open c-file, piece activity',
      moves: [
        {
          san: 'e6',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Solid, classical. Decline the gambit and brace for White's exchange option.",
        },
        {
          san: 'cxd5',
          isLearnerMove: false,
          quality: 'excellent',
          explanation:
            "White releases central tension and goes for the Exchange Variation. This leads to a symmetrical pawn structure, but White gets the minority attack plan.",
        },
        {
          san: 'exd5',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Recapture with the pawn. This gives Black a symmetrical structure with no pawn weaknesses and excellent piece play. 3…exd5 is almost always best here.",
          strategicNote:
            "You now have an isolated pawn structure. White will push b4–b5 to attack your c-pawn. Counter this with active piece play, especially the c8-bishop and doubling rooks on the c-file.",
        },
        {
          san: 'Nc3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Developing and preparing for a kingside fianchetto or e3.",
        },
        {
          san: 'Nf6',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Develop the knight and control e4. Standard and strong.",
        },
        {
          san: 'Bf4',
          isLearnerMove: false,
          quality: 'excellent',
          explanation:
            "White develops the bishop outside the pawn chain — a hallmark of the London System / Exchange QGD setup. White eyes the c7 square.",
        },
        {
          san: 'Be7',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop and prepare to castle. Solid and good.",
          strategicNote:
            "Your dark-squared bishop should aim for f5 or g4 before it gets blocked. Consider …Bf5 if you have the chance.",
        },
        {
          san: 'e3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White solidifies and prepares to castle.",
        },
        {
          san: 'O-O',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Castle! King safety is the priority. You're now ready to fight back with …c6 and …Bf5.",
          strategicNote:
            "Plan: play …c6 to stop b5, develop your bishop actively to f5, and double rooks on the c-file. Watch for White's b4–b5 minority attack.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 3. Catalan Opening — White fianchettoes
    // ──────────────────────────────────────────────
    {
      id: 'qg-catalan',
      name: 'Catalan Opening',
      opponentQuality: 'excellent',
      frequencyPercent: 12,
      summary:
        "White plays g3 and Bg2, using the long diagonal to pressure d5 and the queenside. A very popular weapon at the top level. Black can accept the pawn (Open Catalan) or hold d5 (Closed Catalan). Both are playable.",
      strategicTheme: 'Long diagonal pressure, queenside space, bishop pair',
      moves: [
        {
          san: 'e6',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Standard QGD setup — flexible and ready for the Catalan.",
        },
        {
          san: 'g3',
          isLearnerMove: false,
          quality: 'excellent',
          explanation:
            "The Catalan! White fianchettoes the bishop to g2, where it will X-ray down the long diagonal at d5 and beyond.",
        },
        {
          san: 'Nf6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the knight. This is virtually mandatory in most QGD lines.",
        },
        {
          san: 'Bg2',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "Fianchettoed bishop points directly at d5. Now every capture on c4 will be recovered via this diagonal.",
        },
        {
          san: 'Be7',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Solid development. You can choose to capture on c4 (Open Catalan) or hold with …c6 (Closed Catalan). Either is playable.",
          strategicNote:
            "In the Open Catalan (…dxc4), Black temporarily holds the pawn but White recovers it with superior development. In the Closed Catalan (…c6), Black keeps the center solid.",
        },
        {
          san: 'Nf3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Development and center control.",
        },
        {
          san: 'O-O',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Castle first, always. King safety before anything. Now decide: Open or Closed Catalan?",
          strategicNote:
            "After castling, consider 7…dxc4 (Open Catalan) — Black takes the pawn and fights to hold it with …a6 and …b5. Or play 7…c6 (Closed) — solid, keeps the center intact.",
        },
        {
          san: 'O-O',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White castles. The position is now balanced but highly complex.",
        },
        {
          san: 'dxc4',
          isLearnerMove: true,
          quality: 'excellent',
          explanation:
            "Accept the pawn! The Open Catalan. Black grabs the pawn and will try to hold it with …a6 and …b5. White gets long-term pressure via the g2-bishop.",
          strategicNote:
            "The computer has shown that Black can actually hold this pawn with precise play. Main line: 8…a6 9.Qe2 b5 10.Rd1 Bb7. The pawn may fall anyway, but Black gets counterplay.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 4. Slav Defense — Black's most solid reply
    // ──────────────────────────────────────────────
    {
      id: 'slav-defense',
      name: 'Slav Defense',
      opponentQuality: 'best',
      frequencyPercent: 26,
      summary:
        "Instead of 2…e6, Black plays 2…c6 — supporting d5 without blocking the c8-bishop. This is Kasparov's favorite weapon and one of the most resilient defenses to 1.d4. Black keeps the bishop pair option open.",
      strategicTheme: 'Solid center, active bishop, counterattack with …Bg4 or …Bf5',
      moves: [
        {
          san: 'c6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "The Slav Defense! Support d5 with c6 instead of e6. Crucially, the c8-bishop is NOT blocked and can develop to f5 or g4. This is one of the most theoretically sound defenses.",
          strategicNote:
            "The Slav gives you: (1) solid d5 support, (2) the option of …Bf5 before playing …e6, (3) the Semi-Slav setup with …e6 later if needed. Very flexible.",
        },
        {
          san: 'Nf3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Natural development. White keeps options open.",
        },
        {
          san: 'Nf6',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Develop and control e4. Standard Slav move.",
        },
        {
          san: 'Nc3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Development. Now Black can accept the gambit.",
        },
        {
          san: 'dxc4',
          isLearnerMove: true,
          quality: 'excellent',
          explanation:
            "Accept the gambit! In the Slav, taking on c4 is safe because …c6 supports …b5 to hold the pawn. This is the Accepted Slav.",
          strategicNote:
            "After …dxc4, play …a6 and …b5 to hold the pawn, or simply …Bf5 to develop actively. You don't need to cling to the pawn — development matters more.",
        },
        {
          san: 'a4',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "White prevents …b5. Now Black must find another way to develop. This is the main line of the Accepted Slav.",
        },
        {
          san: 'Bf5',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the bishop to its best diagonal BEFORE playing …e6. This is the key point of the Slav — your light-squared bishop gets active before the e6 pawn blocks it.",
          strategicNote:
            "The bishop on f5 is beautifully placed. It develops actively, avoids being passive on d7 or e6. You've conceded the c4 pawn temporarily but your pieces are flying.",
        },
        {
          san: 'e3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White completes development and prepares Bxc4.",
        },
        {
          san: 'e6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Now play …e6 to fully develop. With the bishop already on f5, this pawn move doesn't trap it. You've achieved the Slav dream: solid center AND active bishop.",
          strategicNote:
            "You now have a great position: solid pawns, active bishops, and good piece coordination. White has a slight space advantage but nothing threatening. Castle next.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 5. QGA — Black accepts the gambit
    // ──────────────────────────────────────────────
    {
      id: 'qga',
      name: "Queen's Gambit Accepted",
      opponentQuality: 'best',
      frequencyPercent: 18,
      summary:
        "Black captures the c4 pawn with 2…dxc4. Unlike the King's Gambit, White does NOT get a powerful attack. Instead, Black uses the time White spends recovering the pawn to fight for the center with …c5 and …e5.",
      strategicTheme: 'Dynamic counterplay, central breaks with …c5 and …e5',
      moves: [
        {
          san: 'dxc4',
          isLearnerMove: true,
          quality: 'excellent',
          explanation:
            "Accept the gambit! Capture the pawn. White can always recover it, but the time spent doing so gives Black chances for active counterplay. Fully playable and dynamic.",
          strategicNote:
            "The point of QGA is NOT to hold the c4 pawn, but to use the time White spends recovering it. Focus on …e5 or …c5 to fight for the center.",
        },
        {
          san: 'Nf3',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "Natural development. White prepares e3 and Bxc4 to recover the pawn.",
        },
        {
          san: 'Nf6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop naturally. Attack e4 and set up for …e6 and …c5.",
        },
        {
          san: 'e3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White prepares to recapture on c4 with the bishop.",
        },
        {
          san: 'e6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Support the center. Now …c5 is the thematic break. Avoid rushing to hold c4 — let White have it.",
        },
        {
          san: 'Bxc4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White recaptures and now has the bishop pair and central presence.",
        },
        {
          san: 'c5',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Strike the center immediately! 5…c5 is the defining move of the QGA. You challenge White's d4 pawn and fight for central equality.",
          strategicNote:
            "After …c5, the game opens up quickly. If White plays d5, you get active piece play. If dxc5, recapture and you have a strong d5 square for your pieces. Equal and dynamic.",
        },
        {
          san: 'O-O',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "White castles, keeping pressure on the center with the well-placed bishop.",
        },
        {
          san: 'a6',
          isLearnerMove: true,
          quality: 'good',
          explanation:
            "A flexible move: prepares …b5 to kick the bishop and gain queenside space. Also useful if White plays Bb3.",
          strategicNote:
            "The plan is …b5, …Bb7, and either …cxd4 or holding the tension. Your pieces become very active on the queenside.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 6. Albin Countergambit — common amateur weapon
    // ──────────────────────────────────────────────
    {
      id: 'qg-albin',
      name: 'Albin Countergambit',
      opponentQuality: 'playable',
      frequencyPercent: 2,
      summary:
        "Black plays 2…e5, offering a pawn to immediately counterattack the center. Objectively dubious, but very tricky in practice — White must know the exact lines or can fall into a devastating trap (the Lasker trap on Nb5?).",
      strategicTheme: 'Aggressive counterplay, traps, initiative',
      moves: [
        {
          san: 'e5',
          isLearnerMove: true,
          quality: 'playable',
          explanation:
            "The Albin Countergambit! Black immediately fights back in the center. This is a surprise weapon — objectively fine for White with precise play, but very dangerous if White doesn't know the theory.",
          strategicNote:
            "The Albin is not recommended as your main weapon, but knowing it exists and how to play it against unprepared opponents is useful. The Lasker trap (3.dxe5 d4 4.e3? Bb4+! 5.Bd2 dxe3! 6.Bxb4?? exf2+!) wins material for Black.",
        },
        {
          san: 'dxe5',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "White accepts the gambit. Now Black must play precisely. 3.dxe5 is objectively best.",
        },
        {
          san: 'd4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Push the pawn forward! This is the point of the Albin — the d4 pawn becomes a powerful passed pawn that disrupts White's development.",
          strategicNote:
            "Your d4 pawn is now a thorn in White's position. White must deal with it carefully. If White plays 4.e3?, play 4…Bb4+! and after 5.Bd2 dxe3! 6.Bxb4?? exf2+! winning a rook (the Lasker trap).",
        },
        {
          san: 'Nf3',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "The correct response — develop and don't block the d-pawn's advance with e3.",
        },
        {
          san: 'Nc6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the knight to support the d4 pawn. Centralize your pieces and keep the pressure on.",
          strategicNote:
            "You want to develop quickly and use your d4 pawn as a battering ram. Play …Bg4 next to pin the Nf3 and increase pressure on d4.",
        },
        {
          san: 'g3',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "White prepares to fianchetto the bishop and put pressure on d4. This is the best plan.",
        },
        {
          san: 'Be6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the bishop and defend d4. Keep the pawn chain intact. Your position is active despite being objectively slightly worse.",
          strategicNote:
            "With …Be6, you protect d4, develop a piece, and maintain your active game. The practical chances are good, especially if White gets nervous and plays passively.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 7. White plays 3.Nf3 Nf6 4.e3 — quiet, solid
    // ──────────────────────────────────────────────
    {
      id: 'qg-quiet-e3',
      name: "Queen's Gambit — Quiet e3 System",
      opponentQuality: 'good',
      frequencyPercent: 8,
      summary:
        "White plays very solidly: Nf3, e3, Bd3 — no pins, no complications. This is a common club player approach. Black should play actively, strike with …c5, and not let White build a comfortable position.",
      strategicTheme: 'Active piece play, …c5 break, dynamic equality',
      moves: [
        {
          san: 'e6',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Standard QGD setup. Be ready to play dynamically against White's quiet system.",
        },
        {
          san: 'Nf3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Development. White's going for the quiet system.",
        },
        {
          san: 'Nf6',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Natural development. Control e4 and prepare to castle.",
        },
        {
          san: 'e3',
          isLearnerMove: false,
          quality: 'good',
          explanation:
            "White plays the quiet e3 system. No Bg5 pin, no complications — just solid development. Common among club players.",
        },
        {
          san: 'c5',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Strike the center immediately! Against quiet setups, …c5 is almost always the right thematic break. Challenge White's d4 pawn before they get too comfortable.",
          strategicNote:
            "With …c5, you fight for the center directly. If White plays dxc5, recapture with your bishop or pawn and you'll have no weaknesses. If White plays d5, you have a closed game with …e5 counterplay.",
        },
        {
          san: 'Bd3',
          isLearnerMove: false,
          quality: 'good',
          explanation: "White develops the bishop, ignoring the c5 challenge for now.",
        },
        {
          san: 'Nc6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the knight and maintain pressure on d4. If White plays dxc5 Bxc5, you'll have excellent development.",
        },
        {
          san: 'O-O',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White castles.",
        },
        {
          san: 'Be7',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop and prepare to castle. Your position is now very comfortable — White's quiet system gave you easy equality.",
          strategicNote:
            "You've achieved a great position. Castle next, then consider …cxd4 to open the position, or …b6 and …Bb7 for an active bishop. White's passive setup gives you no problems.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 8. White plays 3.Nc3 b6?! — amateur setup
    // ──────────────────────────────────────────────
    {
      id: 'qg-amateur-b6',
      name: 'White Plays Passively — Punishing …b6 Idea',
      opponentQuality: 'inaccuracy',
      frequencyPercent: 4,
      summary:
        "Sometimes White plays the opening moves correctly but then tries unusual ideas like Bf4 with e3 or slow maneuvering. Meanwhile, Black should play actively — grab space, develop the bishop pair, and open lines.",
      strategicTheme: 'Punishing passive play, central dominance, bishop pair',
      moves: [
        {
          san: 'e6',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Standard QGD setup.",
        },
        {
          san: 'Nc3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Normal development.",
        },
        {
          san: 'Nf6',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Develop naturally.",
        },
        {
          san: 'Bf4',
          isLearnerMove: false,
          quality: 'good',
          explanation:
            "White develops the bishop to f4 (London-ish). This is fine, but it tells you to play actively before White solidifies.",
        },
        {
          san: 'dxc4',
          isLearnerMove: true,
          quality: 'excellent',
          explanation:
            "Accept the pawn! When White plays Bf4 early, accepting the gambit is very strong because White can't play e4 easily. Take the pawn and keep it.",
          strategicNote:
            "After …dxc4, you can often hold the c4 pawn with …b5 or simply use the time to develop actively. White's Bf4 is slightly misplaced here.",
        },
        {
          san: 'e3',
          isLearnerMove: false,
          quality: 'good',
          explanation: "White prepares Bxc4.",
        },
        {
          san: 'c5',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Strike the center before White recovers the c4 pawn comfortably. This is the most active and principled response.",
          strategicNote:
            "Your c5 pawn breaks immediately challenge White's center. After …c5, you have an excellent game — active pieces and counterplay against d4.",
        },
        {
          san: 'Bxc4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White recovers the pawn.",
        },
        {
          san: 'a6',
          isLearnerMove: true,
          quality: 'good',
          explanation:
            "Prepare …b5 to gain queenside space and gain a tempo against the bishop. This is active and flexible play.",
          strategicNote:
            "After …a6 and …b5, you'll gain space on the queenside and potentially the bishop pair if White's bishop retreats. You're now playing for a win.",
        },
      ],
    },
  ],
};
