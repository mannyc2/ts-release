# @mannyc1/ts-release-catalog

Homebrew Formula and Scoop manifest rendering over exact owned Bundle files.
This 0.4.0 source is an unpublished implementation candidate.

Import `Download`, `Formula` and `render` from
`@mannyc1/ts-release-catalog/homebrew`, or `Download`, `Manifest` and `render`
from `@mannyc1/ts-release-catalog/scoop`. Each renderer returns an Effect producing
UTF-8 bytes. Homebrew requires four macOS/Linux x64/arm64 downloads; Scoop requires
Windows x64/arm64 downloads. Supply the release version, executable path and
metadata, including homepage and license. Homebrew additionally takes the exact
Ruby class name and description. The Formula class must match its eventual filename.

Each download contains its public HTTPS URL and the complete owned File from the
Bundle. Rendered hashes come from that file; conflicting bytes at one URL reject.
Rendering does not fetch URLs or verify remote archive contents. Consumers verify
the declared SHA-256 when downloading. Homebrew uses its native version detection
when it exactly matches the declared version and explicitly sets the version otherwise.

Scoop's special `nightly` version rejects because it disables native hash checks.
Its executable path permits Unicode letters/numbers/marks, spaces, dots, underscores,
hyphens and directory slashes, subject to portable path restrictions. Shell syntax
and wildcard paths reject because native Scoop shims embed paths into scripts.
Both renderers reject noncanonical URLs, incomplete cells and substituted Bundle files.

Store the rendered bytes in the application's content owner, then compose FileEdit,
prepare and update from `@mannyc1/ts-release/git`. The common Git host builds one
commit for the selected paths and uses exact expected-old ref comparison. Catalog
renderers add no journal, transport or publication engine. The application chooses
release and correction metadata; immutable Plan and Journal recovery remain kernel-owned.

Local native Ruby/Homebrew, PowerShell/Scoop format and Git recovery checks are
separate from real hosted publication and native Windows installation qualification.
This package has no runtime dependency beyond its kernel and aligned Effect peers.
