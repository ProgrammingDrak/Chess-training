import type { Card } from './poker';
import type { LiveHandAction, SeatId } from './liveSession';

export type AsyncPokerStatus = 'waiting' | 'active' | 'finished';

export type AsyncPokerAction = 'check' | 'call' | 'bet' | 'raise' | 'fold' | 'pass';
export type AsyncPokerStreet = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface AsyncPokerShowdownResult {
  label: string;
}

export interface AsyncPokerQueuedAction {
  action: 'call' | 'raise';
  amountChips: number;
  handNumber: number;
  street: Exclude<AsyncPokerStreet, 'showdown'>;
  note?: string | null;
  createdAt: string;
}

export interface AsyncPokerHandState {
  street?: AsyncPokerStreet;
  board?: Card[];
  actions?: LiveHandAction[];
  buttonSeat?: SeatId | null;
  smallBlindSeat?: SeatId | null;
  bigBlindSeat?: SeatId | null;
  holeCards?: Record<string, Card[]>;
  foldedUserIds?: number[];
  shownUserIds?: number[];
  nextHandReadyUserIds?: number[];
  endedAt?: string | null;
  endedByUserId?: number | null;
  previousHandResult?: {
    handNumber: number;
    resolvedAt: string | null;
    resolutionReason?: string;
    board?: Card[];
    actions?: LiveHandAction[];
    potChips?: number | null;
    winnerUserIds?: number[];
    winnerUserId?: number | null;
    showdown?: Record<string, AsyncPokerShowdownResult>;
    shownUserIds?: number[];
    acknowledgedUserIds?: number[];
    holeCards?: Record<string, Card[]>;
  } | null;
  potChips?: number | null;
  pendingActions?: Record<string, AsyncPokerQueuedAction>;
  streetActions?: Partial<Record<Exclude<AsyncPokerStreet, 'showdown'>, number[]>>;
  winnerUserIds?: number[];
  winnerUserId?: number | null;
  showdown?: Record<string, AsyncPokerShowdownResult>;
  resolutionReason?: 'showdown' | 'all_but_one_folded' | string;
  resolvedAt?: string | null;
}

export interface AsyncPokerPlayer {
  userId: number;
  username: string;
  seatIndex: number;
  stackChips: number;
  status: 'active' | 'folded' | 'left';
  joinedAt: string;
  isNpc: boolean;
}

export interface AsyncPokerRecentAction {
  id: number;
  userId: number;
  username: string;
  handNumber: number;
  action: AsyncPokerAction | 'post-blind' | 'post-straddle' | 'timeout' | 'join' | 'start' | 'end' | 'ready_next' | 'show';
  street: Exclude<AsyncPokerStreet, 'showdown'>;
  amountChips: number | null;
  note: string | null;
  createdAt: string;
}

export interface AsyncPokerGame {
  id: string;
  name: string;
  hostUserId: number;
  hostUsername: string;
  tableSize: number;
  turnSeconds: number;
  status: AsyncPokerStatus;
  currentPlayerUserId: number | null;
  currentPlayerUsername: string | null;
  currentPlayerIsNpc: boolean;
  currentTurnStartedAt: string | null;
  currentTurnExpiresAt: string | null;
  handNumber: number;
  potChips: number;
  smallBlindChips: number;
  bigBlindChips: number;
  state: AsyncPokerHandState;
  createdAt: string;
  updatedAt: string;
  isPlayer: boolean;
  players: AsyncPokerPlayer[];
  recentActions: AsyncPokerRecentAction[];
}

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  actionPath: string | null;
  metadata?: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  emailTurnNotifications: boolean;
  discordTurnNotifications: boolean;
  discordUserId: string;
  discordConfigured: boolean;
}
