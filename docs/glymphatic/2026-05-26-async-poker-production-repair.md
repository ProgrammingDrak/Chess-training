# Async Poker Production Repair Notes

Date: 2026-05-26
Repo: `ProgrammingDrak/Chess-training`
Production service: Render `GTO Training`

## What Was Done

- Diagnosed production Async Poker failures from Render logs:
  - Initial load/create errors were missing `async_poker_games`.
  - Follow-up errors came from `users.is_npc` schema drift and table ownership/permission mismatch.
- Confirmed production was using Supabase, not the visible Render Postgres database.
- Reset only the empty Async Poker and notification tables:
  - `notification_preferences`
  - `in_app_notifications`
  - `async_poker_games`
  - `async_poker_game_players`
  - `async_poker_npc_users`
  - `async_poker_actions`
- Recreated those tables from Render's production build environment so they are owned by the live production DB role, `postgres`.
- Kept Async Poker independent from `users.is_npc`:
  - NPC identity now uses `async_poker_npc_users`.
  - Async Poker tables do not require foreign keys into the existing `users` table.
- Added temporary repair tooling, used it, then removed it:
  - Temporary admin repair endpoint.
  - Temporary repair scripts.
  - Temporary production build hook.
- Verified production:
  - Render health returned the cleaned-up commit `92b10f5`.
  - Tables exist and are owned by `postgres`.
  - Rollback-only insert smoke test for game, player, and action succeeded.
  - Fresh logs after cleanup showed no Async Poker errors.
- Created and merged sync PR:
  - PR #24: `Document async poker production repair`
  - Merge commit: `aeb29c0`

## Important Context

- `SKIP_SCHEMA_INIT=true` in production means new schema changes do not auto-apply.
- The app may have multiple production DB identities in play:
  - Local `.env` inspection connected as `gto_app`.
  - Render build/runtime connected as `postgres`.
- Creating tables locally or from the wrong connection can produce owner/permission mismatches even when the schema looks correct.
- Existing core tables such as `users`, `profiles`, and `live_sessions` were not dropped or altered.

## Validation Already Run

- `node --check server.js`
- `npm run build`
- Render deploy health checks after each production deploy.
- Production table owner verification via Supabase query.
- Rollback transaction smoke test:
  - Insert into `async_poker_games`.
  - Insert into `async_poker_game_players`.
  - Insert into `async_poker_actions`.
  - Roll back.

## Next Steps / Tasks To Build

- Add a proper migration workflow for production schema changes:
  - Single command for applying app-owned migrations to Supabase.
  - Clear rule for which production DB role owns app tables.
  - Avoid relying on ad hoc `db/schema.sql` application.
- Add a production schema drift check:
  - Verify required tables/columns exist.
  - Verify table owners and key privileges match the Render runtime role.
  - Run before or during deploy, but fail loudly before users hit broken routes.
- Add Async Poker server tests around schema-independent NPC handling:
  - NPCs are detected via `async_poker_npc_users`.
  - No query references `users.is_npc`.
- Decide whether in-app notification tables should be durable production features:
  - If yes, include them in the formal migration path.
  - If no, keep route behavior resilient when notification storage is unavailable.
- Remove or document any stale Supabase/Render database confusion:
  - `render.yaml` mentions Render database config, but production actually uses Supabase.
  - Document the canonical production database source and role.
- Consider a lightweight admin-only diagnostics endpoint or CLI script:
  - DB current user.
  - Required table existence.
  - Required table owner/privileges.
  - Async Poker row counts.

## Watch Items

- If production table creation fails again, check owner first, not just existence.
- If Async Poker load works but create fails, suspect `INSERT` or sequence privileges.
- If notifications fail while poker works, isolate `in_app_notifications` permissions instead of blocking gameplay.
