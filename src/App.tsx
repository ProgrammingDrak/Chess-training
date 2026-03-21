import { useState } from 'react';
import type { Opening, AppView } from './types';
import { useProgress } from './hooks/useProgress';
import { OpeningSelector } from './components/OpeningSelector';
import { LineSelector } from './components/LineSelector';
import { PracticeBoard } from './components/PracticeBoard';
import { Dashboard } from './components/Dashboard';

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [selectedOpening, setSelectedOpening] = useState<Opening | null>(null);
  const [practiceLineIndex, setPracticeLineIndex] = useState(0);

  const { progress, recordAttempt, resetProgress } = useProgress();

  const handleSelectOpening = (opening: Opening) => {
    setSelectedOpening(opening);
    setView('opening_detail');
  };

  const handleSelectLine = (lineIndex: number) => {
    setPracticeLineIndex(lineIndex);
    setView('practice');
  };

  const handleRecordAttempt = (openingId: string, lineId: string, firstTry: boolean) => {
    recordAttempt(openingId, lineId, firstTry);
  };

  return (
    <div className="app">
      {/* Nav bar */}
      <nav className="app-nav">
        <button
          className={`nav-logo ${view === 'home' ? 'active' : ''}`}
          onClick={() => setView('home')}
        >
          ♟ Opening Trainer
        </button>
        <div className="nav-links">
          <button
            className={`nav-link ${view === 'home' ? 'active' : ''}`}
            onClick={() => setView('home')}
          >
            Openings
          </button>
          <button
            className={`nav-link ${view === 'dashboard' ? 'active' : ''}`}
            onClick={() => setView('dashboard')}
          >
            Progress
          </button>
        </div>
      </nav>

      <main className="app-main">
        {view === 'home' && (
          <OpeningSelector progress={progress} onSelect={handleSelectOpening} />
        )}

        {view === 'opening_detail' && selectedOpening && (
          <LineSelector
            opening={selectedOpening}
            progress={progress}
            onSelectLine={handleSelectLine}
            onBack={() => setView('home')}
          />
        )}

        {view === 'practice' && selectedOpening && (
          <PracticeBoard
            opening={selectedOpening}
            startLineIndex={practiceLineIndex}
            progress={progress}
            onRecordAttempt={handleRecordAttempt}
            onBack={() => setView('opening_detail')}
          />
        )}

        {view === 'dashboard' && (
          <Dashboard
            progress={progress}
            onReset={resetProgress}
            onBack={() => setView('home')}
          />
        )}
      </main>
    </div>
  );
}
