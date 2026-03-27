import type { BlackjackDrillType } from '../../types/blackjack';
import { BasicStrategyDrill } from './BasicStrategyDrill';
import { CardCountingDrill } from './CardCountingDrill';
import { TrueCountDrill } from './TrueCountDrill';
import { BetSpreadDrill } from './BetSpreadDrill';

interface BlackjackDrillRouterProps {
  drillType: BlackjackDrillType;
  onRecordAttempt: (drillType: BlackjackDrillType, id: string, correct: boolean) => void;
  onBack: () => void;
}

export function BlackjackDrillRouter({ drillType, onRecordAttempt, onBack }: BlackjackDrillRouterProps) {
  const commonProps = {
    onRecordAttempt: (scenarioId: string, correct: boolean) => onRecordAttempt(drillType, scenarioId, correct),
    onBack,
  };

  switch (drillType) {
    case 'basic_strategy':
      return <BasicStrategyDrill {...commonProps} />;
    case 'card_counting':
      return <CardCountingDrill {...commonProps} />;
    case 'true_count':
      return <TrueCountDrill {...commonProps} />;
    case 'bet_spread':
      return <BetSpreadDrill {...commonProps} />;
    default:
      return <div>Unknown drill type</div>;
  }
}
