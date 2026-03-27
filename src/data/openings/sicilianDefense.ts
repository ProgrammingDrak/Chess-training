import type { Opening } from '../../types';

// Sicilian Defense — practiced from White's perspective
// Setup: 1.e4 c5 — all lines begin here
// Lines ordered: best Black play → worst/most-amateur Black play
export const sicilianDefense: Opening = {
  id: 'sicilian-defense',
  name: 'Sicilian Defense',
  eco: 'B20–B99',
  learnerColor: 'white',
  description:
    "The most popular response to 1.e4. Black fights for the center asymmetrically with 1…c5, avoiding 1…e5 symmetry and aiming for counterplay. As White, you need to understand both the Open Sicilian (2.Nf3 + 3.d4) and the various Anti-Sicilian options. The Sicilian leads to the sharpest, most complex positions in chess.",
  tags: ['sharp', 'dynamic', 'e4', 'counterattack'],
  setupMoves: ['e4', 'c5'],
  lines: [
    // ──────────────────────────────────────────────
    // 1. Najdorf Variation — sharpest and most theoretical
    // ──────────────────────────────────────────────
    {
      id: 'sicilian-najdorf',
      name: 'Sicilian Najdorf',
      opponentQuality: 'best',
      frequencyPercent: 25,
      summary:
        "The sharpest and most theoretical Sicilian. Black plays …a6 to prevent Nb5 and prepare …e5. Used by Fischer, Kasparov, and Carlsen. White must know the English Attack (Be3, f3, g4) or the classical Bg5 approach.",
      strategicTheme: 'Sharp tactics, queenside vs kingside attacks, pawn breaks',
      moves: [
        {
          san: 'Nf3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Development and center control. 2.Nf3 is the first step of the Open Sicilian — you intend 3.d4, opening the game for your well-developed pieces.",
          strategicNote:
            "The Open Sicilian (Nf3 + d4) is the most ambitious. White gets the bishop pair after cxd4 and attacks Black's king. The price: Black gets counterplay on the c-file.",
        },
        {
          san: 'Nc6',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black develops the knight, prepares to recapture on d4.",
        },
        {
          san: 'd4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Open the center! 3.d4 is the critical move — White sacrifices the d4 pawn temporarily to open lines for the pieces.",
          strategicNote:
            "After cxd4 Nxd4, you have the bishop pair and open lines. Black has the semi-open c-file. The game becomes double-edged and tactical.",
        },
        {
          san: 'cxd4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black accepts the center. Now White recaptures with the knight.",
        },
        {
          san: 'Nxd4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Recapture with the knight. Excellent square for the knight and it maintains the center.",
        },
        {
          san: 'a6',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "The Najdorf! …a6 prevents Nb5 and prepares …e5 to kick the Nd4 and fight for the center.",
        },
        {
          san: 'Be3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "The English Attack! Develop the bishop and prepare f3, g4 — White launches a kingside attack. This is currently the most popular White approach.",
          strategicNote:
            "The English Attack plan: Be3, f3, Qd2, O-O-O, g4, g5. You castle queenside and storm the kingside. Black will castle queenside too and there's a race. Very sharp!",
        },
        {
          san: 'e5',
          isLearnerMove: false,
          quality: 'good',
          explanation:
            "Black plays …e5, the typical Najdorf move, kicking the Nd4 and grabbing space.",
        },
        {
          san: 'Nb3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Retreat the knight to b3. From b3 it eyes d4 and c5 and doesn't block your pieces. This is the main continuation.",
          strategicNote:
            "After Nb3, continue with f3, Qd2, O-O-O and launch the kingside attack. Black will counterattack with …b5–b4. The position is razor sharp — whoever attacks faster wins!",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 2. Dragon Variation — fianchetto system
    // ──────────────────────────────────────────────
    {
      id: 'sicilian-dragon',
      name: 'Sicilian Dragon',
      opponentQuality: 'excellent',
      frequencyPercent: 10,
      summary:
        "Black fianchettoes the bishop to g7, creating a powerful battery. White must know the Yugoslav Attack (Be3, f3, Qd2, O-O-O, h4–h5) which leads to one of the most analyzed attacking positions in all of chess.",
      strategicTheme: 'Yugoslav Attack, opposite-side castling, opposite attacks',
      moves: [
        {
          san: 'Nf3',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Open Sicilian. Prepare to open the center with d4.",
        },
        {
          san: 'Nc6',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Natural development.",
        },
        {
          san: 'd4',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Open the center — the key move in the Open Sicilian.",
        },
        {
          san: 'cxd4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black recaptures.",
        },
        {
          san: 'Nxd4',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Recapture with the knight. Perfect central square.",
        },
        {
          san: 'g6',
          isLearnerMove: false,
          quality: 'excellent',
          explanation:
            "The Dragon! Black prepares to fianchetto the bishop to g7, where it will dominate the long diagonal.",
        },
        {
          san: 'Be3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "The Yugoslav Attack begins! Develop the bishop and prepare f3, Qd2, O-O-O.",
          strategicNote:
            "The Yugoslav Attack is the sharpest response to the Dragon. Do NOT castle kingside — always go queenside and attack with h4–h5.",
        },
        {
          san: 'Bg7',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black completes the fianchetto. The g7-bishop is a monster.",
        },
        {
          san: 'f3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Prevent …Ng4 attacking your bishop and prepare g4. The Yugoslav Attack blueprint: Be3, f3, Qd2, O-O-O, g4, h4–h5.",
          strategicNote:
            "After f3, the plan is Qd2, O-O-O, g4, h4–h5–h6. You're attacking on the h-file while Black uses the c-file and open center. The person who delivers checkmate first wins. NEVER play Bc4 — it gets hit by …d5.",
        },
        {
          san: 'Nf6',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black develops the knight, clearing g8 and preparing to castle.",
        },
        {
          san: 'Qd2',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Prepare to castle queenside. The queen connects your rooks and prepares Bc4 or Bh6 ideas.",
          strategicNote:
            "After O-O-O, the attack begins: g4, h4, h5, h6 — or Bh6 to exchange the Dragon bishop. Without the g7-bishop, Black's attack collapses. Keep pressing!",
        },
        {
          san: 'O-O',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black castles kingside, walking into your attack.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 3. Scheveningen — classic, solid setup
    // ──────────────────────────────────────────────
    {
      id: 'sicilian-scheveningen',
      name: 'Scheveningen Variation',
      opponentQuality: 'excellent',
      frequencyPercent: 8,
      summary:
        "Black plays both …e6 and …d6, creating a very solid but slightly passive setup. The Keres Attack (g4!) is White's most aggressive weapon. This line was Kasparov's specialty as Black.",
      strategicTheme: 'Keres Attack, space advantage, restraining …d5',
      moves: [
        {
          san: 'Nf3',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Open Sicilian setup.",
        },
        {
          san: 'e6',
          isLearnerMove: false,
          quality: 'excellent',
          explanation:
            "Black signals the Scheveningen or Kan. They'll complete with …d6 and develop the kingside.",
        },
        {
          san: 'd4',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Open the center.",
        },
        {
          san: 'cxd4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black recaptures.",
        },
        {
          san: 'Nxd4',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Recapture and dominate the center.",
        },
        {
          san: 'Nf6',
          isLearnerMove: false,
          quality: 'excellent',
          explanation: "Develop the kingside knight — Black will castle short and use the f6 knight actively.",
        },
        {
          san: 'g4',
          isLearnerMove: true,
          quality: 'excellent',
          explanation:
            "The Keres Attack! Immediate aggression — White pushes g4 before Black can play …d6. This is the most challenging and aggressive response.",
          strategicNote:
            "The Keres Attack gains space and prevents Black from getting comfortable. After g5, the knight on f6 must retreat. White then plays Bg2, Qe2, O-O-O and attacks. Very sharp!",
        },
        {
          san: 'd6',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "Black completes the Scheveningen setup. The …d6–e6 pawn wall is solid.",
        },
        {
          san: 'g5',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Push the g-pawn! Gain space and force Black's knight to move. This is an aggressive pawn storm.",
          strategicNote:
            "After g5, the Nf6 is displaced. Black might try …h6 or let the knight go to d7. Either way, White has space and attacking chances. Continue with Bg2, h4, and O-O-O.",
        },
        {
          san: 'Nfd7',
          isLearnerMove: false,
          quality: 'best',
          explanation: "The knight retreats to d7 rather than being captured.",
        },
        {
          san: 'Be3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the bishop. Your attack is taking shape: g5 space, bishop developed, now Qd2 and O-O-O.",
          strategicNote:
            "The plan: Qd2, O-O-O, Bg2, h4, h5. You have a massive kingside space advantage. Black will castle queenside and try to break with …b5–b4. A real battle!",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 4. Kan / Taimanov — flexible Black setup
    // ──────────────────────────────────────────────
    {
      id: 'sicilian-kan',
      name: 'Kan / Taimanov Variation',
      opponentQuality: 'good',
      frequencyPercent: 12,
      summary:
        "Black plays …a6 and …e6, keeping maximum flexibility. Common at the club level — Black avoids theory but also avoids commitments. White should play actively and not let Black equalize too easily.",
      strategicTheme: 'Space advantage, active development, f4–f5 attack',
      moves: [
        {
          san: 'Nf3',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Open Sicilian.",
        },
        {
          san: 'e6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black goes for the flexible Kan/Taimanov setup.",
        },
        {
          san: 'd4',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Open the center.",
        },
        {
          san: 'cxd4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black recaptures.",
        },
        {
          san: 'Nxd4',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Central knight.",
        },
        {
          san: 'a6',
          isLearnerMove: false,
          quality: 'good',
          explanation:
            "The Kan! Black prevents Nb5 and keeps options open. Flexible but slightly passive.",
        },
        {
          san: 'Nc3',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Develop and prepare for a central attack.",
        },
        {
          san: 'Qc7',
          isLearnerMove: false,
          quality: 'good',
          explanation:
            "Black centralizes the queen on c7, a typical Kan/Taimanov square. Eyeing c4 and preparing …Nf6.",
        },
        {
          san: 'Bd3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the bishop to its most active square, preparing O-O and then f4.",
          strategicNote:
            "After Bd3, O-O, and f4, White has a strong kingside attack brewing. The f4–f5 break is key: it opens lines toward the king. Black has no real counterplay in this structure.",
        },
        {
          san: 'Nf6',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black develops the knight and prepares to castle.",
        },
        {
          san: 'O-O',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Castle and prepare the attack. Your next moves: f4, and then f5 or Kh1 + f5.",
          strategicNote:
            "After O-O, play f4 immediately. The f4–f5 attack is very dangerous. Black's position is solid but passive — you have more space and better pieces.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 5. Grand Prix Attack — Anti-Sicilian, club favorite
    // ──────────────────────────────────────────────
    {
      id: 'sicilian-grand-prix',
      name: 'Grand Prix Attack',
      opponentQuality: 'best',
      frequencyPercent: 8,
      summary:
        "An Anti-Sicilian where White plays Nc3, f4, and Nf3, avoiding all the Open Sicilian theory. Very popular at the club level and even among GMs. A dangerous attack based on f4–f5 pressure.",
      strategicTheme: 'f4–f5 attack, Bc4 or Bb5 setups, avoiding Open Sicilian theory',
      moves: [
        {
          san: 'Nc3',
          isLearnerMove: true,
          quality: 'excellent',
          explanation:
            "The Grand Prix Attack setup! Instead of 2.Nf3, White plays 2.Nc3 and follows with f4. This avoids all the complex Open Sicilian theory.",
          strategicNote:
            "The Grand Prix Attack is perfect if you want to avoid memorizing tons of Sicilian theory. Plan: Nc3, f4, Nf3, Bc4 or Bb5. Attack with f4–f5.",
        },
        {
          san: 'Nc6',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black's most natural response — develop and fight for the center.",
        },
        {
          san: 'f4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "The defining move of the Grand Prix Attack! Immediately advance the f-pawn to claim kingside space.",
          strategicNote:
            "The f4–f5 pawn advance is your main weapon. If Black doesn't react, you push f5, open lines, and attack. Very dangerous in practice.",
        },
        {
          san: 'e6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black tries to restrain the f-pawn advance.",
        },
        {
          san: 'Nf3',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Develop the knight. Prepare Be2 or Bc4.",
        },
        {
          san: 'd5',
          isLearnerMove: false,
          quality: 'best',
          explanation:
            "Black strikes back in the center with …d5. This is the critical challenge to the Grand Prix Attack.",
        },
        {
          san: 'Bb5',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Pin the Nc6 and create pressure. After exd5 Black recaptures and the position is complex but White has no weaknesses.",
          strategicNote:
            "The Bb5 pin is awkward for Black. If …dxe4, you play Nxe4 and have strong central control. If …a6, Bxc6+ bxc6 and you've damaged Black's pawn structure. Good practical chances.",
        },
        {
          san: 'dxe4',
          isLearnerMove: false,
          quality: 'playable',
          explanation: "Black captures in the center.",
        },
        {
          san: 'Nxe4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Recapture with the knight. You have excellent central control, and the position is roughly equal but with great attacking chances on the kingside.",
          strategicNote:
            "Your position is solid and active. Castle, develop your bishop, and launch the kingside attack. Black's position looks fine but your pieces have more space to maneuver.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 6. Black plays 2…d6 — Pirč-like, passive
    // ──────────────────────────────────────────────
    {
      id: 'sicilian-d6-passive',
      name: 'Sicilian — Early …d6 (Club Level Passive Setup)',
      opponentQuality: 'playable',
      frequencyPercent: 10,
      summary:
        "Many club players play 1…c5 and then just develop normally with …d6, …g6 or …e6 without specific theory. As White, you should play energetically — take lots of space with d4, Nc3, Bc4, and attack.",
      strategicTheme: 'Space dominance, fast attack, bishop pair advantage',
      moves: [
        {
          san: 'Nf3',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Standard Open Sicilian setup.",
        },
        {
          san: 'd6',
          isLearnerMove: false,
          quality: 'playable',
          explanation: "Black plays …d6 passively without establishing the Sicilian knight on c6 first.",
        },
        {
          san: 'd4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Open the center immediately! Don't let Black get comfortable.",
        },
        {
          san: 'cxd4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black recaptures.",
        },
        {
          san: 'Nxd4',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Recapture and dominate the center.",
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
          explanation: "Develop. Control the center and prepare f3 or Bc4.",
        },
        {
          san: 'g6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black aims for the Dragon setup. Now you're in Dragon territory.",
        },
        {
          san: 'Bc4',
          isLearnerMove: true,
          quality: 'excellent',
          explanation:
            "Play Bc4 — the Fischer Sozin Attack! The bishop aims at f7 and creates immediate threats. This is more dangerous against a Dragon setup than Be2.",
          strategicNote:
            "With Bc4, the bishop aims at f7 creating tactical threats. Black must be careful about …Nxe4 tricks. Continue with Be3, f3, Qd2 — the same plan as the Yugoslav Attack.",
        },
        {
          san: 'Bg7',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black completes the fianchetto.",
        },
        {
          san: 'Be3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Protect the bishop and set up the attacking formation. Now f3, Qd2, O-O-O is your plan — identical to the Yugoslav Attack but with the bishop pair and pressure on f7.",
          strategicNote:
            "You're now in a very strong position. The Bc4 is more aggressive than Be2. Continue the Yugoslav Attack plan and Black will have a very difficult position.",
        },
      ],
    },
  ],
};
