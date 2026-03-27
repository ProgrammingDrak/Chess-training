import type { Opening } from '../../types';

// French Defense — practiced from Black's perspective
// Setup: 1.e4 e6 2.d4 d5 — all lines begin here (White to move)
export const frenchDefense: Opening = {
  id: 'french-defense',
  name: 'French Defense',
  eco: 'C00–C19',
  learnerColor: 'black',
  description:
    "Black answers 1.e4 with the French — a solid, counterattacking opening. After 1...e6 2.d4, Black strikes with 2...d5, immediately challenging the center. The French leads to rich positional battles where Black fights for counterplay against White's space advantage. Famously played by Mikhail Botvinnik and Viktor Korchnoi.",
  tags: ['solid', 'positional', 'e4', 'classical', 'counter-attack'],
  setupMoves: ['e4', 'e6', 'd4', 'd5'],
  lines: [
    // ──────────────────────────────────────────────
    // 1. Advance Variation — White plays e5
    // ──────────────────────────────────────────────
    {
      id: 'french-advance',
      name: 'Advance Variation (3.e5)',
      opponentQuality: 'best',
      frequencyPercent: 30,
      summary:
        "White advances with e5, grabbing space. Black counterattacks the pawn chain with c5, then Nc6 and Qb6 to put maximum pressure on d4 and b2. After exchanging on d4, Black develops naturally with Nge7.",
      strategicTheme: 'Attack the pawn chain base with c5, dual pressure with Qb6, timely cxd4',
      moves: [
        {
          san: 'e5',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White advances claiming space and closing the center — the Advance Variation.",
        },
        {
          san: 'c5',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Attack the pawn chain at its base immediately. c5 hits d4, the foundation of White's pawn structure.",
          strategicNote:
            "This is the key French counterattack — d4 is the base of White's chain and c5 undermines it directly. The French pawn structure means Black always attacks where White is weakest: the d4 square.",
        },
        {
          san: 'c3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White reinforces d4 with c3 — the most solid response.",
        },
        {
          san: 'Nc6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the knight and maintain pressure on d4. Nc6 adds another attacker to the critical square.",
        },
        {
          san: 'Nf3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White develops and defends d4 once more.",
        },
        {
          san: 'Qb6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Attack b2 and d4 simultaneously — a powerful dual threat that puts White under immediate pressure.",
          strategicNote:
            "Qb6 is the critical move in the French Advance — it creates problems on both sides of the board. White must deal with the threat to b2 while also keeping d4 defended. This often forces White into passive or concession-making moves.",
        },
        {
          san: 'Be2',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White defends d4 again with Be2 — solid and keeps the bishop safe.",
        },
        {
          san: 'cxd4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Open the position and relieve tension at the right moment. Exchanging on d4 frees Black's pieces and exposes White's center.",
        },
        {
          san: 'cxd4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White recaptures, maintaining the pawn structure.",
        },
        {
          san: 'Nge7',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the knight without blocking the f8-bishop. Nge7 prepares ...Nf5 to target d4 and gives Black excellent piece coordination.",
          strategicNote:
            "Nge7 is preferred over Nf6 because the f6 square is often needed for other purposes and the e7-knight can go to f5 where it attacks d4 powerfully. Black has excellent counterplay.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 2. Exchange Variation — White plays exd5
    // ──────────────────────────────────────────────
    {
      id: 'french-exchange',
      name: 'Exchange Variation (3.exd5)',
      opponentQuality: 'good',
      frequencyPercent: 20,
      summary:
        "White simplifies with exd5, creating a symmetrical pawn structure. Black recaptures and mirrors White's development — Nf6, Bd6, O-O. The key is to counter-pin White's knight with Bg4 after White plays Bg5.",
      strategicTheme: 'Equal pawn structure, symmetric development, piece activity with bishop pins',
      moves: [
        {
          san: 'exd5',
          isLearnerMove: false,
          quality: 'good',
          explanation: "White simplifies with a symmetrical exchange, steering toward an equal endgame.",
        },
        {
          san: 'exd5',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Recapture — Black has a fully equal position with symmetric pawns. The French has been defused but Black is fine.",
        },
        {
          san: 'Nf3',
          isLearnerMove: false,
          quality: 'good',
          explanation: "White develops normally.",
        },
        {
          san: 'Nf6',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Develop the kingside knight, the most natural and principled move.",
        },
        {
          san: 'Bd3',
          isLearnerMove: false,
          quality: 'good',
          explanation: "White develops the bishop actively.",
        },
        {
          san: 'Bd6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Mirror White's bishop — a classic French Exchange principle. Bd6 is active and prepares castling.",
          strategicNote:
            "In the Exchange Variation, symmetrical development is the safest approach. Bd6 mirrors White's setup and keeps the position level. Black's goal: castle quickly and then fight for active piece play.",
        },
        {
          san: 'O-O',
          isLearnerMove: false,
          quality: 'good',
          explanation: "White castles for safety.",
        },
        {
          san: 'O-O',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Castle and complete development. Black has a fully equal and comfortable position.",
        },
        {
          san: 'Bg5',
          isLearnerMove: false,
          quality: 'good',
          explanation: "White pins Black's knight on f6.",
        },
        {
          san: 'Bg4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Counter-pin White's knight on f3. Bg4 immediately neutralises White's Bg5 threat and maintains full equality.",
          strategicNote:
            "Bg4 is the precise response — Black pins White's knight symmetrically. If White plays h3, Black can retreat or play Bh5 keeping the pin. The position is dynamically balanced.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 3. Tarrasch Variation — White plays Nd2
    // ──────────────────────────────────────────────
    {
      id: 'french-tarrasch',
      name: 'Tarrasch Variation (3.Nd2)',
      opponentQuality: 'excellent',
      frequencyPercent: 25,
      summary:
        "White plays the flexible Nd2, developing without blocking the c1-bishop. Black responds with Nf6 and after e5, retreats with Nfd7. The key counterattack is c5 — Black must hit d4 before White consolidates. Then f6 attacks the pawn chain.",
      strategicTheme: 'Counterattack with c5, knight on d7 supporting c5, thematic f6 break',
      moves: [
        {
          san: 'Nd2',
          isLearnerMove: false,
          quality: 'excellent',
          explanation: "White develops the knight flexibly — Nd2 avoids blocking the c1-bishop.",
        },
        {
          san: 'Nf6',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Develop normally and put pressure on e4 — the standard response.",
        },
        {
          san: 'e5',
          isLearnerMove: false,
          quality: 'excellent',
          explanation: "White pushes, the main Tarrasch pawn advance — gaining space and closing the center.",
        },
        {
          san: 'Nfd7',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "The knight retreats to d7 to support the c5 counterattack and avoid being pushed further by f4.",
          strategicNote:
            "Nfd7 is the correct retreat — the knight supports c5 from d7 and Black avoids weakening pawn moves. This is a defining moment in the Tarrasch: don't be afraid to retreat the knight.",
        },
        {
          san: 'Bd3',
          isLearnerMove: false,
          quality: 'excellent',
          explanation: "White develops the bishop actively toward the kingside.",
        },
        {
          san: 'c5',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "The key counterattack — hit d4 before White consolidates the center.",
          strategicNote:
            "In the French, ...c5 is almost always Black's most important move — it fights for the center and gives the bishop on c8 a future. Strike immediately before White plays c3 and makes d4 completely secure.",
        },
        {
          san: 'c3',
          isLearnerMove: false,
          quality: 'excellent',
          explanation: "White reinforces d4 with c3.",
        },
        {
          san: 'Nc6',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Develop the queenside knight and add more pressure to d4.",
        },
        {
          san: 'Ne2',
          isLearnerMove: false,
          quality: 'good',
          explanation: "White repositions the knight toward f4 via e2.",
        },
        {
          san: 'f6',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Strike at the e5 pawn chain — the thematic French counterattack. f6 opens the position and gives Black counterplay.",
          strategicNote:
            "f6 is the second key break in the French Advance and Tarrasch. Combined with c5, it attacks White's center from both sides. After exf6 Nxf6, Black has freed the position and the pieces become active.",
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 4. Winawer Variation — Black pins with Bb4
    // ──────────────────────────────────────────────
    {
      id: 'french-winawer',
      name: 'Winawer Variation (3.Nc3 Bb4)',
      opponentQuality: 'best',
      frequencyPercent: 25,
      summary:
        "After 3.Nc3, Black plays the Winawer with Bb4, pinning the knight. Black plans to trade on c3, damage White's pawn structure, then attack the weakened pawns. After Bxc3+ bxc3, Black develops with Ne7 and prepares queenside castling after Qc7.",
      strategicTheme: 'Structural damage with Bxc3+, attack weak pawns on c3/c4, queenside castling',
      moves: [
        {
          san: 'Nc3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "The most popular and challenging reply — develops toward d5 and defends e4.",
        },
        {
          san: 'Bb4',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "The Winawer — pin the knight and prepare to disrupt White's pawn structure with a future Bxc3+.",
          strategicNote:
            "Bb4 is the hallmark of the Winawer. Black plans ...Bxc3 to double White's pawns, then attack the weakened c3/c4 structure. This gives Black a lasting structural advantage in exchange for the bishop pair.",
        },
        {
          san: 'e5',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White closes the center and gains space — the main Winawer continuation.",
        },
        {
          san: 'c5',
          isLearnerMove: true,
          quality: 'best',
          explanation: "Immediately counterattack in the center — do not allow White to consolidate.",
        },
        {
          san: 'a3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White forces the bishop to declare its intention — take on c3 or retreat.",
        },
        {
          san: 'Bxc3+',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Trade the bishop to damage White's pawn structure. The check is a bonus that gains a tempo.",
          strategicNote:
            "This trade gives Black a key strategic concession from White — the doubled c-pawns on c3 and c4 are a lasting weakness. Black gets counterplay against these pawns throughout the entire game.",
        },
        {
          san: 'bxc3',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White must recapture — now c3 and c4 are weak targets.",
        },
        {
          san: 'Ne7',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Develop the knight without blocking the c8-bishop's future diagonal. Ne7 prepares to go to f5 or g6.",
          strategicNote:
            "Ne7 is the correct development square — Nf6 would be met by Bg5 with an annoying pin. From e7, the knight can go to f5, g6, or even d7, all useful squares in the Winawer structure.",
        },
        {
          san: 'Qg4',
          isLearnerMove: false,
          quality: 'best',
          explanation: "White attacks g7 — a typical and dangerous Winawer motif.",
        },
        {
          san: 'Qc7',
          isLearnerMove: true,
          quality: 'best',
          explanation:
            "Defend g7 and prepare long queenside castling. Qc7 is the most principled response to Qg4.",
          strategicNote:
            "Qc7 solves the g7 problem and prepares to castle queenside, where Black's king is often safer in the Winawer. The queen on c7 also eyes c3 and supports the ...cxd4 break at the right moment.",
        },
      ],
    },
  ],
};
