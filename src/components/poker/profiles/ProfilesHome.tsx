import { useState } from 'react';
import type { PlayerProfile } from '../../../types/profiles';
import { PROFILE_TEMPLATES } from '../../../data/poker/profileTemplates';
import { handCombos } from '../../../utils/handMatrix';
import { ProfileEditor } from './ProfileEditor';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProfilesHomeProps {
  profiles: PlayerProfile[];
  onSaveProfile: (p: PlayerProfile) => void;
  onDeleteProfile: (id: string) => void;
  onDuplicateTemplate: (templateId: string, name: string, tableSize: number) => PlayerProfile;
  onBack: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProfilesHome({
  profiles,
  onSaveProfile,
  onDeleteProfile,
  onDuplicateTemplate,
  onBack,
}: ProfilesHomeProps) {
  // null = list view, 'new' = create blank, PlayerProfile = edit existing
  const [editing, setEditing] = useState<PlayerProfile | 'new' | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ── Editor view ────────────────────────────────────────────────────────────
  if (editing !== null) {
    return (
      <ProfileEditor
        initial={editing === 'new' ? undefined : editing}
        onSave={p => {
          onSaveProfile(p);
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  const selfProfiles    = profiles.filter(p => p.type === 'self');
  const villainProfiles = profiles.filter(p => p.type === 'villain');

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="profiles-home">
      {/* Page header */}
      <div className="profiles-page-header">
        <button className="back-btn" onClick={onBack}>← Poker GTO</button>
        <div>
          <h1 className="profiles-page-title">Player Profiles</h1>
          <p className="profiles-page-desc">
            Build hand-range profiles for yourself and opponents. Use them in drills to check
            decisions against real playing styles.
          </p>
        </div>
        <button className="btn-primary profiles-new-btn" onClick={() => setEditing('new')}>
          + New Profile
        </button>
      </div>

      {/* ── Built-in templates ── */}
      <section className="profiles-section">
        <div className="profiles-section-header">
          <h2 className="profiles-section-title">Built-in Templates</h2>
          <p className="profiles-section-desc">
            Duplicate a template to start from a known archetype, then fine-tune it.
          </p>
        </div>

        <div className="profiles-template-grid">
          {PROFILE_TEMPLATES.map(tpl => (
            <div key={tpl.id} className="profiles-tpl-card">
              <div className="profiles-tpl-icon">{tpl.icon}</div>
              <div className="profiles-tpl-name">{tpl.name}</div>
              <div className="profiles-tpl-desc">{tpl.description}</div>
              <span className={`profiles-type-badge profiles-type-${tpl.type}`}>
                {tpl.type === 'self' ? '🧑 Self' : '👤 Villain'}
              </span>
              <button
                className="btn-secondary profiles-tpl-btn"
                onClick={() => {
                  const p = onDuplicateTemplate(tpl.id, `My ${tpl.name}`, 6);
                  setEditing(p);
                }}
              >
                Use Template →
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Self profiles ── */}
      {selfProfiles.length > 0 && (
        <section className="profiles-section">
          <h2 className="profiles-section-title">My Profiles (Self)</h2>
          <div className="profiles-cards-grid">
            {selfProfiles.map(p => (
              <ProfileCard
                key={p.id}
                profile={p}
                onEdit={() => setEditing(p)}
                onDelete={() => setDeleteConfirm(p.id)}
                confirmingDelete={deleteConfirm === p.id}
                onConfirmDelete={() => { onDeleteProfile(p.id); setDeleteConfirm(null); }}
                onCancelDelete={() => setDeleteConfirm(null)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Villain profiles ── */}
      {villainProfiles.length > 0 && (
        <section className="profiles-section">
          <h2 className="profiles-section-title">Villain Profiles</h2>
          <div className="profiles-cards-grid">
            {villainProfiles.map(p => (
              <ProfileCard
                key={p.id}
                profile={p}
                onEdit={() => setEditing(p)}
                onDelete={() => setDeleteConfirm(p.id)}
                confirmingDelete={deleteConfirm === p.id}
                onConfirmDelete={() => { onDeleteProfile(p.id); setDeleteConfirm(null); }}
                onCancelDelete={() => setDeleteConfirm(null)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {profiles.length === 0 && (
        <div className="profiles-empty">
          <div className="profiles-empty-icon">📋</div>
          <p className="profiles-empty-text">
            No profiles yet. Duplicate a template above or create a blank one.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Profile card ─────────────────────────────────────────────────────────────

interface ProfileCardProps {
  profile: PlayerProfile;
  onEdit: () => void;
  onDelete: () => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

function ProfileCard({
  profile,
  onEdit,
  onDelete,
  confirmingDelete,
  onConfirmDelete,
  onCancelDelete,
}: ProfileCardProps) {
  // Compute VPIP from first position's range
  const firstPos = profile.positions[0];
  const vpipPct = firstPos
    ? (() => {
        let played = 0;
        for (const [hand, action] of Object.entries(firstPos.range)) {
          if (action !== 'fold') played += handCombos(hand);
        }
        return ((played / 1326) * 100).toFixed(0);
      })()
    : '—';

  return (
    <div className="profile-card">
      <div className="profile-card-top">
        <div>
          <div className="profile-card-name">{profile.name}</div>
          <div className="profile-card-meta">
            <span className={`profiles-type-badge profiles-type-${profile.type}`}>
              {profile.type === 'self' ? '🧑 Self' : '👤 Villain'}
            </span>
            <span className="profile-card-size">{profile.tableSize}-handed</span>
            {profile.templateName && (
              <span className="profile-card-tpl">from {profile.templateName}</span>
            )}
          </div>
        </div>
        <div className="profile-card-vpip">
          <span className="profile-card-vpip-value">{vpipPct}%</span>
          <span className="profile-card-vpip-label">VPIP</span>
        </div>
      </div>

      {/* Post-flop summary */}
      <div className="profile-card-pf">
        {(['flop', 'turn', 'river'] as const).map(s => (
          <span key={s} className="profile-card-pf-item">
            <span className="profile-card-pf-street">{s[0].toUpperCase()}:</span>
            {' '}{profile.postFlop[s].minEquityPct}%eq / {profile.postFlop[s].minPotOddsPct}%po
          </span>
        ))}
      </div>

      {/* Positions list */}
      <div className="profile-card-positions">
        {profile.positions.map(p => (
          <span key={p.position} className="profile-card-pos">{p.position}</span>
        ))}
      </div>

      {/* Actions */}
      <div className="profile-card-actions">
        {confirmingDelete ? (
          <>
            <span className="profile-card-confirm">Delete "{profile.name}"?</span>
            <button className="btn-danger profile-card-btn" onClick={onConfirmDelete}>
              Delete
            </button>
            <button className="btn-ghost profile-card-btn" onClick={onCancelDelete}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button className="btn-secondary profile-card-btn" onClick={onEdit}>Edit</button>
            <button className="btn-ghost profile-card-btn" onClick={onDelete}>Delete</button>
          </>
        )}
      </div>
    </div>
  );
}
