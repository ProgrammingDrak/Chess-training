import type { Opening } from '../../types';

// Caro-Kann Defense — practiced from Black's perspective
// Setup: 1.e4 c6 2.d4 d5 — all lines begin here (White to move)
export const caroKann: Opening = {
  id: 'caro-kann',
  name: 'Caro-Kann Defense',
  eco: 'B10–B19',
  learnerColor: 'black',
  description:
    "The Caro-Kann is one of the most solid defenses to 1.e4. Black plays 1...c6 to support the central advance 2...d5. Unlike the French, Black's light-squared bishop is not locked in — it gets developed before the pawns close the position. A favorite of world champions Petrosian, Karpov, and Short.",
  tags: ['solid', 'classical', 'e4', 'positional', 'structural'],
  setupMoves: ['e4', 'c6', 'd4', 'd5'],
  lines: [
    // ──────────────────────────────────────────────
    // 1. Advance Variation — White plays e5
    // ──────────────────────────────────────────────
    {
      id: 'caro-advance',
      name: 'Advance Variation (3.e5)',
      opponentQuality: 'best',
      frequencyPercent: 30,
      summary:
        "White grabs space with e5. Black's key move is Bf5, developing the light-squared bishop before the pawns close — the defining advantage of the Caro-Kann over the French. Then Black counterattacks with c5 and develops with Nc6.",
      strategicTheme: 'Develop bishop with Bf5 before pawn chain closes, counterattack with c5',
      moves: [
        {
          san: 'e5',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White grabs space with the advance — the Advance Variation.",
        },
        {
          san: 'Bf5',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the light-squared bishop before the pawns close! This is the key Caro-Kann advantage — the bishop gets active before being locked in.",
          strategicNote:
            "Bf5 before the pawn chain closes is the main reason players choose the Caro-Kann over the French — the bishop gets active before being locked in. In the French, this bishop is famously passive. In the Caro-Kann, it becomes a powerful piece.",
        },
        {
          san: 'Nf3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White develops and defends e5.",
        },
        {
          san: 'e6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Solidify the center. With the bishop already on f5, e6 is safe and stabilises Black's position.",
          strategicNote:
            "e6 is the right follow-up — it secures d5 and the pawn structure, while the f5-bishop remains active outside the pawn chain. This is exactly what the Caro-Kann is designed to achieve.",
        },
        {
          san: 'Be2',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White develops solidly.",
        },
        {
          san: 'c5',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Counter the pawn chain — attack at the base. c5 targets d4 just as in the French Advance.",
          strategicNote:
            "c5 is the thematic counterattack in all advance variations. Black attacks d4, the base of White's pawn chain. Combined with the active Bf5, Black has excellent counterplay.",
        },
        {
          san: 'c3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White reinforces d4.",
        },
        {
          san: 'Nc6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop and maintain central pressure. Nc6 adds a third attacker to d4 and prepares ...cxd4 at the right moment.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 2. Classical Variation — 3.Nc3 dxe4 4.Nxe4
    // ──────────────────────────────────────────────
    {
      id: 'caro-classical',
      name: 'Classical Variation (3.Nc3 dxe4 4.Nxe4)',
      opponentQuality: 'best',
      frequencyPercent: 35,
      summary:
        "The most popular Caro-Kann line. Black trades on e4, then develops with the signature Bf5. After Ng3 attacks the bishop, Black retreats to g6. White plays h4 to pressure the bishop and Black answers h6 to hold the position.",
      strategicTheme: 'Active Bf5 development, solid structure, precise bishop retreat to g6',
      moves: [
        {
          san: 'Nc3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White develops toward d5 — the classical approach.",
        },
        {
          san: 'dxe4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Trade pawns — open the position and remove the pawn from e4, freeing the bishop on f5.",
        },
        {
          san: 'Nxe4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White recaptures with the knight, centralising it powerfully.",
        },
        {
          san: 'Bf5',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the bishop actively before White can prevent it. This is the defining move of the Classical Caro-Kann.",
          strategicNote:
            "Bf5 is the move that defines the Classical Caro-Kann. The bishop finds an excellent square on f5 and Black's position is easy to play. All of Black's pieces will develop naturally and comfortably.",
        },
        {
          san: 'Ng3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White attacks the bishop — forced to kick it from the active f5 square.",
        },
        {
          san: 'Bg6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Retreat safely to g6 — the bishop remains influential on this square, controlling h5 and f5, and supporting the pawn structure.",
          strategicNote:
            "Bg6 is the correct retreat. On g6 the bishop stays active and cannot be easily attacked. It controls important squares and will become especially strong in endgames.",
        },
        {
          san: 'Nf3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White develops the kingside knight.",
        },
        {
          san: 'Nd7',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Flexible development — the knight can go to f6 to defend or b6 to attack c4. Nd7 keeps all options open.",
          strategicNote:
            "Nd7 is the flexible move in this position. Unlike Nf6, it keeps the f6 square available and can support both ...Ngf6 and ...c5. Black's position is solid and well-coordinated.",
        },
        {
          san: 'h4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White attacks the g6-bishop and tries to gain kingside space.",
        },
        {
          san: 'h6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Prevent h5, maintain the bishop on g6. h6 is the correct prophylactic move — the bishop stays on g6 and White's h4–h5 idea is stopped.",
          strategicNote:
            "h6 is the key defensive move. Without it, h5 would force Bh7 where the bishop is passive. After h6 Black has a solid position with the bishop pair and comfortable development.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 3. Exchange Variation — White plays exd5
    // ──────────────────────────────────────────────
    {
      id: 'caro-exchange',
      name: 'Exchange Variation (3.exd5)',
      opponentQuality: 'good',
      frequencyPercent: 15,
      summary:
        "White simplifies with exd5. Black recaptures with cxd5, gaining the half-open c-file — a key Caro-Kann advantage. Then Nc6, Nf6, and Bg4 follow, with Qd7 defending b7 and preparing queenside castling.",
      strategicTheme: 'Half-open c-file after cxd5, active piece play, queenside castling option',
      moves: [
        {
          san: 'exd5',
          isLearnerMove: false,
          quality: 'good',
          explanation: "White simplifies with a symmetrical exchange.",
        },
        {
          san: 'cxd5',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Recapture with the c-pawn — this is the key difference from the French Exchange. Black gains the half-open c-file for future rook pressure.",
          strategicNote:
            "cxd5 is the superior recapture in the Caro-Kann. By recapturing with the c-pawn rather than exd5, Black opens the c-file. This gives Black excellent long-term pressure and the rooks will find the c-file very useful.",
        },
        {
          san: 'Bd3',
          isLearnerMove: false,
          quality: 'good',
          explanation: "White develops the bishop.",
        },
        {
          san: 'Nc6',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Develop the knight with tempo — the knight eyes d4 and supports the center.",
        },
        {
          san: 'c3',
          isLearnerMove: false,
          quality: 'good',
          explanation: "White prepares a queenside setup.",
        },
        {
          san: 'Nf6',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Develop the kingside knight — natural and principled development.",
        },
        {
          san: 'Bf4',
          isLearnerMove: false,
          quality: 'good',
          explanation: "White develops the bishop actively.",
        },
        {
          san: 'Bg4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Pin the knight on f3 — create immediate pressure on White's defense of d4.",
          strategicNote:
            "Bg4 is an active developing move that pins White's knight. If White plays h3, Black plays Bh5 or Bxf3 depending on the position. This bishop creates problems for White's coordination.",
        },
        {
          san: 'Qb3',
          isLearnerMove: false,
          quality: 'good',
          explanation: "White attacks the b7 pawn.",
        },
        {
          san: 'Qd7',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Defend b7 and prepare to castle queenside. Qd7 is the flexible move — it connects the rooks and keeps all options open.",
          strategicNote:
            "Qd7 defends b7 and prepares long castling where the king is well-protected behind the pawn chain. Black's structure is solid and the c-file pressure will be a lasting asset.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 4. Panov-Botvinnik Attack — 3.exd5 cxd5 4.c4
    // ──────────────────────────────────────────────
    {
      id: 'caro-panov',
      name: 'Panov-Botvinnik Attack (3.exd5 cxd5 4.c4)',
      opponentQuality: 'excellent',
      frequencyPercent: 20,
      summary:
        "After exd5 cxd5, White plays c4 attacking d5 immediately — the Panov-Botvinnik Attack. Black develops with Nf6, e6, and Be7, allowing an IQP structure. After cxd5 Black recaptures with the knight for the ideal Caro-Kann IQP position.",
      strategicTheme: 'IQP structure, active piece compensation, knight on d5 as key piece',
      moves: [
        {
          san: 'exd5',
          isLearnerMove: false,
          quality: 'excellent',
          explanation: "White exchanges to set up the Panov attack.",
        },
        {
          san: 'cxd5',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Recapture with the c-pawn, opening the c-file.",
        },
        {
          san: 'c4',
          isLearnerMove: false,
          quality: 'excellent',
          explanation: "The Panov — attack d5 immediately and head for an IQP (Isolated Queen's Pawn) position.",
        },
        {
          san: 'Nf6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the knight — do not rush to capture on c4. Nf6 develops with tempo and keeps the position solid.",
          strategicNote:
            "Resist the temptation to grab the pawn with dxc4. That gives White a free hand in the center. Nf6 keeps the position balanced and develops naturally.",
        },
        {
          san: 'Nc3',
          isLearnerMove: false,
          quality: 'excellent',
          explanation: "White develops and attacks d5.",
        },
        {
          san: 'e6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Solid central defense. Black allows an IQP to arise in exchange for solid, comfortable development and active pieces.",
          strategicNote:
            "e6 is the classical approach in the Panov. Black accepts a potential IQP structure after cxd5 Nxd5, but gets very active pieces as compensation. The knight on d5 will be a dominant piece.",
        },
        {
          san: 'Nf3',
          isLearnerMove: false,
          quality: 'excellent',
          explanation: "White develops normally.",
        },
        {
          san: 'Be7',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop quietly before deciding on castling direction. Be7 is solid and prepares O-O.",
          strategicNote:
            "Be7 is the solid developing move — Black is not in a hurry. Castle kingside next and wait for the IQP structure to arise. Then the knight on d5 will become the dominant piece in the position.",
        },
        {
          san: 'cxd5',
          isLearnerMove: false,
          quality: 'excellent',
          explanation: "White creates the isolated queen's pawn structure.",
        },
        {
          san: 'Nxd5',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Recapture with the knight — the ideal Caro-Kann IQP structure. The knight on d5 is a powerful central piece.",
          strategicNote:
            "Nxd5 is the key recapture. The knight is magnificent on d5 — it can't be easily challenged and controls the entire center. Black's IQP position is one of the most comfortable and well-studied structures in chess. The active pieces more than compensate for the structural concession.",
        },
      ],
    },
  ],
};
