import { describe, expect, it, layer } from "@effect/bun-test"
import * as BunPath from "@effect/platform-bun/BunPath"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { Artifact, Checksum, ExecutableExtra, InstallableArtifactVariant } from "../src/pipeline/artifact.js"
import {
  ArchiveIntent,
  CommandAction,
  CommandSpec,
  ExecutionApproval,
  GitHubReleaseAssetSpec,
  GitHubReleaseCreateAction,
  GitHubReleaseVerifyAction,
  HttpCheckAction,
  HttpEnvHeader,
  HttpHeader,
  HttpJsonArrayObjectFieldEqualsCheck,
  HttpJsonEqualsCheck,
  HttpRequestSpec,
  NoteAction,
  Operation,
  StageAction,
  WriteFileAction
} from "../src/pipeline/operation.js"
import { ReleasePlan, SourceMetadata } from "../src/pipeline/plan.js"
import { PipeNotice, ReleaseIdentity } from "../src/pipeline/state.js"
import { httpRequestKey, makeTestReleaseHttpLayer } from "./host-fakes.js"
import { commandKey, makeTestCommandRunnerLayer } from "./host-fakes.js"
import {
  EvidenceBundle,
  EvidenceRecord,
  redactText
} from "../src/engine/evidence.js"
import { writeEvidenceBundle } from "../src/engine/engine.js"
import { runOperation, runOperationEvidence } from "../src/engine/executor.js"
import { artifactSummary, evidenceOperationStatuses, stagedArtifactSummaries, type ArtifactSummary } from "../src/engine/summary.js"
import {
  UnsupportedArtifactStagerLayer,
  type StagedArtifact,
  type StagedArtifactOperationResult
} from "../src/engine/stager.js"
import { GitHubApiLiveLayer } from "../src/engine/github.js"
import { TestGitHubApiLayer } from "./helpers.js"

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
  artifacts: [],
  notices: [] satisfies ReadonlyArray<PipeNotice>
})

const makePlan = (name: string = "release", version: string = "0.1.0"): ReleasePlan => {
  const releaseIdentity = identity(name, version)
  return ReleasePlan.make({
    schemaVersion: "release-plan/v3",
    identity: releaseIdentity,
    artifacts: [],
    operations: [],
    notices: [],
    source: SourceMetadata.make({ root: "." }),
    evidenceDirectory: ".release/evidence"
  })
}

const evidenceRecord = (operationId: string): EvidenceRecord =>
  EvidenceRecord.make({
    operationId,
    pipeId: "test",
    phase: "publish",
    risk: "writes-local",
    status: "passed",
    message: "ok",
    startedAt: "2026-06-17T00:00:00.000Z",
    endedAt: "2026-06-17T00:00:00.000Z",
    durationMillis: 0
  })

