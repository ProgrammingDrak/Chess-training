import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DealSimulator } from './DealSimulator';

function clickIfPresent(name: string): boolean {
  const button = screen.queryByRole('button', { name });
  if (!button) return false;
  expect(button).toBeEnabled();
  fireEvent.click(button);
  return true;
}

function clickHeroAction(handIndex: number): void {
  const raise = screen.queryByRole('button', { name: 'Raise' });
  const bet = screen.queryByRole('button', { name: 'Bet' });
  const check = screen.queryByRole('button', { name: 'Check' });
  const fold = screen.queryByRole('button', { name: 'Fold' });
  const call = screen.queryByRole('button', { name: /Call \d/ });

  const shouldApplyPressure = handIndex % 4 === 0;
  const shouldFold = handIndex % 9 === 0;

  if (shouldFold && fold?.hasAttribute('disabled') === false && call) {
    fireEvent.click(fold);
    return;
  }
  if (shouldApplyPressure && raise?.hasAttribute('disabled') === false) {
    fireEvent.click(raise);
    return;
  }
  if (shouldApplyPressure && bet?.hasAttribute('disabled') === false) {
    fireEvent.click(bet);
    return;
  }
  if (call?.hasAttribute('disabled') === false) {
    fireEvent.click(call);
    return;
  }
  if (check?.hasAttribute('disabled') === false) {
    fireEvent.click(check);
    return;
  }
  if (fold?.hasAttribute('disabled') === false) {
    fireEvent.click(fold);
    return;
  }

  throw new Error('No enabled Hero action was available.');
}

function finishCurrentPreflopHand(handIndex: number): void {
  for (let step = 0; step < 80; step += 1) {
    if (screen.queryAllByText(/Pre-flop complete:/).length > 0 || screen.queryAllByText(/wins .* without showdown/).length > 0) {
      return;
    }

    if (clickIfPresent('Next Bot Action')) continue;

    clickHeroAction(handIndex);
  }

  throw new Error('Pre-flop simulator got stuck before the hand ended.');
}

describe('DealSimulator', () => {
  it('plays through 30 pre-flop hands as Hero without stuck action states', () => {
    const randomValues = Array.from({ length: 500 }, (_, index) => ((index * 37) % 100) / 100);
    let randomIndex = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const value = randomValues[randomIndex % randomValues.length];
      randomIndex += 1;
      return value;
    });

    render(<DealSimulator profiles={[]} onBack={vi.fn()} />);

    for (let hand = 1; hand <= 30; hand += 1) {
      expect(screen.getByText(`Hand ${hand}`)).toBeInTheDocument();
      expect(screen.getByText('Pre-flop only')).toBeInTheDocument();

      finishCurrentPreflopHand(hand);

      const log = screen.getByRole('region', { name: 'Action log' });
      expect(within(log).getAllByText(/Hero|Villain|Pre-flop|wins/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/Flop:/)).not.toBeInTheDocument();

      if (hand < 30) {
        fireEvent.click(screen.getByRole('button', { name: 'New Hand' }));
      }
    }
  }, 15000);
});
