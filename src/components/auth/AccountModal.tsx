import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getTierLabel } from '../../types/tiers';

interface AccountModalProps {
  onClose: () => void;
}

interface AdminFeedbackMessage {
  id: number;
  userId: number | null;
  reporterUsername: string | null;
  reporterEmail: string | null;
  contactEmail: string | null;
  message: string;
  source: string | null;
  path: string | null;
  status: 'new' | 'read';
  readAt: string | null;
  readByUsername: string | null;
  createdAt: string;
}

function formatFeedbackDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function AccountModal({ onClose }: AccountModalProps) {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<AdminFeedbackMessage[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function loadFeedback() {
    if (user?.role !== 'admin') return;
    setFeedbackLoading(true);
    setFeedbackError('');
    try {
      const res = await fetch('/api/admin/feedback', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load feedback inbox');
      }
      setFeedback(Array.isArray(data.feedback) ? data.feedback : []);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Failed to load feedback inbox');
    } finally {
      setFeedbackLoading(false);
    }
  }

  useEffect(() => {
    loadFeedback();
  }, [user?.role]);

  async function updateFeedbackStatus(id: number, status: AdminFeedbackMessage['status']) {
    setFeedbackError('');
    const previous = feedback;
    setFeedback((items) => items.map((item) =>
      item.id === id ? { ...item, status, readAt: status === 'read' ? item.readAt ?? new Date().toISOString() : null } : item
    ));
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update feedback');
      }
    } catch (err) {
      setFeedback(previous);
      setFeedbackError(err instanceof Error ? err.message : 'Failed to update feedback');
    }
  }

  if (!user) return null;

  const unreadCount = feedback.filter((item) => item.status === 'new').length;

  return (
    <div className="auth-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="account-modal" role="dialog" aria-modal="true" aria-label="Account settings">
        <button className="auth-close" onClick={onClose} aria-label="Close">×</button>
        <div className="account-modal-header">
          <div>
            <div className="tier-gate-kicker">Account</div>
            <h2>{user.username}</h2>
          </div>
          <span className={`tier-chip tier-${user.tier}`}>{getTierLabel(user.tier)}</span>
        </div>

        <div className="account-summary">
          <div><span>Email</span><strong>{user.email ?? 'Not set'}</strong></div>
          <div><span>Status</span><strong>{getTierLabel(user.tier)}</strong></div>
          <div><span>Role</span><strong>{user.role === 'admin' ? 'Admin' : 'User'}</strong></div>
        </div>

        {user.role === 'admin' && (
          <section className="account-section admin-feedback-inbox">
            <div className="admin-feedback-header">
              <div>
                <h3>Feedback inbox</h3>
                <p>{unreadCount} unread · {feedback.length} total</p>
              </div>
              <button className="btn-secondary" onClick={loadFeedback} disabled={feedbackLoading}>
                {feedbackLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {feedbackError && <p className="auth-error">{feedbackError}</p>}

            {!feedbackLoading && feedback.length === 0 && (
              <p>No feedback messages yet.</p>
            )}

            <div className="admin-feedback-list">
              {feedback.map((item) => {
                const reporter = item.reporterUsername
                  ? `${item.reporterUsername}${item.reporterEmail ? ` · ${item.reporterEmail}` : ''}`
                  : 'Anonymous';
                return (
                  <article className={`admin-feedback-card ${item.status}`} key={item.id}>
                    <div className="admin-feedback-card-header">
                      <div>
                        <span className={`admin-feedback-status ${item.status}`}>
                          {item.status === 'new' ? 'New' : 'Read'}
                        </span>
                        <strong>{reporter}</strong>
                      </div>
                      <time dateTime={item.createdAt}>{formatFeedbackDate(item.createdAt)}</time>
                    </div>
                    <p className="admin-feedback-message">{item.message}</p>
                    <div className="admin-feedback-meta">
                      <span>{item.contactEmail ? `Contact: ${item.contactEmail}` : 'No contact email'}</span>
                      <span>{item.path ?? 'Unknown page'}</span>
                      {item.readByUsername && <span>Read by {item.readByUsername}</span>}
                    </div>
                    <div className="admin-feedback-actions">
                      {item.status === 'new' ? (
                        <button className="btn-ghost" onClick={() => updateFeedbackStatus(item.id, 'read')}>
                          Mark read
                        </button>
                      ) : (
                        <button className="btn-ghost" onClick={() => updateFeedbackStatus(item.id, 'new')}>
                          Mark unread
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
