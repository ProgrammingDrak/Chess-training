import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveStreet } from '../../../types/liveSession';
import type { Card } from '../../../types/poker';
import type { VisionBoardCards } from '../../../types/vision';
import { VISION_CALIBRATION_STORAGE_KEY, VisionCapturePanel } from './VisionCapturePanel';

const emptyBoard: VisionBoardCards = [null, null, null, null, null];

function renderPanel(overrides: Partial<{
  currentHeroCards: Card[];
  currentBoard: VisionBoardCards;
  resetSignal: number;
  onApplyHeroCards: (cards: Card[]) => void;
  onApplyBoard: (board: VisionBoardCards, street: LiveStreet) => void;
}> = {}) {
  const props = {
    currentHeroCards: [],
    currentBoard: emptyBoard,
    resetSignal: 0,
    onApplyHeroCards: vi.fn(),
    onApplyBoard: vi.fn(),
    ...overrides,
  };
  render(<VisionCapturePanel {...props} />);
  return props;
}

describe('VisionCapturePanel', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    });
  });

  it('renders without screen-capture support', () => {
    renderPanel();
    expect(screen.getByText('Screen capture unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start capture' })).toBeDisabled();
  });

  it('saves and loads local calibration', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Use default regions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save calibration' }));

    const saved = JSON.parse(localStorage.getItem(VISION_CALIBRATION_STORAGE_KEY) ?? '{}') as { boardRegion?: unknown };
    expect(saved.boardRegion).toBeTruthy();

    renderPanel();
    expect(screen.getAllByText('Board range').length).toBeGreaterThan(0);
  });

  it('requires clicking Apply in confirm mode before mock hero cards are applied', () => {
    const onApplyHeroCards = vi.fn();
    renderPanel({ onApplyHeroCards });

    fireEvent.click(screen.getByRole('button', { name: 'Mock Hero' }));
    expect(onApplyHeroCards).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Apply Hero' }));
    expect(onApplyHeroCards).toHaveBeenCalledWith([
      { rank: 'A', suit: 's' },
      { rank: 'K', suit: 'd' },
    ]);
  });

  it('requires clicking Apply in confirm mode before mock board cards are applied', () => {
    const onApplyBoard = vi.fn();
    renderPanel({ onApplyBoard });

    fireEvent.click(screen.getByRole('button', { name: 'Mock Flop' }));
    expect(onApplyBoard).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Apply Board' }));
    expect(onApplyBoard).toHaveBeenCalledWith(
      [{ rank: 'A', suit: 's' }, { rank: 'K', suit: 'd' }, { rank: 'Q', suit: 'h' }, null, null],
      'flop',
    );
  });

  it('auto applies stable mock board detections when enabled', () => {
    const onApplyBoard = vi.fn();
    renderPanel({ onApplyBoard });

    fireEvent.click(screen.getByLabelText('Auto apply'));
    fireEvent.click(screen.getByRole('button', { name: 'Mock Flop' }));

    expect(onApplyBoard).toHaveBeenCalledWith(
      [{ rank: 'A', suit: 's' }, { rank: 'K', suit: 'd' }, { rank: 'Q', suit: 'h' }, null, null],
      'flop',
    );
  });
});
