import type { RangeChart, RangeCell } from '../../types/poker';

// Ranks in standard order
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

function s(rank1: string, rank2: string): string {
  return rank1 === rank2 ? `${rank1}${rank2}` : `${rank1}${rank2}s`;
}
function o(rank1: string, rank2: string): string {
  return `${rank1}${rank2}o`;
}
function pp(rank: string): string {
  return `${rank}${rank}`;
}

// Build all 169 hands
function buildCells(actions: Record<string, string>, notes?: Record<string, string>): RangeCell[] {
  const cells: RangeCell[] = [];
  for (let i = 0; i < RANKS.length; i++) {
    for (let j = 0; j < RANKS.length; j++) {
      let hand: string;
      if (i === j) {
        hand = pp(RANKS[i]);
      } else if (i < j) {
        hand = s(RANKS[i], RANKS[j]);
      } else {
        hand = o(RANKS[j], RANKS[i]);
      }
      const action = (actions[hand] ?? 'fold') as RangeCell['action'];
      const freq = action === 'raise_mixed' || action === 'call_mixed'
        ? parseInt(actions[hand + '_freq'] ?? '50')
        : undefined;
      cells.push({
        hand,
        action,
        frequency: freq,
        notes: notes?.[hand],
      });
    }
  }
  return cells;
}

// ─── BTN RFI (raises ~45% of hands) ────────────────────────────────────────────
const BTN_ACTIONS: Record<string, string> = {
  // Pairs
  AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', '99': 'raise', '88': 'raise',
  '77': 'raise', '66': 'raise', '55': 'raise', '44': 'raise_mixed', '33': 'raise_mixed', '22': 'raise_mixed',
  '44_freq': '70', '33_freq': '65', '22_freq': '60',
  // Suited Aces
  AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise', A9s: 'raise', A8s: 'raise',
  A7s: 'raise', A6s: 'raise', A5s: 'raise', A4s: 'raise', A3s: 'raise', A2s: 'raise',
  // Offsuit Aces
  AKo: 'raise', AQo: 'raise', AJo: 'raise', ATo: 'raise', A9o: 'raise_mixed', A8o: 'raise_mixed',
  A7o: 'fold', A6o: 'fold', A5o: 'raise_mixed', A4o: 'fold', A3o: 'fold', A2o: 'fold',
  A9o_freq: '70', A8o_freq: '50', A5o_freq: '40',
  // Suited Kings
  KQs: 'raise', KJs: 'raise', KTs: 'raise', K9s: 'raise', K8s: 'raise_mixed', K7s: 'raise_mixed',
  K6s: 'raise_mixed', K5s: 'raise_mixed', K4s: 'raise_mixed', K3s: 'fold', K2s: 'fold',
  K8s_freq: '70', K7s_freq: '60', K6s_freq: '50', K5s_freq: '40', K4s_freq: '30',
  // Offsuit Kings
  KQo: 'raise', KJo: 'raise', KTo: 'raise', K9o: 'raise_mixed', K8o: 'fold', K7o: 'fold',
  K9o_freq: '50',
  // Suited Queens
  QJs: 'raise', QTs: 'raise', Q9s: 'raise', Q8s: 'raise_mixed', Q7s: 'fold', Q6s: 'fold',
  Q5s: 'fold', Q4s: 'fold', Q3s: 'fold', Q2s: 'fold',
  Q8s_freq: '50',
  // Offsuit Queens
  QJo: 'raise', QTo: 'raise_mixed', Q9o: 'fold',
  QTo_freq: '60',
  // Suited Jacks
  JTs: 'raise', J9s: 'raise', J8s: 'raise_mixed', J7s: 'fold',
  J8s_freq: '55',
  // Offsuit Jacks
  JTo: 'raise', J9o: 'raise_mixed', J8o: 'fold',
  J9o_freq: '45',
  // Suited Tens
  T9s: 'raise', T8s: 'raise', T7s: 'raise_mixed', T6s: 'fold',
  T7s_freq: '50',
  // Offsuit Tens
  T9o: 'raise_mixed', T8o: 'fold',
  T9o_freq: '50',
  // Suited Nines
  '98s': 'raise', '97s': 'raise_mixed', '96s': 'fold',
  '97s_freq': '55',
  // Offsuit Nines
  '98o': 'raise_mixed', '97o': 'fold',
  '98o_freq': '45',
  // Suited Eights
  '87s': 'raise', '86s': 'raise_mixed', '85s': 'fold',
  '86s_freq': '45',
  // Offsuit Eights
  '87o': 'fold',
  // Suited Sevens and below
  '76s': 'raise', '75s': 'raise_mixed', '74s': 'fold',
  '75s_freq': '40',
  '65s': 'raise', '64s': 'fold',
  '54s': 'raise', '53s': 'raise_mixed',
  '53s_freq': '35',
  '43s': 'fold',
};

