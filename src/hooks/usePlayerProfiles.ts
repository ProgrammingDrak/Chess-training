import { useCallback, useEffect, useState } from 'react';
import type { PlayerProfile, PositionRangeConfig } from '../types/profiles';
import { DEFAULT_ACTION_CONTEXT } from '../types/profiles';
import {
  buildDefaultPositions,
  buildRangeFromPercentile,
  makeSituationRange,
  PROFILE_TEMPLATES,
} from '../data/poker/profileTemplates';
import { useAuth } from '../contexts/AuthContext';

const STORAGE_KEY = 'gto-player-profiles';
const LOCAL_ID_PREFIX = 'local-';

const DEFAULT_POSTFLOP: PlayerProfile['postFlop'] = {
  flop:  { minPotOddsPct: 25, minEquityPct: 30 },
  turn:  { minPotOddsPct: 28, minEquityPct: 33 },
  river: { minPotOddsPct: 30, minEquityPct: 35 },
};

// ─── localStorage migration (v1 flat range → v2 situations) ──────────────────

function migratePositionConfig(raw: Record<string, unknown>): PositionRangeConfig {
  if (raw.situations) return raw as unknown as PositionRangeConfig;
  return {
    position: raw.position as string,
    situations: {
      [DEFAULT_ACTION_CONTEXT]: {
        range: (raw.range ?? {}) as Record<string, unknown> as Record<string, import('../types/profiles').RangeAction>,
        callThresholdBB: (raw.callThresholdBB as number) ?? 20,
      },
    },
  };
}

function migrateProfile(raw: Record<string, unknown>): PlayerProfile {
  return {
    ...(raw as unknown as PlayerProfile),
    positions: ((raw.positions ?? []) as Record<string, unknown>[]).map(migratePositionConfig),
  };
}

function loadLocalProfiles(): PlayerProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Record<string, unknown>[]).map(migrateProfile);
  } catch {
    return [];
  }
}

function persistLocal(profiles: PlayerProfile[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles)); } catch { /* ignore */ }
}

function genLocalId(): string {
  return LOCAL_ID_PREFIX + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function isLocalId(id: string): boolean {
  return id.startsWith(LOCAL_ID_PREFIX) || !/^\d+$/.test(id);
}

// ─── Server <-> client mapping ───────────────────────────────────────────────

interface ServerProfileRow {
  id: number;
  name: string;
  type: string;
  table_size: number | null;
  range_data: {
    positions?: PositionRangeConfig[];
    defaultCallThresholdBB?: number;
    templateName?: string;
  } | null;
  postflop_thresholds: PlayerProfile['postFlop'] | null;
  created_at: string;
  updated_at: string;
}

function fromServerRow(row: ServerProfileRow): PlayerProfile {
  const rd = row.range_data ?? {};
  return {
    id: String(row.id),
    name: row.name,
    type: row.type === 'villain' ? 'villain' : 'self',
    tableSize: row.table_size ?? 6,
    defaultCallThresholdBB: rd.defaultCallThresholdBB ?? 20,
    positions: rd.positions ?? [],
    postFlop: row.postflop_thresholds ?? DEFAULT_POSTFLOP,
    templateName: rd.templateName,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toServerPayload(p: PlayerProfile) {
  return {
    name: p.name,
    type: p.type,
    table_size: p.tableSize,
    range_data: {
      positions: p.positions,
      defaultCallThresholdBB: p.defaultCallThresholdBB,
      templateName: p.templateName,
    },
    postflop_thresholds: p.postFlop,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePlayerProfiles() {
  const { user, loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<PlayerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      if (user) {
        try {
          const res = await fetch('/api/profiles', { credentials: 'include' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json() as { profiles: ServerProfileRow[] };
          if (!cancelled) setProfiles(data.profiles.map(fromServerRow));
        } catch (err) {
          console.error('[profiles] load failed:', err);
          if (!cancelled) setProfiles([]);
        }
      } else {
        if (!cancelled) setProfiles(loadLocalProfiles());
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user, authLoading]);

  const saveProfile = useCallback(async (profile: PlayerProfile): Promise<PlayerProfile> => {
    if (user) {
      const creating = isLocalId(profile.id);
      const url = creating ? '/api/profiles' : `/api/profiles/${profile.id}`;
      const res = await fetch(url, {
        method: creating ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(toServerPayload(profile)),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(err.error ?? 'Save failed');
      }
      const { profile: saved } = await res.json() as { profile: ServerProfileRow };
      const mapped = fromServerRow(saved);
      setProfiles(prev => {
        const filtered = prev.filter(p => p.id !== profile.id && p.id !== mapped.id);
        return [mapped, ...filtered];
      });
      return mapped;
    }

    // Logged-out: localStorage
    const updated: PlayerProfile = { ...profile, updatedAt: new Date().toISOString() };
    setProfiles(prev => {
      const exists = prev.some(p => p.id === profile.id);
      const next = exists
        ? prev.map(p => p.id === profile.id ? updated : p)
        : [...prev, updated];
      persistLocal(next);
      return next;
    });
    return updated;
  }, [user]);

  const deleteProfile = useCallback(async (id: string): Promise<void> => {
    if (user) {
      try {
        const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE', credentials: 'include' });
        if (!res.ok && res.status !== 404) {
          const err = await res.json().catch(() => ({ error: 'Delete failed' }));
          throw new Error(err.error ?? 'Delete failed');
        }
      } catch (err) {
        console.error('[profiles] delete failed:', err);
        throw err;
      }
      setProfiles(prev => prev.filter(p => p.id !== id));
      return;
    }

    setProfiles(prev => {
      const next = prev.filter(p => p.id !== id);
      persistLocal(next);
      return next;
    });
  }, [user]);

  const duplicateTemplate = useCallback(async (
    templateId: string,
    name: string,
    tableSize = 6,
  ): Promise<PlayerProfile> => {
    const tpl = PROFILE_TEMPLATES.find(t => t.id === templateId);
    if (!tpl) throw new Error(`Unknown template: ${templateId}`);
    const now = new Date().toISOString();
    const profile: PlayerProfile = {
      id: genLocalId(),
      name,
      type: tpl.type,
      tableSize,
      defaultCallThresholdBB: tpl.defaultCallThresholdBB,
      positions: buildDefaultPositions(tableSize, tpl.baseRange),
      postFlop: structuredClone(tpl.postFlop),
      templateName: tpl.name,
      createdAt: now,
      updatedAt: now,
    };
    return saveProfile(profile);
  }, [saveProfile]);

  const createBlankProfile = useCallback(async (
    name: string,
    type: 'self' | 'villain',
    tableSize: number,
    playPct: number,
    callThresholdBB: number,
  ): Promise<PlayerProfile> => {
    const now = new Date().toISOString();
    const sitRange = makeSituationRange(buildRangeFromPercentile(playPct), callThresholdBB);
    const profile: PlayerProfile = {
      id: genLocalId(),
      name,
      type,
      tableSize,
      defaultCallThresholdBB: callThresholdBB,
      positions: buildDefaultPositions(tableSize, sitRange),
      postFlop: {
        flop:  { minPotOddsPct: 25, minEquityPct: 30 },
        turn:  { minPotOddsPct: 28, minEquityPct: 33 },
        river: { minPotOddsPct: 30, minEquityPct: 35 },
      },
      createdAt: now,
      updatedAt: now,
    };
    return saveProfile(profile);
  }, [saveProfile]);

  return { profiles, loading, saveProfile, deleteProfile, duplicateTemplate, createBlankProfile };
}
