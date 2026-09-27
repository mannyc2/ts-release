# Credential preflight fixture ownership

Baseline: `fc7d1412a75509f48f39f0e551affe7432ee2432`. Isolated checkout
`/mnt/models/dev/ts-release/.credential-fixture-ownership`, branch
`codex/credential-fixture-ownership`. This closes the concrete R26/R27 exception
recorded in [the retention review](test-retention-core.md#credential-fixture-follow-up-static-review-on-f2266bd).
It changes three test/fixture files and no production API or behavior.

## Public preparation and deliberate doubles

The self-release credential preflight previously imported npm's private
`scopeFor`, `readScope` and `endpointFor`, then fabricated a provider/request with
an empty body. Its one-byte provenance could not pass actual npm preparation.
Replacing only the request double with the public provider would therefore
refuse before either credential-exchange scenario ran.

The existing `structuralBundle` helper moves unchanged from `npm/auth.test.ts`
to the npm-owned `fixtures.ts`; both tests share it. It deliberately contains
untrusted signature/certificate material. The self-release test now:

1. Uses public `Npm.createProvenance` with owned tarball bytes and an explicit
   `Attest` fixture to obtain the exact statement and a structurally admitted
   envelope. No native signing adapter is selected.
2. Places both tarball and provenance in the public Bundle with their actual
   content identities and byte readers.
3. Installs public `Npm.definitions` and lets `checkCredentials` invoke its actual
   provider preparation. Request scope, endpoint, body and digest now come from
   that public owner, with no private npm import or hand-authored request.

The accepting `VerifyProvenance` port remains an explicit test double. These
tests qualify structural preparation and the application credential/diagnostic
policy; they do not establish cryptographic trust. The existing actual-SDK
[native Sigstore witness](native-sigstore-settlement.md#integrator-qualification)
owns that separate claim. Registry reads are forbidden, as are journal append
and transport preparation/send. The existing journal read and credential exchange
ports remain deliberate fixtures.

Both original 201/401 cases still require one journal read, one exchange, zero
writes, the same response-shape diagnostics and readiness split, and absence of
both secret values from emitted events. The separate failure-code redaction case
is unchanged. All existing assertions are retained; no test case, assertion
matrix, public testing export or duplicate structural schema was added.

This is an ownership refactor of existing tests, not a newly reproduced runtime
bug. There is no invented before-fix failure claim or new regression suite.
Independent read-only review traced the actual public preparation path and found
no blocking issue in the final three-file diff.

## Qualification and limits

Frozen Bun installation initially failed to access its temporary/cache area in
the sandbox, including with an explicit writable Bun temporary directory.
The same frozen installation completed outside the sandbox, with no dependency
changes; `/tmp/ts-release-credential-fixture-install-qualified.log` records exit 0.
The complete installed Effect guidance was previously read; its unchanged
rc.115 SHA256 was rechecked:
`e155acab559b29e0a54acd0f5d8d4b7a428268ba6eb1aba4d62b4876d6b1a78e`.

The integrator held the coordinator's exact shared lock using
`flock -n /tmp/the-show-full-verification.lock` for the sequential batch:

```sh
bun run check
bun test ./test/reimplementation/npm/auth.test.ts ./test/reimplementation/self-release/credentials.test.js
```

Both commands exited **0**. Static formatting, patched compiler/build,
type-aware lint, root/host types, import policy and package entry checks passed.
The selected existing behavior passed **9 tests, 0 failures, 67 assertions
across 2 files**, in one uninterrupted selected run. Logs:

- `/tmp/ts-release-credential-fixture-check.log`
- `/tmp/ts-release-credential-fixture-behavior.log`

The tuple remains Bun **1.3.14**, TypeScript **7.0.2** with effect-tsgo **0.45.0**,
and aligned Effect/platform **4.0.0-rc.115**. Node22.22.2 was selected on PATH;
these particular behavior cases execute under Bun and do not qualify new Node
or native-host behavior.

Production, dependencies, scripts and generated delivery are unchanged from
qualified fc7d141. No delivery regeneration, packed/native network repeat or
full ordinary-suite repeat was warranted for this fixture relocation. The
previous bounded artifact evidence remains applicable; it does not become a
new all-host, live-provider or full-distribution pass. Original root staging
remains untouched, and no publication is authorized or performed.

Other provider/application error policies, preparation writes, signing and
HTTP/SQLite cleanup remain separate owners. Closing this known test import
exception does not close every semantic R26/R27 or W7 requirement.
