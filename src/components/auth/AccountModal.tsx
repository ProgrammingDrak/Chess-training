import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getTierLabel } from '../../types/tiers';

interface AccountModalProps {
  onClose: () => void;
}

export function AccountModal({ onClose }: AccountModalProps) {
  const { user } = useAuth();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

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
          <div><span>Status</span><strong>{getTierLabel(user.tier)}</strong></div>
          <div><span>Role</span><strong>{user.role === 'admin' ? 'Admin' : 'User'}</strong></div>
        </div>
      </div>
    </div>
  );
}
