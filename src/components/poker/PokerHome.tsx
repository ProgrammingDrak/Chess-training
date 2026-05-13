interface PokerHomeProps {
  onViewDashboard: () => void;
  onViewDrills: () => void;
  onViewProfiles: () => void;
  onViewHandLookup: () => void;
  onViewLiveSession: () => void;
  onBack: () => void;
}

export function PokerHome({
  onViewDashboard,
  onViewDrills,
  onViewProfiles,
  onViewHandLookup,
  onViewLiveSession,
}: PokerHomeProps) {
  return (
    <div className="poker-home">
      <div className="poker-home-header">
        <div>
          <h1>♠ Poker GTO Training</h1>
          <p className="poker-home-subtitle">
            Your poker workspace for drills, lookup tools, profiles, and live session tracking.
            Train the fundamentals, then bring those decisions to the table.
          </p>
        </div>
      </div>

      {/* Tools section */}
      <button
        className="drill-module-card"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 16, textAlign: 'left', justifyContent: 'flex-start' }}
        onClick={onViewDrills}
      >
        <div className="drill-module-icon" style={{ fontSize: '1.6rem', flexShrink: 0 }}>DR</div>
        <div style={{ flex: 1 }}>
          <div className="drill-module-name">Drills</div>
          <div className="drill-module-desc">
            Hand selection, pot odds, equity estimator, bet sizing, opponent simulator,
            EV calculator, and range reading now live together in one drill workspace.
          </div>
        </div>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)', flexShrink: 0 }}>→</div>
      </button>
      <button
        className="drill-module-card"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 16, textAlign: 'left', justifyContent: 'flex-start' }}
        onClick={onViewHandLookup}
      >
        <div className="drill-module-icon" style={{ fontSize: '1.6rem', flexShrink: 0 }}>🔎</div>
        <div style={{ flex: 1 }}>
          <div className="drill-module-name">
            Hand Lookup Lab
          </div>
          <div className="drill-module-desc">
            Look up exact hole cards, add flop, turn, and river runouts, then compare street-by-street
            equity, made-hand stats, draw pressure, and preflop range context.
          </div>
        </div>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)', flexShrink: 0 }}>→</div>
      </button>
      <button
        className="drill-module-card"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 16, textAlign: 'left', justifyContent: 'flex-start' }}
        onClick={onViewProfiles}
      >
        <div className="drill-module-icon" style={{ fontSize: '1.6rem', flexShrink: 0 }}>📋</div>
        <div style={{ flex: 1 }}>
          <div className="drill-module-name">
            Player Profiles
          </div>
          <div className="drill-module-desc">
            Build hand-range profiles for Hero and opponents. 4-color action grid (fold/limp/call/raise),
            per-position ranges, post-flop thresholds. Use them to benchmark decisions against any playing style.
          </div>
        </div>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)', flexShrink: 0 }}>→</div>
      </button>
      <button
        className="drill-module-card"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 16, textAlign: 'left', justifyContent: 'flex-start' }}
        onClick={onViewLiveSession}
      >
        <div className="drill-module-icon" style={{ fontSize: '1.6rem', flexShrink: 0 }}>🎲</div>
        <div style={{ flex: 1 }}>
          <div className="drill-module-name">
            Live Session Tracker
          </div>
          <div className="drill-module-desc">
            Track real hands at a real table. Tap the winner of each hand; the button advances
            automatically. Per-session stats: hands played, hands per hour, win % per player, win %
            by position.
          </div>
        </div>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)', flexShrink: 0 }}>→</div>
      </button>
      <button
        className="drill-module-card"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 16, textAlign: 'left', justifyContent: 'flex-start' }}
        onClick={onViewDashboard}
      >
        <div className="drill-module-icon" style={{ fontSize: '1.6rem', flexShrink: 0 }}>ST</div>
        <div style={{ flex: 1 }}>
          <div className="drill-module-name">My Stats</div>
          <div className="drill-module-desc">
            Review drill accuracy, attempts, progress trends, and reset poker training stats.
          </div>
        </div>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)', flexShrink: 0 }}>→</div>
      </button>

      {/* GTO Info Section */}
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
          About GTO Play
        </div>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 700 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Game Theory Optimal (GTO)</strong> is a mathematically unexploitable strategy based on Nash Equilibrium —
          a balance point where neither player can improve by changing their strategy alone.
          Mastering GTO fundamentals allows you to identify when opponents deviate from optimal play,
          enabling powerful exploitative adjustments.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: '0.8rem' }}>
          {[
            'Pot Odds = Call / (Pot + Call)',
            'Rule of 4: Outs × 4 on flop',
            'Rule of 2: Outs × 2 on turn',
            'EV = Σ(P × outcome)',
          ].map((formula) => (
            <code
              key={formula}
              style={{
                background: 'var(--bg-3)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '4px 10px',
                fontFamily: 'var(--mono)',
                color: 'var(--accent-hover)',
              }}
            >
              {formula}
            </code>
          ))}
        </div>
      </div>
    </div>
  );
}
