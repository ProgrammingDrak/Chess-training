# GTO Training → shared Supabase consolidation

> **CLOSED OUT — consolidation complete.**
> - Cutover applied and verified **2026-06-08** (`gto` schema on the hub, 119 rows, live app `db:connected`).
> - Standalone source project `svqwyibsmhpknnjvbufi` **deleted 2026-06-10** (irreversible) after a final clean check.
> - Current offline backup: `archive_gto_2026-06-10.sql` (full schema+data dump of the live hub, gitignored). Regenerate per the pg_dump note below.
> - The pre-cutover source dump now lives in `archive/` (see `archive/MANIFEST.md`).
>
> The "Procedure" and "Rollback" sections below are the **historical migration record** — step 5 (delete the old project) is already done, and rollback is no longer possible (source deleted).
>
> **Regenerate the live backup:** `pg_dump "<gto_app DATABASE_URL, minus the ?options= query>" --schema=gto --no-owner --no-privileges -f archive_gto_<date>.sql` — the `gto_app` session-pooler URL (port 5432) is in the GTO Render service `DATABASE_URL` env var.

Moves the GTO Training database off its own standalone Supabase project and into
the **shared `daily-command-center` Supabase project**, where it lives in its own
dedicated Postgres **`gto` schema** — its "own little section" — alongside the
other apps. One Supabase project hosts many apps; each app gets a schema.

## Why a schema (not just `public`)

The GTO app queries its tables **unqualified** (`FROM users`, `INTO sessions`,
`profiles`, …). The daily-command-center `public` schema already has `users`,
`sessions`, `login_events`, and `feedback_messages`. Dropping GTO into `public`
would collide. A dedicated `gto` schema isolates it; the app reaches it by
pinning `search_path=gto,public` (see `db/pool.js`, env `DB_SCHEMA=gto`). The
unqualified queries resolve into `gto` with zero query rewrites.

## Projects

| Role | Supabase project | Ref | Region |
|------|------------------|-----|--------|
| Source (current GTO, standalone) | GTO Training | `svqwyibsmhpknnjvbufi` | us-east-2 |
| Target (shared hub) | daily-command-center | `zcxyeeeoczfvxuyajrkr` | us-east-1 |

## Files

- `build-migration.sh` — dumps the live source and regenerates the two SQL files below.
- `01_schema_gto.sql` — all GTO DDL, namespaced into schema `gto`. Safe to commit (no data).
- `02_data_gto.sql` — row data + sequence values, namespaced to `gto`. **Gitignored — contains password hashes / session data.** Regenerate with `build-migration.sh`.
- `apply-to-target.sh` — applies 01 then 02 to a target and prints row counts.
- `.gitignore` — keeps raw dumps and the data file out of git.

The `async_poker_schema_probe` diagnostic table (0 rows) is intentionally excluded.

## Baseline (source row counts, captured at build time)

`async_poker_actions 34 · async_poker_game_players 7 · async_poker_games 3 ·
async_poker_npc_users 0 · bankroll 0 · feedback_messages 2 · hand_history 0 ·
in_app_notifications 20 · live_sessions 2 · login_events 10 ·
notification_preferences 4 · profiles 7 · promo_codes 3 · promo_redemptions 2 ·
scenarios 0 · sessions 20 · users 5` — **119 rows total.**

## Procedure

1. Regenerate the data file (kept out of git):
   ```bash
   bash db/consolidation/build-migration.sh
   ```
2. Apply to the shared project (get the connection string from the
   daily-command-center Supabase project → Connect → Session pooler, port 5432):
   ```bash
   TARGET_DATABASE_URL='postgresql://postgres.zcxyeeeoczfvxuyajrkr:<PW>@aws-1-us-east-1.pooler.supabase.com:5432/postgres' \
     bash db/consolidation/apply-to-target.sh
   ```
   Confirm the printed counts equal the baseline above.
3. Point the GTO app at the shared project. In the **Chess-training** service
   (Render) env:
   - `DATABASE_URL` → the shared `daily-command-center` connection string above
   - `DB_SCHEMA=gto`
   Redeploy. `db/pool.js` reads `DB_SCHEMA` and pins `search_path`.
4. Verify the live app (login, profiles, async poker games all load).
5. Only after verification: delete the old standalone GTO project
   (`svqwyibsmhpknnjvbufi`). Irreversible.

## Rollback

Until step 5, the old GTO project is untouched and fully intact. To roll back,
revert the Chess-training env (`DATABASE_URL` back to the old project, drop
`DB_SCHEMA`) and redeploy. To undo the target, `DROP SCHEMA gto CASCADE;` on the
shared project removes only the GTO section and leaves daily-command-center's
`public` schema untouched.
