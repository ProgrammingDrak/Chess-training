import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getTierLabel, normalizeUserTier } from '../../types/tiers';

interface AdminActivitySummary {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  active_sessions: number;
  logins_24h: number;
  logins_7d: number;
  unique_login_users_7d: number;
  total_live_sessions: number;
  open_live_sessions: number;
  live_sessions_7d: number;
  total_feedback: number;
  unread_feedback: number;
}

interface CountRow {
  count: number;
}

interface TierCountRow extends CountRow {
  tier: string;
}

interface RoleCountRow extends CountRow {
  role: string;
}

interface LoginMethodRow extends CountRow {
  method: string;
  last_seen_at: string | null;
}

interface RecentUserRow {
  id: number;
  username: string;
  email: string | null;
  role: string;
  membership_tier: string;
  created_at: string;
  last_login_at: string | null;
  login_count: number;
}

interface ActiveSessionRow {
  sid: string;
  expire: string;
  user_id: string | null;
  username: string | null;
  email: string | null;
  role: string | null;
  membership_tier: string | null;
}

interface LoginEventRow {
  id: string;
  user_id: number | null;
  username: string | null;
  email: string | null;
  method: string;
  ip_address: string | null;
  country: string | null;
  user_agent: string | null;
  created_at: string;
}

interface LiveUserRow {
  id: number;
  username: string;
  email: string | null;
  live_session_count: number;
  last_started_at: string | null;
  last_updated_at: string | null;
}

interface FeedbackRow {
  id: number;
  user_id: number | null;
  reporter_username: string | null;
  reporter_email: string | null;
  contact_email: string | null;
  message: string;
  path: string | null;
  status: 'new' | 'read';
  created_at: string;
}

interface AdminActivityResponse {
  summary: AdminActivitySummary;
  usersByTier: TierCountRow[];
  usersByRole: RoleCountRow[];
  loginsByMethod: LoginMethodRow[];
  recentUsers: RecentUserRow[];
  activeSessions: ActiveSessionRow[];
  recentLoginEvents: LoginEventRow[];
  topLiveUsers: LiveUserRow[];
  recentFeedback: FeedbackRow[];
}

interface Props {
  onBack: () => void;
}

function formatNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toLocaleString() : '0';
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatLongDate(value: string | null | undefined) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatMethod(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function truncate(value: string | null | undefined, length = 80) {
  if (!value) return 'Unknown';
  return value.length > length ? `${value.slice(0, length - 1)}...` : value;
}

function userLabel(username: string | null | undefined, email: string | null | undefined) {
  if (username && email) return `${username} / ${email}`;
  return username ?? email ?? 'Unknown user';
}

function StatCard({ label, value, detail }: { label: string; value: number | string; detail?: string }) {
  return (
    <div className="admin-stat-card">
      <div className="admin-stat-value">{typeof value === 'number' ? formatNumber(value) : value}</div>
      <div className="admin-stat-label">{label}</div>
      {detail && <div className="admin-stat-detail">{detail}</div>}
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return <div className="admin-empty">{children}</div>;
}

export function AdminActivityPage({ onBack }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<AdminActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadActivity() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/activity', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'Failed to load admin activity');
      }
      setData(body as AdminActivityResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin activity');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivity();
  }, []);

  const summary = data?.summary;
  const knownLoginLocations = useMemo(() => (
    data?.recentLoginEvents.filter((event) => event.ip_address || event.country).length ?? 0
  ), [data?.recentLoginEvents]);

  if (user?.role !== 'admin') {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <button className="back-btn" onClick={onBack}>Back</button>
          <h2>Admin Activity</h2>
        </div>
        <EmptyState>Admin access required.</EmptyState>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <button className="back-btn" onClick={onBack}>Back</button>
        <div>
          <h2>Admin Activity</h2>
          <p>Users, sessions, logins, live sessions, and feedback.</p>
        </div>
        <button className="btn-secondary" onClick={loadActivity} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && <p className="auth-error">{error}</p>}

      {!data && loading ? (
        <EmptyState>Loading activity...</EmptyState>
      ) : summary ? (
        <>
          <section className="admin-stat-grid" aria-label="Activity summary">
            <StatCard label="Total Users" value={summary.total_users} detail={`${formatNumber(summary.new_users_7d)} new this week`} />
            <StatCard label="Active Sessions" value={summary.active_sessions} detail="Unexpired browser sessions" />
            <StatCard label="Logins" value={summary.logins_7d} detail={`${formatNumber(summary.logins_24h)} in the last 24 hours`} />
            <StatCard label="Unique Login Users" value={summary.unique_login_users_7d} detail="Last 7 days" />
            <StatCard label="Live Sessions" value={summary.total_live_sessions} detail={`${formatNumber(summary.open_live_sessions)} open now`} />
            <StatCard label="Feedback" value={summary.total_feedback} detail={`${formatNumber(summary.unread_feedback)} unread`} />
          </section>

          <section className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h3>Login Events</h3>
                <p>{knownLoginLocations} recent events include IP or country data.</p>
              </div>
            </div>
            {data.recentLoginEvents.length === 0 ? (
              <EmptyState>No login events recorded yet.</EmptyState>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Time</th>
                      <th>Method</th>
                      <th>Where</th>
                      <th>Device</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentLoginEvents.map((event) => (
                      <tr key={event.id}>
                        <td>{userLabel(event.username, event.email)}</td>
                        <td>{formatLongDate(event.created_at)}</td>
                        <td>{formatMethod(event.method)}</td>
                        <td>
                          <span className="admin-where">
                            {event.country ?? 'Unknown'}
                            {event.ip_address && <span>{event.ip_address}</span>}
                          </span>
                        </td>
                        <td title={event.user_agent ?? undefined}>{truncate(event.user_agent, 56)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="admin-two-column">
            <section className="admin-panel">
              <div className="admin-panel-header">
                <h3>Users</h3>
              </div>
              <div className="admin-breakdown-grid">
                <div>
                  <h4>By Tier</h4>
                  {data.usersByTier.map((row) => (
                    <div className="admin-breakdown-row" key={row.tier}>
                      <span>{getTierLabel(normalizeUserTier(row.tier))}</span>
                      <strong>{formatNumber(row.count)}</strong>
                    </div>
                  ))}
                </div>
                <div>
                  <h4>By Role</h4>
                  {data.usersByRole.map((row) => (
                    <div className="admin-breakdown-row" key={row.role}>
                      <span>{row.role === 'admin' ? 'Admin' : 'User'}</span>
                      <strong>{formatNumber(row.count)}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="admin-list">
                {data.recentUsers.map((item) => (
                  <div className="admin-list-row" key={item.id}>
                    <div>
                      <strong>{userLabel(item.username, item.email)}</strong>
                      <span>{item.role} / {getTierLabel(normalizeUserTier(item.membership_tier))}</span>
                    </div>
                    <div>
                      <strong>{formatDate(item.created_at)}</strong>
                      <span>{item.login_count > 0 ? `Last login ${formatDate(item.last_login_at)}` : 'No login event yet'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel-header">
                <h3>Browser Sessions</h3>
              </div>
              {data.activeSessions.length === 0 ? (
                <EmptyState>No active sessions.</EmptyState>
              ) : (
                <div className="admin-list">
                  {data.activeSessions.map((session) => (
                    <div className="admin-list-row" key={session.sid}>
                      <div>
                        <strong>{userLabel(session.username, session.email)}</strong>
                        <span>{session.role ?? 'user'} / {getTierLabel(normalizeUserTier(session.membership_tier ?? 'diamond'))}</span>
                      </div>
                      <div>
                        <strong>Expires {formatDate(session.expire)}</strong>
                        <span>ID {session.user_id ?? 'unknown'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="admin-two-column">
            <section className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <h3>Live Session Usage</h3>
                  <p>{formatNumber(summary.live_sessions_7d)} started this week.</p>
                </div>
              </div>
              {data.topLiveUsers.length === 0 ? (
                <EmptyState>No live sessions yet.</EmptyState>
              ) : (
                <div className="admin-list">
                  {data.topLiveUsers.map((item) => (
                    <div className="admin-list-row" key={item.id}>
                      <div>
                        <strong>{userLabel(item.username, item.email)}</strong>
                        <span>{formatNumber(item.live_session_count)} sessions</span>
                      </div>
                      <div>
                        <strong>{formatDate(item.last_started_at)}</strong>
                        <span>Updated {formatDate(item.last_updated_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="admin-panel">
              <div className="admin-panel-header">
                <h3>Login Methods</h3>
              </div>
              {data.loginsByMethod.length === 0 ? (
                <EmptyState>No login methods recorded.</EmptyState>
              ) : (
                <div className="admin-list">
                  {data.loginsByMethod.map((item) => (
                    <div className="admin-list-row" key={item.method}>
                      <div>
                        <strong>{formatMethod(item.method)}</strong>
                        <span>Last seen {formatDate(item.last_seen_at)}</span>
                      </div>
                      <div>
                        <strong>{formatNumber(item.count)}</strong>
                        <span>Events</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="admin-panel">
            <div className="admin-panel-header">
              <h3>Recent Feedback</h3>
            </div>
            {data.recentFeedback.length === 0 ? (
              <EmptyState>No feedback messages yet.</EmptyState>
            ) : (
              <div className="admin-feedback-list compact">
                {data.recentFeedback.map((item) => (
                  <article className={`admin-feedback-card ${item.status}`} key={item.id}>
                    <div className="admin-feedback-card-header">
                      <div>
                        <span className={`admin-feedback-status ${item.status}`}>
                          {item.status === 'new' ? 'New' : 'Read'}
                        </span>
                        <strong>{userLabel(item.reporter_username, item.reporter_email)}</strong>
                      </div>
                      <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
                    </div>
                    <p className="admin-feedback-message">{item.message}</p>
                    <div className="admin-feedback-meta">
                      <span>{item.contact_email ? `Contact: ${item.contact_email}` : 'No contact email'}</span>
                      <span>{item.path ?? 'Unknown page'}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
