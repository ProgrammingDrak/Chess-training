import { useState, useCallback } from 'react';
import type { PlayerProfile, PositionRangeConfig } from '../types/profiles';
import { DEFAULT_ACTION_CONTEXT } from '../types/profiles';
import {
  buildDefaultPositions,
  buildRangeFromPercentile,
  makeSituationRange,
  PROFILE_TEMPLATES,
} from '../data/poker/profileTemplates';

const STORAGE_KEY = 'gto-player-profiles';

// ─── Migration ───────────────────────────────────────────────────────────────
//
// v1 schema:  PositionRangeConfig = { position, range, callThresholdBB }
// v2 schema:  PositionRangeConfig = { position, situations: { RFI: { range, callThresholdBB } } }
//
// If we find a position with the old flat `range` field we lift it into `situations['RFI']`.

function migratePositionConfig(raw: Record<string, unknown>): PositionRangeConfig {
  // Already new schema
  if (raw.situations) return raw as unknown as PositionRangeConfig;

  // Old schema — lift flat range + callThresholdBB into situations['RFI']
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

function loadProfiles(): PlayerProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown>[];
    return parsed.map(migrateProfile);
  } catch {
    return [];
  }
}

function persist(profiles: PlayerProfile[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles)); } catch { /* ignore */ }
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePlayerProfiles() {
  const [profiles, setProfiles] = useState<PlayerProfile[]>(loadProfiles);

  const saveProfile = useCallback((profile: PlayerProfile) => {
    setProfiles(prev => {
      const exists = prev.some(p => p.id === profile.id);
      const next = exists
        ? prev.map(p => p.id === profile.id ? { ...profile, updatedAt: new Date().toISOString() } : p)
        : [...prev, profile];
      persist(next);
      return next;
    });
  }, []);

  const deleteProfile = useCallback((id: string) => {
    setProfiles(prev => {
      const next = prev.filter(p => p.id !== id);
      persist(next);
      return next;
    });
  }, []);

  /** Duplicate a built-in template into a new editable profile and return it. */
  const duplicateTemplate = useCallback((
    templateId: string,
    name: string,
    tableSize = 6,
  ): PlayerProfile => {
    const tpl = PROFILE_TEMPLATES.find(t => t.id === templateId);
    if (!tpl) throw new Error(`Unknown template: ${templateId}`);
    const now = new Date().toISOString();
    const profile: PlayerProfile = {
      id: genId(),
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
    setProfiles(prev => {
      const next = [...prev, profile];
      persist(next);
      return next;
    });
    return profile;
  }, []);

  /** Create a blank profile seeded from a percentile range. */
  const createBlankProfile = useCallback((
    name: string,
    type: 'self' | 'villain',
    tableSize: number,
    playPct: number,
    callThresholdBB: number,
  ): PlayerProfile => {
    const now = new Date().toISOString();
    const sitRange = makeSituationRange(buildRangeFromPercentile(playPct), callThresholdBB);
    const profile: PlayerProfile = {
      id: genId(),
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
    setProfiles(prev => {
      const next = [...prev, profile];
      persist(next);
      return next;
    });
    return profile;
  }, []);

  return { profiles, saveProfile, deleteProfile, duplicateTemplate, createBlankProfile };
}
