# Where ts-release fits

ts-release is a TypeScript/Bun release engine. This interim comparison names
only executable capabilities; schema fields, historical profiles, and upstream
feature names are not support evidence.

Every GoReleaser statement below is read from its documentation at the pinned
version `v2.16.0`; this project has not executed GoReleaser.

| Surface | Executable product capability |
|---|---|
| <!-- claim capability:build.bun-compile --> Cross-target builds | Bun compilation with declared target triples |
| <!-- claim capability:artifact.archive --> Archives | deterministic tar.gz and zip preparation |
| <!-- claim capability:artifact.checksum --> Checksums | sha256/sha512 preparation |
| <!-- claim capability:publish.github --> GitHub releases | typed release publication path |
| <!-- claim capability:publish.npm --> npm | typed package publication path |
| <!-- claim capability:catalog.render --> Catalogs | local Homebrew/Scoop/generic file rendering |

Catalog rendering deliberately does not submit Git changes in this wave.
Remote catalog delivery is owned by plan 215. Local command checks, generated
files, and artifact transforms are recovered user cases for the preparation
grammar in plans 212–213, not lifecycle hooks.

<!-- claim docs-derived:121 -->
Per GoReleaser's v2.16.0 documentation, its configuration surface includes
additional provider and lifecycle features that are not automatically product
capabilities here.
