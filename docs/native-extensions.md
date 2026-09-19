# Native extensions

Applications explicitly compose providers using `defineProvider`, `makeRequest`
and the root provider types. A provider defines durable intent and evidence
codecs, request/receipt correspondence, preparation and optional observation.
The core owns dispatch authorization and replay decisions.

The trusted application's `createApplication` factory supplies providers and host
services. Serialized Plan or Journal data cannot select a module to import.
Preparation adopts effect-build 0.8 hashed artifact records through `effect-build`: a
produced file or directory is copied into release ownership and verified against
its recorded identity, and the borrowed producer path is not retained. Apple
preparation remains available through `apple` with its scoped recovery model.
Ordinary producer outputs no longer carry content identity. Run
`Artifact.withSha256` after production and before `adoptFile` or `adoptTree`.
Adoption requires `HashedFile`, `HashedExecutable`, or `HashedDirectory` and
checks copied bytes against that prior identity. Bundle format 2 is unchanged;
its file entries continue to retain their SHA-256 digests. Portable tree names
remain an explicit release requirement through `Layout.validatePortable`.

Apple preparation format 3 owns the binding between the native submission ID
and the exact signed source. Formats 1 and 2 must be prepared again. Recovery
queries only that recorded ID, checks acceptance, restores and verifies the signed
source, then staples, verifies the signature and ticket, assesses, and identifies
the final product before adoption. A different lookup tool does not change the
submission identity. The upstream Apple API supplies native operations; the
release application composes these assurance checks explicitly.

See [application preparation](preparation.md) for runtime wiring.

`restoreTree` verifies the staged tree before exclusively claiming its destination
as an empty directory, then renames the complete tree over that reservation.
Existing files, directories and dangling links are refused. Wait for the returned
artifact before reading the destination. If the final rename fails, inspect the
retained reservation before retrying; restoration never deletes it or moves it
aside. Hosts that cannot rename over an empty directory fail without a fallback.
