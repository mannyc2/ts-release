import { describe, expect, it, layer } from "@effect/bun-test"
import * as BunPath from "@effect/platform-bun/BunPath"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { Artifact, Checksum, ExecutableExtra, InstallableArtifactVariant, makeArtifact } from "../src/grammar/artifact.js"
import {
  CommandAction,
  CommandSpec,
  GitHubReleaseAssetSpec,
  GitHubReleaseCreateAction,
  GitHubReleaseVerifyAction,
  NoteAction,
  Operation,
  StageAction,
  WriteFileAction
} from "../src/grammar/operation.js"
import { ArchiveIntent } from "../src/grammar/intent.js"
import { ExecutionApproval } from "../src/grammar/approval.js"
import type { HttpHeader, HttpRequestSpec } from "../src/host/http.js"
import { ReleasePlan, SourceMetadata } from "../src/grammar/plan.js"
import { ReleaseIdentity } from "../src/grammar/state.js"
import { makeTestReleaseHttpLayer } from "./host-fakes.js"
import { commandKey, makeTestCommandRunnerLayer } from "./host-fakes.js"
import {
  EvidenceBundle,
  EvidenceRecord,
  redactText
} from "../src/run/evidence.js"
import { writeEvidenceBundle } from "../src/run/workflow.js"
import { runOperationEvidence } from "../src/run/executor.js"
import { artifactSummary, evidenceOperationStatuses, stagedArtifactSummaries, type ArtifactSummary } from "../src/render/summary.js"
import {
  UnsupportedArtifactStagerLayer,
  type StagedArtifact,
  type StagedArtifactOperationResult
} from "../src/pack/stager.js"
import { GitHubApiLiveLayer } from "../src/github/github.js"
import { runOperation, TestGitHubApiLayer } from "./helpers.js"

const makeWorkspaceTestCommandRunnerLayer = (
  options: Parameters<typeof makeTestCommandRunnerLayer>[0] = {}
) =>
  makeTestCommandRunnerLayer({
    pathLayer: BunPath.layer,
    ...options
  })

const identity = (name: string = "release", version: string = "0.1.0"): ReleaseIdentity =>
  ReleaseIdentity.make({
    name,
    normalizedName: name.replaceAll("/", "-").replaceAll("@", ""),
    version,
    tag: `v${version}`,
    commit: "abc123",
    shortCommit: "abc123",
    versionSource: "test",
    snapshot: false
  })

const context = (releaseIdentity: ReleaseIdentity = identity()) => ({
  root: ".",
  identity: releaseIdentity,
  artifacts: []
})

const makePlan = (name: string = "release", version: string = "0.1.0"): ReleasePlan => {
  const releaseIdentity = identity(name, version)
  return ReleasePlan.make({
    schemaVersion: "release-plan/v4",
    identity: releaseIdentity,
    artifacts: [],
    operations: [],
    source: SourceMetadata.make({ root: "." }),
    evidenceDirectory: ".release/evidence"
  })
}