// ─── CO RFI (raises ~35% of hands) ────────────────────────────────────────────
const CO_ACTIONS: Record<string, string> = {
  AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', '99': 'raise', '88': 'raise',
  '77': 'raise', '66': 'raise', '55': 'raise', '44': 'raise_mixed', '33': 'fold', '22': 'fold',
  '44_freq': '55',
  AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise', A9s: 'raise', A8s: 'raise',
  A7s: 'raise', A6s: 'raise', A5s: 'raise', A4s: 'raise_mixed', A3s: 'raise_mixed', A2s: 'raise_mixed',
  A4s_freq: '70', A3s_freq: '60', A2s_freq: '50',
  AKo: 'raise', AQo: 'raise', AJo: 'raise', ATo: 'raise', A9o: 'raise_mixed', A8o: 'fold',
  A9o_freq: '55',
  KQs: 'raise', KJs: 'raise', KTs: 'raise', K9s: 'raise', K8s: 'raise_mixed', K7s: 'fold',
  K8s_freq: '55',
  KQo: 'raise', KJo: 'raise', KTo: 'raise', K9o: 'raise_mixed', K8o: 'fold',
  K9o_freq: '40',
  QJs: 'raise', QTs: 'raise', Q9s: 'raise', Q8s: 'fold',
  QJo: 'raise', QTo: 'raise_mixed', Q9o: 'fold',
  QTo_freq: '45',
  JTs: 'raise', J9s: 'raise', J8s: 'fold',
  JTo: 'raise_mixed', J9o: 'fold',
  JTo_freq: '50',
  T9s: 'raise', T8s: 'raise_mixed', T7s: 'fold',
  T8s_freq: '45',
  T9o: 'fold',
  '98s': 'raise', '97s': 'fold',
  '87s': 'raise', '86s': 'fold',
  '76s': 'raise', '75s': 'fold',
  '65s': 'raise_mixed', '65s_freq': '55',
  '54s': 'raise_mixed', '54s_freq': '45',
};

// ─── HJ/MP RFI (raises ~25% of hands) ─────────────────────────────────────────
const HJ_ACTIONS: Record<string, string> = {
  AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', '99': 'raise', '88': 'raise',
  '77': 'raise', '66': 'raise_mixed', '55': 'fold', '44': 'fold', '33': 'fold', '22': 'fold',
  '66_freq': '50',
  AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise', A9s: 'raise', A8s: 'raise',
  A7s: 'raise_mixed', A6s: 'fold', A5s: 'raise_mixed', A4s: 'fold', A3s: 'fold', A2s: 'fold',
  A7s_freq: '60', A5s_freq: '50',
  AKo: 'raise', AQo: 'raise', AJo: 'raise', ATo: 'raise_mixed', A9o: 'fold',
  ATo_freq: '60',
  KQs: 'raise', KJs: 'raise', KTs: 'raise', K9s: 'raise_mixed', K8s: 'fold',
  K9s_freq: '55',
  KQo: 'raise', KJo: 'raise', KTo: 'raise_mixed', K9o: 'fold',
  KTo_freq: '50',
  QJs: 'raise', QTs: 'raise', Q9s: 'raise_mixed', Q8s: 'fold',
  Q9s_freq: '45',
  QJo: 'raise', QTo: 'fold',
  JTs: 'raise', J9s: 'raise_mixed', J8s: 'fold',
  J9s_freq: '45',
  JTo: 'raise_mixed', JTo_freq: '45',
  T9s: 'raise', T8s: 'fold',
  '98s': 'raise_mixed', '98s_freq': '50',
  '87s': 'raise_mixed', '87s_freq': '45',
  '76s': 'raise_mixed', '76s_freq': '45',
  '65s': 'fold', '54s': 'fold',
};

// ─── UTG RFI (raises ~14% of hands) ────────────────────────────────────────────
const UTG_ACTIONS: Record<string, string> = {
  AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', '99': 'raise', '88': 'raise',
  '77': 'raise_mixed', '66': 'fold', '55': 'fold', '44': 'fold', '33': 'fold', '22': 'fold',
  '77_freq': '55',
  AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise', A9s: 'raise_mixed', A8s: 'fold',
  A9s_freq: '50',
  AKo: 'raise', AQo: 'raise', AJo: 'raise_mixed', ATo: 'fold',
  AJo_freq: '55',
  KQs: 'raise', KJs: 'raise', KTs: 'raise_mixed', K9s: 'fold',
  KTs_freq: '55',
  KQo: 'raise', KJo: 'raise_mixed', KTo: 'fold',
  KJo_freq: '50',
  QJs: 'raise', QTs: 'raise_mixed', Q9s: 'fold',
  QTs_freq: '50',
  QJo: 'raise_mixed', QJo_freq: '45',
  JTs: 'raise', J9s: 'fold',
  JTo: 'fold',
  T9s: 'raise_mixed', T9s_freq: '45',
  '98s': 'fold', '87s': 'fold', '76s': 'fold', '65s': 'fold',
};

