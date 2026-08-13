# Plan 228k — Verified preparation and durable source provenance

Input-Commit: 3a5b7cef4437c5f59bc547481535ebbc83cf437f
Result-Commit: SELF
Evidence-Commit: SELF
Status: IMPLEMENTED / DETERMINISTIC CONTRACT TESTED / LIVE PUBLICATION NOT AUTHORIZED
Outcome: EXACT-GIT-MATERIALIZATION / PRIVATE-STAGING / COMPLETE-BUNDLES-ONLY
Date: 2026-08-13

Commit convention: `SELF` means this completed implementation and its
deterministic handoff are intentionally co-committed in candidate result X. It
does not name Plan 233 certificate Y or supply live-provider evidence.

## Decision

Preparation consumes a fresh private materialization of the exact verified Git
commit. It does not run against the operator checkout and does not copy the
checkout wholesale. Tracked blobs, executable modes, and contained symlinks
are read from Git objects, verified, written into an empty directory, and
recorded in a canonical path/type/mode/size/SHA-256 manifest. Untracked and
ignored workspace bytes are excluded unless a graph artifact declares them as
an explicit non-Git input.

Every command receives a closed environment, a private staged working
directory, and no declared ambient environment variables. On the certified
Linux host, generic commands are dispatched by an external Bun runtime after
an embedded helper loads `libseccomp.so.2` and installs a fail-closed syscall
filter. Helper bytes, Bun bytes/version, loaded libseccomp bytes, kernel,
architecture, and denied syscall set enter provenance. The standalone CLI
still requires Bun and `libseccomp.so.2`; it is not a self-contained execution
sandbox. The only
`offline-cli` operations are the certified `npm pack --offline --ignore-scripts`
and isolated
`bun install --offline --frozen-lockfile --ignore-scripts --no-save --linker=hoisted`
protocols. The hoisted linker keeps the admitted dependency closure beneath the
single declared root `node_modules` instead of writing package-local workspace
link farms. For that exact Bun install only, the parent canonicalizes an explicit
`BUN_INSTALL_CACHE_DIR` or Bun's standard `$HOME/.bun/install/cache` and passes
the child only `BUN_INSTALL_CACHE_DIR`; `HOME` and ambient Bun configuration
remain absent. A command may persist only declared outputs. Source, explicit
inputs, isolated dependencies, undeclared cache paths, and scratch paths are
snapshotted before and after execution; any change aborts preparation.

Certified Bun cross-compilation uses a separate, narrower cache boundary. The
parent selects the exact target-runtime file for the executing Bun version,
rejects links or noncanonical files, copies that one file into a new private
read-only cache, and gives only that disposable cache to the exact built-in
`bun build ... --compile --target ... --outfile ...` command shape. The Linux
x64 target binds the executing Bun bytes directly. Target, version, source,
filename, and SHA-256 enter durable execution provenance and the preparation
basis. Cache shape or byte mutation aborts before output admission.

Prepared releases have one admitted durable form: `kind: "complete"`. The
manifest records the exact source snapshot, explicit inputs and their
materializers, tool/lockfile basis, closed execution facts, every artifact's
producer and input-basis digest, and the exact publication intents. The
manifest deliberately states `reproducibility: "not-asserted"`: host clock and
randomness are not isolated, although `SOURCE_DATE_EPOCH=0`, UTC, and the C
locale are supplied and all resulting artifact bytes are content-bound.

Runtime-discovered outputs are admitted only through a typed artifact
collection contract. The authored preparation declares one stable collection
id, producer-owned root, homogeneous artifact kind, portable filename suffix,
media type, and cardinality range. A downstream GitHub selector must repeat the
same id/kind/suffix/media contract and a link-compatible cardinality before the
producer can run. The graph carries the contract, not guessed filenames.

## Input-closure contract

