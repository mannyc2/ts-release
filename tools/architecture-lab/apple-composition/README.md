# Mixed Apple release composition

This experiment corrects two restrictions in the earlier app fixture: it admitted
only one preparation and bound the publication Plan to a one-tree Bundle. The
new mechanism keeps one physical journal and one final publication Plan while
admitting multiple exact preparations and a complete mixed release Bundle.

`composition.ts` owns a strict immutable preparation collection. Its journal ID
hashes the caller-ordered native inputs, excluding their derived journal-ID
fields. Loading recomputes that identity before any store or native call. Adding,
removing or changing an untouched preparation cannot retain the old release root.
This input contains finalized source artifacts, native signatures and public
authority references; it contains no future operation DAG or release recipe.

Each preparation uses the existing opaque dispatch machine. After its recorded
native acceptance, local stapling, assessment, immutable adoption and optional
delivery-file construction produce an output subbundle. The existing journal CAS
selects one Ready fact and those exact bytes for that preparation. The full final
Bundle must contain every member of every selected output subbundle, alongside
any other release artifacts. The one final Plan hashes the full Bundle content
identity. A source tree cannot substitute for the selected assessed final tree,
and a selected delivery file cannot be omitted or changed.

The complete preparation set and all scopes are validated against one global
history revision. The new core guard admits at most one publication scope. Its
first publication fact fixes that Plan in the journal; the guard does not invent
a registration event before the first fact. The application freezes and transfers
the complete Bundle and its one Plan before publishing. An intentionally new
release/root is distinct from automatic continuation of this immutable input.

`amend.mjs` preserves the original app experiment and creates a temporary amended
copy: remove its one-preparation restriction and allow an optional native-final
artifact callback to return already owned delivery Files before Ready selection.
The amended app helper remains 224 physical lines; it replaces that original
224-line helper. The new collection/full-Bundle mechanism is 70 physical lines.
Do not charge the temporary full source copy as another product implementation.

The actual fixture passes strict TypeScript against the retained published
effect-build/Apple 0.6.3 packages and the current machine. Eight fresh Bun
processes run two different app preparations (arm64/x64), create two actual TARs
from the post-staple trees, finalize a five-member Bundle including an independent
Linux file, and publish once. A fresh resume sends zero times. Source and native
producer directories are deleted before final assembly. Six negative checks
cover changed untouched input before any journal/native call, missing/duplicate
preparations, wrong full Bundle, omitted selected delivery and substitution of
the original source tree. All facts use the same SQLite journal, ending at global
revision 8. TAR bytes pass through the real upstream File finalizer and adoption;
the fixture inspects their ticket member independently.

Apple Client/Stapler/Assessor services are explicit protocol doubles. These are
unsigned test trees and fake tickets. The experiment does not claim real Apple,
DMG/pkg or Gatekeeper acceptance. The complete typed app/DMG/pkg production API is
[`apple-api.d.ts`](../../../docs/refactor/architecture-program/handoff/apple-api.d.ts);
its extra native branches remain explicit implementation and native qualification
work. The old app-only declarations are retained historical evidence.

Run `bun tools/architecture-lab/apple-composition/run.mjs`. It installs retained
public producer tarballs and the installed dependency closure through a local
registry, compiles the actual source amendment, and executes the fixture. The
runner requires local socket/subprocess permission and writes a hash-bound
`results.json`. It performs no remote mutation or publication.
