import type { UserTier } from '../types/tiers';

interface TierGateModalProps {
  featureName: string;
  requiredTier: UserTier;
  currentTier: UserTier | null;
  onClose: () => void;
  onSignIn: () => void;
}

export function TierGateModal({
  featureName,
  currentTier,
  onClose,
  onSignIn,
}: TierGateModalProps) {
  return (
    <div className="tier-gate-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tier-gate-modal" role="dialog" aria-modal="true" aria-label={`${featureName} locked`}>
        <button className="tier-gate-close" onClick={onClose} aria-label="Close">×</button>
        <div className="tier-gate-kicker">Account required</div>
        <h2>{featureName}</h2>
        <p>
          Create an account or log in to use this tool.
        </p>
        <div className="tier-gate-actions">
          {!currentTier && (
            <button className="btn-primary" onClick={onSignIn}>
              Log in or create account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
