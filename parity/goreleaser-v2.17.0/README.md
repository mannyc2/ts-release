# GoReleaser v2.17.0 parity contract

`manifest.json` is the only machine population and requirement source for the
rewrite program. It transcribes the recorded semantics from the closed
Plan 151 ledger; it does not fetch or infer upstream behavior.

The three raw populations are independent:

- customization: 115 raw, 107 eligible, 8 excluded;
- Pro: 36 raw, 33 eligible, 3 excluded;
- deprecations: 40 informational rows, outside both parity equations.

The customization exclusions are C005, C008, C017, C023, C028, C047, C050,
and C051. The Pro exclusions are P029, P035, and P036. Historical
`SHIPPED` or `CONFIG-EQUIVALENT` prose is retained only as provenance. It
never contributes to a numerator.

Every eligible row freezes:

- its exact semantics, population, family, and independent assertion;
- one or more implementation keys with exactly one owner per key;
- the complete public JSON-compatible config fixture and named invalid/excess
  cases;
- required executable case ids and levels;
- pre-implementation external contract fixture ids where a tool or wire
  boundary exists.

Current-surface fixture provenance is `recorded-evidence`. Later closed-profile
surfaces carry the accepted plan decision and remain
`maintainer-decision-required` until the exact version/argv/wire contract is
frozen before that key's first source-history record. That marker cannot pass
a case and does not authorize research or an implementation-derived fixture.

The only permitted final claim is:

> Full in-scope outcome parity for TypeScript/Bun distribution against the
> pinned GoReleaser v2.17.0 ledger: 107/107 customization rows and 33/33 Pro
> rows.

`bun run check:parity -- --bootstrap` derives the denominators from the
manifest and executes the registered case code for the current source
snapshot. At this contract milestone every eligible row is unverified, so
the expected numerator is 0/107 customization and 0/33 Pro.
