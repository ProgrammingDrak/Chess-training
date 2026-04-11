import { useState, useCallback } from 'react';
import type { PlayerProfile } from '../types/profiles';
import {
  buildDefaultPositions,
  buildRangeFromPercentile,
  PROFILE_TEMPLATES,
} from '../data/poker/profileTemplates';

const STORAGE_KEY = 'gto-player-profiles';

function loadProfiles(): PlayerProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PlayerProfile[]) : [];
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

  /** Duplicate a built-in template into a new editable profile. Returns the new profile. */
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
      positions: buildDefaultPositions(tableSize, tpl.range, tpl.defaultCallThresholdBB),
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

  /** Create a blank profile starting from a percentile-based range. */
  const createBlankProfile = useCallback((
    name: string,
    type: 'self' | 'villain',
    tableSize: number,
    playPct: number,
    callThresholdBB: number,
  ): PlayerProfile => {
    const now = new Date().toISOString();
    const range = buildRangeFromPercentile(playPct);
    const profile: PlayerProfile = {
      id: genId(),
      name,
      type,
      tableSize,
      defaultCallThresholdBB: callThresholdBB,
      positions: buildDefaultPositions(tableSize, range, callThresholdBB),
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
