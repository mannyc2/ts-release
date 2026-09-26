# Provider validation defect classification

This bounded W3 slice concerns the captured synchronous `validatePlan` callback
in `Plan.loadPlan`. It does not change the shared `attempt` or HTTP data-boundary
helpers. The callback receives an already admitted complete Plan and must finish
before journal access, observation, credential acquisition or dispatch.

## Why this proof is necessary

Existing dependency tests exercise deliberate provider refusals, descriptor
receiver capture and an invalid callback that returns an unexecuted Effect.
Those checks do not distinguish an unexpected callback exception from the
`invalid-data` failure produced by the broad helper. Losing that distinction
hides provider implementation defects behind ordinary admission failures.

One new regression uses the existing dependency fixture and actual public
`runRelease` entrypoint. Its validator throws a specific `TypeError`. The test
requires the exact defect identity, no recorded journal, and no reads,
observations, credential acquisitions or sends. It adds no alternate kernel,
native fixture, public test service or timing assumption.

The existing descriptor receiver/capture test now also runs with an independently
declared `Schema.TaggedError` carrying the stable `ReleaseError` tag and string
`code`/`message`. Both constructors must retain the refusal fields after the
descriptor method is replaced during hashing. The original local-constructor
case remains. This demonstrates constructor-independent classification, not
installation compatibility with a second Effect runtime or another tarball.

## Initial before-fix run and assertion correction

Baseline: `07eff4faba15483d5d80879c493c3233733344c5` in the isolated
`.provider-validation-defects` checkout. Production remained unchanged during
this run. SHA-256:

- `packages/ts-release/src/Plan.ts`:
  `afcf35ef69775f6a834d6c7ff1307c7d0de7cc03e1bbf473fd174a9224b09898`
- `packages/ts-release/src/internal/Error.ts`:
  `8358b200df4ef5dc126b90d686c5c9f57891988ca8d16d1fac1b6586d83fd2a2`
- `test/reimplementation/kernel/dependencies.test.ts`:
  `f0edf01f3984c9e9b416f0e23bab1a7b4ee766b444891a499dd6335db666c78d`

Command, using the exact pinned Bun 1.3.14 executable:

```sh
/tmp/ts-release-bun-qualification/node_modules/.bin/bun test ./test/reimplementation/kernel/dependencies.test.ts
```

Raw output: `/tmp/ts-release-provider-validation-red.log`. Exit **1**:
**7 passed, 2 failed, 40 assertions**. The TypeError case first confirms the
absence of external actions, then fails because the Cause contains no defect.
The receiver test retains the local refusal but fails for the independent
constructor: its code/message become the generic `invalid-data` refusal.
These are observed failures before implementation. However, the initial defect
assertion incorrectly compared `Cause.findDie`'s successful result directly with
the TypeError. In rc.115 that result is a `Die` reason; its `defect` property holds
the original value (`effect/src/Cause.ts:326,1013`). The first after-fix run and
compiler check exposed this mistake. The original test would also reject a
correctly preserved defect, so its initial failure alone was insufficient proof.

After production was changed, the assertion was corrected to compare
`found.success.defect`. No case or expected outcome was added. The corrected test
SHA-256 is
`230bc8b533a8d29ff21693e8022fe9358a38229759ed635b14ca1d339c88e5fb`.
Do not describe this final test as unchanged since the initial before-fix run.

## Corrected baseline control and current result

The corrected test and its existing fixture closure were copied into
`/tmp/ts-release-provider-validation-baseline-f64af59p`. Its `packages` and
`node_modules` symlinks resolve to the retained, clean `.content-store-lifecycle`
checkout at `07eff4faba15483d5d80879c493c3233733344c5`. The baseline Plan/Error
hashes match those recorded above. That checkout was not edited.

The same exact Bun command was then run in the temporary baseline tree and the
current `.provider-validation-defects` tree:

| Run | Raw output | Exit and result |
| --- | --- | --- |
| Corrected test against retained baseline, after implementation | `/tmp/ts-release-provider-validation-corrected-baseline.log` | **1**; 7 passed, 2 failed, 40 assertions |
| Corrected test against current implementation | `/tmp/ts-release-provider-validation-green.log` | **0**; 9 passed, 0 failed, 40 assertions |

The baseline still lacks a `Die` reason and still replaces the foreign refusal
fields with `invalid-data`. The current implementation preserves the exact
TypeError and both refusal constructors, while all existing dependency cases
pass. This is a subsequent baseline control following an assertion correction,
not a reconstructed claim that the final assertion ran before production edits.

Current source SHA-256 during the green run:

- `packages/ts-release/src/Plan.ts`:
  `642359ddfd2866887257a662aebec1c64875e1b628de32b1d37cda6caf00b558`
- `packages/ts-release/src/internal/Error.ts`:
  `a7a559372196947edac47a880c26cdeaf37789ab3654e1c07078b167b7f99271`

The corrected dependency test also passes the strict lint command. No build,
packing, or additional test cases were introduced for this correction.

## Scope and compatibility limits

Keep intentional domain refusals typed, preserve the existing safe projection
of schema admission failures, and preserve rejection of non-void validator
results. Unexpected callback exceptions should remain defects. Error messages,
Plan bytes, operation identities and dispatch authority are otherwise unchanged.

The following remain outside this slice:

- Core `attempt` and `makeDataBoundary.attempt`, `admit` and `matches` used by
  other callers. They currently also wrap raw native operations and parsers;
  narrowing them globally would change expected failures into defects.
- JSON lexical/duplicate-key admission, fatal UTF-8 decoding, canonical JSON,
  URL/percent decoding, gzip/archive parsing, native crypto and SQLite or
  filesystem failure projection. Their semantic owners need separate review.
- Git/HTTP credential privacy, GitHub OIDC token verification, npm token and
  Sigstore handling, and the Promise application's legacy factory-throw
  projection. No secret-bearing exception policy is broadened here.
- Provider codec execution, other provider callbacks, and installed-package or
  multi-runtime qualification. This source proof does not certify those paths.

## Final integration qualification

Linux x64, Bun 1.3.14, Node 22.22.2 and unchanged Effect/platform rc.115:

| Check | Actual result |
| --- | --- |
| `bun run check` | Exit 0: formatting, patched build, strict lint, root/native/portable compiler closures, import graph and package entries. |
| `bun test ./test/reimplementation/kernel/dependencies.test.ts` | Exit 0: 9 passed, 40 assertions, after the documented assertion correction and baseline control. |
| Existing GitHub `graph.test.ts`/`protocol.test.ts`, kernel `cli.test.ts`/`application.test.ts` | Exit 0: 45 passed, 278 assertions, including real provider graph refusals and safe CLI/application behavior. |
| `bun run check:packed-kernel` | Exit 0: real Bun/npm consumer installations, eight public runtime entries, strict declarations and factory E/R inference. |

Raw final logs are `/tmp/ts-release-provider-validation-check-final.log`,
`/tmp/ts-release-provider-validation-green.log`,
`/tmp/ts-release-provider-validation-behavior.log` and
`/tmp/ts-release-provider-validation-packed-kernel.log`. The existing packed
receipt remains `.release/checks/packed-kernel.json`. The full provider suite,
other operating systems and runtime versions, and live publication were not run
for this callback-only change.

The initial `Effect.try`/identity-catch implementation was rejected by the
patched compiler's prohibitions on an intermediate unknown error channel. The
final narrow synchronous catch lives inside `Effect.suspend` and directly
returns a classified Effect; no diagnostic was suppressed or relaxed.

This bounded result does not claim a completed W3 program or qualify every
provider callback. Durable versions, canonical identities and publish authority
remain unchanged.