// ─── SB RFI (vs fold-around) (raises ~40% vs BTN-fold scenario)
const SB_ACTIONS: Record<string, string> = {
  AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', '99': 'raise', '88': 'raise',
  '77': 'raise', '66': 'raise', '55': 'raise', '44': 'raise', '33': 'raise_mixed', '22': 'raise_mixed',
  '33_freq': '65', '22_freq': '55',
  AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise', A9s: 'raise', A8s: 'raise',
  A7s: 'raise', A6s: 'raise', A5s: 'raise', A4s: 'raise', A3s: 'raise', A2s: 'raise',
  AKo: 'raise', AQo: 'raise', AJo: 'raise', ATo: 'raise', A9o: 'raise', A8o: 'raise_mixed',
  A8o_freq: '65',
  KQs: 'raise', KJs: 'raise', KTs: 'raise', K9s: 'raise', K8s: 'raise', K7s: 'raise',
  K6s: 'raise', K5s: 'raise_mixed', K4s: 'fold',
  K5s_freq: '55',
  KQo: 'raise', KJo: 'raise', KTo: 'raise', K9o: 'raise', K8o: 'raise_mixed', K7o: 'fold',
  K8o_freq: '50',
  QJs: 'raise', QTs: 'raise', Q9s: 'raise', Q8s: 'raise', Q7s: 'raise_mixed', Q6s: 'fold',
  Q7s_freq: '50',
  QJo: 'raise', QTo: 'raise', Q9o: 'raise_mixed', Q8o: 'fold',
  Q9o_freq: '50',
  JTs: 'raise', J9s: 'raise', J8s: 'raise', J7s: 'raise_mixed', J6s: 'fold',
  J7s_freq: '45',
  JTo: 'raise', J9o: 'raise_mixed', J8o: 'fold',
  J9o_freq: '50',
  T9s: 'raise', T8s: 'raise', T7s: 'raise_mixed',
  T7s_freq: '50',
  T9o: 'raise_mixed', T9o_freq: '55',
  '98s': 'raise', '97s': 'raise_mixed', '97s_freq': '50',
  '98o': 'raise_mixed', '98o_freq': '45',
  '87s': 'raise', '86s': 'raise_mixed', '86s_freq': '45',
  '76s': 'raise', '75s': 'raise_mixed', '75s_freq': '40',
  '65s': 'raise', '64s': 'fold',
  '54s': 'raise', '43s': 'fold',
};

// ─── BB vs SB steal (defend range ~50%) ────────────────────────────────────────
const BB_VS_SB: Record<string, string> = {
  AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', '99': 'raise', '88': 'call',
  '77': 'call', '66': 'call', '55': 'call', '44': 'call', '33': 'call', '22': 'call',
  AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'call', A9s: 'call', A8s: 'call',
  A7s: 'call', A6s: 'call', A5s: 'call', A4s: 'call', A3s: 'call', A2s: 'call',
  AKo: 'raise', AQo: 'raise', AJo: 'call', ATo: 'call', A9o: 'call', A8o: 'call',
  A7o: 'call', A6o: 'call_mixed', A5o: 'call_mixed', A4o: 'fold', A3o: 'fold', A2o: 'fold',
  A6o_freq: '55', A5o_freq: '45',
  KQs: 'raise', KJs: 'call', KTs: 'call', K9s: 'call', K8s: 'call', K7s: 'call',
  K6s: 'call', K5s: 'call_mixed', K4s: 'fold',
  K5s_freq: '45',
  KQo: 'call', KJo: 'call', KTo: 'call', K9o: 'call', K8o: 'call_mixed', K7o: 'fold',
  K8o_freq: '45',
  QJs: 'call', QTs: 'call', Q9s: 'call', Q8s: 'call', Q7s: 'call_mixed', Q6s: 'fold',
  Q7s_freq: '45',
  QJo: 'call', QTo: 'call', Q9o: 'call_mixed', Q8o: 'fold',
  Q9o_freq: '45',
  JTs: 'call', J9s: 'call', J8s: 'call', J7s: 'call_mixed', J6s: 'fold',
  J7s_freq: '45',
  JTo: 'call', J9o: 'call_mixed', J8o: 'fold',
  J9o_freq: '40',
  T9s: 'call', T8s: 'call', T7s: 'call_mixed',
  T7s_freq: '40',
  '98s': 'call', '97s': 'call_mixed', '97s_freq': '45',
  '87s': 'call', '86s': 'call_mixed', '86s_freq': '40',
  '76s': 'call', '75s': 'call_mixed', '75s_freq': '35',
  '65s': 'call', '64s': 'fold',
  '54s': 'call_mixed', '54s_freq': '40',
  '43s': 'fold', '32s': 'fold',
};

export const RANGE_CHARTS: Record<string, RangeChart> = {
  BTN: {
    position: 'BTN',
    scenario: 'RFI',
    cells: buildCells(BTN_ACTIONS),
  },
  CO: {
    position: 'CO',
    scenario: 'RFI',
    cells: buildCells(CO_ACTIONS),
  },
  HJ: {
    position: 'HJ',
    scenario: 'RFI',
    cells: buildCells(HJ_ACTIONS),
  },
  UTG: {
    position: 'UTG',
    scenario: 'RFI',
    cells: buildCells(UTG_ACTIONS),
  },
  SB: {
    position: 'SB',
    scenario: 'RFI',
    cells: buildCells(SB_ACTIONS),
  },
  BB: {
    position: 'BB',
    scenario: 'RFI',
    cells: buildCells(BB_VS_SB),
  },
};
