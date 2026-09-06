# Native Git object construction experiment

This bounded prototype replaces the retained handwritten Git tree/commit parser
with Git's own plumbing. It is research code, not the completed Git provider or
native host. It does not change the selected core, event format, transport or
package tournament.

`objects.ts` retains the exact `core-git-object-set/v1` object type/base64 codec.
It imports each object into a fresh private repository, checks native OIDs,
uses `read-tree`, `update-index`, `write-tree` and `commit-tree`, validates the
single expected parent, checks the exact managed blob/mode at each path,
rejects unrelated changes with `diff-tree`, and requires native `fsck --strict`.
`rev-list`/`cat-file` export the entire reachable desired graph, including the
old commit ancestry, into owned content. No source repository, index or worktree
is needed after that object-set is stored. A host must bound object count,
individual size and aggregate bytes before buffering this complete graph; it
must not silently truncate history or treat an incomplete set as complete.

The test uses actual Git in SHA-1 and SHA-256 formats. It creates two managed
files (644 and 755), preserves an unrelated README, verifies deterministic
commit/object-set bytes, deletes both original and builder repositories, and
reloads the owned graph into a fresh repository. Negative cases cover an
unmanaged change, wrong mode, traversal, duplicate/nested managed paths,
invalid native timestamp, duplicate objects and tampered content. This file
has **2 tests / 28 assertions**; reload happens in the same test process.
The separate `machine/test/git-catalog.test.ts` experiment establishes actual
cross-process journal/transport replay, using the retained object-set format.
Neither proof substitutes for the other's missing surface.

Run:

```sh
bun test ./tools/architecture-lab/git-catalog/objects.test.ts
bun node_modules/typescript/bin/tsc --ignoreConfig --target ES2022 --module NodeNext --moduleResolution NodeNext --lib ES2022,DOM,ESNext.Disposable --types bun-types --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --skipLibCheck false --noEmit tools/architecture-lab/git-catalog/objects.ts tools/architecture-lab/git-catalog/objects.test.ts
```

`objects.ts` is **122 physical / 157 TypeScript-printer lines**. Its 65-line test
is not included. This gives a measured basis for replacing the previous
890-line expected native codec/construction/reload allocation. It does not make
the 65-line earlier replay fixture a production native host.

The revised full Git implementation estimate is **710 / 1,000 / 1,460 physical
lines** (low / expected / high). The components are:

| Responsibility | Low | Expected | High |
| --- | ---: | ---: | ---: |
| Measured object construction/verification mechanism | 122 | 122 | 122 |
| Complete public codecs, immutable capture, aggregate bounds and native-output errors | 138 | 198 | 418 |
| Native process lifecycle, exact credentials, repository scope, capture/read/push | 330 | 490 | 650 |
| Catalog authors, native evidence binding and conditional core transport | 90 | 140 | 200 |
| Public exports and thin wrappers | 30 | 50 | 70 |

The additional 198 expected lines include strict public coordinate/input codecs
(~50), severing mutable input/content aliases and constructing the admitted
native command capability (~35), aggregate count/byte and per-object admission
limits (~45), native output/UTF-8/diagnostic error conversion (~28), and capture
integration around an exact remote/base revision (~40). These are unimplemented
estimates, not measured savings. The current 71-line protected core Git
transport is included in the author/conditional transport row. The 490-line
native host estimate remains charged: donor bounded process handling, private
repository lifecycle, exact Basic/Bearer/anonymous credentials, read-ref,
fetch/capture and conditional push do not disappear through native parsing.

Source donors are immutable overlay `2ef7a9a61fe40608d053569cbcd71e40fca5c181`:
`src/transport/core-git.ts:321` onward supplied the native codec/tree/commit
laws; `src/platform/core-git-live.ts:147` onward supplies process/lifetime and
credential needs; `src/platform/git-authorization.ts` supplies the 134-line
native auth boundary. The new mechanism removes the need for a second custom
Git graph parser. It adds dependence on the already required host Git command
semantics and complete-graph resource admission. This is a proposed
implementation choice established locally, with no hosted credential or remote
service acceptance claim.

The expected Git estimate decreases by 570 lines, from 1,570 to 1,000.
The complete program arithmetic, counting lanes and threshold status are owned
by [the current handoff forecast](../../../docs/refactor/architecture-program/handoff/forecast.json).
