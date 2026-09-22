# @mannyc1/ts-release-github

GitHub tag, release and asset operations for the ts-release kernel. This workspace
uses the matching `@mannyc1/ts-release@0.4.0` core and `effect@4.0.0-rc.115`.

Compose `definitions({ bundle, readContent, read })` with an owned Bundle, its
content reader and an explicit HTTP reader. Install those six definitions in the
kernel Host and use the shared HTTP transport. `authorizeToken` binds an existing
redacted token to the selected repository and principal before opening it.
Repository read routes are bounded families; this helper does not downscope a
remote token. Mutation and upload requests bind their exact native endpoint,
bytes and returned parent identities before credentials are acquired.

Author a lightweight tag with `lightweightTag`, or an annotated object and ref
with `annotatedTag` and `annotatedRef`. `draft` depends on that managed tag or an
explicit `ExistingTag` commit. Each `uploadAsset` depends on the draft, and
`publish` names the complete selected asset-operation set. Authors derive those
required dependency edges. Zero-asset releases use an empty asset-operation set.
The complete graph is checked before storage or provider effects.

The returned annotated-object ID, release ID and upload URL come from validated
Journal evidence. A fresh host reconstructs them from the same history. An upload
uses owned raw bytes and retains native effective name, state, size and digest.
Missing native digests require exact downloaded-byte verification. Explicit
GitHub asset redirects receive no repository token, and signed download URLs are
not durable journal data. A draft's assets are addressed under GitHub's
`untagged-<hex>` placeholder until publication; the provider accepts that form and
the tag form, binding each asset by API id and stored name. Repository authority is
an authenticated exact view: GitHub reports no grants for the Actions installation
token, so none is required, and write authority is proven by each acknowledged write.

Draft preparation requires complete authenticated release enumeration and an
exact tag target even when optional observations are disabled. Publish preparation
rechecks the complete asset set and tag target. These reads are not remote locks:
GitHub does not offer an atomic snapshot across tag, release and asset endpoints.
The common executor owns conditional journal append and dispatch permission.
A response loss remains uncertain; later absence never authorizes a blind resend.
Native starter assets, changed names, conflicting bytes and incomplete pagination
cannot be treated as a successful upload or complete release.

Authenticated release and asset enumeration admits up to 16 MiB per JSON page,
64 MiB across the complete enumeration and 1,000 pages. Individual native-object
JSON responses remain limited to 1 MiB. Configure the HTTP reader's
`maximumResponseBytes` to at least 16 MiB to admit populated release pages;
exceeding any provider bound stops enumeration without treating a partial list as
complete.

The package uses the GitHub.com REST API, pinned to 2022-11-28, with an explicit
User-Agent. It has no CLI or implicit environment/credential discovery. Compose
CLI, Action or self-release policy at the application boundary. Keep the provider
and application versions fixed for an unfinished release.
