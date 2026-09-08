# @mannyc1/ts-release-npm

Native npm publication, dist-tag updates, scoped authentication and GitHub Actions
provenance for explicitly composed ts-release applications. This is an unpublished
refactor candidate; the complete release qualification is still in progress.

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
Accepted receipts exclude arbitrary response bodies.

For provenance, explicitly authorize `createProvenance` and adopt its returned
bytes as a separate owned File. Provide `verifyProvenance` when installing a provider
for provenance intents; loaded files undergo trust verification again. The native
`makeSigstoreAttester` / `makeSigstoreVerifier` pair uses pinned Sigstore5, explicit
OIDC identity, zero write retries, production trust services and exact signed source
bindings. Supply explicit TUF root/cache paths and timeout. Signature trust is the
responsibility of an explicitly supplied `VerifyProvenance` implementation.

Actual native Sigstore verification is currently qualified locally under Node22.22.2.
Bun1.3.14 fails the pinned client's TUF ECDSA root verification; direct Bun Sigstore
signing/verification is unqualified. Ordinary npm authoring/provider execution and
public declarations pass fresh Bun and npm consumers. Live npm/OIDC publication,
CLI/Action and the complete seven-package cohort remain acceptance gates.
