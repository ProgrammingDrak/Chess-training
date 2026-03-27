import type { PokerDrillType } from '../../types/poker';
import { PotOddsDrill } from './PotOddsDrill';
import { EvCalculatorDrill } from './EvCalculatorDrill';
import { HandSelectionDrill } from './HandSelectionDrill';
import { EquityEstimatorDrill } from './EquityEstimatorDrill';
import { BetSizingDrill } from './BetSizingDrill';
import { OpponentSimulator } from './OpponentSimulator';
import { RangeReadingDrill } from './RangeReadingDrill';

interface PokerDrillRouterProps {
  drillType: PokerDrillType;
  onRecordAttempt: (drillType: PokerDrillType, scenarioId: string, correct: boolean) => void;
  onBack: () => void;
}

export function PokerDrillRouter({ drillType, onRecordAttempt, onBack }: PokerDrillRouterProps) {
  const commonProps = {
    onRecordAttempt: (scenarioId: string, correct: boolean) => onRecordAttempt(drillType, scenarioId, correct),
    onBack,
  };

  switch (drillType) {
    case 'pot_odds':
      return <PotOddsDrill {...commonProps} />;
    case 'ev_calculation':
      return <EvCalculatorDrill {...commonProps} />;
    case 'hand_selection':
      return <HandSelectionDrill {...commonProps} />;
    case 'equity_estimation':
      return <EquityEstimatorDrill {...commonProps} />;
    case 'bet_sizing':
      return <BetSizingDrill {...commonProps} />;
    case 'opponent_simulation':
      return <OpponentSimulator {...commonProps} />;
    case 'range_reading':
      return <RangeReadingDrill {...commonProps} />;
    default:
      return <div>Unknown drill type</div>;
  }
}
