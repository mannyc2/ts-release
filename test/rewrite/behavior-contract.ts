import { createHash } from "node:crypto"
import { existsSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import * as Schema from "effect/Schema"
import type { Artifact } from "../../src/grammar/artifact.js"
import { operationApprovalRequirements } from "../../src/grammar/approval.js"
import type { Operation } from "../../src/grammar/operation.js"
import type { ReleasePlan } from "../../src/grammar/plan.js"

export class BehaviorIdentity extends Schema.Class<BehaviorIdentity>("BehaviorIdentity")({
  name: Schema.String,
  version: Schema.String,
  tag: Schema.String,
  commit: Schema.String,
  snapshot: Schema.Boolean,
  versionSource: Schema.String
}) {}

export class BehaviorOutput extends Schema.Class<BehaviorOutput>("BehaviorOutput")({
  id: Schema.String,
  path: Schema.String,
  kind: Schema.String,
  provenance: Schema.String,
  platform: Schema.optionalKey(Schema.Json),
  size: Schema.optionalKey(Schema.Number),
  digest: Schema.optionalKey(Schema.String)
}) {}

export class BehaviorEffect extends Schema.Class<BehaviorEffect>("BehaviorEffect")({
  sequence: Schema.Number,
  stage: Schema.String,
  authority: Schema.String,
  kind: Schema.String,
  description: Schema.String,
  details: Schema.Json
}) {}

export class BehaviorApproval extends Schema.Class<BehaviorApproval>("BehaviorApproval")({
  sequence: Schema.Number,
  execute: Schema.Boolean,
  irreversible: Schema.Boolean
}) {}

export class BehaviorRetry extends Schema.Class<BehaviorRetry>("BehaviorRetry")({
  sequence: Schema.Number,
  attempts: Schema.Number,
  delayMillis: Schema.Number
}) {}

export class BehaviorContract extends Schema.Class<BehaviorContract>("BehaviorContract")({
  identity: BehaviorIdentity,
  outputs: Schema.Array(BehaviorOutput),
  effects: Schema.Array(BehaviorEffect),
  renderedFiles: Schema.Array(Schema.Struct({
    path: Schema.String,
    bytes: Schema.String
  })),
  approvals: Schema.Array(BehaviorApproval),
  retries: Schema.Array(BehaviorRetry),
  execution: Schema.Struct({
    scope: Schema.Array(Schema.String),
    frontier: Schema.String
  }),
  traces: Schema.Struct({
    commands: Schema.Array(Schema.Json),
    http: Schema.Array(Schema.Json),
    fileWrites: Schema.Array(Schema.Json),
    durableStates: Schema.Array(Schema.Json)
  }),
  outcome: Schema.String
}) {}

const sha256 = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex")

const stableProvenance = (artifact: Artifact): string => {
  if (artifact.producedBy.startsWith("build:")) return "build"
  if (artifact.producedBy.startsWith("catalog")) return "catalog"
  if (artifact.producedBy.startsWith("archive")) return "process"
  if (artifact.producedBy.startsWith("checksum")) return "process"
  if (artifact.producedBy.startsWith("import")) return "import"
  return "package"
}

const output = (workspace: string, artifact: Artifact): BehaviorOutput => {
  const path = resolve(workspace, artifact.path)
  const materialized = existsSync(path) && statSync(path).isFile()
  return BehaviorOutput.make({
    id: artifact.id,
    path: artifact.path,
    kind: artifact.kind,
    provenance: stableProvenance(artifact),
    ...(artifact.platform === undefined
      ? {}
      : {
          platform: {
            os: artifact.platform.os,
            arch: artifact.platform.arch,
            ...(artifact.platform.libc === undefined ? {} : { libc: artifact.platform.libc }),
            ...(artifact.platform.binaryName === undefined
              ? {}
              : { binaryName: artifact.platform.binaryName }),
            ...(artifact.platform.targetTriple === undefined
              ? {}
              : { targetTriple: artifact.platform.targetTriple })
          }
        }),
    ...(materialized
      ? {
          size: readFileSync(path).byteLength,
          digest: sha256(path)
        }
      : {})
  })
}

const authority = (operation: Operation): string => {
  if (operation.risk === "read-only") {
    return operation.action._tag.startsWith("github") ||
        operation.action._tag === "published-assets-verify"
      ? "remote-read"
      : "local-read"
  }
  if (operation.risk === "writes-local") {
    return operation.action._tag === "command" ? "local-exec" : "local-write"
  }
  return "remote-publish"
}

const actionDetails = (operation: Operation): Schema.Json => {
  const action = operation.action
  switch (action._tag) {
    case "command":
      return {
        argv: [action.command.executable, ...action.command.args],
        cwd: action.command.cwd ?? ".",
        environmentNames: [...new Set([
          ...action.command.requiredEnv,
          ...action.command.redactedEnv
        ])].sort()
      }
    case "check-file":
      return {
        path: action.path,
        ...(action.checksum === undefined ? {} : {
          digest: `${action.checksum.algorithm}:${action.checksum.value}`
        })
      }
    case "write-file":
      return {
        path: action.path,
        content: typeof action.contents === "string"
          ? { kind: "exact", bytes: action.contents }
          : { kind: "deferred-output-facts" }
      }
    case "github-release-create":
      return {
        provider: "github",
        repository: action.repository,
        tag: action.tag,
        title: action.title,
        draft: action.draft,
        prerelease: action.prerelease,
        credentialSlot: action.tokenEnv ?? "none",
        assets: action.assets.map((asset) => ({
          outputId: asset.artifactId,
          path: asset.path,
          name: asset.name,
          contentType: asset.contentType
        }))
      }
    case "github-release-verify":
      return {
        provider: "github",
        repository: action.repository,
        tag: action.tag,
        draft: action.draft,
        prerelease: action.prerelease,
        credentialSlot: action.tokenEnv ?? "none",
        assetNames: action.assetNames
      }
    case "published-assets-verify":
      return {
        provider: "github",
        repository: action.repository,
        tag: action.tag,
        checksumAssetName: action.checksumAssetName,
        algorithm: action.algorithm,
        assetNames: action.assetNames
      }
    case "note":
      return {
        severity: action.severity,
        skipped: action.skipped,
        message: action.message
      }
    case "stage":
      return {
        outputIds: action.producesArtifactIds,
        materializer: action.intent._tag
      }
  }
}

const effectKind = (operation: Operation): string => {
  switch (operation.action._tag) {
    case "github-release-create":
      return "forge-release"
    case "github-release-verify":
    case "published-assets-verify":
      return "verify-published"
    case "check-file":
      return "check-output"
    case "write-file":
      return "write-content"
    case "stage":
      return "materialize-output"
    case "command":
      return "run-command"
    case "note":
      return "record-note"
  }
}

export const behaviorFromLegacyPlan = (
  plan: ReleasePlan,
  workspace: string
): BehaviorContract => {
  const effects = plan.operations.map((operation, sequence) =>
    BehaviorEffect.make({
      sequence,
      stage: operation.phase,
      authority: authority(operation),
      kind: effectKind(operation),
      description: operation.description,
      details: actionDetails(operation)
    })
  )
  return BehaviorContract.make({
    identity: BehaviorIdentity.make({
      name: plan.identity.name,
      version: plan.identity.version,
      tag: plan.identity.tag,
      commit: plan.identity.commit,
      snapshot: plan.identity.snapshot,
      versionSource: plan.identity.versionSource
    }),
    outputs: plan.artifacts.map((artifact) => output(workspace, artifact)),
    effects,
    renderedFiles: plan.operations.flatMap((operation) =>
      operation.action._tag === "write-file" && typeof operation.action.contents === "string"
        ? [{ path: operation.action.path, bytes: operation.action.contents }]
        : []
    ),
    approvals: plan.operations.map((operation, sequence) => {
      const requirements = operationApprovalRequirements(operation)
      return BehaviorApproval.make({
        sequence,
        execute: requirements.requiresExecute,
        irreversible: requirements.requiresIrreversibleApproval
      })
    }),
    retries: plan.operations.flatMap((operation, sequence) =>
      operation.retry === undefined
        ? []
        : [BehaviorRetry.make({
            sequence,
            attempts: operation.retry.attempts,
            delayMillis: operation.retry.delayMillis
          })]
    ),
    execution: {
      scope: effects.map((effect) => `${effect.sequence}:${effect.stage}:${effect.kind}`),
      frontier: "planned"
    },
    traces: {
      commands: [],
      http: [],
      fileWrites: [],
      durableStates: []
    },
    outcome: "planned"
  })
}

export const encodeBehaviorContract = Schema.encodeSync(BehaviorContract)

export const decodeBehaviorContract = Schema.decodeUnknownSync(BehaviorContract, {
  onExcessProperty: "error"
})