const evidenceBundle = (
  plan: ReleasePlan,
  records: EvidenceBundle["records"] = []
): EvidenceBundle =>
  EvidenceBundle.make({
    schemaVersion: "release-evidence/v3",
    releaseName: plan.identity.name,
    releaseVersion: plan.identity.version,
    records
  })

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ?
  (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false : false
const summaryIsEncoded: Equal<ArtifactSummary, Schema.Codec.Encoded<typeof Artifact>> = true
const summaryArtifact = (id: string, path: string) => makeArtifact({
  id, path, producedBy: "build:test",
  platform: InstallableArtifactVariant.make({ os: "linux", arch: "x64", libc: "glibc", binaryName: id }),
  checksum: Checksum.make({ algorithm: "sha256", value: `${id}-digest` }),
  extra: ExecutableExtra.make({ binary: id, extension: "", builderId: "test" })
})
const summaryOperation = (id: string, produces?: ReadonlyArray<string>) => Operation.make({
  id, pipeId: "test", phase: produces === undefined ? "publish" : "build", risk: "writes-local", description: id,
  action: produces === undefined ? NoteAction.make({ message: "test", severity: "info", skipped: false }) :
    StageAction.make({ intent: ArchiveIntent.make({ outfile: `dist/${id}.zip`, format: "zip", artifacts: [], files: [] }), producesArtifactIds: produces })
})
const summaryPlan = (artifacts: ReadonlyArray<Artifact> = [], operations: ReadonlyArray<Operation> = []) =>
  ReleasePlan.make({ ...makePlan(), artifacts, operations })
const staged = (operationId: string, id: string, path: string, intentTag = "archive") =>
  ({
    operationId,
    intentTag,
    artifacts: [{ id, path } satisfies StagedArtifact]
  }) satisfies StagedArtifactOperationResult

const baseEngineLayer = (
  commandOptions: Parameters<typeof makeWorkspaceTestCommandRunnerLayer>[0] = {}
) =>
  Layer.mergeAll(
    makeWorkspaceTestCommandRunnerLayer(commandOptions),
    makeTestReleaseHttpLayer(),
    TestGitHubApiLayer,
    UnsupportedArtifactStagerLayer
  )
const githubCreateOperation = (
  overrides: Partial<ConstructorParameters<typeof GitHubReleaseCreateAction>[0]> = {}
) => Operation.make({
  id: "github:github-release-create",
  pipeId: "publish:github",
  phase: "publish",
  risk: "externally-visible",
  description: "Create GitHub release.",
  action: GitHubReleaseCreateAction.make({
    repository: "owner/repo",
    tokenEnv: "TOKEN",
    tag: "v0.1.0",
    title: "release 0.1.0",
    draft: false,
    prerelease: false,
    assets: [],
    ...overrides
  })
})
const githubLayer = (
  httpLayer: ReturnType<typeof makeTestReleaseHttpLayer>,
  commandOptions: Parameters<typeof makeWorkspaceTestCommandRunnerLayer>[0] = {}
) => Layer.mergeAll(
  makeWorkspaceTestCommandRunnerLayer(commandOptions),
  httpLayer,
  Layer.provide(GitHubApiLiveLayer, httpLayer),
  UnsupportedArtifactStagerLayer
)

describe("evidence recorder", () => {
  layer(baseEngineLayer())((it) => {
    it.effect("redacts known secret values", () =>
      Effect.sync(() => {
        expect(redactText("token npm_secret leaked", ["npm_secret"])).toBe("token [REDACTED] leaked")
      }))

    it.effect("does not alter text when the secret is empty", () =>
      Effect.sync(() => {
        expect(redactText("plain output", [""])).toBe("plain output")
      }))
  })

  {
    const command = CommandSpec.make({
      executable: "tool",
      args: ["validate"],
      requiredEnv: ["TOKEN"],
      redactedEnv: ["TOKEN"]
    })
    const operation = Operation.make({
      id: "validate-token",
      pipeId: "test",
      phase: "publish",
      risk: "read-only",
      description: "Validate token handling.",
      action: CommandAction.make({ command })
    })

    layer(baseEngineLayer({
      env: new Map([["TOKEN", "super_secret"]]),
      commands: new Map([
        [commandKey(command), {
          exitCode: 0,
          stdout: "stdout super_secret",
          stderr: "stderr super_secret"
        }]
      ])
    }))((it) => {
      it.effect("redacts command output through the shared executor", () =>
        Effect.gen(function*() {
          const evidence = yield* runOperation(operation, ExecutionApproval.none, context())

          expect(evidence.phase).toBe("publish")
          expect(evidence.risk).toBe("read-only")
          expect(evidence.outcome?._tag).toBe("command")
          if (evidence.outcome?._tag === "command") {
            expect(evidence.outcome.stdout).toBe("stdout [REDACTED]")
            expect(evidence.outcome.stderr).toBe("stderr [REDACTED]")
          }
          expect(evidence.message).toBe("Command completed successfully.")
        }))
    })
  }

  {
    const operation = githubCreateOperation({
      notes: "ship it",
      draft: true,
      assets: [GitHubReleaseAssetSpec.make({
        artifactId: "package",
        path: "dist/package.tgz",
        name: "package.tgz",
        contentType: "application/octet-stream"
      })]
    })
    const createUrl = "https://api.github.com/repos/owner/repo/releases"
    const uploadUrl = "https://uploads.github.com/repos/owner/repo/releases/123/assets?name=package.tgz"
    const requests: Array<HttpRequestSpec> = []
    const httpLayer = makeTestReleaseHttpLayer({
      onRequest: (request) => {
        requests.push(request)
      },
      responses: new Map([
        [`POST\u0000${createUrl}`, {
          status: 201,
          json: {
            id: 123,
            tag_name: "v0.1.0",
            name: "release 0.1.0",
            draft: true,
            prerelease: false,
            upload_url: "https://uploads.github.com/repos/owner/repo/releases/123/assets{?name,label}",
            assets: []
          }
        }],
        [`POST\u0000${uploadUrl}`, {
          status: 201,
          json: {
            id: 456,
            name: "package.tgz",
            state: "uploaded"
          }
        }]
      ])
    })

    layer(githubLayer(httpLayer, {
        files: new Map([["dist/package.tgz", "package bytes"]]),
        env: new Map([["TOKEN", "super_secret"]])
      }))((it) => {
      it.effect("records successful GitHub API create evidence without request bodies", () =>
        Effect.gen(function*() {
          const evidence = yield* runOperation(
            operation,
            ExecutionApproval.make({ execute: true, approveIrreversible: false }),
            context()
          )

          expect(evidence.operationId).toBe("github:github-release-create")
          expect(evidence.status).toBe("passed")
          expect(evidence.outcome?._tag).toBe("github-release")
          if (evidence.outcome?._tag === "github-release") {
            expect(evidence.outcome.release.releaseId).toBe(123)
            expect(evidence.outcome.release.assets).toEqual(["package.tgz"])
          }
          expect("request" in evidence).toBe(false)
          expect(requests.map((request) => request.body?._tag)).toEqual([
            "HttpJsonRequestBody",
            "HttpFileRequestBody"
          ])
          const uploadRequest = requests[1]
          expect(uploadRequest?.body?._tag).toBe("HttpFileRequestBody")
          if (uploadRequest?.body?._tag === "HttpFileRequestBody") {
            expect(uploadRequest.body.path).toBe("dist/package.tgz")
            expect(uploadRequest.body.contentType).toBe("application/octet-stream")
          }
        }))
    })
  }

  {
    const operation = githubCreateOperation()
    const createUrl = "https://api.github.com/repos/owner/repo/releases"
    const httpLayer = makeTestReleaseHttpLayer({
      responses: new Map([
        [`POST\u0000${createUrl}`, {
          status: 422,
          json: {
            message: "already_exists"
          }
        }]
      ])
    })

    layer(githubLayer(httpLayer, { env: new Map([["TOKEN", "super_secret"]]) }))((it) => {
      it.effect("records failed GitHub API create evidence with status only", () =>
        Effect.gen(function*() {
          const evidence = yield* runOperationEvidence(
            operation,
            ExecutionApproval.make({ execute: true, approveIrreversible: false }),
            context()
          )

          expect(evidence.operationId).toBe("github:github-release-create")
          expect(evidence.status).toBe("failed")
          expect(evidence.outcome?._tag).toBe("github-release")
          if (evidence.outcome?._tag === "github-release") {
            expect(evidence.outcome.responseStatus).toBe(422)
            expect(evidence.outcome.release.assets).toEqual([])
          }
          expect(evidence.message).toContain("HTTP 422")
        }))
    })
  }

  {
    const operation = Operation.make({
      id: "github:github-release-verify-api",
      pipeId: "publish:github",
      phase: "verify",
      risk: "read-only",
      description: "Verify release.",
      action: GitHubReleaseVerifyAction.make({
        repository: "owner/repo",
        tokenEnv: "TOKEN",
        tag: "v0.1.0",
        title: "release 0.1.0",
        draft: false,
        prerelease: false,
        assetNames: ["package.tgz"]
      })
    })
    const inspectUrl = "https://api.github.com/repos/owner/repo/releases/tags/v0.1.0"
    const httpLayer = makeTestReleaseHttpLayer({
      responses: new Map([
        [`GET\u0000${inspectUrl}`, {
          status: 200,
          json: {
            id: 123,
            tag_name: "v0.1.0",
            name: "wrong title",
            draft: false,
            prerelease: false,
            upload_url: "https://uploads.github.com/repos/owner/repo/releases/123/assets{?name,label}",
            assets: []
          }
        }]
      ])
    })

    layer(githubLayer(httpLayer, { env: new Map([["TOKEN", "super_secret"]]) }))((it) => {
      it.effect("records GitHub API verification mismatches", () =>
        Effect.gen(function*() {
          const evidence = yield* runOperationEvidence(operation, ExecutionApproval.none, context())

          expect(evidence.operationId).toBe("github:github-release-verify-api")
          expect(evidence.status).toBe("failed")
          expect(evidence.message).toContain("title is release 0.1.0")
          expect(evidence.outcome?._tag).toBe("github-release")
          if (evidence.outcome?._tag === "github-release") {
            expect(evidence.outcome.checks?.some((check) => !check.passed)).toBe(true)
            expect(evidence.outcome.release.releaseId).toBe(123)
          }
        }))
    })
  }

  layer(baseEngineLayer({ directories: new Set(["."]) }))((it) => {
    it.effect("records write-file and note evidence with phase and risk", () =>
      Effect.gen(function*() {
        const renderOperation = Operation.make({
          id: "render-readme",
          pipeId: "catalog:test",
          phase: "catalog",
          risk: "writes-local",
          description: "Render README.",
          action: WriteFileAction.make({
            path: ".release/generated/readme.md",
            contents: "# Release\n"
          })
        })
        const validationOperation = Operation.make({
          id: "validate-note",
          pipeId: "publish:test",
          phase: "publish",
          risk: "read-only",
          description: "Record validation note.",
          action: NoteAction.make({
            message: "No local validation command is configured.",
            skipped: true,
            severity: "info"
          })
        })

        const renderEvidence = yield* runOperation(
          renderOperation,
          ExecutionApproval.make({ execute: true, approveIrreversible: false }),
          context()
        )
        const validationEvidence = yield* runOperation(validationOperation, ExecutionApproval.none, context())

        expect(renderEvidence.phase).toBe("catalog")
        expect(renderEvidence.risk).toBe("writes-local")
        expect(renderEvidence.message).toBe("Rendered .release/generated/readme.md")
        expect(validationEvidence.phase).toBe("publish")
        expect(validationEvidence.status).toBe("skipped")
      }))

    it.effect("rejects render writes outside the workspace root", () =>
      Effect.gen(function*() {
        const operation = Operation.make({
          id: "render-outside",
          pipeId: "catalog:test",
          phase: "catalog",
          risk: "writes-local",
          description: "Render outside.",
          action: WriteFileAction.make({
            path: "../outside.md",
            contents: "# Release\n"
          })
        })
        const error = yield* runOperation(
          operation,
          ExecutionApproval.make({ execute: true, approveIrreversible: false }),
          context()
        ).pipe(Effect.flip)

        expect(error._tag).toBe("WorkspaceWriteError")
      }))

    it.effect("rejects evidence writes outside the workspace root", () =>
      Effect.gen(function*() {
        const plan = makePlan()
        const error = yield* writeEvidenceBundle("../outside.json", evidenceBundle(plan), ".").pipe(Effect.flip)

        expect(error._tag).toBe("EvidenceWriteError")
      }))
  })

  it("encodes canonical artifact summaries as recursive JSON data", () => {
    const encoded = artifactSummary(summaryArtifact("cli", "dist/cli"))
    expect(summaryIsEncoded).toBe(true)
    expect(encoded).toEqual(JSON.parse(JSON.stringify(encoded)))
    for (const value of [encoded, encoded.platform, encoded.checksum, encoded.extra])
      expect(Object.getPrototypeOf(value!)).toBe(Object.prototype)
    expect(encoded).not.toHaveProperty("format"); expect(encoded).not.toHaveProperty("sizeBytes")
  })

  it("joins staged artifacts in result order", () => {
    const first = summaryArtifact("first", "dist/first"), second = summaryArtifact("second", "dist/second")
    const summaries = stagedArtifactSummaries(
      summaryPlan([first, second], [summaryOperation("stage-second", ["second"]), summaryOperation("stage-first", ["first"])]),
      [staged("stage-second", "second", "dist/second"), staged("stage-first", "first", "dist/first")])
    expect(summaries).toEqual([artifactSummary(second), artifactSummary(first)])
  })
})
