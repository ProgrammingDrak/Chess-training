import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { UserTier } from '../../types/tiers';
import { USER_TIERS, getTierLabel } from '../../types/tiers';

interface AccountModalProps {
  onClose: () => void;
}

interface AdminPromoCode {
  id: number;
  code: string;
  tier: UserTier;
  duration_days: number;
  max_redemptions: number | null;
  redeemed_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

async function readApiJson<T>(res: Response, fallbackMessage: string): Promise<T> {
  const text = await res.text();
  if (!text) throw new Error(res.ok ? fallbackMessage : `API unavailable (HTTP ${res.status})`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`API returned an invalid response (HTTP ${res.status})`);
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'No expiration';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function isPermanentPromoCode(code: AdminPromoCode): boolean {
  return code.duration_days === 3650 && code.max_redemptions === null && code.expires_at === null;
}

export function AccountModal({ onClose }: AccountModalProps) {
  const { user, redeemPromoCode, refreshUser } = useAuth();
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemStatus, setRedeemStatus] = useState('');
  const [redeemError, setRedeemError] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const [adminCodes, setAdminCodes] = useState<AdminPromoCode[]>([]);
  const [adminError, setAdminError] = useState('');
  const [adminStatus, setAdminStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newTier, setNewTier] = useState<UserTier>('gold');
  const [newDurationDays, setNewDurationDays] = useState('30');
  const [newMaxRedemptions, setNewMaxRedemptions] = useState('');
  const [newExpiresAt, setNewExpiresAt] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    fetch('/api/admin/promo-codes', { credentials: 'include' })
      .then((res) => readApiJson<{ promoCodes: AdminPromoCode[]; error?: string }>(res, 'Failed to load promo codes'))
      .then((data) => setAdminCodes(data.promoCodes))
      .catch((err) => setAdminError(err instanceof Error ? err.message : 'Failed to load promo codes'));
  }, [user?.role]);

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    setRedeemError('');
    setRedeemStatus('');
    setRedeeming(true);
    try {
      await redeemPromoCode(redeemCode);
      setRedeemCode('');
      setRedeemStatus('Promo applied.');
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : 'Promo code failed');
    } finally {
      setRedeeming(false);
    }
  }

  async function handleCreatePromo(e: React.FormEvent) {
    e.preventDefault();
    setAdminError('');
    setAdminStatus('');
    setCreating(true);
    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: newCode,
          tier: newTier,
          durationDays: newDurationDays,
          maxRedemptions: newMaxRedemptions,
          expiresAt: newExpiresAt,
        }),
      });
      const data = await readApiJson<{ promoCode?: AdminPromoCode; error?: string }>(res, 'Failed to create promo code');
      if (!res.ok) throw new Error(data.error ?? 'Failed to create promo code');
      if (!data.promoCode) throw new Error('Failed to create promo code');
      setAdminCodes((codes) => [data.promoCode!, ...codes]);
      setNewCode('');
      setNewMaxRedemptions('');
      setNewExpiresAt('');
      setAdminStatus('Promo code created.');
      await refreshUser();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Failed to create promo code');
    } finally {
      setCreating(false);
    }
  }

  if (!user) return null;

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
          <div><span>Base tier</span><strong>{getTierLabel(user.membershipTier ?? user.tier)}</strong></div>
          <div><span>Role</span><strong>{user.role === 'admin' ? 'Admin' : 'User'}</strong></div>
          <div>
            <span>Active promo</span>
            <strong>
              {user.activePromo
                ? user.activePromo.expiresAt
                  ? `${getTierLabel(user.activePromo.tier)} until ${formatDate(user.activePromo.expiresAt)}`
                  : `${getTierLabel(user.activePromo.tier)} with no expiration`
                : 'None'}
            </strong>
          </div>
        </div>

        <form className="account-section" onSubmit={handleRedeem}>
          <div>
            <h3>Redeem Promo Code</h3>
            <p>Add a promotional tier to this account for the code's active period.</p>
          </div>
          <div className="account-form-row">
            <input
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              placeholder="PROMO_CODE"
              required
            />
            <button className="btn-primary" type="submit" disabled={redeeming}>
              {redeeming ? 'Applying...' : 'Apply'}
            </button>
          </div>
          {redeemStatus && <p className="account-success">{redeemStatus}</p>}
          {redeemError && <p className="auth-error">{redeemError}</p>}
        </form>

        {user.role === 'admin' && (
          <section className="account-section">
            <div>
              <h3>Admin Promo Codes</h3>
              <p>Create codes that grant a selected tier for a fixed number of days after redemption.</p>
            </div>
            <form className="account-promo-grid" onSubmit={handleCreatePromo}>
              <label>
                <span>Code</span>
                <input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="LAUNCH30" required />
              </label>
              <label>
                <span>Tier</span>
                <select value={newTier} onChange={(e) => setNewTier(e.target.value as UserTier)}>
                  {USER_TIERS.filter((tier) => tier !== 'user').map((tier) => (
                    <option key={tier} value={tier}>{getTierLabel(tier)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Days</span>
                <input type="number" min="1" max="3650" value={newDurationDays} onChange={(e) => setNewDurationDays(e.target.value)} required />
              </label>
              <label>
                <span>Max uses</span>
                <input type="number" min="1" value={newMaxRedemptions} onChange={(e) => setNewMaxRedemptions(e.target.value)} placeholder="Unlimited" />
              </label>
              <label>
                <span>Code expires</span>
                <input type="date" value={newExpiresAt} onChange={(e) => setNewExpiresAt(e.target.value)} />
              </label>
              <button className="btn-primary" type="submit" disabled={creating}>
                {creating ? 'Creating...' : 'Create'}
              </button>
            </form>
            {adminStatus && <p className="account-success">{adminStatus}</p>}
            {adminError && <p className="auth-error">{adminError}</p>}
            <div className="account-code-list">
              {adminCodes.slice(0, 8).map((code) => (
                <div className="account-code-row" key={code.id}>
                  <strong>{code.code}</strong>
                  <span>{isPermanentPromoCode(code) ? `${getTierLabel(code.tier)} permanent` : `${getTierLabel(code.tier)} for ${code.duration_days} days`}</span>
                  <span>{code.redeemed_count}{code.max_redemptions ? `/${code.max_redemptions}` : ''} used</span>
                  <span>{code.expires_at ? `Ends ${formatDate(code.expires_at)}` : 'No code expiration'}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
