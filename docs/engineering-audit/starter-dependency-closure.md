# Maintained starter dependency closure

Baseline: `07eff4faba15483d5d80879c493c3233733344c5`, isolated checkout
`/mnt/models/dev/ts-release/.provider-validation-defects`, Bun 1.3.14, Effect
4.0.0-rc.115. This is a bounded R21/R26/R29 repair, not complete W2/W5/W7
qualification.

The documented starter command `bun run input:release candidate release-input.json
Token` could not load: generated `input.ts` imported `./ReleaseMetadata.js`, which
the delivery generator did not copy. Copying that helper alone would leave its
own workspace-relative import of `apps/self-release/src/Model.ts` unresolved.

The helper owns only local input projection. It reads retained identities and
explicit configuration, then writes runtime input with `authorize: false` unless
the operator supplies `--execute`; it neither prepares a provider request nor
publishes. The production application owns its schemas. Keep that owner and
bundle the helper's workspace closure; keep all package imports external so the
adopter's declared dependencies and installed core remain authoritative. Do not
copy a second hand-maintained schema or add a new public export.

The existing installed workflow uses a catalog fixture application and bypasses
the starter input command. The distribution check copies the production
application and verifier, but also bypasses this command. This observed broken
documented command justifies a temporary isolated consumer probe; no new test
matrix or committed test file is necessary for the repair.

## Before-fix evidence

- `/tmp/ts-release-starter-closure-red.json` records the exact command, raw exit 1,
  stderr, source commit and generated input SHA-256
  `cc717e360384a386d57e0eafd8e5ff8fc6f3cbba0cf616925396b530b95f62b6`.
- Isolated copied starter: `/tmp/ts-release-starter-closure-c5oe4l8u/starter`.
  Its dependency directory was copied from the real npm-installed packed consumer
  `/tmp/ts-release-packed-npm-Qj3v5Q/npm/node_modules`; the core is a physical
  package directory, with no workspace resolution fallback or module mocks.
- Failure: `Cannot find module './ReleaseMetadata.js'`. No input output was
  written. Publishing credentials and inherited GitHub output path were removed
  from the child environment; the selected journal URL was `example.invalid`.

## Repair and qualification

`scripts/build-delivery.ts` now uses Bun's existing bundler to emit `input.ts`
from `scripts/release-input.ts` with `packages: "external"`, preserving the
documented Bun entrypoint. The three bundled workspace modules have one authored
source; generated code does not establish a separate schema authority.

A standalone temporary bundle passed the same isolated command and retained the
exact Bundle/Plan identities and Token credential references with authorization
false. `/tmp/ts-release-starter-closure-green-provisional.json` records that
provisional probe. It does not qualify the actual delivery-generator output.

The first shared `bun run build:delivery` stopped before generation on blocking
Plan.ts diagnostics TS377021 and TS377030 from concurrently integrated provider
work. `/tmp/ts-release-starter-build-delivery.log` records exit 1; no generated
files changed. After that provider source was corrected, the identical delivery
command passed; `/tmp/ts-release-starter-build-delivery-final.log` records exit 0.

The actual generated `templates/npm-github/input.ts` was then copied into the
same isolated starter. The documented entrypoint exited 0, preserved the two
fixture identity digests and Token credential references, and emitted
`authorize: false`. `/tmp/ts-release-starter-closure-green.json` records the
command, raw output/exit, result data and artifact identities:

- Generated input: `59b0aff19ff08193852fe89cbe8eb4f36999828af6691ca195c2c958036c90a3`.
- Generator: `0e10423f124f9477833c296a9417214c53171bc76480d872bcdca0dfffeec79b`.

The residual imports are `effect`, the declared core/npm/GitHub packages, and
the native `assert/strict`, `fs/promises`, and `path` built-ins. No workspace
relative import remains. Actual generation changed only `input.ts`; the
Action launcher and generated release application files were unchanged.

The installed dependencies reused the earlier physically installed, qualified
milestone-one archives. This command does not qualify the newer provider defect
changes, a fresh installation, or a complete release candidate. Root integration
owns the final static and affected package checks.

No live provider, OIDC, Sigstore signing, Node execution, new engine version or
hosted workflow is qualified by this Bun input-projection command.
