#!/usr/bin/env bash
# Usage: run-lane.sh <lane-dir>  — runs the packed matrix, the nine probes and the metrics in that lane.
set -uo pipefail
LANE=$1; cd "$LANE"
export ARCHITECTURE_NODE_BINARY=/home/cjpher/.local/share/fnm/node-versions/v22.22.2/installation/bin/node
{
  echo "== lane $LANE start $(date -u +%FT%TZ)"
  bun tools/architecture-lab/topology/run.ts && echo "== run.ts OK $(date -u +%FT%TZ)" || { echo "== run.ts FAILED"; exit 1; }
  bun tools/architecture-lab/topology/probes.mjs && echo "== probes.mjs OK $(date -u +%FT%TZ)" || { echo "== probes.mjs FAILED"; exit 1; }
  bun tools/architecture-lab/topology/metrics.mjs && echo "== metrics.mjs OK $(date -u +%FT%TZ)" || { echo "== metrics.mjs FAILED"; exit 1; }
  echo "== lane done $(date -u +%FT%TZ)"
} > "$LANE/lane.log" 2>&1
