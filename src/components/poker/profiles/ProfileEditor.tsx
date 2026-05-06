import { useState } from 'react';
import type { PlayerProfile, RangeAction, PositionRangeConfig, RangeActionBucket } from '../../../types/profiles';
import { DEFAULT_ACTION_CONTEXT } from '../../../types/profiles';
import {
  getPositionsForTableSize,
  buildDefaultPositions,
  buildRangeFromPercentile,
  makeSituationRange,
  suggestedVpip,
} from '../../../data/poker/profileTemplates';
import { ensureActionBuckets } from '../../../utils/profileActionBuckets';
import { HandRangeEditor } from './HandRangeEditor';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const DEFAULT_POST_FLOP: PlayerProfile['postFlop'] = {
  flop:  { minPotOddsPct: 25, minEquityPct: 30 },
  turn:  { minPotOddsPct: 28, minEquityPct: 33 },
  river: { minPotOddsPct: 30, minEquityPct: 35 },
};

/** Read the RFI situation from a position config, with safe fallback. */
function getRfiSituation(pos: PositionRangeConfig) {
  const situation = pos.situations[DEFAULT_ACTION_CONTEXT] ?? { range: {}, callThresholdBB: 10, limpThresholdBB: 1 };
  return { ...situation, actionBuckets: ensureActionBuckets(situation) };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProfileEditorProps {
  initial?: PlayerProfile;
  onSave: (profile: PlayerProfile) => void;
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfileEditor({ initial, onSave, onCancel }: ProfileEditorProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<'self' | 'villain'>(initial?.type ?? 'self');
  const [tableSize, setTableSize] = useState(initial?.tableSize ?? 6);
  const [positions, setPositions] = useState<PositionRangeConfig[]>(() => {
    if (initial?.positions) return initial.positions;
    // New profile: seed with top-20% raise range for each position
    return buildDefaultPositions(6, makeSituationRange(buildRangeFromPercentile(20), 20));
  });
  const [postFlop, setPostFlop] = useState<PlayerProfile['postFlop']>(
    initial?.postFlop ?? DEFAULT_POST_FLOP
  );
  const [selectedPosIdx, setSelectedPosIdx] = useState(0);

  // ── Table size change ──────────────────────────────────────────────────────
  const handleTableSizeChange = (newSize: number) => {
    setTableSize(newSize);
    const newPosNames = getPositionsForTableSize(newSize);
    const baseRange = getRfiSituation(positions[0]).range;
    const baseThreshold = getRfiSituation(positions[0]).callThresholdBB;
    const updated: PositionRangeConfig[] = newPosNames.map(posName => {
      const existing = positions.find(p => p.position === posName);
      return existing ?? {
        position: posName,
        situations: {
          [DEFAULT_ACTION_CONTEXT]: { range: { ...baseRange }, callThresholdBB: baseThreshold },
        },
      };
    });
    setPositions(updated);
    setSelectedPosIdx(0);
  };

  // ── Range changes for current position / RFI context ──────────────────────
  const handleRangeChange = (newRange: Record<string, RangeAction>) => {
    setPositions(prev => prev.map((p, i) => {
      if (i !== selectedPosIdx) return p;
      const prev_rfi = getRfiSituation(p);
      return {
        ...p,
        situations: { ...p.situations, [DEFAULT_ACTION_CONTEXT]: { ...prev_rfi, range: newRange } },
      };
    }));
  };

  const handleCallThresholdChange = (bb: number) => {
    setPositions(prev => prev.map((p, i) => {
      if (i !== selectedPosIdx) return p;
      const prev_rfi = getRfiSituation(p);
      return {
        ...p,
        situations: { ...p.situations, [DEFAULT_ACTION_CONTEXT]: { ...prev_rfi, callThresholdBB: bb } },
      };
    }));
  };

  const handleActionBucketsChange = (actionBuckets: RangeActionBucket[]) => {
    const callBucket = actionBuckets.find(bucket => bucket.id === 'call') ??
      actionBuckets.find(bucket => bucket.kind === 'callRaise');
    const limpBucket = actionBuckets.find(bucket => bucket.id === 'limp') ??
      actionBuckets.find(bucket => bucket.kind === 'limp');

    setPositions(prev => prev.map((p, i) => {
      if (i !== selectedPosIdx) return p;
      const prev_rfi = getRfiSituation(p);
      return {
        ...p,
        situations: {
          ...p.situations,
          [DEFAULT_ACTION_CONTEXT]: {
            ...prev_rfi,
            actionBuckets,
            callThresholdBB: callBucket?.maxBB ?? prev_rfi.callThresholdBB,
            limpThresholdBB: limpBucket?.maxBB ?? prev_rfi.limpThresholdBB ?? 1,
          },
        },
      };
    }));
  };

  const applyToAllPositions = () => {
    const src = getRfiSituation(positions[selectedPosIdx]);
    setPositions(prev => prev.map(p => ({
      ...p,
      situations: {
        ...p.situations,
        [DEFAULT_ACTION_CONTEXT]: { range: { ...src.range }, callThresholdBB: src.callThresholdBB },
      },
    })));
  };

  // ── Post-flop updates ──────────────────────────────────────────────────────
  const updatePostFlop = (
    street: 'flop' | 'turn' | 'river',
    field: 'minPotOddsPct' | 'minEquityPct',
    value: number,
  ) => {
    setPostFlop(prev => ({ ...prev, [street]: { ...prev[street], [field]: value } }));
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    const rfiSit = getRfiSituation(positions[0] ?? { position: '', situations: {} });
    const defaultCallBucket = rfiSit.actionBuckets.find(bucket => bucket.id === 'call') ??
      rfiSit.actionBuckets.find(bucket => bucket.kind === 'callRaise');
    const profile: PlayerProfile = {
      id: initial?.id ?? genId(),
      name: name.trim(),
      type,
      tableSize,
      defaultCallThresholdBB: defaultCallBucket?.maxBB ?? rfiSit.callThresholdBB,
      positions,
      postFlop,
      templateName: initial?.templateName,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(profile);
  };

  const currentPos = positions[selectedPosIdx];
  const currentRfi = currentPos ? getRfiSituation(currentPos) : null;
  // Position-aware VPIP suggestion for the quick-start slider
  const posSuggestion = suggestedVpip(tableSize, currentPos?.position ?? '');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="pe-wrapper">
      <div className="pe-header">
        <button className="back-btn" onClick={onCancel}>← Back</button>
        <h2 className="pe-title">{initial ? 'Edit Profile' : 'New Profile'}</h2>
      </div>

      {/* ── Section 1: Basic info ── */}
      <div className="pe-section">
        <div className="pe-fields-row">
          <div className="pe-field pe-field-grow">
            <label className="pe-label">Profile name</label>
            <input
              className="pe-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. My 6-max tight-aggressive"
              maxLength={48}
            />
          </div>

          <div className="pe-field">
            <label className="pe-label">Type</label>
            <div className="pe-toggle-row">
              {(['self', 'villain'] as const).map(t => (
                <button
                  key={t}
                  className={`pe-toggle-btn${type === t ? ' active' : ''}`}
                  onClick={() => setType(t)}
                >
                  {t === 'self' ? '🧑 Self' : '👤 Villain'}
                </button>
              ))}
            </div>
          </div>

          <div className="pe-field">
            <label className="pe-label">Table size</label>
            <select
              className="pe-select"
              value={tableSize}
              onChange={e => handleTableSizeChange(Number(e.target.value))}
            >
              {[2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <option key={n} value={n}>
                  {n === 2 ? 'Heads-up (2)' : `${n}-handed`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="pe-hint">
          {type === 'self'
            ? 'Self profiles compare your tendencies against GTO in drills.'
            : 'Villain profiles can replace fixed archetypes in the Opponent Simulator.'}
          {' '}Positions shown: <strong>{getPositionsForTableSize(tableSize).join(', ')}</strong>.
        </p>
      </div>

      {/* ── Section 2: Hand ranges ── */}
      <div className="pe-section">
        <div className="pe-section-header">
          <h3 className="pe-section-title">
            Preflop Hand Ranges
            <span className="pe-section-ctx">· Raise First In (RFI)</span>
          </h3>
          <button className="btn-ghost pe-apply-all-btn" onClick={applyToAllPositions}>
            Apply this position to all others
          </button>
        </div>

        <div className="pe-pos-tabs">
          {positions.map((pos, i) => (
            <button
              key={pos.position}
              className={`pe-pos-tab${selectedPosIdx === i ? ' active' : ''}`}
              onClick={() => setSelectedPosIdx(i)}
            >
              {pos.position}
            </button>
          ))}
        </div>

        {currentRfi && (
          <HandRangeEditor
            range={currentRfi.range}
            onChange={handleRangeChange}
            actionBuckets={currentRfi.actionBuckets}
            onChangeActionBuckets={handleActionBucketsChange}
            onChangeCallThreshold={handleCallThresholdChange}
            suggestedPct={posSuggestion}
          />
        )}
      </div>

      {/* ── Section 3: Post-flop thresholds ── */}
      <div className="pe-section">
        <h3 className="pe-section-title">Post-Flop Thresholds</h3>
        <p className="pe-section-desc">
          Minimum requirements to continue on each street.
        </p>
        <div className="pe-postflop-grid">
          {(['flop', 'turn', 'river'] as const).map(street => (
            <div key={street} className="pe-postflop-street">
              <div className="pe-pf-street-name">
                {street.charAt(0).toUpperCase() + street.slice(1)}
              </div>
              <label className="pe-pf-label">Min pot odds</label>
              <div className="pe-pf-input-row">
                <input
                  type="number" min={0} max={100}
                  className="pe-input-sm"
                  value={postFlop[street].minPotOddsPct}
                  onChange={e => updatePostFlop(street, 'minPotOddsPct', Number(e.target.value))}
                />
                <span className="pe-pf-unit">%</span>
              </div>
              <label className="pe-pf-label">Min equity</label>
              <div className="pe-pf-input-row">
                <input
                  type="number" min={0} max={100}
                  className="pe-input-sm"
                  value={postFlop[street].minEquityPct}
                  onChange={e => updatePostFlop(street, 'minEquityPct', Number(e.target.value))}
                />
                <span className="pe-pf-unit">%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="pe-footer">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={!name.trim()}>
          {initial ? 'Save Changes' : 'Create Profile'}
        </button>
      </div>
    </div>
  );
}
