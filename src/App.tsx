import { useState, useEffect, useRef } from 'react';
import type { Opening, AppView } from './types';
import type { PokerDrillType } from './types/poker';
import type { BlackjackDrillType } from './types/blackjack';
import type { UserTier } from './types/tiers';
import { useProgress } from './hooks/useProgress';
import { usePokerProgress } from './hooks/usePokerProgress';
import { useBlackjackProgress } from './hooks/useBlackjackProgress';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthModal } from './components/auth/AuthModal';
import { AccountModal } from './components/auth/AccountModal';
import { TierGateModal } from './components/TierGateModal';
import { GameSelector } from './components/GameSelector';
import { OpeningSelector } from './components/OpeningSelector';
import { LineSelector } from './components/LineSelector';
import { PracticeBoard } from './components/PracticeBoard';
import { ChallengeBoard } from './components/ChallengeBoard';
import { Dashboard } from './components/Dashboard';
import { PokerHome } from './components/poker/PokerHome';
import { PokerDrillsHome } from './components/poker/PokerDrillsHome';
import { PokerDrillRouter } from './components/poker/PokerDrillRouter';
import { PokerDashboard } from './components/poker/PokerDashboard';
import { ProfilesHome } from './components/poker/profiles/ProfilesHome';
import { HandLookup } from './components/poker/HandLookup';
import { LiveSessionsHome } from './components/poker/live/LiveSessionsHome';
import { LiveSessionActive } from './components/poker/live/LiveSessionActive';
import { usePlayerProfiles } from './hooks/usePlayerProfiles';
import { useLiveSessions } from './hooks/useLiveSessions';
import { BlackjackHome } from './components/blackjack/BlackjackHome';
import { BlackjackDrillRouter } from './components/blackjack/BlackjackDrillRouter';
import { BlackjackDashboard } from './components/blackjack/BlackjackDashboard';
import { FEATURE_TIERS, POKER_DRILL_TIERS } from './data/featureTiers';
import { HIGHEST_USER_TIER, USER_TIERS, canAccessTier, getTierLabel } from './types/tiers';

const CHESS_VIEWS: AppView[] = ['chess_home', 'opening_detail', 'practice', 'challenge', 'dashboard'];
const POKER_VIEWS: AppView[] = ['poker_home', 'poker_drills', 'poker_drill', 'poker_dashboard', 'poker_profiles', 'poker_hand_lookup', 'poker_live_home', 'poker_live_active'];
const BLACKJACK_VIEWS: AppView[] = ['blackjack_home', 'blackjack_drill', 'blackjack_dashboard'];
const ADMIN_VIEW_STATES = ['non-user', ...USER_TIERS] as const;

type AdminViewState = (typeof ADMIN_VIEW_STATES)[number];

const ADMIN_VIEW_LABELS: Record<AdminViewState, string> = {
  'non-user': 'Non-user',
  user: 'User',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
};

const POKER_DRILL_NAMES: Record<PokerDrillType, string> = {
  hand_selection: 'Hand Selection',
  pot_odds: 'Pot Odds',
  equity_estimation: 'Equity Estimator',
  bet_sizing: 'Bet Sizing',
  opponent_simulation: 'Opponent Simulator',
  ev_calculation: 'EV Calculator',
  range_reading: 'Range Reading',
};

