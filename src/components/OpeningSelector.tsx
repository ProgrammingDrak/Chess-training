import { useState, useMemo } from 'react';
import type { Opening } from '../types';
import { ALL_OPENINGS } from '../data/openings';
import { QualityBadge } from './QualityBadge';
import type { AppProgress } from '../types';

interface Props {
  progress: AppProgress;
  onSelect: (opening: Opening) => void;
}

type SideFilter = 'all' | 'white' | 'black';
type MoveFilter = 'all' | 'e4' | 'd4' | 'c4' | 'other';
type StyleFilter = 'all' | 'classical' | 'aggressive' | 'solid' | 'dynamic';
type SortOption = 'default' | 'name' | 'lines' | 'progress';

const SIDE_LABELS: Record<SideFilter, string> = {
  all: 'All Sides',
  white: '♔ White',
  black: '♚ Black',
};

const MOVE_LABELS: Record<MoveFilter, string> = {
  all: 'All Openings',
  e4: '1.e4',
  d4: '1.d4',
  c4: '1.c4',
  other: 'Other',
};

const STYLE_LABELS: Record<StyleFilter, string> = {
  all: 'All Styles',
  classical: 'Classical',
  aggressive: 'Aggressive',
  solid: 'Solid',
  dynamic: 'Dynamic',
};

const SORT_LABELS: Record<SortOption, string> = {
  default: 'Default',
  name: 'Name A–Z',
  lines: 'Most Lines',
  progress: 'Least Mastered',
};

const AGGRESSIVE_TAGS = ['aggressive', 'attacking', 'sharp', 'gambit'];
const SOLID_TAGS = ['solid', 'positional', 'structural', 'systematic'];
const DYNAMIC_TAGS = ['dynamic', 'fianchetto', 'hypermodern', 'counterattack'];
const CLASSICAL_TAGS = ['classical', 'strategic'];

function matchesStyle(opening: Opening, style: StyleFilter): boolean {
  if (style === 'all') return true;
  const tags = opening.tags;
  if (style === 'aggressive') return AGGRESSIVE_TAGS.some((t) => tags.includes(t));
  if (style === 'solid') return SOLID_TAGS.some((t) => tags.includes(t));
  if (style === 'dynamic') return DYNAMIC_TAGS.some((t) => tags.includes(t));
  if (style === 'classical') return CLASSICAL_TAGS.some((t) => tags.includes(t));
  return true;
}

function firstMove(opening: Opening): MoveFilter {
  const m = opening.setupMoves[0];
  if (m === 'e4') return 'e4';
  if (m === 'd4') return 'd4';
  if (m === 'c4') return 'c4';
  return 'other';
}

