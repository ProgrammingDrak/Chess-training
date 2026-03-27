interface CardDisplayProps {
  rank: string;
  suit?: string;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const RED_SUITS = new Set(['♥', '♦']);

const SIZE_DIMS: Record<NonNullable<CardDisplayProps['size']>, { width: number; height: number; rankSize: string; suitSize: string }> = {
  sm: { width: 52,  height: 72,  rankSize: '0.75rem', suitSize: '0.7rem'  },
  md: { width: 64,  height: 90,  rankSize: '0.9rem',  suitSize: '0.85rem' },
  lg: { width: 80,  height: 112, rankSize: '1.1rem',  suitSize: '1rem'    },
};

export function CardDisplay({ rank, suit, faceDown = false, size = 'md' }: CardDisplayProps) {
  const dims = SIZE_DIMS[size];
  const displayRank = rank === 'T' ? '10' : rank;
  const isRed = suit !== undefined && RED_SUITS.has(suit);

  const sizeClass = `bj-card-${size}`;
  const colorClass = isRed ? 'bj-card-red' : '';
  const backClass = faceDown ? 'bj-card-back' : '';

  return (
    <div
      className={`bj-card ${sizeClass} ${colorClass} ${backClass}`.trim()}
      style={{ width: dims.width, height: dims.height }}
    >
      {faceDown ? (
        <div className="bj-card-back-pattern" />
      ) : suit ? (
        <>
          <span className="bj-card-rank-tl" style={{ fontSize: dims.rankSize }}>{displayRank}</span>
          <span className="bj-card-suit-br" style={{ fontSize: dims.suitSize }}>{suit}</span>
        </>
      ) : (
        <span className="bj-card-rank-center" style={{ fontSize: dims.rankSize }}>{displayRank}</span>
      )}
    </div>
  );
}