const evidenceBundle = (
  plan: ReleasePlan,
  records: EvidenceBundle["records"] = []
): EvidenceBundle =>
  EvidenceBundle.make({
    schemaVersion: "release-evidence/v2",
    releaseName: plan.identity.name,
    releaseVersion: plan.identity.version,
    notices: [],
    records
  })

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ?
  (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false : false
const summaryIsEncoded: Equal<ArtifactSummary, Schema.Codec.Encoded<typeof Artifact>> = true
const summaryArtifact = (id: string, path: string) => Artifact.make({
  id, kind: "executable", path, producedBy: "build:test",
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
    const request = HttpRequestSpec.make({
      method: "GET",
      url: "https://api.github.com/repos/owner/repo/releases/tags/v0.1.0",
      headers: [HttpHeader.make({ name: "Accept", value: "application/vnd.github+json" })],
      envHeaders: [HttpEnvHeader.make({ name: "Authorization", valueEnv: "TOKEN", prefix: "Bearer " })],
      requiredEnv: ["TOKEN"],
      redactedEnv: ["TOKEN"]
    })
    const operation = Operation.make({
      id: "api:response-verify-http",
      pipeId: "test",
      phase: "verify",
      risk: "read-only",
      description: "Verify release.",
      action: HttpCheckAction.make({
        request,
        expectedStatus: 200,
        checks: [
          HttpJsonEqualsCheck.make({ path: ["tag_name"], expected: "v0.1.0" }),
          HttpJsonArrayObjectFieldEqualsCheck.make({ path: ["assets"], field: "name", expected: "package.tgz" })
        ]
      })
    })

    layer(Layer.mergeAll(
      makeWorkspaceTestCommandRunnerLayer({ env: new Map([["TOKEN", "super_secret"]]) }),
      makeTestReleaseHttpLayer({
        responses: new Map([
          [httpRequestKey(request), {
            status: 200,
            responseHeaders: [
              HttpHeader.make({
                name: "Link",
                value: "<https://api.github.com/repos/owner/repo/releases?per_page=100&page=2>; rel=\"next\""
              })
            ],
            json: {
              tag_name: "v0.1.0",
              assets: [{ name: "package.tgz" }]
            }
          }]
        ])
      }),
      TestGitHubApiLayer,
      UnsupportedArtifactStagerLayer
    ))((it) => {
      it.effect("evaluates HTTP verification evidence through the shared executor", () =>
        Effect.gen(function*() {
          const evidence = yield* runOperation(operation, ExecutionApproval.none, context())

          expect(evidence.phase).toBe("verify")
          expect(evidence.outcome?._tag).toBe("http")
          if (evidence.outcome?._tag === "http") {
            expect(evidence.outcome.responseStatus).toBe(200)
            expect(evidence.outcome.checks.every((check) => check.passed)).toBe(true)
          }
          expect("responseHeaders" in evidence).toBe(false)
        }))
    })
  }

  {
    const operation = Operation.make({
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
        notes: "ship it",
        draft: true,
        prerelease: false,
        assets: [
          GitHubReleaseAssetSpec.make({
            artifactId: "package",
            path: "dist/package.tgz",
            name: "package.tgz",
            contentType: "application/octet-stream"
          })
        ]
      })
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

    layer(Layer.mergeAll(
      makeWorkspaceTestCommandRunnerLayer({
        files: new Map([["dist/package.tgz", "package bytes"]]),
        env: new Map([["TOKEN", "super_secret"]])
      }),
      httpLayer,
      Layer.provide(GitHubApiLiveLayer, httpLayer),
      UnsupportedArtifactStagerLayer
    ))((it) => {
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
    const operation = Operation.make({
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
        assets: []
      })
    })
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

    layer(Layer.mergeAll(
      makeWorkspaceTestCommandRunnerLayer({ env: new Map([["TOKEN", "super_secret"]]) }),
      httpLayer,
      Layer.provide(GitHubApiLiveLayer, httpLayer),
      UnsupportedArtifactStagerLayer
    ))((it) => {
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

    layer(Layer.mergeAll(
      makeWorkspaceTestCommandRunnerLayer({ env: new Map([["TOKEN", "super_secret"]]) }),
      httpLayer,
      Layer.provide(GitHubApiLiveLayer, httpLayer),
      UnsupportedArtifactStagerLayer
    ))((it) => {
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

  {
    const request = HttpRequestSpec.make({
      method: "GET",
      url: "https://api.github.com/repos/owner/repo/releases/tags/v0.1.0",
      headers: [],
      envHeaders: [],
      requiredEnv: [],
      redactedEnv: []
    })
    const operation = Operation.make({
      id: "api:response-verify-http",
      pipeId: "verify:test",
      phase: "verify",
      risk: "read-only",
      description: "Verify release.",
      action: HttpCheckAction.make({
        request,
        expectedStatus: 200,
        checks: [
          HttpJsonEqualsCheck.make({ path: ["draft"], expected: true })
        ]
      })
    })

    layer(Layer.mergeAll(
      makeWorkspaceTestCommandRunnerLayer(),
      makeTestReleaseHttpLayer({
        responses: new Map([
          [httpRequestKey(request), {
            status: 200,
            json: { draft: false }
          }]
        ])
      }),
      TestGitHubApiLayer,
      UnsupportedArtifactStagerLayer
    ))((it) => {
      it.effect("fails HTTP verification when JSON checks do not match", () =>
        Effect.gen(function*() {
          const error = yield* runOperation(operation, ExecutionApproval.none, context()).pipe(Effect.flip)

          expect(error._tag).toBe("OperationFailedError")
          if (error._tag === "OperationFailedError") {
            expect(error.responseStatus).toBe(200)
            expect(error.reason).toContain("HTTP verification failed")
            expect(error.reason).toContain("$.draft equals true")
          }
        }))
    })
  }

  it("encodes canonical artifact summaries as recursive JSON data", () => {
    const encoded = artifactSummary(summaryArtifact("cli", "dist/cli"))
    expect(summaryIsEncoded).toBe(true)
    expect(encoded).toEqual(JSON.parse(JSON.stringify(encoded)))
    for (const value of [encoded, encoded.platform, encoded.checksum, encoded.extra])
      expect(Object.getPrototypeOf(value!)).toBe(Object.prototype)
    expect(encoded).not.toHaveProperty("format"); expect(encoded).not.toHaveProperty("sizeBytes")
  })

  it.effect("rejects orphan, duplicate, and metadata-mismatched evidence", () => Effect.gen(function*() {
    const planned = summaryOperation("planned"), releasePlan = summaryPlan([], [planned])
    const cases = [
      ["orphan", [evidenceRecord("missing")]], ["duplicate", [evidenceRecord("planned"), evidenceRecord("planned")]],
      ["pipeId", [EvidenceRecord.make({ ...evidenceRecord("planned"), pipeId: "other" })]],
      ["phase", [EvidenceRecord.make({ ...evidenceRecord("planned"), phase: "verify" })]],
      ["risk", [EvidenceRecord.make({ ...evidenceRecord("planned"), risk: "irreversible" })]]
    ] as const
    for (const [label, records] of cases) {
      const error = yield* evidenceOperationStatuses(releasePlan, evidenceBundle(releasePlan, records)).pipe(Effect.flip)
      expect([error._tag, error.source], label).toEqual(["PlanReferenceMismatchError", "evidence"])
    }
  }))

  it.effect("joins staged artifacts in result order", () => Effect.gen(function*() {
    const first = summaryArtifact("first", "dist/first"), second = summaryArtifact("second", "dist/second")
    const summaries = yield* stagedArtifactSummaries(
      summaryPlan([first, second], [summaryOperation("stage-second", ["second"]), summaryOperation("stage-first", ["first"])]),
      [staged("stage-second", "second", "dist/second"), staged("stage-first", "first", "dist/first")])
    expect(summaries).toEqual([artifactSummary(second), artifactSummary(first)])
  }))

  it.effect("rejects staged artifact and operation reference mismatches", () => Effect.gen(function*() {
    const cli = summaryArtifact("cli", "dist/cli"), other = summaryArtifact("other", "dist/other")
    const stage = summaryOperation("stage", ["cli"]), result = staged("stage", "cli", "dist/cli")
    const cases = [
      ["missing artifact", summaryPlan([], [stage]), [result]],
      ["duplicate plan artifact", summaryPlan([cli, summaryArtifact("cli", "dist/duplicate")], [stage]), [result]],
      ["path", summaryPlan([cli], [stage]), [staged("stage", "cli", "dist/wrong")]],
      ["missing operation", summaryPlan([cli]), [result]],
      ["non-stage", summaryPlan([cli], [summaryOperation("stage")]), [result]],
      ["intent", summaryPlan([cli], [stage]), [staged("stage", "cli", "dist/cli", "pypi-wheel")]],
      ["produced IDs", summaryPlan([cli, other], [stage]), [staged("stage", "other", "dist/other")]],
      ["duplicate artifacts", summaryPlan([cli], [summaryOperation("one", ["cli"]), summaryOperation("two", ["cli"])]),
        [staged("one", "cli", "dist/cli"), staged("two", "cli", "dist/cli")]],
      ["duplicate operations", summaryPlan([cli], [stage]), [result, result]]
    ] as const
    for (const [label, releasePlan, results] of cases) {
      const error = yield* stagedArtifactSummaries(releasePlan, results).pipe(Effect.flip)
      expect([error._tag, error.source], label).toEqual(["PlanReferenceMismatchError", "staged-artifact"])
    }
  }))
})
