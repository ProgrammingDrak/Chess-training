import { useCallback, useEffect, useState } from 'react';
import type {
  AppNotification,
  AsyncPokerAction,
  AsyncPokerGame,
  AsyncPokerQueuedAction,
  NotificationPreference,
} from '../types/asyncPoker';

interface AsyncPokerPayload {
  games?: AsyncPokerGame[];
  game?: AsyncPokerGame;
  notifications?: AppNotification[];
  preference?: NotificationPreference;
  error?: string;
}

const DEFAULT_PREFERENCE: NotificationPreference = {
  emailTurnNotifications: false,
  discordTurnNotifications: false,
  discordUserId: '',
  discordConfigured: false,
};

async function readJson<T>(res: Response, fallbackMessage: string): Promise<T> {
  const text = await res.text();
  if (!text) throw new Error(res.ok ? fallbackMessage : `API unavailable (HTTP ${res.status})`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`API returned an invalid response (HTTP ${res.status})`);
  }
}

export function useAsyncPoker(enabled: boolean) {
  const [games, setGames] = useState<AsyncPokerGame[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [preference, setPreference] = useState<NotificationPreference>(DEFAULT_PREFERENCE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const replaceGame = useCallback((game: AsyncPokerGame) => {
    setGames((current) => {
      const exists = current.some((item) => item.id === game.id);
      const next = exists ? current.map((item) => (item.id === game.id ? game : item)) : [game, ...current];
      return next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/async-poker/games', { credentials: 'include' });
      const data = await readJson<AsyncPokerPayload>(res, 'Failed to load async poker');
      if (!res.ok) throw new Error(data.error ?? 'Failed to load async poker');
      setGames(data.games ?? []);
      setNotifications(data.notifications ?? []);
      setPreference(data.preference ?? DEFAULT_PREFERENCE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load async poker');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [enabled, refresh]);

  const createGame = useCallback(async (input: {
    name: string;
    tableSize: number;
    turnSeconds: number;
    inviteUsernames: string[];
  }) => {
    const res = await fetch('/api/async-poker/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    const data = await readJson<AsyncPokerPayload>(res, 'Failed to create game');
    if (!res.ok || !data.game) throw new Error(data.error ?? 'Failed to create game');
    replaceGame(data.game);
    return data.game;
  }, [replaceGame]);

  const joinGame = useCallback(async (gameId: string) => {
    const res = await fetch(`/api/async-poker/games/${encodeURIComponent(gameId)}/join`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await readJson<AsyncPokerPayload>(res, 'Failed to join game');
    if (!res.ok || !data.game) throw new Error(data.error ?? 'Failed to join game');
    replaceGame(data.game);
  }, [replaceGame]);

  const addNpc = useCallback(async (gameId: string, input?: { name?: string; seatIndex?: number }) => {
    const res = await fetch(`/api/async-poker/games/${encodeURIComponent(gameId)}/npcs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input ?? {}),
    });
    const data = await readJson<AsyncPokerPayload>(res, 'Failed to add NPC');
    if (!res.ok || !data.game) throw new Error(data.error ?? 'Failed to add NPC');
    replaceGame(data.game);
  }, [replaceGame]);

  const startGame = useCallback(async (gameId: string) => {
    const res = await fetch(`/api/async-poker/games/${encodeURIComponent(gameId)}/start`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await readJson<AsyncPokerPayload>(res, 'Failed to start game');
    if (!res.ok || !data.game) throw new Error(data.error ?? 'Failed to start game');
    replaceGame(data.game);
  }, [replaceGame]);

  const endGame = useCallback(async (gameId: string) => {
    const res = await fetch(`/api/async-poker/games/${encodeURIComponent(gameId)}/end`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await readJson<AsyncPokerPayload>(res, 'Failed to end table');
    if (!res.ok || !data.game) throw new Error(data.error ?? 'Failed to end table');
    replaceGame(data.game);
  }, [replaceGame]);

  const showCards = useCallback(async (gameId: string) => {
    const res = await fetch(`/api/async-poker/games/${encodeURIComponent(gameId)}/show-cards`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await readJson<AsyncPokerPayload>(res, 'Failed to show cards');
    if (!res.ok || !data.game) throw new Error(data.error ?? 'Failed to show cards');
    replaceGame(data.game);
  }, [replaceGame]);

  const acknowledgeResult = useCallback(async (gameId: string) => {
    const res = await fetch(`/api/async-poker/games/${encodeURIComponent(gameId)}/acknowledge-result`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await readJson<AsyncPokerPayload>(res, 'Failed to acknowledge result');
    if (!res.ok || !data.game) throw new Error(data.error ?? 'Failed to acknowledge result');
    replaceGame(data.game);
  }, [replaceGame]);

  const takeAction = useCallback(async (
    gameId: string,
    action: AsyncPokerAction,
    amountChips?: number,
    note?: string,
  ) => {
    const res = await fetch(`/api/async-poker/games/${encodeURIComponent(gameId)}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, amountChips, note }),
    });
    const data = await readJson<AsyncPokerPayload>(res, 'Failed to record action');
    if (!res.ok || !data.game) throw new Error(data.error ?? 'Failed to record action');
    replaceGame(data.game);
  }, [replaceGame]);

  const queueAction = useCallback(async (
    gameId: string,
    input: Pick<AsyncPokerQueuedAction, 'action' | 'amountChips' | 'note'> & { actorUserId?: number },
  ) => {
    const res = await fetch(`/api/async-poker/games/${encodeURIComponent(gameId)}/queued-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    const data = await readJson<AsyncPokerPayload>(res, 'Failed to save pre-decision');
    if (!res.ok || !data.game) throw new Error(data.error ?? 'Failed to save pre-decision');
    replaceGame(data.game);
  }, [replaceGame]);

  const clearQueuedAction = useCallback(async (gameId: string, actorUserId?: number) => {
    const query = actorUserId ? `?actorUserId=${encodeURIComponent(String(actorUserId))}` : '';
    const res = await fetch(`/api/async-poker/games/${encodeURIComponent(gameId)}/queued-action${query}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await readJson<AsyncPokerPayload>(res, 'Failed to clear pre-decision');
    if (!res.ok || !data.game) throw new Error(data.error ?? 'Failed to clear pre-decision');
    replaceGame(data.game);
  }, [replaceGame]);

  const savePreference = useCallback(async (nextPreference: NotificationPreference) => {
    const res = await fetch('/api/notification-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(nextPreference),
    });
    const data = await readJson<AsyncPokerPayload>(res, 'Failed to save preferences');
    if (!res.ok || !data.preference) throw new Error(data.error ?? 'Failed to save preferences');
    setPreference(data.preference);
  }, []);

  const markNotificationRead = useCallback(async (notificationId: number) => {
    const res = await fetch(`/api/notifications/${notificationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ read: true }),
    });
    const data = await readJson<{ error?: string }>(res, 'Failed to update notification');
    if (!res.ok) throw new Error(data.error ?? 'Failed to update notification');
    setNotifications((current) => current.filter((item) => item.id !== notificationId));
  }, []);

  return {
    games,
    notifications,
    preference,
    loading,
    error,
    refresh,
    createGame,
    joinGame,
    addNpc,
    startGame,
    endGame,
    showCards,
    acknowledgeResult,
    takeAction,
    queueAction,
    clearQueuedAction,
    savePreference,
    markNotificationRead,
  };
}