function getInitialTheme(): 'dark' | 'light' {
  try {
    const stored = localStorage.getItem('gto-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* ignore */ }
  return 'dark';
}

// ── Nav auth button ───────────────────────────────────────────────────────────

function getInitialAdminViewState(): AdminViewState {
  try {
    const stored = localStorage.getItem('gto-admin-view-tier');
    if (ADMIN_VIEW_STATES.includes(stored as AdminViewState)) return stored as AdminViewState;
  } catch { /* ignore */ }
  return HIGHEST_USER_TIER;
}

function AuthButton({
  adminViewTier,
  onAdminViewTierChange,
  onOpenAccount,
  onOpenModal,
}: {
  adminViewTier: AdminViewState;
  onAdminViewTierChange: (tier: AdminViewState) => void;
  onOpenAccount: () => void;
  onOpenModal: () => void;
}) {
  const { user, loading, logout } = useAuth();

  if (user) {
    return (
      <div className="nav-auth">
        <button className="nav-username nav-account-btn" onClick={onOpenAccount}>
          {user.username}
        </button>
        {user.role === 'admin' && <span className="nav-role-badge">Admin</span>}
        {user.role !== 'admin' && (
          <span className={`nav-tier-badge tier-${user.tier}`}>{getTierLabel(user.tier)}</span>
        )}
        {user.role === 'admin' && (
          <label className="admin-view-tier">
            <span>View as</span>
            <select
              value={adminViewTier}
              onChange={(e) => onAdminViewTierChange(e.target.value as AdminViewState)}
            >
              {ADMIN_VIEW_STATES.map((tier) => (
                <option key={tier} value={tier}>{ADMIN_VIEW_LABELS[tier]}</option>
              ))}
            </select>
          </label>
        )}
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

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messageRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (message.trim().length < 3) {
      setError('Tell us a little more first.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message,
          email,
          path: window.location.pathname,
          source: 'app feedback button',
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || 'Failed to submit feedback');
      }
      setSent(true);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="feedback-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="feedback-modal" role="dialog" aria-modal="true" aria-label="Submit feedback">
        <button className="feedback-close" onClick={onClose} aria-label="Close">×</button>
        <div className="feedback-kicker">Feedback</div>
        <h2>Send a suggestion</h2>
        {sent ? (
          <div className="feedback-success">
            Thanks. Your feedback was sent to the admins.
          </div>
        ) : (
          <form className="feedback-form" onSubmit={handleSubmit}>
            <label className="feedback-field" htmlFor="feedback-message">
              <span>Suggestion or feedback</span>
              <textarea
                id="feedback-message"
                ref={messageRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What should we improve, add, or fix?"
                maxLength={5000}
              />
            </label>
            <label className="feedback-field" htmlFor="feedback-email">
              <span>Email for follow-up</span>
              <input
                id="feedback-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="optional"
              />
            </label>
            {error && <p className="auth-error">{error}</p>}
            <div className="feedback-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Main app (inner — must be inside AuthProvider) ────────────────────────────

function AppInner() {
  const { user } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);
  const [adminViewTier, setAdminViewTier] = useState<AdminViewState>(getInitialAdminViewState);
  const [view, setView] = useState<AppView>('home');
  const [showAuth, setShowAuth] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [tierGate, setTierGate] = useState<{ featureName: string; requiredTier: UserTier } | null>(null);
  const [selectedOpening, setSelectedOpening] = useState<Opening | null>(null);
  const [practiceLineIndex, setPracticeLineIndex] = useState(0);
  const [pokerDrillType, setPokerDrillType] = useState<PokerDrillType | null>(null);
  const [bjDrillType, setBjDrillType] = useState<BlackjackDrillType | null>(null);
  const [activeLiveSessionId, setActiveLiveSessionId] = useState<string | null>(null);

  const { progress, recordAttempt, resetProgress } = useProgress();
  const { progress: pokerProgress, recordAttempt: recordPokerAttempt, resetProgress: resetPokerProgress, getDrillStats } = usePokerProgress();
  const { progress: bjProgress, recordAttempt: recordBJAttempt, resetProgress: resetBJProgress, getDrillStats: getBJDrillStats } = useBlackjackProgress();
  const { profiles, saveProfile, deleteProfile, duplicateTemplate, createBlankProfile } = usePlayerProfiles();
  const { sessions: liveSessions, saveSession: saveLiveSession, deleteSession: deleteLiveSession } = useLiveSessions();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('gto-theme', theme); } catch { /* ignore */ }
  }, [theme]);

  useEffect(() => {
    try { localStorage.setItem('gto-admin-view-tier', adminViewTier); } catch { /* ignore */ }
  }, [adminViewTier]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  const accessTier = user?.role === 'admin'
    ? adminViewTier === 'non-user' ? null : adminViewTier
    : user?.tier ?? null;

  const inChess = CHESS_VIEWS.includes(view);
  const inPoker = POKER_VIEWS.includes(view);
  const inBlackjack = BLACKJACK_VIEWS.includes(view);

  useEffect(() => {
    const lockedViews: Partial<Record<AppView, { featureName: string; requiredTier: UserTier }>> = {
      poker_hand_lookup: { featureName: 'What Should I Do?', requiredTier: FEATURE_TIERS.pokerHandLookup },
      poker_live_home: { featureName: 'Live Session Tracker', requiredTier: FEATURE_TIERS.pokerLiveSession },
      poker_live_active: { featureName: 'Live Session Tracker', requiredTier: FEATURE_TIERS.pokerLiveSession },
    };
    const lockedView = lockedViews[view];
    if (!lockedView || canAccessTier(accessTier, lockedView.requiredTier)) return;

    if (view === 'poker_live_active') setActiveLiveSessionId(null);
    setView('poker_home');
    setTierGate(lockedView);
  }, [accessTier, view]);

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
    const requiredTier = POKER_DRILL_TIERS[drillType];
    const openDrill = () => {
      setPokerDrillType(drillType);
      setView('poker_drill');
    };

    if (!requiredTier) {
      openDrill();
      return;
    }

    requireTier(requiredTier, POKER_DRILL_NAMES[drillType], openDrill);
  };

  const handleSelectBJDrill = (drillType: BlackjackDrillType) => {
    setBjDrillType(drillType);
    setView('blackjack_drill');
  };

  const requireTier = (requiredTier: UserTier, featureName: string, onAllowed: () => void) => {
    if (canAccessTier(accessTier, requiredTier)) {
      onAllowed();
      return;
    }
    setTierGate({ requiredTier, featureName });
  };

  const openAuthFromTierGate = () => {
    setTierGate(null);
    setShowAuth(true);
  };

  return (
    <div className="app">
      {/* Nav bar */}
      <nav className="app-nav">
        <button
          className="nav-logo"
          onClick={() => setView('home')}
        >
          GTO Training
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
                className={`nav-link ${view === 'poker_drills' || view === 'poker_drill' ? 'active' : ''}`}
                onClick={() => setView('poker_drills')}
              >
                Drills
              </button>
              <button
                className={`nav-link ${view === 'poker_profiles' ? 'active' : ''}`}
                onClick={() => setView('poker_profiles')}
              >
                Profiles
              </button>
              <button
                className={`nav-link ${view === 'poker_hand_lookup' ? 'active' : ''}`}
                onClick={() => requireTier(FEATURE_TIERS.pokerHandLookup, 'What Should I Do?', () => setView('poker_hand_lookup'))}
              >
                Hand Lookup
              </button>
              <button
                className={`nav-link ${view === 'poker_live_home' || view === 'poker_live_active' ? 'active' : ''}`}
                onClick={() => requireTier(FEATURE_TIERS.pokerLiveSession, 'Live Session Tracker', () => setView('poker_live_home'))}
              >
                Live Session
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
          <AuthButton
            adminViewTier={adminViewTier}
            onAdminViewTierChange={setAdminViewTier}
            onOpenAccount={() => setShowAccount(true)}
            onOpenModal={() => setShowAuth(true)}
          />
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
            onViewDashboard={() => setView('poker_dashboard')}
            onViewDrills={() => setView('poker_drills')}
            onViewProfiles={() => setView('poker_profiles')}
            onViewHandLookup={() => requireTier(FEATURE_TIERS.pokerHandLookup, 'What Should I Do?', () => setView('poker_hand_lookup'))}
            onViewLiveSession={() => requireTier(FEATURE_TIERS.pokerLiveSession, 'Live Session Tracker', () => setView('poker_live_home'))}
            onBack={() => setView('home')}
          />
        )}

        {view === 'poker_drills' && (
          <PokerDrillsHome
            getDrillStats={getDrillStats}
            onSelectDrill={handleSelectPokerDrill}
            onBack={() => setView('poker_home')}
          />
        )}

        {view === 'poker_drill' && pokerDrillType && (
          <PokerDrillRouter
            drillType={pokerDrillType}
            onRecordAttempt={recordPokerAttempt}
            onBack={() => setView('poker_drills')}
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
            canCreateProfiles={canAccessTier(accessTier, FEATURE_TIERS.pokerProfiles)}
            onCreateProfileBlocked={() =>
              requireTier(FEATURE_TIERS.pokerProfiles, 'Create Player Profiles', () => {})
            }
            onBack={() => setView('poker_home')}
          />
        )}

        {view === 'poker_hand_lookup' && (
          <HandLookup
            profiles={profiles}
            onBack={() => setView('poker_home')}
          />
        )}

        {view === 'poker_live_home' && (
          <LiveSessionsHome
            sessions={liveSessions}
            profiles={profiles}
            onCreateProfile={(name, tableSize) =>
              createBlankProfile(name, 'villain', tableSize, 20, 20)
            }
            onSaveSession={saveLiveSession}
            onDeleteSession={deleteLiveSession}
            onResumeSession={(id) => {
              setActiveLiveSessionId(id);
              setView('poker_live_active');
            }}
            onStartSession={(s) => {
              setActiveLiveSessionId(s.id);
              setView('poker_live_active');
            }}
            onBack={() => setView('poker_home')}
          />
        )}

        {view === 'poker_live_active' && activeLiveSessionId && (() => {
          const session = liveSessions.find(s => s.id === activeLiveSessionId);
          if (!session) {
            // Session was deleted or not yet loaded — bounce back to home.
            setView('poker_live_home');
            return null;
          }
          return (
            <LiveSessionActive
              session={session}
              profiles={profiles}
              onSave={saveLiveSession}
              onCreateProfile={(name, tableSize) =>
                createBlankProfile(name, 'villain', tableSize, 20, 20)
              }
              onExit={() => {
                setActiveLiveSessionId(null);
                setView('poker_live_home');
              }}
            />
          );
        })()}

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

      <button className="feedback-launcher" onClick={() => setShowFeedback(true)}>
        Feedback
      </button>

      {/* Auth modal */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showAccount && <AccountModal onClose={() => setShowAccount(false)} />}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
      {tierGate && (
        <TierGateModal
          featureName={tierGate.featureName}
          requiredTier={tierGate.requiredTier}
          currentTier={accessTier}
          onClose={() => setTierGate(null)}
          onSignIn={openAuthFromTierGate}
        />
      )}
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
