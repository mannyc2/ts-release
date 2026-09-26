# Effect reviews and ts-release refactor — 2026-09-26

Both requested investigations are complete: the [adoption audit](README.md)
documents multiple problems in each of four verified adopters, and the
[Browserbase](effect-patterns-browserbase.md) and
[Reactor](effect-patterns-reactor.md) reviews examine their library architecture,
Effect usage, ownership and tests. The reviews informed a concrete ts-release
refactor in the user-selected current-main baseline.

## Baseline and working copies

- Implementation: `/mnt/models/dev/ts-release/.effect-pattern-refactor`, branch
  `codex/effect-patterns-refactor`, based on main
  `fa50ce368c50e9a28a2e57f667d454374e7b209c` (0.4.2).
- Browserbase: `7e93054494ee491dbf2a1f66a083d99da846fd3e`.
- Reactor: `f821a9084cf51e9aac591388db0788cb90501bf0`.
- Original workspace: `codex/architecture-program` at `9b14c6c`; its pre-existing
  staged work was preserved. Documentation is available in both working copies.

The implemented code uses aligned Effect rc.115 packages. Consumer rc.117 pins
are context for the reviews, not a reason to change dependencies. No version,
lockfile, candidate identity or journal format was changed, and nothing was
published. The new public API requires building this checkout; it is not present
in the already-published 0.4.2 package.

## Review conclusions

Both libraries offer useful examples of explicit capabilities, layers at host
boundaries, scoped ownership, schema-backed facts, uncertain mutation outcomes,
and behavioral tests through real implementations. Browserbase also provides
strong named-operation and callback error/service inference examples. Reactor's
submission ownership and bounded native transport are useful architectural
references.

Neither should be copied wholesale. A targeted Browserbase probe reproduced a
writer verification construction throw that bypasses settlement and leaves an
escaped permit accepted. Its returned-Effect defect path does clean up. Reactor
does not consistently use `Effect.fn`, and some supervisor failures become a
generic protocol error. Their browser/media state machines and custom test
harnesses are domain-specific. Details, evidence and limitations are in the
individual reviews; neither consumer was edited.

## Implemented standards

| Change | Prior gap | Result and regression coverage |
| --- | --- | --- |
| Composable application runner | The public application-module runner required a Promise boundary and a new runtime. | `runApplicationEffect` is exported from Node/Bun, owns one scope, preserves factory errors/services and uses the caller's runtime. The Promise adapter shares the interpreter. Tests cover type inference, layer ownership, construction throws, typed failure, defects, interruption, observe mode and authorization continuation. |
| Scoped content operations | A broad asynchronous workflow could continue native file operations after fiber interruption. | Named Effect operations bracket handles and temporary paths; current native I/O settles before cleanup and interruption stops subsequent work. Native Node/Bun tests inject acquisition, read, write, copy, verify and close interruptions, plus write/close failures. Snapshot, identity, immutable installation and recovery behavior remain covered. |
| Credential cancellation | HTTP credentials converted interruption into an ordinary `http-credentials` failure. | Interruptions remain cancellation. Typed errors, defects and mixed causes are redacted; secrets do not enter diagnostics. Tests cover both read and release paths and joined credential cleanup. |
| Repository conventions | Useful rules were spread across older agent notes and implementation patterns. | A maintained Effect standards document, linked from README/architecture/preparation, records ownership, tracing, schemas, composition, callback boundaries and verification. Local ignored agent notes point to the same standard. |

The source checkout's [Effect standards](../effect-standards.md) gives the full
contract and rationale. Durable Schema models, the `Host` capability and
boundary layers already followed these principles; they were retained. The
refactor does not introduce a parallel service hierarchy or rewrite providers
for stylistic consistency.

One intentional compatibility change is documented: synchronous application
factory throws now remain defects. The old Promise runner preserved thrown
`ReleaseError` values as typed failures and normalized other exceptions to
`invalid-data`. Expected failures should be returned using `Effect.fail`.
Non-Effect return values and malformed module exports keep typed validation.

Native filesystem calls without cancellation support must finish before their
handles can safely close. A stuck native call can therefore delay interruption;
the implementation masks individual calls and ownership transitions, not whole
copies or releases. Credential redaction preserves the cancellation decision,
not the original full Cause or interruptor identity.

## Validation and independent review

Validated with Bun 1.4.2 and native Node 22.22.2:

| Check | Result |
| --- | --- |
| `bun run check` | Passed: package builds, workspace TypeScript, import boundaries and 15 public entrypoints. |
| `bun run test` | 356 passed, 0 failed, 3,852 assertions across 59 files. Includes native Node/Bun content lifecycle, HTTP cancellation, authentication, CLI/Action signals and recovery cases. |
| `bun run check:packed-kernel` | Passed: isolated Bun/npm installations, strict public declarations without optional peers, and the new scoped runner executed under native Node and Bun. |
| `bun run check:packed-action` | Passed: Bun/npm consumers, native Node, equivalent reports from fresh caches and exactly one dispatch. |
| `bun run check:installed-workflow --skip-build` | Passed against the delivery built by the preceding gate: installed CLI and Action, ordinary/interrupted continuation and completed recognition through native local Git. |
| Review hygiene | Changed code formatting and `git diff --check` passed; documentation links/census JSON validated; original workspace index matches its pre-work snapshot. |

Native subprocess/socket checks required execution outside the restricted
sandbox; the sandbox suppressed Node child output and blocked `mkfifo`. The
complete suite passed with native process behavior available. No public registry
publication or hosted workflow was initiated by these checks. Test mutations
were confined to local fixture registries and Git repositories.

Packed-gate receipts are retained in the implementation checkout under
`.release/checks/packed-kernel.json` and
`.release/checks/current-packed-action.json`. The full test output is at
`/tmp/ts-release-effect-patterns-test.log`; installed-workflow output is at
`/tmp/ts-release-effect-patterns-installed-workflow.log`. These establish local
Node/Bun acceptance, not a hosted GitHub Actions run or a public release.

Independent review checked the HTTP boundary, application runner and content
store. It caught and corrected a close-before-link ordering regression before
completion; a new native-close-failure test now proves that failure does not
install a digest path. No actionable review findings remained.

## Product improvements still motivated by the audit

The [prioritized adoption backlog](README.md#prioritized-improvement-backlog)
remains separate from this Effect refactor. Its strongest product opportunities
are configurable visibility observation, recovery under a repaired host,
realistic provider conformance, whole-release preflight, and smaller supported
release-set/storage/workflow helpers. This refactor improves the composition and
lifetime foundations for that work; it does not claim to implement those
features or fix every historical consumer incident.
