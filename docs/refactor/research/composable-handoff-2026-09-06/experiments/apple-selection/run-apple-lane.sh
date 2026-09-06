#!/usr/bin/env bash
# Usage: run-apple-lane.sh <lane-dir>  — runs the Apple lifecycle experiment (packed adopter) and the mixed-release composition experiment.
set -uo pipefail
LANE=$1; cd "$LANE"
[ -e docs ] || ln -s /mnt/models/dev/ts-release/docs docs
export ARCHITECTURE_NODE_BINARY=/home/cjpher/.local/share/fnm/node-versions/v22.22.2/installation/bin/node
{
  echo "== apple lane $LANE start $(date -u +%FT%TZ)"
  bun tools/architecture-lab/apple/run-experiments.ts > apple-results.stdout.json && echo "== run-experiments OK $(date -u +%FT%TZ)" || { echo "== run-experiments FAILED $(date -u +%FT%TZ)"; }
  bun tools/architecture-lab/apple-composition/run.mjs > apple-composition.stdout.json && echo "== apple-composition OK $(date -u +%FT%TZ)" || { echo "== apple-composition FAILED $(date -u +%FT%TZ)"; }
  echo "== apple lane done $(date -u +%FT%TZ)"
} > "$LANE/apple.log" 2>&1
