# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0.0] - 2026-03-27

### Added
- **Poker GTO Training**: 7 drill modules — hand selection, pot odds, equity estimation, bet sizing, EV calculation, range reading, and opponent simulation with 5 opponent profiles (NIT, TAG, LAG, calling station, maniac)
- **Blackjack Training**: 4 drill modules — basic strategy (6-deck S17/DAS), Hi-Lo card counting, true count conversion, and bet spread optimization
- **Challenge Mode**: 5-streak challenge across random chess opening lines with progress-aware queue
- **6 new chess openings**: London System, French Defense, Caro-Kann, King's Gambit, King's Indian, English Opening
- **Game selector home screen**: Choose between Chess, Poker, and Blackjack training modules
- **Progress tracking**: Per-drill accuracy stats and dashboard for all three game types
- **Test framework**: Vitest + @testing-library/react with 570 tests and GitHub Actions CI

### Fixed
- Corrected 4 invalid chess moves in opening data (Sicilian Scheveningen, King's Gambit Declined, King's Indian Classical/Samisch)
- Fixed 6 incorrect answer values in poker training data (pot odds and EV calculations)
- Fixed mid-session crash when changing difficulty filter during active drill
- Fixed correctness tracking mismatch between session and progress stats in bet sizing drill
- Fixed stale UI state when changing hand type filter in range reading drill
- Removed hardcoded worktree paths from launch.json

### Changed
- App architecture expanded from single-game to multi-game platform
- Opening selector now shows 10 openings (was 4)
- Updated AppView type system for new game modules

## [0.1.0] - 2026-03-25

### Added
- Initial Chess Opening Trainer with Queen's Gambit, Sicilian Defense, Italian Game, and Ruy Lopez
- Interactive practice board with move-by-move feedback
- Line-by-line progress tracking with mastery system
