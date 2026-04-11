import { useState } from 'react';
import type { PlayerProfile, RangeAction, PositionRangeConfig } from '../../../types/profiles';
import {
  getPositionsForTableSize,
  buildDefaultPositions,
  buildRangeFromPercentile,
} from '../../../data/poker/profileTemplates';
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProfileEditorProps {
  /** If provided, we're editing an existing profile. Otherwise creating a new one. */
  initial?: PlayerProfile;
  onSave: (profile: PlayerProfile) => void;
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfileEditor({ initial, onSave, onCancel }: ProfileEditorProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<'self' | 'villain'>(initial?.type ?? 'self');
  const [tableSize, setTableSize] = useState(initial?.tableSize ?? 6);
  const [callThresholdBB] = useState(initial?.defaultCallThresholdBB ?? 20);
  const [positions, setPositions] = useState<PositionRangeConfig[]>(
    initial?.positions ?? buildDefaultPositions(6, buildRangeFromPercentile(20), 20)
  );
  const [postFlop, setPostFlop] = useState<PlayerProfile['postFlop']>(
    initial?.postFlop ?? DEFAULT_POST_FLOP
  );
  const [selectedPosIdx, setSelectedPosIdx] = useState(0);

  // ── Table size change ──────────────────────────────────────────────────────
  const handleTableSizeChange = (newSize: number) => {
    setTableSize(newSize);
    const newPosNames = getPositionsForTableSize(newSize);
    // Preserve existing position data where possible, fill gaps from first pos
    const baseRange = positions[0]?.range ?? buildRangeFromPercentile(20);
    const updated = newPosNames.map(posName => {
      const existing = positions.find(p => p.position === posName);
      return existing ?? {
        position: posName,
        range: { ...baseRange },
        callThresholdBB,
      };
    });
    setPositions(updated);
    setSelectedPosIdx(0);
  };

  // ── Range changes ──────────────────────────────────────────────────────────
  const handleRangeChange = (newRange: Record<string, RangeAction>) => {
    setPositions(prev =>
      prev.map((p, i) => i === selectedPosIdx ? { ...p, range: newRange } : p)
    );
  };

  const handleCallThresholdChange = (bb: number) => {
    setPositions(prev =>
      prev.map((p, i) => i === selectedPosIdx ? { ...p, callThresholdBB: bb } : p)
    );
  };

  const applyToAllPositions = () => {
    const src = positions[selectedPosIdx];
    setPositions(prev =>
      prev.map(p => ({ ...p, range: { ...src.range }, callThresholdBB: src.callThresholdBB }))
    );
  };

  // ── Post-flop update helpers ───────────────────────────────────────────────
  const updatePostFlop = (
    street: 'flop' | 'turn' | 'river',
    field: 'minPotOddsPct' | 'minEquityPct',
    value: number,
  ) => {
    setPostFlop(prev => ({
      ...prev,
      [street]: { ...prev[street], [field]: value },
    }));
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    const profile: PlayerProfile = {
      id: initial?.id ?? genId(),
      name: name.trim(),
      type,
      tableSize,
      defaultCallThresholdBB: callThresholdBB,
      positions,
      postFlop,
      templateName: initial?.templateName,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(profile);
  };

  const currentPos = positions[selectedPosIdx];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="pe-wrapper">
      {/* Header */}
      <div className="pe-header">
        <button className="back-btn" onClick={onCancel}>← Back</button>
        <h2 className="pe-title">{initial ? 'Edit Profile' : 'New Profile'}</h2>
      </div>

      {/* ── Section 1: Basic info ── */}
      <div className="pe-section">
        <div className="pe-fields-row">
          {/* Name */}
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

          {/* Type */}
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

          {/* Table size */}
          <div className="pe-field">
            <label className="pe-label">Table size</label>
            <select
              className="pe-select"
              value={tableSize}
              onChange={e => handleTableSizeChange(Number(e.target.value))}
            >
              {[2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <option key={n} value={n}>{n}-handed</option>
              ))}
            </select>
          </div>
        </div>

        {type === 'self' && (
          <p className="pe-hint">
            Self profiles can be used in drills to compare your tendencies against GTO.
          </p>
        )}
        {type === 'villain' && (
          <p className="pe-hint">
            Villain profiles can be selected in the Opponent Simulator to replace fixed archetypes.
          </p>
        )}
      </div>

      {/* ── Section 2: Hand ranges ── */}
      <div className="pe-section">
        <div className="pe-section-header">
          <h3 className="pe-section-title">Preflop Hand Ranges</h3>
          <button className="btn-ghost pe-apply-all-btn" onClick={applyToAllPositions}>
            Apply this position to all others
          </button>
        </div>

        {/* Position tabs */}
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

        {currentPos && (
          <HandRangeEditor
            range={currentPos.range}
            onChange={handleRangeChange}
            callThresholdBB={currentPos.callThresholdBB}
            onChangeCallThreshold={handleCallThresholdChange}
          />
        )}
      </div>

      {/* ── Section 3: Post-flop thresholds ── */}
      <div className="pe-section">
        <h3 className="pe-section-title">Post-Flop Thresholds</h3>
        <p className="pe-section-desc">
          Minimum requirements to continue on each street. Used when comparing decisions against this profile.
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
                  type="number"
                  min={0} max={100}
                  className="pe-input-sm"
                  value={postFlop[street].minPotOddsPct}
                  onChange={e => updatePostFlop(street, 'minPotOddsPct', Number(e.target.value))}
                />
                <span className="pe-pf-unit">%</span>
              </div>

              <label className="pe-pf-label">Min equity</label>
              <div className="pe-pf-input-row">
                <input
                  type="number"
                  min={0} max={100}
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

      {/* ── Footer actions ── */}
      <div className="pe-footer">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={!name.trim()}
        >
          {initial ? 'Save Changes' : 'Create Profile'}
        </button>
      </div>
    </div>
  );
}
