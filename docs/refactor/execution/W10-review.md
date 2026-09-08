# W10 implementation review

This is the implementer's material review of the completed local candidate. It
is not independent Plan010 certification, and no separate reviewer was claimed.

Application-boundary review traced authority from the CLI and Action into
`runApplication`. The dynamically imported path is an explicit trusted
application input; neither durable Plan nor Journal content can select it. The
module must export an Effect-producing `createApplication`, whose scoped result
supplies Bundle, Plan and a captured host. The admitted Bundle/Plan identities
are retained across execution and report projection. Node and Bun layers are
provided only at application/runtime boundaries rather than hidden in the
kernel.

Process review exercised successful completion, typed failure, SIGINT and
SIGTERM in separate operating-system processes. The interrupt owner installs
and removes exactly its two signal listeners, keeps the asynchronous main alive,
aborts once and awaits Effect scope finalizers before returning 130 or 143. The
Action catches no private failure text: its public diagnostic directs operators
to the durable journal. Output admission permits only a SHA-256 plan ID and a
non-negative decimal revision.

Action path review checks both lexical traversal and symlink escape. The
workspace itself and an in-workspace application are resolved through
`realpath`; a candidate outside the workspace fails before import. The Action
does not accept an ambient package, command or transport selector. Packed Bun
and npm copies contain the same launcher and package bytes, omit optional peers,
use no installed-package symlink and continue the persisted journal on a fresh
runner without a second send.

Self-release review follows every intended output from exact owned content. The
application verifies the Bundle SHA-256, Plan ID, source repository/commit/tree,
seven-package npm cohort, four wheel filenames, GitHub tag, catalog paths and
bytes, MCP operation, OpenAI package tree and marketplace update. Provider
definitions are built through public package exports. Its host cannot read a
network destination or dispatch, and the run options forbid authorization,
observation and dispatch. This establishes a complete non-mutating intention;
it does not simulate publication success.

Package review rebuilt declarations and fresh archives before consumer checks.
One issue found during this pass was an exported inferred `Sigstore.Bundle`
return type in npm's declaration, which pulled development-only Sigstore
declaration dependencies into a strict consumer. The public structural
admission result now exposes `bundle:unknown`; the native type assertion exists
only at the internal `Sigstore.verify` call. Fresh Bun and npm consumers then
passed with `types:[]`, `skipLibCheck:false` and optional peers absent. The same
review found TypeScript had expanded MCP's nested filtered codecs into a 3.7 MB
declaration. Explicit public codec annotations retain the exact class-union
types while reducing that declaration to 90,532 bytes/1,655 lines; all nine MCP
and OpenAI tests and fresh packed imports still pass. The final packed matrix now
installs all seven archives rather than treating MCP/OpenAI as workspace-only
imports. Runtime validation and native verification behavior are unchanged.

Migration review re-parsed and hash-matched every one of the 18 W10-assigned
files before confirming deletion and successor ownership. Their 2,067 lines and
152 declarations, plus the separately recorded 24-line old Action metadata,
close the final 2,091 inherited lines. The retired CLI/config/prepared-store and
Action bridge are not retained behind compatibility exports. `.repos/effect`
and the user's original worktree remain outside the implementation.

Source review recomputed every maintained file after the final declaration
fix. Product is exactly 11,485 lines, all replacement, with no forecast or
variance used as a pass. The generated Action bundle, metadata, owned data,
tests, fixtures and tooling are counted separately and remain visible. The
forecast's actual source bindings and production declaration projection were
also refreshed before sealing.

The direct and packed matrices cover local deterministic behavior, fresh
installation, package-manager skew, runtime skew, process replacement, real Git
journals and actual loss boundaries. They do not cover hosted node24, live npm,
PyPI, GitHub, MCP Registry or marketplace mutation, human OpenAI submission,
credentialed Apple/Windows signing/notary services, direct Bun Sigstore/TUF, or
the independent complete-candidate review. All 69 launch outcomes therefore
remain open, and no publication or release-certification claim is made.
