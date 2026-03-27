import type { RangeChart } from '../../types/poker';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

interface RangeGridProps {
  chart: RangeChart;
  highlightHand?: string;
}

export function RangeGrid({ chart, highlightHand }: RangeGridProps) {
  // Build lookup map
  const cellMap = new Map(chart.cells.map((c) => [c.hand, c]));

  const cells = [];
  for (let i = 0; i < RANKS.length; i++) {
    for (let j = 0; j < RANKS.length; j++) {
      let hand: string;
      if (i === j) {
        hand = `${RANKS[i]}${RANKS[i]}`;
      } else if (i < j) {
        hand = `${RANKS[i]}${RANKS[j]}s`;
      } else {
        hand = `${RANKS[j]}${RANKS[i]}o`;
      }
      const cell = cellMap.get(hand);
      const action = cell?.action ?? 'fold';
      const isHighlighted = highlightHand === hand;

      cells.push(
        <div
          key={`${i}-${j}`}
          className={`range-cell ${action} ${isHighlighted ? 'highlight' : ''}`}
          title={`${hand}: ${action}${cell?.frequency ? ` (${cell.frequency}%)` : ''}`}
        >
          {hand.length <= 3 ? hand : hand.slice(0, 2)}
        </div>,
      );
    }
  }

  return (
    <div className="range-grid-container">
      <div className="range-grid">{cells}</div>
      <div className="range-legend">
        <div className="range-legend-item">
          <div className="range-legend-swatch range-cell raise" style={{ width: 12, height: 12 }} />
          <span style={{ color: 'var(--text-muted)' }}>Raise</span>
        </div>
        <div className="range-legend-item">
          <div className="range-legend-swatch" style={{ width: 12, height: 12, background: '#1a2a0d', borderRadius: 2 }} />
          <span style={{ color: 'var(--text-muted)' }}>Raise (mixed)</span>
        </div>
        <div className="range-legend-item">
          <div className="range-legend-swatch" style={{ width: 12, height: 12, background: '#3d3000', borderRadius: 2 }} />
          <span style={{ color: 'var(--text-muted)' }}>Call</span>
        </div>
        <div className="range-legend-item">
          <div className="range-legend-swatch" style={{ width: 12, height: 12, background: 'var(--bg-3)', borderRadius: 2 }} />
          <span style={{ color: 'var(--text-muted)' }}>Fold</span>
        </div>
      </div>
    </div>
  );
}
