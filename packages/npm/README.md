# @mannyc1/ts-release-npm

Native npm publication, dist-tag updates, scoped authentication and GitHub Actions
provenance for explicitly composed ts-release applications. Install this package
with the matching `@mannyc1/ts-release@0.4.0` core and `effect@4.0.0-rc.115`.

`inspectTarball(file, artifacts)` reads the exact owned Bundle member and returns
package metadata plus native SHA-512 integrity and SHA-1 shasum. Put those hashes
in `PublishIntent`; the provider recomputes them before registry I/O. `publish`,
`distTag` and `author` create immutable operations. Private candidates are omitted
structurally by `author`. Public publication currently targets npmjs with public
access; prereleases require a non-latest initial tag.

```ts
import { Effect } from "effect"
import * as Npm from "@mannyc1/ts-release-npm"

// file is an owned File; artifacts is the application's ArtifactAccess.
const authorPublication = (file, artifacts) =>
  Effect.gen(function* () {
    const { name, version, integrity, shasum } = yield* Npm.inspectTarball(file, artifacts)
    return yield* Npm.publish(
      new Npm.PublishIntent({
        registry: "https://registry.npmjs.org/",
        name,
        version,
        tarball: file,
        integrity,
        shasum,
        initialTag: "latest",
        access: "public",
        authorization: new Npm.TokenAuthorization({ principal: "npm-publisher" }),
        provenance: new Npm.NoProvenance({}),
      }),
    )
  })
```

Install `definitions({ ...artifacts, read })` in the application's Host. The
provider verifies the complete native PUT body before credential lookup and
receipt acceptance. Token bytes stay in the live transport; `authorizeToken` and
`authorizeTrusted` bind them to exact origin, principal and canonical intent scope.
The transport prepares credentials before the journal records DispatchStarted.
The common executor retains fresh conditional-append authority and the sole send.

Publication evidence separates the immutable version from its initial tag. A moved
tag cannot authorize another package upload. A separate new dist-tag operation can
move an existing tag. After a possible write, absence never authorizes a blind retry.
Accepted receipts exclude arbitrary response bodies. Any 2xx reply is the registry's
acknowledgement of the exact write: npm documents HTTP 200 for a successful publish
and answered 201 historically. Public visibility follows asynchronously and is
established only by observation. Every other status is journaled as
`npm-native-failure/1` with the HTTP status and stays inconclusive until observed.

Local browser authentication uses `makeLocalAuthentication` inside the application's
Effect scope. Supply a `TokenAuthorization`, an explicit `configFile` containing the
literal `//registry.npmjs.org/:_authToken` written by `npm login`, and a `notify`
callback for the redacted browser URL. The session exposes `credentials`, synchronous
`capture(request, response)`, and `complete(operation)`. Wrap each npm provider's
`decodeResponse` to capture the live response before delegating to the provider.
Only after the kernel records that operation as `Rejected`, call `complete` and,
when it returns true, re-enter the kernel with the same Plan and Journal. Bound the
application to one authentication continuation per operation in each invocation.
`complete` authenticates; it never publishes or creates dispatch permission.

Only native HTTP 401 with the exact `WWW-Authenticate: OTP` challenge produces
`npm-authentication-rejection/1` noncommit evidence. This follows
[HTTP 401 semantics](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.2) and
[npm's OTP challenge flow](https://docs.npmjs.com/cli/v11/commands/npm-publish/#otp).
Other failures remain uncertain. Challenge URLs and OTPs stay in memory; only the
exact request binding and rejection kind enter the journal. Polling is bounded,
cancelable, restricted to npm HTTPS origins, and never follows redirects. The
default authentication deadline is five minutes. On expiry, rerun to request a fresh
challenge. A crash after the authenticated publication begins follows ordinary
observation and recovery rules.

The local credential resolver requires a `PUT` binding with the exact body digest
before returning an OTP; each completed OTP is supplied once. It returns no secrets
for reads. Native ts-release HTTP transports provide these binding fields.
`authorizationBinding(binding)` returns an Effect containing the owned authorization
and package name, so hosted applications can select token/OIDC acquisition without
parsing private scope data. There is no ambient npm configuration discovery; quoted
or interpolated tokens and duplicate npmjs token entries are refused.

For provenance, explicitly authorize `createProvenance` and adopt its returned
bytes as a separate owned File. Provide `verifyProvenance` when installing a provider
for provenance intents; loaded files undergo trust verification again. The native
`makeSigstoreAttester` / `makeSigstoreVerifier` pair uses pinned Sigstore5, explicit
OIDC identity, zero write retries, production trust services and exact signed source
bindings. Supply explicit TUF root/cache paths and timeout. Signature trust is the
responsibility of an explicitly supplied `VerifyProvenance` implementation.

Actual native Sigstore verification is currently qualified locally under Node22.22.2.
Bun1.3.14 fails the pinned client's TUF ECDSA root verification. The native Sigstore
adapters therefore fail with `npm-sigstore-runtime` when invoked under Bun; use
supported Node.js for their execution. Imports, construction, provenance data
authoring, custom verifiers, and ordinary token publication remain available under
Bun. Ordinary npm authoring/provider execution and
public declarations pass fresh Bun and npm consumers. Live npm/OIDC execution
through these provider APIs remains separate from publishing this package itself.
See the repository's release runbook for seven-package distribution and the
installed CLI/Action checks.
