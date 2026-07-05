import { describe, expect, layer } from "@effect/bun-test"
import * as BunPath from "@effect/platform-bun/BunPath"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ArtifactCatalog } from "../src/pipeline/catalog.js"
import {
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
  WriteFileAction
} from "../src/pipeline/operation.js"
import { PipeNotice, ReleaseIdentity, ReleaseState } from "../src/pipeline/state.js"
import { httpRequestKey, makeTestReleaseHttpLayer } from "./host-fakes.js"
import { commandKey, makeTestCommandRunnerLayer } from "./host-fakes.js"
import {
  EvidenceBundle,
  EvidenceRecord,
  redactText,
  renderEvidenceJson
} from "../src/engine/evidence.js"
import {
  mergeEvidenceBundles,
  readEvidenceBundle,
  tryReadEvidenceBundle,
  writeEvidenceBundle
} from "../src/engine/engine.js"
import { runOperation, runOperationEvidence } from "../src/engine/executor.js"
import { ReleasePlanDocument, SourceMetadata } from "../src/engine/plan-document.js"
import { UnsupportedArtifactStagerLayer } from "../src/engine/stager.js"
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
  notices: [] satisfies ReadonlyArray<PipeNotice>
})

const makePlan = (name: string = "release", version: string = "0.1.0"): ReleasePlanDocument => {
  const releaseIdentity = identity(name, version)
  return ReleasePlanDocument.make({
    schemaVersion: "release-plan/v2",
    state: ReleaseState.make({
      identity: releaseIdentity,
      artifacts: ArtifactCatalog.empty,
      operations: [],
      notices: []
    }),
    source: SourceMetadata.make({ root: "." }),
    artifacts: [],
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
  plan: ReleasePlanDocument,
  records: EvidenceBundle["records"] = []
): EvidenceBundle =>
  EvidenceBundle.make({
    schemaVersion: "release-evidence/v2",
    releaseName: plan.state.identity.name,
    releaseVersion: plan.state.identity.version,
    notices: [],
    records
  })

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

  {
    const plan = makePlan()
    const bundle = evidenceBundle(plan)
    layer(makeWorkspaceTestCommandRunnerLayer({
      files: new Map([
        [".release/evidence/evidence.json", renderEvidenceJson(bundle)]
      ])
    }))((it) => {
      it.effect("reads a valid evidence bundle", () =>
        Effect.gen(function*() {
          const read = yield* readEvidenceBundle(".release/evidence/evidence.json")

          expect(read.releaseName).toBe("release")
          expect(read.records).toEqual([])
        }))
    })
  }

  layer(makeWorkspaceTestCommandRunnerLayer())((it) => {
    it.effect("returns undefined for missing optional evidence", () =>
      Effect.gen(function*() {
        const read = yield* tryReadEvidenceBundle(".release/evidence/evidence.json")

        expect(read).toBeUndefined()
      }))

    it.effect("merges evidence bundles in order", () =>
      Effect.gen(function*() {
        const plan = makePlan()
        const merged = yield* mergeEvidenceBundles(
          plan,
          evidenceBundle(plan, [evidenceRecord("first")]),
          evidenceBundle(plan, [evidenceRecord("second")])
        )

        expect(merged.records.map((record) => record.operationId)).toEqual(["first", "second"])
      }))

    it.effect("rejects merging evidence from another release", () =>
      Effect.gen(function*() {
        const plan = makePlan()
        const error = yield* mergeEvidenceBundles(
          plan,
          evidenceBundle(plan),
          evidenceBundle(makePlan("other", "9.9.9"))
        ).pipe(Effect.flip)

        expect(error._tag).toBe("EvidenceReadError")
      }))
  })

  layer(makeWorkspaceTestCommandRunnerLayer({
    files: new Map([
      [".release/evidence/evidence.json", "{not json"]
    ])
  }))((it) => {
    it.effect("fails invalid evidence JSON with EvidenceReadError", () =>
      Effect.gen(function*() {
        const error = yield* readEvidenceBundle(".release/evidence/evidence.json").pipe(Effect.flip)

        expect(error._tag).toBe("EvidenceReadError")
        if (error._tag === "EvidenceReadError") {
          expect(error.reason).toBe("Evidence bundle is not valid JSON.")
          expect(error.cause).toBeDefined()
        }
      }))
  })

  layer(makeWorkspaceTestCommandRunnerLayer({
    files: new Map([
      [".release/evidence/evidence.json", JSON.stringify({ schemaVersion: "wrong" })]
    ])
  }))((it) => {
    it.effect("fails wrong evidence schema with EvidenceReadError", () =>
      Effect.gen(function*() {
        const error = yield* readEvidenceBundle(".release/evidence/evidence.json").pipe(Effect.flip)

        expect(error._tag).toBe("EvidenceReadError")
      }))
  })

  layer(makeWorkspaceTestCommandRunnerLayer({
    files: new Map([
      [".release/evidence/evidence.json", `${JSON.stringify({
        schemaVersion: "release-evidence/v2",
        releaseName: "release",
        releaseVersion: "0.1.0",
        notices: [],
        records: [
          {
            operationId: "validate-token",
            status: "passed"
          }
        ]
      })}\n`]
    ])
  }))((it) => {
    it.effect("fails operation evidence without required phase and timing fields", () =>
      Effect.gen(function*() {
        const error = yield* readEvidenceBundle(".release/evidence/evidence.json").pipe(Effect.flip)

        expect(error._tag).toBe("EvidenceReadError")
      }))
  })
})
