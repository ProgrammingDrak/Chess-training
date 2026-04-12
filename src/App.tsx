import { useState, useEffect } from 'react';
import type { Opening, AppView } from './types';
import type { PokerDrillType } from './types/poker';
import type { BlackjackDrillType } from './types/blackjack';
import { useProgress } from './hooks/useProgress';
import { usePokerProgress } from './hooks/usePokerProgress';
import { useBlackjackProgress } from './hooks/useBlackjackProgress';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthModal } from './components/auth/AuthModal';
import { GameSelector } from './components/GameSelector';
import { OpeningSelector } from './components/OpeningSelector';
import { LineSelector } from './components/LineSelector';
import { PracticeBoard } from './components/PracticeBoard';
import { ChallengeBoard } from './components/ChallengeBoard';
import { Dashboard } from './components/Dashboard';
import { PokerHome } from './components/poker/PokerHome';
import { PokerDrillRouter } from './components/poker/PokerDrillRouter';
import { PokerDashboard } from './components/poker/PokerDashboard';
import { ProfilesHome } from './components/poker/profiles/ProfilesHome';
import { HandLookup } from './components/poker/HandLookup';
import { usePlayerProfiles } from './hooks/usePlayerProfiles';
import { BlackjackHome } from './components/blackjack/BlackjackHome';
import { BlackjackDrillRouter } from './components/blackjack/BlackjackDrillRouter';
import { BlackjackDashboard } from './components/blackjack/BlackjackDashboard';

const CHESS_VIEWS: AppView[] = ['chess_home', 'opening_detail', 'practice', 'challenge', 'dashboard'];
const POKER_VIEWS: AppView[] = ['poker_home', 'poker_drill', 'poker_dashboard', 'poker_profiles', 'poker_hand_lookup'];
const BLACKJACK_VIEWS: AppView[] = ['blackjack_home', 'blackjack_drill', 'blackjack_dashboard'];

