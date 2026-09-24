#!/usr/bin/env bash
#
# Publishes the code of this repository (bailly-api-heroku) to the public repository
# defense-humanites/bailly-api, as required by the AGPL-3.0: copies the files tracked
# on `main`, except the database archives (a personal concession of their authors, not
# distributable), then commits them there, referencing the source commit.
#
# Usage: scripts/sync_public.sh <path to the bailly-api clone>
#
# Only the `main` branch is published: `main` here (which must match `origin/main`,
# i.e. be pushed) is committed on `main` there, whatever the branch checked out here.
# The public repository mirrors this one: files removed here are removed there, except
# the files listed in PUBLIC_OWN, which belong to the public repository and are never
# overwritten (on the first sync, they are copied from here if missing). Its
# `.gitignore` additionally ignores the database archives. Review the resulting commit
# before pushing it.

set -euo pipefail

# Files specific to the public repository.
PUBLIC_OWN=(README.md)

src=$(git rev-parse --show-toplevel)
dest=$(cd "${1:?"usage: $0 <path to the bailly-api clone>"}" && git rev-parse --show-toplevel)

fail() { echo "❌ $*" >&2; exit 1; }

[ "$src" != "$dest" ] || fail "the destination must be the public repository."
[ -z "$(git -C "$dest" status --porcelain)" ] || fail "commit or discard the changes of $dest first."

BRANCH=main

git -C "$src" rev-parse -q --verify "refs/heads/$BRANCH" >/dev/null ||
  fail "no '$BRANCH' branch in $src."
[ "$(git -C "$src" rev-parse "$BRANCH")" = \
  "$(git -C "$src" rev-parse -q --verify "refs/remotes/origin/$BRANCH" || true)" ] ||
  fail "'$BRANCH' differs from 'origin/$BRANCH' in $src: push (or pull) it first."
[ "$(git -C "$dest" symbolic-ref -q --short HEAD || true)" = "$BRANCH" ] ||
  fail "check out '$BRANCH' in $dest first."

rev=$(git -C "$src" rev-parse --short "$BRANCH")
subject=$(git -C "$src" log -1 --format=%s "$BRANCH")

# Mirror: remove every tracked file of the destination, then extract `main` without the
# database archives, leaving the files of PUBLIC_OWN untouched.
own_excludes=()
for file in "${PUBLIC_OWN[@]}"; do
  if [ -e "$dest/$file" ]; then own_excludes+=(":(exclude)$file"); fi
done

git -C "$dest" rm -rq --ignore-unmatch -- . "${own_excludes[@]+"${own_excludes[@]}"}"
git -C "$src" archive --format=tar "$BRANCH" -- . ':(exclude)database/*.gz' \
  "${own_excludes[@]+"${own_excludes[@]}"}" | tar -x -C "$dest"

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
  -m "Sync with bailly-api-heroku ($BRANCH, $rev)" \
  -m "Last change: $subject"

echo "✅ Committed in $dest:"
git -C "$dest" show --stat --format='   %h %s' HEAD | tail -n +1
echo "Review it, then push: git -C \"$dest\" push"
