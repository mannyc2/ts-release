#!/usr/bin/env bash
# Usage: setup-lane.sh <lane-dir> <baseline|relocated>
# Creates a disposable full copy of tools/architecture-lab (node_modules symlinked to the repo),
# optionally applies the kernel.Http helper relocation, and prints the lane directory.
set -euo pipefail
REPO=/mnt/models/dev/ts-release
LANE=$1; MODE=$2
rm -rf "$LANE"; mkdir -p "$LANE/tools"
cp -r "$REPO/tools/architecture-lab" "$LANE/tools/"
ln -s "$REPO/node_modules" "$LANE/node_modules"
cp "$REPO/tsconfig.json" "$LANE/tsconfig.json"
echo '{"name":"lab-lane","private":true,"type":"module"}' > "$LANE/package.json"
cd "$LANE" && git init -q && git add -A && git -c user.email=lab@example.invalid -c user.name=lab commit -qm "sealed lab copy" >/dev/null
if [ "$MODE" = "relocated" ]; then
  LAB="$LANE/tools/architecture-lab"
  # 1. Move the native HTTP receipt helper into the kernel (design.json module kernel.Http).
  git mv "$LAB/topology/src/http-evidence.ts" "$LAB/machine/src/http-evidence.ts"
  sed -i 's#import type { RequestFacts } from "@lab/kernel"#import type { RequestFacts } from "./contracts.js"#' "$LAB/machine/src/http-evidence.ts"
  echo 'export { HttpReceipt, corresponds } from "./http-evidence.js"' >> "$LAB/machine/src/index.ts"
  # 2. Providers import the helper from the kernel instead of a sibling copy.
  for f in "$LAB"/topology/src/npm.ts "$LAB"/topology/src/python.ts "$LAB"/topology/src/external.ts "$LAB"/topology/extensions/catalog.ts "$LAB"/topology/extensions/npm-tag.ts; do
    sed -i '/import { HttpReceipt, corresponds } from ".\/http-evidence.js"/d' "$f"
    sed -i '0,/from "@lab\/kernel"/s#\(import {[^}]*\)} from "@lab/kernel"#\1, HttpReceipt, corresponds } from "@lab/kernel"#' "$f"
  done
  # 3. probes.mjs: the P02/P03 package specs no longer carry a helper copy (build.mjs spreads were already conditional).
  python3 - "$LAB/topology/probes.mjs" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p).read()
s=s.replace('patchSize({}, {"external.ts":source.own["external.ts"],"http-evidence.ts":source.own["http-evidence.ts"]})','patchSize({}, {"external.ts":source.own["external.ts"],...(source.own["http-evidence.ts"]?{"http-evidence.ts":source.own["http-evidence.ts"]}:{})})')
s=s.replace('sources:{"index.ts":catalogSource,"http-evidence.ts":source.own["http-evidence.ts"]}','sources:{"index.ts":catalogSource,...(source.own["http-evidence.ts"]?{"http-evidence.ts":source.own["http-evidence.ts"]}:{})}')
open(p,'w').write(s)
PY
  git add -A && git -c user.email=lab@example.invalid -c user.name=lab commit -qm "relocate http-evidence helper into kernel" >/dev/null
  git diff HEAD~1 --stat
fi
echo "$LANE"
