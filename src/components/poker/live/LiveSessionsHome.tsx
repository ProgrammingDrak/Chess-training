import { useMemo, useState } from 'react';
import type { LiveSession } from '../../../types/liveSession';
import type { PlayerProfile } from '../../../types/profiles';
import { computeStats } from '../../../utils/livePoker';
import { LiveSessionSetup } from './LiveSessionSetup';
import { LiveSessionStats } from './LiveSessionStats';

interface LiveSessionsHomeProps {
  sessions: LiveSession[];
  profiles: PlayerProfile[];
  onCreateProfile: (name: string, tableSize: number) => Promise<PlayerProfile>;
  onSaveSession: (s: LiveSession) => LiveSession;
  onDeleteSession: (id: string) => Promise<void>;
  /** Called when the user opens an active (non-ended) session for play. */
  onResumeSession: (sessionId: string) => void;
  /** Called when the user wants to start a new session — App switches view. */
  onStartSession: (s: LiveSession) => void;
  onBack: () => void;
}

type View = 'list' | 'new' | 'review';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function LiveSessionsHome({
  sessions,
  profiles,
  onCreateProfile,
  onSaveSession,
  onDeleteSession,
  onResumeSession,
  onStartSession,
  onBack,
}: LiveSessionsHomeProps) {
  const [view, setView] = useState<View>('list');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)),
    [sessions],
  );

  if (view === 'new') {
    return (
      <LiveSessionSetup
        profiles={profiles}
        onCreateProfile={onCreateProfile}
        onCancel={() => setView('list')}
        onStart={(session) => {
          onSaveSession(session);
          onStartSession(session);
        }}
      />
    );
  }

  if (view === 'review' && reviewingId) {
    const session = sessions.find(s => s.id === reviewingId);
    if (!session) {
      setView('list');
      setReviewingId(null);
      return null;
    }
    return (
      <div className="live-review">
        <div className="live-active-header">
          <button className="back-btn" onClick={() => { setView('list'); setReviewingId(null); }}>
            ← Live Sessions
          </button>
          <div className="live-active-title-block">
            <h1 className="live-active-title">{session.name ?? 'Session'}</h1>
            <span className="live-active-ended-tag">
              {session.endedAt ? 'Ended' : 'Active'}
            </span>
          </div>
        </div>
        <p className="live-review-meta">
          {formatDate(session.startedAt)}
          {session.endedAt && ` → ${formatDate(session.endedAt)}`}
          {' · '}{session.tableSize}-max
        </p>
        <LiveSessionStats session={session} profiles={profiles} />
        {!session.endedAt && (
          <button
            className="btn-primary live-review-resume"
            onClick={() => onResumeSession(session.id)}
          >
            Resume session →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="live-home">
      <div className="live-home-header">
        <button className="back-btn" onClick={onBack}>← Poker GTO</button>
        <div>
          <h1 className="live-home-title">Live Session Tracker</h1>
          <p className="live-home-desc">
            Track real hands at a real table. Tap the winner of each hand; the button advances
            automatically. Per-session stats: hands, hands/hr, win % per player and per position.
          </p>
        </div>
        <button className="btn-primary live-home-new-btn" onClick={() => setView('new')}>
          + New Session
        </button>
      </div>

      {sortedSessions.length === 0 ? (
        <div className="live-home-empty">
          <p>No sessions yet — start one to begin tracking.</p>
        </div>
      ) : (
        <div className="live-home-list">
          {sortedSessions.map(s => {
            const stats = computeStats(s);
            const isActive = s.endedAt === null;
            return (
              <div key={s.id} className={`live-home-card ${isActive ? 'live-home-card-active' : ''}`}>
                <div className="live-home-card-main" onClick={() => { setReviewingId(s.id); setView('review'); }}>
                  <div className="live-home-card-title">
                    {s.name ?? 'Untitled session'}
                    {isActive && <span className="live-home-card-active-tag">LIVE</span>}
                  </div>
                  <div className="live-home-card-meta">
                    {formatDate(s.startedAt)}
                    {' · '}
                    {s.tableSize}-max
                    {' · '}
                    {stats.totalHands} hand{stats.totalHands === 1 ? '' : 's'}
                    {stats.handsPerHour > 0 && ` · ${stats.handsPerHour.toFixed(1)}/hr`}
                  </div>
                </div>
                <div className="live-home-card-actions">
                  {isActive && (
                    <button
                      className="btn-primary live-home-card-resume"
                      onClick={() => onResumeSession(s.id)}
                    >
                      Resume
                    </button>
                  )}
                  <button
                    className="btn-secondary live-home-card-delete"
                    onClick={() => setConfirmDelete(s.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmDelete && (
        <div className="live-confirm">
          <p className="live-confirm-text">Delete this session? This cannot be undone.</p>
          <div className="live-confirm-actions">
            <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button
              className="btn-primary live-confirm-danger"
              onClick={async () => {
                await onDeleteSession(confirmDelete);
                setConfirmDelete(null);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