| Input class | Admission and provenance rule | Failure rule |
|---|---|---|
| Git source | exact verified commit/tree; canonical staging snapshot includes every blob, mode, and contained link | tracked drift, object disagreement, submodule, unsafe path/link, case collision, or package-manifest disagreement aborts before a command |
| Ignored/untracked artifact | copied or reflinked only when the graph names its exact artifact path; digest, size, materializer, and basis enter provenance | undeclared bytes stay absent; overlap with Git source, symlinks, escapes, or missing paths abort |
| Bun dependencies | admitted only for a Bun preparation with exactly one tracked root `bun.lock` or `bun.lockb`; one private offline, frozen, hoisted install creates a real root `node_modules`; tree digest, Bun version, lock digest, and tool digest enter provenance | no lock, tracked `node_modules`, install failure, package-local `node_modules`, source/cache write, workspace inode alias, escaping link, or later dependency mutation aborts |
| Bun compile runtime | the exact current Bun bytes serve Linux x64; each other advertised target requires one canonical version-matched runtime in the host cache that is copied alone into a disposable read-only cache; all runtime identities enter the preparation basis | missing/linked/wrong-version runtime, uncertified command shape or target, private-cache mutation, target download attempt, or inconsistent repeated identity aborts |
| npm package | an optional explicit package build runs first with declared absent output roots; `npm pack` then reads the private staged package, uses a private output/cache, disables scripts and online resolution, and reports the selected file set; the exact npm version/executable and release graph enter provenance | undeclared build mutation, missing/linked/escaping build root, missing literal `files` entry, linked/escaped/unmaterialized selection, package mutation, malformed report, changed npm executable, or non-single tarball output aborts |
| Command output | a graph-owned output root is the sole persistent writable area; captured bytes are hashed immediately | output/source or output/input overlap, undeclared mutation, linked capture, missing output, or nonzero exit aborts |
| Runtime artifact collection | one empty, absent-before-run root is writable; post-run files are recursively enumerated in code-point order and receive stable ids derived from producer, collection contract, and normalized member key | root overlap, missing/non-directory root, symlink, escape, unsupported filesystem kind, non-portable/case-colliding key, suffix/kind/media disagreement, or producer/consumer cardinality violation aborts |

Changing ignored bytes that are not selected leaves the source and prepared
artifact identities unchanged. Changing a declared non-Git input, the isolated
dependency tree, lockfile, Bun version, execution platform, or captured output
changes the preparation basis or canonical prepared bytes.

## Collection claim semantics

The collection contract separates declarations from observations:

| Claim | Declared authority | Observed verification |
|---|---|---|
| Identity and ownership | collection id, operation producer, and root | root is absent before execution, then a real contained directory; every member id is SHA-256-derived from the full stable contract plus canonical key |
| Membership | portable dot suffix and producer cardinality | recursive file enumeration is code-point sorted; paths must be ASCII POSIX form, unique under portable case folding, regular, contained, and unlinked; actual count must satisfy the producer contract |
| Archive | `archive` plus `.zip`/`application/zip`, or a supported gzip suffix plus `application/gzip` | member bytes must carry the corresponding ZIP or gzip signature; this verifies format identity, not full semantic archive extraction |
| Digest | `digest`, `.sha256` or `.sha512`, and `text/plain` | bytes must be UTF-8 canonical checksum rows with the declared hexadecimal width; the collection does not claim those rows describe a separate artifact unless another contract establishes that relation |
| Executable | `executable` and `application/octet-stream` | the captured regular file must have at least one executable mode bit; arbitrary executable semantics or target architecture are not inferred |
| Generic file | `file`, suffix, and non-archive media type | regular-file/path containment and exact bytes are observed; arbitrary media type content is declared, not sniffed |
| Downstream selection | collection id, exact kind/suffix/media, and consumer cardinality | graph linking rejects impossible or mismatched selectors; prepared GitHub assets contain the exact sorted durable member ids and the observed count must also satisfy the consumer range |

The complete prepared manifest persists each collection contract and its exact
`key -> artifactId` member list beside the content-bound artifacts. Canonical
decode and store reload recompute stable ids and paths, verify contract/member
agreement, cardinality, ownership, ordering, blob integrity, and publication
references. Consequently a lost API response can be retried from the prepared
reference without retaining or reconstructing the disposable graph.

## Durable store and trust boundary