function getInitialTheme(): 'dark' | 'light' {
  try {
    const stored = localStorage.getItem('gto-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* ignore */ }
  return 'dark';
}

// ── Nav auth button ───────────────────────────────────────────────────────────

function AuthButton({ onOpenModal }: { onOpenModal: () => void }) {
  const { user, loading, logout } = useAuth();

  if (user) {
    return (
      <div className="nav-auth">
        <span className="nav-username">{user.username}</span>
        <button className="nav-link nav-logout" onClick={logout}>
          Log Out
        </button>
      </div>
    );
  }

  return (
    <button
      className="nav-link nav-login"
      onClick={onOpenModal}
      disabled={loading}
      style={loading ? { opacity: 0.45 } : undefined}
    >
      Log In
    </button>
  );
}

// ── Main app (inner — must be inside AuthProvider) ────────────────────────────

function AppInner() {
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);
  const [view, setView] = useState<AppView>('home');
  const [showAuth, setShowAuth] = useState(false);
  const [selectedOpening, setSelectedOpening] = useState<Opening | null>(null);
  const [practiceLineIndex, setPracticeLineIndex] = useState(0);
  const [pokerDrillType, setPokerDrillType] = useState<PokerDrillType | null>(null);
  const [bjDrillType, setBjDrillType] = useState<BlackjackDrillType | null>(null);

  const { progress, recordAttempt, resetProgress } = useProgress();
  const { progress: pokerProgress, recordAttempt: recordPokerAttempt, resetProgress: resetPokerProgress, getDrillStats } = usePokerProgress();
  const { progress: bjProgress, recordAttempt: recordBJAttempt, resetProgress: resetBJProgress, getDrillStats: getBJDrillStats } = useBlackjackProgress();
  const { profiles, saveProfile, deleteProfile, duplicateTemplate } = usePlayerProfiles();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('gto-theme', theme); } catch { /* ignore */ }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const inChess = CHESS_VIEWS.includes(view);
  const inPoker = POKER_VIEWS.includes(view);
  const inBlackjack = BLACKJACK_VIEWS.includes(view);

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

  const handleSelectPokerDrill = (drillType: PokerDrillType) => {
    setPokerDrillType(drillType);
    setView('poker_drill');
  };

  const handleSelectBJDrill = (drillType: BlackjackDrillType) => {
    setBjDrillType(drillType);
    setView('blackjack_drill');
  };

  return (
    <div className="app">
      {/* Nav bar */}
      <nav className="app-nav">
        <button
          className="nav-logo"
          onClick={() => setView('home')}
        >
          GTO Trainer
        </button>
        <div className="nav-links">
          {/* Root nav */}
          {view === 'home' && null}


          {/* Chess nav */}
          {inChess && (
            <>
              <button className="nav-link" onClick={() => setView('home')}>
                ← Games
              </button>
              <button
                className={`nav-link ${view === 'chess_home' ? 'active' : ''}`}
                onClick={() => setView('chess_home')}
              >
                ♟ Openings
              </button>
              <button
                className={`nav-link ${view === 'challenge' ? 'active' : ''}`}
                onClick={() => setView('challenge')}
              >
                ⚡ Challenge
              </button>
              <button
                className={`nav-link ${view === 'dashboard' ? 'active' : ''}`}
                onClick={() => setView('dashboard')}
              >
                Progress
              </button>
            </>
          )}

          {/* Poker nav */}
          {inPoker && (
            <>
              <button className="nav-link" onClick={() => setView('home')}>
                ← Games
              </button>
              <button
                className={`nav-link ${view === 'poker_home' ? 'active' : ''}`}
                onClick={() => setView('poker_home')}
              >
                ♠ Poker GTO
              </button>
              <button
                className={`nav-link ${view === 'poker_profiles' ? 'active' : ''}`}
                onClick={() => setView('poker_profiles')}
              >
                Profiles
              </button>
              <button
                className={`nav-link ${view === 'poker_hand_lookup' ? 'active' : ''}`}
                onClick={() => setView('poker_hand_lookup')}
              >
                Hand Lookup
              </button>
              <button
                className={`nav-link ${view === 'poker_dashboard' ? 'active' : ''}`}
                onClick={() => setView('poker_dashboard')}
              >
                My Stats
              </button>
            </>
          )}

          {/* Blackjack nav */}
          {inBlackjack && (
            <>
              <button className="nav-link" onClick={() => setView('home')}>
                ← Games
              </button>
              <button
                className={`nav-link ${view === 'blackjack_home' ? 'active' : ''}`}
                onClick={() => setView('blackjack_home')}
              >
                🃏 Blackjack
              </button>
              <button
                className={`nav-link ${view === 'blackjack_dashboard' ? 'active' : ''}`}
                onClick={() => setView('blackjack_dashboard')}
              >
                My Stats
              </button>
            </>
          )}

          {/* Auth + Theme — always visible */}
          <AuthButton onOpenModal={() => setShowAuth(true)} />
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
        </div>
      </nav>

      <main className="app-main">
        {/* ── Game Selector (root) ── */}
        {view === 'home' && (
          <GameSelector
            chessProgress={progress}
            pokerProgress={pokerProgress}
            bjProgress={bjProgress}
            onSelectChess={() => setView('chess_home')}
            onSelectPoker={() => setView('poker_home')}
            onSelectBlackjack={() => setView('blackjack_home')}
          />
        )}

        {/* ── Chess views ── */}
        {view === 'chess_home' && (
          <OpeningSelector progress={progress} onSelect={handleSelectOpening} />
        )}

        {view === 'opening_detail' && selectedOpening && (
          <LineSelector
            opening={selectedOpening}
            progress={progress}
            onSelectLine={handleSelectLine}
            onBack={() => setView('chess_home')}
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

        {view === 'challenge' && (
          <ChallengeBoard progress={progress} onBack={() => setView('chess_home')} />
        )}

        {view === 'dashboard' && (
          <Dashboard
            progress={progress}
            onReset={resetProgress}
            onBack={() => setView('chess_home')}
          />
        )}

        {/* ── Poker views ── */}
        {view === 'poker_home' && (
          <PokerHome
            pokerProgress={pokerProgress}
            getDrillStats={getDrillStats}
            onSelectDrill={handleSelectPokerDrill}
            onViewDashboard={() => setView('poker_dashboard')}
            onViewProfiles={() => setView('poker_profiles')}
            onViewHandLookup={() => setView('poker_hand_lookup')}
            onBack={() => setView('home')}
          />
        )}

        {view === 'poker_drill' && pokerDrillType && (
          <PokerDrillRouter
            drillType={pokerDrillType}
            onRecordAttempt={recordPokerAttempt}
            onBack={() => setView('poker_home')}
          />
        )}

        {view === 'poker_dashboard' && (
          <PokerDashboard
            pokerProgress={pokerProgress}
            onReset={resetPokerProgress}
            onBack={() => setView('poker_home')}
          />
        )}

        {view === 'poker_profiles' && (
          <ProfilesHome
            profiles={profiles}
            onSaveProfile={saveProfile}
            onDeleteProfile={deleteProfile}
            onDuplicateTemplate={duplicateTemplate}
            onBack={() => setView('poker_home')}
          />
        )}

        {view === 'poker_hand_lookup' && (
          <HandLookup
            profiles={profiles}
            onBack={() => setView('poker_home')}
          />
        )}

        {/* ── Blackjack views ── */}
        {view === 'blackjack_home' && (
          <BlackjackHome
            bjProgress={bjProgress}
            getDrillStats={getBJDrillStats}
            onSelectDrill={handleSelectBJDrill}
            onViewDashboard={() => setView('blackjack_dashboard')}
            onBack={() => setView('home')}
          />
        )}

        {view === 'blackjack_drill' && bjDrillType && (
          <BlackjackDrillRouter
            drillType={bjDrillType}
            onRecordAttempt={recordBJAttempt}
            onBack={() => setView('blackjack_home')}
          />
        )}

        {view === 'blackjack_dashboard' && (
          <BlackjackDashboard
            bjProgress={bjProgress}
            onReset={resetBJProgress}
            onBack={() => setView('blackjack_home')}
          />
        )}
      </main>

      {/* Auth modal */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
