import { describe, expect, test } from "bun:test"
import { CredentialRef } from "../../src/model/authority.js"
import { parseSha256Hex } from "../../src/model/digest.js"
import { NonEmptyName, OutputId, SafeRelativePath, Version } from "../../src/model/primitives.js"
import {
  CanonicalNpmRegistryEndpoint,
  NpmDistTag,
  NpmTokenAuthentication,
  NpmTrustedPublishingAuthentication,
  NpmTrustedPublisherAttestation
} from "../../src/recipes/config.js"
import { makeNpmPublicationAuthorityIntent } from "../../src/release/graph.js"
import {
  PreparedArtifact,
  PreparedNpmPublication,
  PreparedProject,
  PreparedReleaseV2,
  PreparedSource,
  encodePreparedRelease
} from "../../src/release/prepared.js"
import {
  fixtureArtifactProvenance,
  fixturePreparedProvenance,
  fixtureStagingSnapshot
} from "../fixtures/prepared-provenance.js"

const digest = parseSha256Hex("a".repeat(64))
const sourceCommit = "c".repeat(40)
const source = PreparedSource.make({
  commit: NonEmptyName.make(sourceCommit), tree: NonEmptyName.make("tree"), clean: true,
  packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: digest,
  materialized: fixtureStagingSnapshot
})
const artifact = (id: string) => PreparedArtifact.make({
  id: OutputId.make(id), path: SafeRelativePath.make(`${id}.tgz`), kind: "archive",
  size: 7, digest, blob: digest, mediaType: "application/gzip", ...fixtureArtifactProvenance()
})

type Intent = {
  readonly artifactId: string
  readonly packageName: string
  readonly version: string
  readonly registryUrl: string
  readonly distTag: string
  readonly access: "public" | "restricted"
  readonly credential: string
  readonly provenance: "required" | "disabled"
}

const base: Intent = {
  artifactId: "npm-tarball", packageName: "@fixture/package", version: "1.0.0",
  registryUrl: "https://registry.example.test/tenant/", distTag: "latest", access: "public",
  credential: "NPM_TOKEN", provenance: "disabled"
}

const bytes = (intent: Intent): Uint8Array => {
  const authentication = NpmTokenAuthentication.make({
    strategy: "token", credential: CredentialRef.make(intent.credential)
  })
  const registryUrl = CanonicalNpmRegistryEndpoint.make(intent.registryUrl)
  const publication = PreparedNpmPublication.make({
    id: NonEmptyName.make("npm-release"), artifactId: OutputId.make(intent.artifactId),
    packageName: NonEmptyName.make(intent.packageName), version: Version.make(intent.version),
    registryUrl, distTag: NpmDistTag.make(intent.distTag), access: intent.access,
    authentication, provenance: intent.provenance,
    authority: makeNpmPublicationAuthorityIntent({
      packageName: intent.packageName, version: intent.version, registryUrl,
      distTag: intent.distTag, authentication
    })
  })
  return encodePreparedRelease(PreparedReleaseV2.make({
    kind: "complete",
    schemaVersion: "prepared-release/v2", source,
    project: PreparedProject.make({
      name: NonEmptyName.make("fixture"), packageName: publication.packageName,
      version: publication.version, tag: NonEmptyName.make(`v${intent.version}`)
    }),
    provenance: fixturePreparedProvenance,
    artifacts: [artifact(intent.artifactId)], collections: [], publications: [publication]
  }))
}

const trustedBytes = (
  repository: string,
  workflow: string,
  workflowRef = "refs/heads/main",
  trustedSourceCommit = sourceCommit
): Uint8Array => {
  const authentication = NpmTrustedPublishingAuthentication.make({
    strategy: "trusted-publishing",
    attestation: NpmTrustedPublisherAttestation.make({
      provider: "github-actions", runner: "github-hosted", repository, workflow,
      workflowRef,
      allowedAction: "npm-publish-direct"
    })
  })
  const registryUrl = CanonicalNpmRegistryEndpoint.make("https://registry.npmjs.org/")
  const publication = PreparedNpmPublication.make({
    id: NonEmptyName.make("npm-release"), artifactId: OutputId.make("npm-tarball"),
    packageName: NonEmptyName.make("@fixture/package"), version: Version.make("1.0.0"),
    registryUrl, distTag: NpmDistTag.make("latest"), access: "public", authentication,
    provenance: "automatic",
    authority: makeNpmPublicationAuthorityIntent({
      packageName: "@fixture/package", version: "1.0.0", registryUrl,
      distTag: "latest", authentication, sourceCommit: trustedSourceCommit
    })
  })
  return encodePreparedRelease(PreparedReleaseV2.make({
    kind: "complete",
    schemaVersion: "prepared-release/v2",
    source: PreparedSource.make({ ...source, commit: NonEmptyName.make(trustedSourceCommit) }),
    project: PreparedProject.make({
      name: NonEmptyName.make("fixture"), packageName: publication.packageName,
      version: publication.version, tag: NonEmptyName.make("v1.0.0")
    }),
    provenance: fixturePreparedProvenance,
    artifacts: [artifact("npm-tarball")], collections: [], publications: [publication]
  }))
}

describe("durable npm publication intent", () => {
  test("every variable npm policy and identity field changes canonical prepared bytes", () => {
    const baseline = bytes(base)
    const variants: ReadonlyArray<Intent> = [
      { ...base, artifactId: "other-tarball" },
      { ...base, packageName: "@fixture/other" },
      { ...base, version: "2.0.0" },
      { ...base, registryUrl: "https://registry.example.test/other/" },
      { ...base, distTag: "next" },
      { ...base, access: "restricted" },
      { ...base, credential: "OTHER_NPM_TOKEN" },
      { ...base, provenance: "required" }
    ]
    for (const variant of variants) expect(bytes(variant)).not.toEqual(baseline)
  })

  test("authentication strategy is explicit in the durable document", () => {
    const encoded = new TextDecoder().decode(bytes(base))
    expect(encoded).toContain('"authentication":{"credential":"NPM_TOKEN","strategy":"token"}')
  })

  test("trusted authentication and each variable attestation coordinate change prepared bytes", () => {
    const token = bytes(base)
    const trusted = trustedBytes("owner/package", "publish.yml")
    expect(trusted).not.toEqual(token)
    expect(trustedBytes("other/package", "publish.yml")).not.toEqual(trusted)
    expect(trustedBytes("owner/package", "release.yml")).not.toEqual(trusted)
    expect(trustedBytes("owner/package", "publish.yml", "refs/tags/v1.0.0")).not.toEqual(trusted)
    expect(trustedBytes("owner/package", "publish.yml", "refs/heads/main", "d".repeat(40)))
      .not.toEqual(trusted)
  })
})
