import type { LiveStreet } from '../../../types/liveSession';
import type { ActionSummary } from '../../../utils/liveHandEngine';
import { formatLiveNumber } from '../../../utils/liveMoney';

export interface LiveActionOdds {
  callBB: number;
  potBB: number;
  actorRemainingAfterCallBB: number;
  biggestOpponentRemainingBB: number;
  impliedFutureBB: number;
  potRequiredEquityPct: number;
  impliedRequiredEquityPct: number;
  potOddsRatio: string;
  impliedOddsRatio: string;
  stackLabel: string;
}

interface LiveActionBarProps {
  street: LiveStreet;
  actorName: string;
  actionSummary: ActionSummary | null;
  actionOdds: LiveActionOdds | null;
  disabled: boolean;
  hasUserActions: boolean;
  onFold: () => void;
  onCheckOrCall: () => void;
  onBetOrRaise: () => void;
  onWinner: () => void;
  onUndo: () => void;
  showWinner?: boolean;
}

function formatNumber(value: number): string {
  return formatLiveNumber(value);
}

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}

export function LiveActionBar({
  street,
  actorName,
  actionSummary,
  actionOdds,
  disabled,
  hasUserActions,
  onFold,
  onCheckOrCall,
  onBetOrRaise,
  onWinner,
  onUndo,
  showWinner = true,
}: LiveActionBarProps) {
  return (
    <section className="live-sticky-action-bar" aria-label="Live action controls">
      <div className="live-sticky-action-main">
        <div>
          <div className="live-card-modal-kicker">{street}</div>
          <h3>{actorName}</h3>
        </div>
        <div className="live-action-panel-meta">
          {actionOdds && (
            <button type="button" className="live-action-odds-chip" aria-label={`Pot odds ${actionOdds.callBB > 0 ? actionOdds.potOddsRatio : 'free check'}`}>
              <span className="live-action-odds-label">Pot odds</span>
              <strong>{actionOdds.callBB > 0 ? actionOdds.potOddsRatio : 'Free'}</strong>
              <span className="live-action-odds-tooltip" role="tooltip">
                <span className="live-action-odds-title">Pot odds</span>
                {actionOdds.callBB > 0 ? (
                  <>
                    <span>Current price = {formatNumber(actionOdds.potBB)}BB pot : {formatNumber(actionOdds.callBB)}BB call = {actionOdds.potOddsRatio}.</span>
                    <span>Required equity = {formatNumber(actionOdds.callBB)} / ({formatNumber(actionOdds.potBB)} + {formatNumber(actionOdds.callBB)}) = {formatPercent(actionOdds.potRequiredEquityPct)}</span>
                  </>
                ) : (
                  <span>No call required. Checking is free.</span>
                )}
                <span className="live-action-odds-divider" />
                <span>{actionOdds.stackLabel}</span>
              </span>
            </button>
          )}
          {actionOdds && (
            <button type="button" className="live-action-odds-chip" aria-label={`Implied odds ${actionOdds.callBB > 0 ? actionOdds.impliedOddsRatio : 'not available'}`}>
              <span className="live-action-odds-label">Implied odds</span>
              <strong>{actionOdds.callBB > 0 ? actionOdds.impliedOddsRatio : 'N/A'}</strong>
              <span className="live-action-odds-tooltip" role="tooltip">
                <span className="live-action-odds-title">Max implied odds</span>
                {actionOdds.callBB > 0 ? (
                  <>
                    <span>Max future win = min({formatNumber(actionOdds.actorRemainingAfterCallBB)}BB after call, {formatNumber(actionOdds.biggestOpponentRemainingBB)}BB deepest opponent) = {formatNumber(actionOdds.impliedFutureBB)}BB.</span>
                    <span>Max implied price = ({formatNumber(actionOdds.potBB)}BB pot + {formatNumber(actionOdds.impliedFutureBB)}BB future) : {formatNumber(actionOdds.callBB)}BB call = {actionOdds.impliedOddsRatio}.</span>
                    <span>Required equity at that max = {formatNumber(actionOdds.callBB)} / ({formatNumber(actionOdds.potBB)} + {formatNumber(actionOdds.callBB)} + {formatNumber(actionOdds.impliedFutureBB)}) = {formatPercent(actionOdds.impliedRequiredEquityPct)}</span>
                  </>
                ) : (
                  <span>No call is at risk yet, so implied odds do not apply.</span>
                )}
                <span className="live-action-odds-divider" />
                <span>Pot {formatNumber(actionOdds.potBB)}BB · To call {formatNumber(actionOdds.callBB)}BB · {actionOdds.stackLabel}</span>
              </span>
            </button>
          )}
        </div>
      </div>
      <div className="live-sticky-action-buttons">
        <button type="button" className="hl-po-chip" onClick={onFold} disabled={disabled}>Fold</button>
        <button
          type="button"
          className="hl-po-chip"
          onClick={onCheckOrCall}
          disabled={disabled || (!actionSummary?.canCheck && !actionSummary?.canCall)}
        >
          {actionSummary?.canCheck ? 'Check' : `Call ${formatNumber(actionSummary?.toCallBB ?? 0)}BB`}
        </button>
        <button type="button" className="hl-po-chip" onClick={onBetOrRaise} disabled={disabled}>
          {actionSummary?.canBet ? 'Bet' : 'Raise'}
        </button>
        {showWinner && <button type="button" className="hl-po-chip" onClick={onWinner} disabled={disabled}>Winner</button>}
        <button type="button" className="hl-po-chip" onClick={onUndo} disabled={!hasUserActions}>Undo</button>
      </div>
    </section>
  );
}
