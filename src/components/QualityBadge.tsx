import type { MoveQuality } from '../types';
import { QUALITY_LABELS, QUALITY_COLORS, QUALITY_BG } from '../utils/quality';

interface Props {
  quality: MoveQuality;
  size?: 'sm' | 'md';
}

export function QualityBadge({ quality, size = 'md' }: Props) {
  const fontSize = size === 'sm' ? '0.65rem' : '0.75rem';
  const padding = size === 'sm' ? '2px 6px' : '3px 8px';

  return (
    <span
      style={{
        display: 'inline-block',
        background: QUALITY_BG[quality],
        color: QUALITY_COLORS[quality],
        border: `1px solid ${QUALITY_COLORS[quality]}40`,
        borderRadius: '4px',
        padding,
        fontSize,
        fontWeight: 600,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {QUALITY_LABELS[quality]}
    </span>
  );
}
