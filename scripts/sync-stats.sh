#!/bin/sh
# Shows how the synchronization is used, from its D1 database (read only):
# the lockers (total, active, emptied, deleted, size, seen lately), the
# lockers created day by day, the latest active ones, and today's and
# yesterday's daily budgets (all addresses together; they are kept as
# pseudonyms only, cf. `server/lib/syncBudget.ts`).
#
# Usage: npm run sync:stats, or npm run sync:stats:preview (the preview).
# (Or: sh scripts/sync-stats.sh [production|preview].)
# Needs wrangler to be logged in (`npx wrangler login`).
set -eu

case "${1:-production}" in
  production) DATABASE=bailly-sync ;;
  preview) DATABASE=bailly-sync-preview ;;
  *) echo "Usage: $0 [production|preview]" >&2; exit 1 ;;
esac

query() {
  echo
  echo "== $1"
  npx wrangler d1 execute "$DATABASE" --remote --command "$2"
}

# Today, in days since 1970 (as the columns of the days).
TODAY="CAST(strftime('%s', 'now') / 86400 AS INTEGER)"

query "Lockers" "
SELECT count(*) AS total,
       sum(deleted = 0 AND blob <> '') AS active,
       sum(deleted = 0 AND blob = '') AS emptied,
       sum(deleted) AS deleted,
       sum(length(blob)) AS bytes,
       sum(seen_day >= $TODAY - 7) AS seen_7_days,
       sum(seen_day >= $TODAY - 30) AS seen_30_days
FROM sync_lockers"

query "Lockers created, by day (latest 30 days)" "
SELECT date(created_day * 86400, 'unixepoch') AS day,
       count(*) AS created,
       sum(deleted = 0 AND blob <> '') AS still_active,
       sum(series) AS in_series
FROM sync_lockers
WHERE created_day >= $TODAY - 30
GROUP BY created_day
ORDER BY created_day DESC"

query "Latest active lockers (written last first)" "
SELECT substr(id, 1, 8) AS id,
       version,
       length(blob) AS size,
       datetime(updated_at / 1000, 'unixepoch') AS written,
       date(created_day * 86400, 'unixepoch') AS created,
       date(seen_day * 86400, 'unixepoch') AS seen
FROM sync_lockers
WHERE deleted = 0 AND blob <> ''
ORDER BY updated_at DESC
LIMIT 20"

query "Daily budgets (today and yesterday)" "
SELECT date(day * 86400, 'unixepoch') AS day,
       sum(address NOT LIKE '*%') AS addresses,
       sum(CASE WHEN address NOT LIKE '*%' THEN bytes END) AS bytes,
       sum(creations) AS creations,
       sum(growth) AS growth,
       sum(CASE WHEN address = '*' THEN bytes END) AS server_new,
       sum(CASE WHEN address = '*established' THEN bytes END) AS server_established
FROM sync_budgets
GROUP BY day
ORDER BY day DESC"
