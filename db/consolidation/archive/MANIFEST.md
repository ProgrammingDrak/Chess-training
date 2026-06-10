# Consolidation archive manifest

Audit trail for files moved out of `db/consolidation/` during cleanup. Each row
records what moved, from where, to where, and when. To undo a move, reverse it.

| File | From | To | Date | Reason |
|------|------|----|------|--------|
| `02_data_gto.sql` | `db/consolidation/` | `db/consolidation/archive/02_data_gto_pre-cutover_2026-06-07.sql` | 2026-06-10 | Pre-cutover dump of the standalone source project (captured 2026-06-07). Superseded by the live-hub backup `archive_gto_2026-06-10.sql` after cutover completed (2026-06-08) and the standalone project was deleted (2026-06-10). Kept for history; contains real user data, gitignored. |
