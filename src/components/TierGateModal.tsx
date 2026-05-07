import { useState } from 'react';
import type { UserTier } from '../types/tiers';
import { getTierLabel } from '../types/tiers';

interface TierGateModalProps {
  featureName: string;
  requiredTier: UserTier;
  currentTier: UserTier | null;
  onClose: () => void;
  onSignIn: () => void;
}

export function TierGateModal({
  featureName,
  requiredTier,
  currentTier,
  onClose,
  onSignIn,
}: TierGateModalProps) {
  const [upgradeRequested, setUpgradeRequested] = useState(false);
  const requiredLabel = getTierLabel(requiredTier);
  const currentLabel = currentTier ? getTierLabel(currentTier) : null;

  return (
    <div className="tier-gate-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tier-gate-modal" role="dialog" aria-modal="true" aria-label={`${featureName} locked`}>
        <button className="tier-gate-close" onClick={onClose} aria-label="Close">×</button>
        <div className="tier-gate-kicker">Locked feature</div>
        <h2>{featureName}</h2>
        <p>
          You must be a {requiredLabel} level user to use this tool.
          {currentLabel ? ` Your current tier is ${currentLabel}.` : ' Create a free account first, then upgrade when checkout is connected.'}
        </p>
        {upgradeRequested && (
          <div className="tier-gate-note">
            Upgrade checkout is not wired yet. This button is the hook for the future billing flow.
          </div>
        )}
        <div className="tier-gate-actions">
          {!currentTier && (
            <button className="btn-secondary" onClick={onSignIn}>
              Log in or create account
            </button>
          )}
          <button className="btn-primary" onClick={() => setUpgradeRequested(true)}>
            Upgrade now
          </button>
        </div>
      </div>
    </div>
  );
}
