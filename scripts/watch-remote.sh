#!/usr/bin/env bash
# Watch the remote for the other lane's work.
#
# FETCH ONLY — never pulls, never checks out, never touches the working tree.
# Merging is a decision, not something a background loop should make for you
# while you are mid-edit.
#
#   bash scripts/watch-remote.sh            # every 45s
#   INTERVAL=20 bash scripts/watch-remote.sh
#
# Output is appended, so the log is the history of what landed and when.
set -u

INTERVAL="${INTERVAL:-45}"
cd "$(dirname "$0")/.." || exit 1

echo "watching origin every ${INTERVAL}s — $(date '+%H:%M:%S')"
echo "fetch only; your working tree is never touched."
echo

declare -A seen
first_pass=1

while true; do
  git fetch --quiet --prune origin 2>/dev/null

  # Every remote branch, newest commit first.
  while IFS='|' read -r ref sha subject author when; do
    [ -z "$ref" ] && continue
    key="${ref}"
    if [ "${seen[$key]:-}" != "$sha" ]; then
      if [ "$first_pass" -eq 0 ]; then
        echo "[$(date '+%H:%M:%S')] ${ref}  ${sha}"
        echo "    ${subject}"
        echo "    ${author}, ${when}"
        # What changed, so you can tell instantly whether it touches your lane.
        git diff --stat "${seen[$key]:-$sha^}" "$sha" 2>/dev/null | tail -8 | sed 's/^/    /'
        echo
      fi
      seen[$key]="$sha"
    fi
  done < <(git for-each-ref --sort=-committerdate refs/remotes/origin \
             --format='%(refname:short)|%(objectname:short)|%(contents:subject)|%(authorname)|%(committerdate:relative)' \
             2>/dev/null)

  if [ "$first_pass" -eq 1 ]; then
    echo "baseline: $(git for-each-ref refs/remotes/origin --format='%(refname:short)' | tr '\n' ' ')"
    echo "waiting for new commits…"
    echo
    first_pass=0
  fi

  # How far behind main you are, without moving anything.
  behind=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)
  if [ "${behind:-0}" -gt 0 ] && [ "${last_behind:-0}" != "$behind" ]; then
    echo "[$(date '+%H:%M:%S')] you are ${behind} commit(s) behind origin/main — rebase when convenient:"
    echo "    git pull --rebase origin main"
    echo
    last_behind="$behind"
  fi

  sleep "$INTERVAL"
done
