import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveSession } from '../types/liveSession';
import { useAuth } from '../contexts/AuthContext';

const STORAGE_KEY = 'gto-live-sessions';
const DIRTY_KEY = 'gto-live-sessions-dirty';

// ─── localStorage I/O ───────────────────────────────────────────────────────

function loadLocal(): LiveSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LiveSession[];
  } catch {
    return [];
  }
}

function persistLocal(sessions: LiveSession[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); } catch { /* ignore */ }
}

function loadDirty(): Set<string> {
  try {
    const raw = localStorage.getItem(DIRTY_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function persistDirty(dirty: Set<string>): void {
  try { localStorage.setItem(DIRTY_KEY, JSON.stringify([...dirty])); } catch { /* ignore */ }
}

function markDirty(id: string): void {
  const d = loadDirty();
  d.add(id);
  persistDirty(d);
}

function clearDirty(id: string): void {
  const d = loadDirty();
  d.delete(id);
  persistDirty(d);
}

// ─── UUID generation ────────────────────────────────────────────────────────

export function newSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: RFC4122-ish v4 from Math.random.  Adequate for our uniqueness
  // needs (per-user, low collision risk) when crypto.randomUUID isn't there.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Server <-> client mapping ──────────────────────────────────────────────

interface ServerLiveSessionRow {
  id: number;
  client_id: string;
  name: string | null;
  started_at: string;
  ended_at: string | null;
  table_size: number;
  data: Omit<LiveSession, 'id' | 'name' | 'startedAt' | 'endedAt' | 'tableSize'>;
  updated_at: string;
}

function fromServerRow(row: ServerLiveSessionRow): LiveSession {
  return {
    ...row.data,
    id: row.client_id,
    name: row.name ?? undefined,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    tableSize: row.table_size,
    updatedAt: row.updated_at,
  };
}

function toServerPayload(s: LiveSession) {
  // Strip the fields that get top-level columns; everything else lives in data.
  const { id: _id, name: _name, startedAt: _s, endedAt: _e, tableSize: _t, ...data } = s;
  return {
    name: s.name ?? null,
    started_at: s.startedAt,
    ended_at: s.endedAt,
    table_size: s.tableSize,
    data,
  };
}

// ─── Background sync ────────────────────────────────────────────────────────

async function pushSession(session: LiveSession): Promise<boolean> {
  try {
    const res = await fetch(`/api/live-sessions/${encodeURIComponent(session.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(toServerPayload(session)),
    });
    return res.ok;
  } catch {
    return false; // network error — keep dirty for next attempt
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useLiveSessions() {
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<LiveSession[]>(() => loadLocal());
  const [loading, setLoading] = useState(true);
  // Latest session list ref for use inside event handlers w/o re-binding.
  const sessionsRef = useRef<LiveSession[]>(sessions);
  sessionsRef.current = sessions;

  /**
   * Push every dirty session to the server, removing each from the dirty
   * set on success.  Safe to call repeatedly — no-op when nothing dirty.
   */
  const flushDirty = useCallback(async (): Promise<void> => {
    if (!user) return;
    const dirty = loadDirty();
    if (dirty.size === 0) return;
    for (const id of dirty) {
      const session = sessionsRef.current.find(s => s.id === id);
      if (!session) {
        // Locally deleted before sync — drop from dirty set.
        clearDirty(id);
        continue;
      }
      const ok = await pushSession(session);
      if (ok) clearDirty(id);
    }
  }, [user]);

  // Initial load: read localStorage, then if logged in pull server + flush dirty.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const local = loadLocal();
      if (!cancelled) setSessions(local);

      if (user) {
        try {
          const res = await fetch('/api/live-sessions', { credentials: 'include' });
          if (res.ok) {
            const { sessions: rows } = await res.json() as { sessions: ServerLiveSessionRow[] };
            const serverSessions = rows.map(fromServerRow);

            // Merge: union by id.  Server wins on overlap unless the local
            // copy is dirty (pending push), in which case keep local.
            const dirty = loadDirty();
            const localById = new Map(local.map(s => [s.id, s]));
            const merged: LiveSession[] = [];
            const seen = new Set<string>();

            for (const srv of serverSessions) {
              if (dirty.has(srv.id) && localById.has(srv.id)) {
                merged.push(localById.get(srv.id)!);
              } else {
                merged.push(srv);
              }
              seen.add(srv.id);
            }
            for (const loc of local) {
              if (!seen.has(loc.id)) merged.push(loc); // local-only — needs sync
            }

            persistLocal(merged);
            if (!cancelled) setSessions(merged);

            // Push anything dirty (new local-only sessions + dirty edits).
            await flushDirty();
          }
        } catch (err) {
          console.error('[live-sessions] load failed:', err);
        }
      }

      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user, authLoading, flushDirty]);

  // Re-flush whenever the browser comes back online.
  useEffect(() => {
    if (!user) return;
    const onOnline = () => { void flushDirty(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [user, flushDirty]);

  // ── Mutations ──

  const saveSession = useCallback((session: LiveSession): LiveSession => {
    const updated: LiveSession = { ...session, updatedAt: new Date().toISOString() };
    setSessions(prev => {
      const exists = prev.some(s => s.id === updated.id);
      const next = exists
        ? prev.map(s => s.id === updated.id ? updated : s)
        : [updated, ...prev];
      persistLocal(next);
      return next;
    });
    if (user) {
      markDirty(updated.id);
      // Fire-and-forget; failures stay in the dirty queue.
      void (async () => {
        const ok = await pushSession(updated);
        if (ok) clearDirty(updated.id);
      })();
    }
    return updated;
  }, [user]);

  const deleteSession = useCallback(async (id: string): Promise<void> => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      persistLocal(next);
      return next;
    });
    clearDirty(id);
    if (user) {
      try {
        await fetch(`/api/live-sessions/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
      } catch (err) {
        console.error('[live-sessions] delete failed:', err);
      }
    }
  }, [user]);

  return { sessions, loading, saveSession, deleteSession, flushDirty };
}
