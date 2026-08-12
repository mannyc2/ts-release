import * as Effect from "effect/Effect"
import { EnvironmentName, SubjectId } from "../../../src/model/authority.js"
import { sha256Digest } from "../../../src/model/digest.js"
import { NonEmptyName, OutputId, SafeRelativePath, Version } from "../../../src/model/primitives.js"
import {
  CredentialProvider,
  makeCredentialProvider,
  type CredentialProviderShape
} from "../../../src/publication/authority.js"
import { publishReleaseSubjects } from "../../../src/publication/coordinator.js"
import { makeGithubSubjects } from "../../../src/publication/github.js"
import { makeGitHubPublicationAuthorityIntent } from "../../../src/release/graph.js"
import {
  PreparedArtifact,
  PreparedGitHubAsset,
  PreparedGitHubPublication,
  PreparedProject,
  PreparedReleaseV2,
  PreparedSource
} from "../../../src/release/prepared.js"
import type { PreparedBundle } from "../../../src/release/prepared-store.js"
import type { GithubProtocolDouble } from "./double.js"

export const preparedCommit = "1111111111111111111111111111111111111111"
export const wrongCommit = "2222222222222222222222222222222222222222"
export const annotatedTagSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
export const nestedTagSha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
export const preparedSubject = SubjectId.make("prepared:github-protocol-v1")

export interface GithubFixture {
  readonly bundle: PreparedBundle
  readonly publication: PreparedGitHubPublication
  readonly assets: ReadonlyArray<{ readonly name: string, readonly mediaType: string, readonly bytes: Uint8Array }>
}

export const makeGithubFixture = (
  assetInputs: ReadonlyArray<{
    readonly name: string
    readonly mediaType?: string
    readonly contents?: string
  }> = [{ name: "asset.zip", mediaType: "application/zip", contents: "exact GitHub asset bytes\n" }]
): GithubFixture => {
  const assets = assetInputs.map((input, index) => ({
    name: input.name,
    mediaType: input.mediaType ?? "application/octet-stream",
    bytes: new TextEncoder().encode(input.contents ?? `asset-${index}\n`)
  }))
  const artifacts = assets.map((asset, index) => {
    const digest = sha256Digest(asset.bytes)
    return PreparedArtifact.make({
      id: OutputId.make(`github-protocol-asset-${index}`),
      path: SafeRelativePath.make(`artifacts/${asset.name}`),
      kind: "archive",
      size: asset.bytes.length,
      digest,
      blob: digest,
      mediaType: asset.mediaType
    })
  })
  const authority = makeGitHubPublicationAuthorityIntent({
    repository: "owner/project",
    tag: "v1.0.0",
    tokenEnv: "GITHUB_PROTOCOL_TOKEN"
  })
  const publication = PreparedGitHubPublication.make({
    id: NonEmptyName.make("github-protocol-release"),
    repository: "owner/project",
    tag: NonEmptyName.make("v1.0.0"),
    title: NonEmptyName.make("Project 1.0.0"),
    body: "release notes",
    draft: false,
    prerelease: false,
    targetCommit: NonEmptyName.make(preparedCommit),
    assets: artifacts.map((artifact, index) => PreparedGitHubAsset.make({
      artifactId: artifact.id,
      name: assets[index]!.name,
      mediaType: assets[index]!.mediaType
    })),
    authority
  })
  const manifestDigest = sha256Digest(new TextEncoder().encode("github protocol fixture"))
  const manifest = PreparedReleaseV2.make({
    schemaVersion: "prepared-release/v2",
    source: PreparedSource.make({
      commit: NonEmptyName.make(preparedCommit),
      tree: NonEmptyName.make("3333333333333333333333333333333333333333"),
      clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"),
      packageManifestDigest: manifestDigest
    }),
    project: PreparedProject.make({
      name: NonEmptyName.make("fixture"),
      version: Version.make("1.0.0"),
      tag: publication.tag
    }),
    artifacts,
    publications: [publication]
  })
  return {
    bundle: {
      directory: "/tmp/github-protocol-v1",
      manifest,
      blobs: new Map(artifacts.map((artifact, index) => [artifact.id.toString(), assets[index]!.bytes]))
    },
    publication,
    assets
  }
}

export const githubProtocolCredentials = (): CredentialProviderShape => makeCredentialProvider({
  acquire: (request) => Effect.succeed(request.strategy.kind === "anonymous"
    ? { _tag: "AnonymousAccess", purposes: ["observe"] as const }
    : request.strategy.kind === "token"
    ? { _tag: "ScopedSecret", purposes: [request.purpose] as const, ref: request.strategy.credential }
    : {
      _tag: "WorkloadIdentity",
      purposes: [request.purpose] as const,
      names: [EnvironmentName.make("ACTIONS_ID_TOKEN_REQUEST_URL")] as const
    })
})

export const runGithubProtocol = (
  fixture: GithubFixture,
  double: GithubProtocolDouble
) => Effect.runPromise(publishReleaseSubjects({
  prepared: preparedSubject,
  subjects: [makeGithubSubjects(fixture.bundle, fixture.publication, double.http, double.mutationHttp)[0]]
}).pipe(Effect.provideService(
  CredentialProvider,
  githubProtocolCredentials()
)))
