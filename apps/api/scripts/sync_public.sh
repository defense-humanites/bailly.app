#!/usr/bin/env bash
#
# Publishes the code of this repository (bailly-api-heroku) to the public repository
# defense-humanites/bailly-api, as required by the AGPL-3.0: copies the files tracked
# at HEAD, except the database archives (a personal concession of their authors, not
# distributable), then commits them there, referencing the source commit.
#
# Usage: scripts/sync_public.sh <path to the bailly-api clone>
#
# Run it from the deployed commit. The public repository mirrors this one: files
# removed here are removed there. Its `.gitignore` additionally ignores the database
# archives. Review the resulting commit before pushing it.

set -euo pipefail

src=$(git rev-parse --show-toplevel)
dest=$(cd "${1:?"usage: $0 <path to the bailly-api clone>"}" && git rev-parse --show-toplevel)

fail() { echo "❌ $*" >&2; exit 1; }

[ "$src" != "$dest" ] || fail "the destination must be the public repository."
[ -z "$(git -C "$src" status --porcelain)" ] || fail "commit or stash the changes of $src first."
[ -z "$(git -C "$dest" status --porcelain)" ] || fail "commit or discard the changes of $dest first."

rev=$(git -C "$src" rev-parse --short HEAD)
subject=$(git -C "$src" log -1 --format=%s)

# Mirror: remove every tracked file of the destination, then extract HEAD without the
# database archives.
git -C "$dest" rm -rq --ignore-unmatch -- .
git -C "$src" archive --format=tar HEAD -- . ':(exclude)database/*.gz' | tar -x -C "$dest"

# Never publish the database, even by mistake in a later manual commit.
cat >> "$dest/.gitignore" <<'GITIGNORE'

# The database is not distributed with the code (cf. README).
database/*.gz
GITIGNORE

git -C "$dest" add -A

if git -C "$dest" diff --cached --name-only | grep -qE '^database/.*\.(gz|db)$'; then
  git -C "$dest" reset -q
  fail "database files would be published: aborted (the destination is left unstaged)."
fi

if git -C "$dest" diff --cached --quiet; then
  echo "Nothing to publish: $dest is already in sync with $rev."
  exit 0
fi

git -C "$dest" commit -q \
  -m "Sync with bailly-api-heroku ($rev)" \
  -m "Last change: $subject"

echo "✅ Committed in $dest:"
git -C "$dest" show --stat --format='   %h %s' HEAD | tail -n +1
echo "Review it, then push: git -C \"$dest\" push"
