# Native extensions

ts-release extends user jobs through typed preparation and provider subjects,
not lifecycle hook names. The stock CLI and Action load only bundled
capabilities. A custom library application may install provider modules
explicitly through `@mannyc1/ts-release/provider-sdk`; serialized configuration
cannot name a package, command publisher, or dynamic plugin.

## Preparation jobs

`CommandCheck` validates declared inputs and creates no durable output.
`CommandArtifact` transforms declared inputs into exact regular-file outputs;
the collection variant captures runtime-discovered files through a typed root,
suffix, media type, artifact kind, and cardinality contract. Commands are argv
arrays, run in private verified staging with denied network and a closed
environment, receive no publication/signing secret, and fail if they mutate
source inputs or create undeclared output.

Concrete translations:

- A pre-build policy check is `preparations: [{ kind: "check", id:
  "policy", inputs: ["source"], run: ["bun", "run", "policy",
  "{input:source}"] }]`.
- Generated release notes are a `CommandArtifact` with one declared Markdown
  output. A later GitHub publication may select that artifact as its body.
- Transforming an executable or archive names the old artifact in `inputs` and
  the new file in `outputs`; dependency order replaces before/after hooks.
- A runtime-discovered report set uses `collection` and a GitHub publication
  consumes it through an identical stable selector.
- Artifact validation is a `CommandCheck` that names the artifact as an input;
  reading an ambient workspace path does not establish a dependency.

These jobs are preparation-only. They cannot claim a remote write, request a
credential reference, or receive a registry, signing, notarization, or
publication secret.

## Exact remote verification

`observe(prepared)` runs the same exact npm, GitHub Release, PyPI, and catalog
subjects that `publish` uses before mutation. It returns provider facts and
never acquires mutation authority. There is no parallel generic HTTP-check
language and no `verify` synonym: installed provider equality is the reusable
primitive.

## Custom provider applications

A custom application may compose a provider module:

```ts
import { makeReleaseApi } from "@mannyc1/ts-release"
import { makeCustomReleaseLayer } from "@mannyc1/ts-release/host"
import {
  ProviderAdapterContract,
  makeProviderAdapter
} from "@mannyc1/ts-release/provider-sdk"

const adapter = makeProviderAdapter({
  id: "publish.acme",
  contract: ProviderAdapterContract.make({
    schemaVersion: "ts-release/provider-adapter-contract/v1",
    preparedSubject: "typed-canonical-data",
    identity: "canonical-subject-id",
    observation: "exact-equality-and-authoritative-absence",
    mutation: "typed-precondition-and-commitment",
    credentials: "audience-and-purpose-scoped",
    recovery: "coordinator-profile",
    certification: "provider-protocol-and-public-boundary-tests"
  }),
  profile: acmeRecoveryRegistration,
  subjects: (bundle, services) => makeAcmeSubjects(bundle, services)
})

const api = makeReleaseApi(makeCustomReleaseLayer(host), {
  providerAdapters: [adapter]
})
```

The registration validates the recovery profile and the emitted subjects must
use that provider's credential authority and exact profile. The unchanged
coordinator then validates canonical subject/request identity, observation
order, mutation purpose, anonymous refusal, prerequisites, and durable history
requirements. Returning `success: boolean`, an error string, or a command is
not an adapter. A stock config containing `providerAdapters`, `publish.custom`,
or similar fields is rejected.

## Supply-chain effects

A non-secret local SBOM can be a declared `CommandArtifact`. No signing
capability is claimed. Offline signing reopens only with a typed capability
that binds exact input bytes, key audience and lifetime, certified host/tool,
signature identity, cleanup, failure, and cancellation. Remote signing, Apple
notarization, timestamps, transparency logs, and keyless attestation require
provider observation, commitment, exposure, and recovery semantics. None is
hidden behind a generic command exit code.

## Announcements and host orchestration

Approval, holds, incident/date gates, provider-native staging, cross-repository
coordination, and announcements remain host workflow jobs. A downstream job
may read the redacted report artifact only after the release job succeeds:

```yaml
announce:
  needs: release
  if: ${{ needs.release.result == 'success' }}
  permissions: {}
  runs-on: ubuntu-24.04
  steps:
    - uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4.3.0
      with:
        name: ts-release-report-${{ github.run_attempt }}
        path: report
    - shell: bash
      env:
        ANNOUNCEMENT_WEBHOOK: ${{ secrets.ANNOUNCEMENT_WEBHOOK }}
      run: |
        report_file="$(find report -type f -name action-report.json -print -quit)"
        bun -e 'const r = await Bun.file(process.argv[1]).json(); if (r.status !== "complete") process.exit(1)' "$report_file"
        curl --fail --request POST --data-binary @"$report_file" "$ANNOUNCEMENT_WEBHOOK"
```

The channel call is not rollback-safe or exactly-once. It stays external until
a specific provider can prove conclusive observation or replay-safe
idempotency. Cleanup of temporary application resources belongs in an Effect
scoped finalizer.

## Non-goals

- GoReleaser lifecycle vocabulary as a public abstraction;
- ambient environment overlays or secret-bearing generic commands;
- configured package discovery, root plugin directories, or remote shell
  publishers;
- local receipts impersonating provider approval/staging state;
- announcements described as part of atomic release rollback.
