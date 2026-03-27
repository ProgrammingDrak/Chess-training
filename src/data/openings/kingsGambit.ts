import type { Opening } from '../../types';

// King's Gambit — practiced from White's perspective
// Setup: 1.e4 e5 2.f4 — all lines begin here (Black to move)
export const kingsGambit: Opening = {
  id: 'kings-gambit',
  name: "King's Gambit",
  eco: 'C30–C39',
  learnerColor: 'white',
  description:
    "The King's Gambit is one of the oldest and most romantic attacking openings. White sacrifices the f4 pawn to open the f-file and seize the center. A favorite of Morphy, Fischer, and Tal. When accepted, White gets a powerful center and attacking chances; when declined, White still gets dynamic play.",
  tags: ['aggressive', 'attacking', 'sharp', 'e4', 'gambit'],
  setupMoves: ['e4', 'e5', 'f4'],
  lines: [
    // ──────────────────────────────────────────────
    // 1. King's Gambit Accepted — 2...exf4 3.Nf3 Nf6
    // ──────────────────────────────────────────────
    {
      id: 'kg-accepted-main',
      name: "King's Gambit Accepted — 2...exf4 3.Nf3 Nf6",
      opponentQuality: 'best',
      frequencyPercent: 40,
      summary:
        "The main line of the King's Gambit Accepted. Black takes the pawn and develops the knight to f6, immediately counterattacking e4. White responds with the space-gaining e5 and builds a powerful d4+e5 center. A complex, double-edged position where White's center compensates for the sacrificed pawn.",
      strategicTheme: 'Central domination with d4+e5, space advantage, open f-file',
      moves: [
        {
          san: 'exf4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Black accepts the gambit pawn.",
        },
        {
          san: 'Nf3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop and prevent ...Qh4+ — the key development move.",
        },
        {
          san: 'Nf6',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Counterattack e4 immediately.",
        },
        {
          san: 'e5',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Push and gain central space, forcing the knight back.",
          strategicNote:
            "e5 is White's key response to ...Nf6 in the KGA — it gains space and drives the knight while maintaining central tension.",
        },
        {
          san: 'Nh5',
          isLearnerMove: false,
          quality: 'best',
          explanation: "The knight retreats to a strange but safe square.",
        },
        {
          san: 'd4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Strengthen the center — White now has d4+e5 dominating.",
        },
        {
          san: 'd6',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Challenge the e5 pawn.",
        },
        {
          san: 'Nc3',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Develop the knight, support e5.",
        },
        {
          san: 'dxe5',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Trade the e5 pawn.",
        },
        {
          san: 'dxe5',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Recapture, maintaining pawn center.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 2. King's Gambit Accepted — Bc4 Attack
    // ──────────────────────────────────────────────
    {
      id: 'kg-accepted-bc4',
      name: "King's Gambit Accepted — Bc4 Attack",
      opponentQuality: 'good',
      frequencyPercent: 25,
      summary:
        "Black accepts and tries to hold the f4 pawn with ...g5. White develops with Bc4, targeting f7, and follows up with d4 for a powerful center. This is the classic King's Bishop Attack — romantic chess at its finest, with direct attacking play.",
      strategicTheme: 'Bishop targets f7, d4 center, direct kingside attack',
      moves: [
        {
          san: 'exf4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "Accept the gambit.",
        },
        {
          san: 'Nf3',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Develop first.",
        },
        {
          san: 'g5',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Black tries to hold the f4 pawn with g5.",
        },
        {
          san: 'Bc4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the bishop targeting f7 — the King's Bishop Attack.",
          strategicNote:
            "Bc4 combined with d4 creates a powerful attacking setup against f7 — this is the romantic King's Gambit at its finest.",
        },
        {
          san: 'Bg7',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Develop the bishop and defend g5.",
        },
        {
          san: 'd4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Claim the center — d4 + e4 is White's ideal pawn center.",
        },
        {
          san: 'd6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Solid defensive setup.",
        },
        {
          san: 'O-O',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Castle into safety while keeping maximum piece activity.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 3. King's Gambit Declined — 2...Bc5
    // ──────────────────────────────────────────────
    {
      id: 'kg-declined-bc5',
      name: "King's Gambit Declined — 2...Bc5",
      opponentQuality: 'good',
      frequencyPercent: 20,
      summary:
        "Black declines the gambit and develops the bishop actively to c5. White mirrors with Bc4 targeting f7 and plays a solid d3 to support the center. The position remains dynamic with both sides having active bishops and competing central plans.",
      strategicTheme: 'Bishop symmetry, f7 target, solid center with d3',
      moves: [
        {
          san: 'Bc5',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Decline the gambit and develop aggressively.",
        },
        {
          san: 'Nf3',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Develop, maintain pressure on e5.",
        },
        {
          san: 'd6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Solid defense.",
        },
        {
          san: 'Bc4',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Mirror the bishop — target f7.",
        },
        {
          san: 'Nc6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Develop the queenside knight.",
        },
        {
          san: 'd3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Solid — support e4, prepare Nc3, avoid overextension.",
        },
        {
          san: 'Nf6',
          isLearnerMove: false,
          quality: 'good',
          explanation: "Develop and attack e4.",
        },
        {
          san: 'Nc3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the knight and control d5 and e4. Castling is not yet possible because Black's Bc5 controls the g1 square.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 4. Falkbeer Countergambit (2...d5)
    // ──────────────────────────────────────────────
    {
      id: 'kg-falkbeer',
      name: 'Falkbeer Countergambit (2...d5)',
      opponentQuality: 'playable',
      frequencyPercent: 15,
      summary:
        "The Falkbeer Countergambit — Black ignores the gambit and strikes back with ...d5. White accepts and play becomes very complex with pawns flying in all directions. White should respond with d3, challenging Black's pawn on e4 before it becomes too strong.",
      strategicTheme: 'Counter-gambit, central pawn battle, open lines',
      moves: [
        {
          san: 'd5',
          isLearnerMove: false,
          quality: 'playable',
          explanation:
            "The Falkbeer Countergambit — Black ignores the gambit and strikes back immediately.",
        },
        {
          san: 'exd5',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Accept and take the d5 pawn.",
        },
        {
          san: 'e4',
          isLearnerMove: false,
          quality: 'playable',
          explanation: "Black gains a strong central pawn.",
        },
        {
          san: 'd3',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Challenge the e4 pawn immediately.",
        },
        {
          san: 'Nf6',
          isLearnerMove: false,
          quality: 'playable',
          explanation: "Develop and attack d5.",
        },
        {
          san: 'dxe4',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Remove the central pawn and open lines.",
        },
        {
          san: 'Nxe4',
          isLearnerMove: false,
          quality: 'playable',
          explanation: "Recapture with the knight.",
        },
        {
          san: 'Nf3',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop actively and counterattack the e4 knight.",
        },
      ],
    },
  ],
};