export function OpeningSelector({ progress, onSelect }: Props) {
  const [side, setSide] = useState<SideFilter>('all');
  const [move, setMove] = useState<MoveFilter>('all');
  const [style, setStyle] = useState<StyleFilter>('all');
  const [sort, setSort] = useState<SortOption>('default');
  const [search, setSearch] = useState('');

  const getStats = (opening: Opening) => {
    const lineEntries = Object.values(progress.lines).filter((l) => l.openingId === opening.id);
    const mastered = lineEntries.filter((l) => l.mastered).length;
    const attempted = lineEntries.filter((l) => l.attempts > 0).length;
    const total = opening.lines.length;
    const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
    return { mastered, attempted, total, pct };
  };

  const filtered = useMemo(() => {
    let list = ALL_OPENINGS.filter((o) => {
      if (side !== 'all' && o.learnerColor !== side) return false;
      if (move !== 'all' && firstMove(o) !== move) return false;
      if (!matchesStyle(o, style)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!o.name.toLowerCase().includes(q) && !o.tags.some((t) => t.includes(q))) return false;
      }
      return true;
    });

    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'lines') list = [...list].sort((a, b) => b.lines.length - a.lines.length);
    else if (sort === 'progress') {
      list = [...list].sort((a, b) => {
        const sa = getStats(a), sb = getStats(b);
        if (sa.attempted === 0 && sb.attempted === 0) return 0;
        if (sa.attempted === 0) return -1;
        if (sb.attempted === 0) return 1;
        return sa.pct - sb.pct;
      });
    }
    return list;
  }, [side, move, style, sort, search, progress]);

  const totalOpenings = ALL_OPENINGS.length;
  const availableMoves = useMemo(() => {
    const moves = new Set(ALL_OPENINGS.map(firstMove));
    return moves;
  }, []);

  return (
    <div className="opening-selector">
      <div className="selector-header">
        <h1>Chess Opening Trainer</h1>
        <p className="subtitle">
          {totalOpenings} openings — from classical to hypermodern. Filter by side, first move, and style.
        </p>
      </div>

      {/* Filter + Sort bar */}
      <div className="opening-filters">
        {/* Search */}
        <div className="opening-search-wrap">
          <input
            className="opening-search"
            type="text"
            placeholder="Search openings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="opening-search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        {/* Filter groups */}
        <div className="opening-filter-groups">
          <div className="filter-group">
            <span className="filter-group-label">Side</span>
            <div className="filter-btns">
              {(['all', 'white', 'black'] as SideFilter[]).map((s) => (
                <button
                  key={s}
                  className={`filter-btn ${side === s ? 'active' : ''}`}
                  onClick={() => setSide(s)}
                >
                  {SIDE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-group-label">First Move</span>
            <div className="filter-btns">
              {(['all', 'e4', 'd4', 'c4', 'other'] as MoveFilter[]).map((m) => (
                <button
                  key={m}
                  className={`filter-btn ${move === m ? 'active' : ''} ${!availableMoves.has(m) && m !== 'all' ? 'filter-btn-disabled' : ''}`}
                  onClick={() => setMove(m)}
                >
                  {MOVE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-group-label">Style</span>
            <div className="filter-btns">
              {(['all', 'classical', 'aggressive', 'solid', 'dynamic'] as StyleFilter[]).map((st) => (
                <button
                  key={st}
                  className={`filter-btn ${style === st ? 'active' : ''}`}
                  onClick={() => setStyle(st)}
                >
                  {STYLE_LABELS[st]}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-group-label">Sort</span>
            <div className="filter-btns">
              {(['default', 'name', 'lines', 'progress'] as SortOption[]).map((so) => (
                <button
                  key={so}
                  className={`filter-btn ${sort === so ? 'active' : ''}`}
                  onClick={() => setSort(so)}
                >
                  {SORT_LABELS[so]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Active filter summary + reset */}
        {(side !== 'all' || move !== 'all' || style !== 'all' || search) && (
          <div className="filter-summary">
            <span>{filtered.length} of {totalOpenings} openings</span>
            <button
              className="filter-reset"
              onClick={() => { setSide('all'); setMove('all'); setStyle('all'); setSort('default'); setSearch(''); }}
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* Opening grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
          No openings match your filters.
        </div>
      ) : (
        <div className="openings-grid">
          {filtered.map((opening) => {
            const { mastered, attempted, total, pct } = getStats(opening);
            const fm = firstMove(opening);

            return (
              <button
                key={opening.id}
                className="opening-card"
                onClick={() => onSelect(opening)}
              >
                <div className="opening-card-top">
                  <div>
                    <div className="opening-card-name">{opening.name}</div>
                    <div className="opening-card-eco">{opening.eco}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div
                      className="opening-card-color"
                      style={{
                        background: opening.learnerColor === 'white' ? '#f0d9b5' : '#2c2c2c',
                        color: opening.learnerColor === 'white' ? '#2c2c2c' : '#f0d9b5',
                      }}
                    >
                      Play as {opening.learnerColor === 'white' ? '♔ White' : '♚ Black'}
                    </div>
                    <span className="opening-first-move">{fm !== 'other' ? `1.${fm}` : `1.${opening.setupMoves[0]}`}</span>
                  </div>
                </div>

                <p className="opening-card-desc">{opening.description}</p>

                <div className="opening-card-tags">
                  {opening.tags.map((t) => (
                    <span key={t} className="tag">{t}</span>
                  ))}
                </div>

                <div className="opening-card-lines">
                  <span className="lines-count">{total} lines</span>
                  <span className="lines-range">
                    {opening.lines[0] && (
                      <>
                        <QualityBadge quality={opening.lines[0].opponentQuality} size="sm" />
                        {' → '}
                        <QualityBadge quality={opening.lines[opening.lines.length - 1].opponentQuality} size="sm" />
                      </>
                    )}
                  </span>
                </div>

                {attempted > 0 && (
                  <div className="opening-card-progress">
                    <div className="progress-bar-track">
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="progress-label">{mastered}/{total} mastered</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
