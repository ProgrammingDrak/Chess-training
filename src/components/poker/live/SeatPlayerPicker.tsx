import { useState } from 'react';
import type { PlayerProfile } from '../../../types/profiles';

interface SeatPlayerPickerProps {
  /** Profiles available to choose from. */
  profiles: PlayerProfile[];
  /** Profile IDs already seated (excluded from the existing-profile list). */
  excludeIds: string[];
  /** Default tableSize for newly-created profiles. */
  tableSize: number;
  onCancel: () => void;
  /** Pick an existing profile. */
  onPickExisting: (profileId: string) => void;
  /** Create a new profile, then seat it.  Caller does the creation. */
  onCreateNew: (name: string, tableSize: number) => Promise<{ id: string }>;
  /**
   * Optional title — defaults to "Seat a player".  Used to distinguish
   * "Add player" (mid-session) from initial seating.
   */
  title?: string;
  /** Optional helper text shown under the title. */
  helperText?: string;
}

export function SeatPlayerPicker({
  profiles,
  excludeIds,
  tableSize,
  onCancel,
  onPickExisting,
  onCreateNew,
  title = 'Seat a player',
  helperText,
}: SeatPlayerPickerProps) {
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = profiles.filter(p => !excludeIds.includes(p.id));

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError('Name required');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await onCreateNew(trimmed, tableSize);
      onPickExisting(created.id);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  };

  return (
    <div className="live-picker">
      <div className="live-picker-header">
        <h3 className="live-picker-title">{title}</h3>
        {helperText && <p className="live-picker-helper">{helperText}</p>}
      </div>

      {available.length > 0 && (
        <div className="live-picker-section">
          <div className="live-picker-section-label">Existing profiles</div>
          <div className="live-picker-grid">
            {available.map(p => (
              <button
                key={p.id}
                type="button"
                className="live-picker-profile"
                onClick={() => onPickExisting(p.id)}
              >
                <span className="live-picker-profile-name">{p.name}</span>
                <span className="live-picker-profile-type">
                  {p.type === 'self' ? 'Hero' : 'Villain'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="live-picker-section">
        <div className="live-picker-section-label">Or create new</div>
        <div className="live-picker-create">
          <input
            className="live-picker-input"
            type="text"
            placeholder="Player name"
            value={newName}
            onChange={e => { setNewName(e.target.value); setError(null); }}
            onKeyDown={e => { if (e.key === 'Enter') void handleCreate(); }}
            disabled={creating}
          />
          <button
            type="button"
            className="btn-primary live-picker-create-btn"
            onClick={() => void handleCreate()}
            disabled={creating || !newName.trim()}
          >
            {creating ? 'Creating…' : 'Create + Seat'}
          </button>
        </div>
        {error && <p className="live-picker-error">{error}</p>}
      </div>

      <button type="button" className="btn-secondary live-picker-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