The local store writes all blobs and the canonical manifest under a temporary
content-addressed directory, fsyncs files/directories, then performs one atomic
promotion. It rejects missing, altered, extra, or linked blobs and every
partial/unknown manifest kind. Pre-promotion faults leave no loadable bundle;
post-promotion faults remain reported and the exact bundle is recoverable.
Concurrent identical writers converge on one digest directory.

Local and hosted bytes have intentionally different trust evidence. Local
verification requires the exact canonical store root plus an explicit operator
boundary. GitHub Actions verification requires the exact repository,
workflow ref and immutable workflow SHA, run and attempt, candidate commit,
digest-bound artifact name, prepared digest, and repository-workflow writer
boundary. Copying local bytes or their digest cannot manufacture hosted
provenance. The Action store invokes this verifier before accepting downloaded
bytes.

The runtime staging/materialization records are exported through the narrow
`@mannyc1/ts-release/host` boundary. Store-provenance evidence and verification
are exported through `@mannyc1/ts-release/store`; neither expands the root API.

## Deterministic evidence

The focused suites cover:

- exact Git blobs, executable modes, contained symlinks, untracked exclusion,
  case collisions, escaping links, and verification/materialization drift;
- source and cache mutation, writable-source declarations, undeclared npm
  selection, explicit-input identity, dependency no-lock/alias/cache failure,
  and exact tool-version basis;
- canonical complete manifests, provenance disagreement, local/hosted trust
  separation, missing/altered/extra/linked blobs, the full store fault matrix,
  concurrent writers, and fresh-process reload;
- Action upload-before-reference ordering and authenticated hosted reload.
- public config-to-graph collection linking; zero/one/many deterministic
  capture; nested member ordering and stable ids; prepared-store reload with no
  command rerun; exact GitHub selection; and cardinality, selector, suffix,
  archive-byte, digest-byte, executable-mode, unsafe-name, case-collision, and
  symlink refusals.

No evidence command in this plan contacted npm, GitHub, an OIDC issuer, or any
other public provider, and no publication was executed.

Current-worktree focused rerun on 2026-08-12:
`bun test test/core/artifact-collection.test.ts` — PASS, 7 tests and 67
expectations. This is contract-tested local evidence, not clean-candidate or
live-provider certification.

## Operational-cost evidence

On the 2026-08-12 Linux development host, the isolated synthetic collection
suite completed seven tests in 0.28 seconds wall time with 157,440 KiB maximum
RSS (`/usr/bin/time` around `bun test test/core/artifact-collection.test.ts`).
This measures collection linking, capture, hashing, durable commits/reloads,
and refusal paths for at most three small files. It is deliberately not used as
a claim about production archives, Bun dependency installation, or native CLI
compilation.

**OPEN cost blocker:** the representative self-release preparation requires a
clean exact-Git candidate checkout. The current integration worktree is dirty,
so the public source observer correctly refuses it before preparation; a
cold/warm Bun install and multi-target build measurement recorded here would be
fabricated. The release-candidate certification must measure that clean commit
and record wall time, maximum RSS, prepared-store bytes, dependency-tree bytes,
and cold-versus-warm cache state before making an operational-cost claim.

## Honest limitations

- Generic network denial depends on Linux seccomp and the host-provided
  `libseccomp.so.2`. If the library, required syscall rules, or filter load is
  unavailable, command spawn fails closed; the implementation does not silently
  run with network access.
- Bun's offline installer may read the one canonical host package-cache
  directory described above. The produced private dependency tree is
  independently snapshotted and included in the prepared identity; the
  implementation does not claim that two hosts produce the same tree, and
  `reproducibility` remains `not-asserted`.
- Cross-target Bun runtime files must already exist in that cache during host
  provisioning. Preparation never downloads them: it consumes only verified
  private copies while the command remains under the fail-closed network filter.
- Host wall clock and randomness are not isolated. They are named as
  `host-*-not-isolated` in durable execution provenance, and any resulting
  byte difference changes the artifact and prepared-reference digests.
- Partial prepared releases still have no public producer. Cross-host
  partition/merge remains owned by Plan 235 and cannot reuse the complete
  collection bundle by omission.
