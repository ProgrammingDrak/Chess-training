import type { CSSProperties } from 'react';
import { HAND_RANK_MAP } from '../../../data/poker/profileTemplates';
import type { RangeAction, SituationRange } from '../../../types/profiles';
import { RANKS, cellHand, handCombos } from '../../../utils/handMatrix';
import { actionBucketFor, ensureActionBuckets } from '../../../utils/profileActionBuckets';

interface ProfileRangeChartProps {
  situation: SituationRange;
  profileName: string;
  position: string;
  tableSize: number;
  highlightedHand?: string | null;
}

export function ProfileRangeChart({
  situation,
  profileName,
  position,
  tableSize,
  highlightedHand,
}: ProfileRangeChartProps) {
  const buckets = ensureActionBuckets(situation);
  const actionFor = (hand: string): RangeAction => situation.range[hand] ?? 'fold';
  const playedCombos = RANKS.reduce((sum, _rowRank, row) => (
    sum + RANKS.reduce((rowSum, _colRank, col) => {
      const hand = cellHand(row, col);
      const bucket = actionBucketFor(actionFor(hand), buckets);
      return bucket.kind === 'fold' ? rowSum : rowSum + handCombos(hand);
    }, 0)
  ), 0);
  const vpipPct = ((playedCombos / 1326) * 100).toFixed(1);
  const highlightedAction = highlightedHand ? actionFor(highlightedHand) : null;
  const highlightedBucket = highlightedAction ? actionBucketFor(highlightedAction, buckets) : null;

  return (
    <section className="profile-range-chart" aria-label={`${profileName} ${position} range chart`}>
      <div className="profile-range-chart-head">
        <div>
          <span className="profile-range-chart-kicker">{position} · {tableSize}-max · {vpipPct}% VPIP</span>
          <h3>{profileName} chart</h3>
        </div>
        {highlightedHand && highlightedBucket && (
          <div className="profile-range-chart-selected" style={{ '--profile-range-action': highlightedBucket.text } as CSSProperties}>
            <span>{highlightedHand}</span>
            <strong>{highlightedBucket.label}</strong>
          </div>
        )}
      </div>

      <div className="profile-range-chart-legend">
        {buckets.map(bucket => (
          <span
            key={bucket.id}
            className="profile-range-chart-legend-item"
            style={{ '--profile-range-action': bucket.text, '--profile-range-bg': bucket.bg, '--profile-range-border': bucket.border } as CSSProperties}
          >
            <span className="profile-range-chart-swatch" />
            {bucket.label}
          </span>
        ))}
      </div>

      <div className="profile-range-chart-grid-wrap">
        <div className="profile-range-chart-grid">
          <div className="profile-range-chart-corner" />
          {RANKS.map(rank => (
            <div key={`col-${rank}`} className="profile-range-chart-axis">{rank}</div>
          ))}

          {RANKS.map((rowRank, row) => (
            <div key={`row-${rowRank}`} className="profile-range-chart-row">
              <div className="profile-range-chart-axis profile-range-chart-row-axis">{rowRank}</div>
              {RANKS.map((_colRank, col) => {
                const hand = cellHand(row, col);
                const bucket = actionBucketFor(actionFor(hand), buckets);
                const isHighlighted = highlightedHand === hand;
                const isPair = row === col;
                const isSuited = col > row;

                return (
                  <div
                    key={hand}
                    className={[
                      'profile-range-chart-cell',
                      isPair ? 'profile-range-chart-pair' : isSuited ? 'profile-range-chart-suited' : 'profile-range-chart-offsuit',
                      isHighlighted ? 'profile-range-chart-highlight' : '',
                    ].filter(Boolean).join(' ')}
                    style={{ '--profile-range-bg': bucket.bg, '--profile-range-border': bucket.border, '--profile-range-action': bucket.text } as CSSProperties}
                    title={`${hand} · ${bucket.label} · rank #${HAND_RANK_MAP[hand] ?? 169}`}
                  >
                    <span>{hand}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
