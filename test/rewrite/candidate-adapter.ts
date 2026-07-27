import { createHash } from "node:crypto"
import {
  existsSync,
  readFileSync,
  realpathSync,
  statSync
} from "node:fs"
import { join, resolve } from "node:path"
import * as Effect from "effect/Effect"
import { canonicalJsonHash } from "../../scripts/lib/canonical-json.js"
import type {
  Operation,
  PackageRegistryRelease
} from "../../src/model/operation.js"
import {
  NonEmptyName,
  WorkspaceRoot
} from "../../src/model/primitives.js"
import type { AcceptedPlan } from "../../src/plan/accepted.js"
import {
  Invocation,
  compilePlan
} from "../../src/plan/compiler.js"
import {
  operationEntries,
  type OperationEntry
} from "../../src/model/validate.js"
import {
  BehaviorApproval,
  BehaviorContract,
  BehaviorEffect,
  BehaviorIdentity,
  BehaviorOutput,
  BehaviorRetry,
  encodeBehaviorContract
} from "./behavior-contract.js"

interface ProjectedEffect {
  readonly stage: string
  readonly authority: string
  readonly kind: string
  readonly description: string
  readonly details: object
  readonly irreversible: boolean
  readonly retry?: { readonly attempts: number; readonly delayMillis: number } | undefined
}

const environmentNames = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...new Set(values)].sort()

const effect = (
  operation: Operation,
  stage: string,
  authority: string,
  kind: string,
  details: object,
  irreversible: boolean = false
): ProjectedEffect => ({
  stage,
  authority,
  kind,
  description: operation.description ?? `${operation._tag} ${operation.id}`,
  details,
  irreversible
})

const commandEffect = (
  operation: Extract<Operation, { readonly _tag: "Exec" | "OpaquePublish" }>,
  stage: string
): ProjectedEffect => effect(
  operation,
  stage,
  operation._tag === "OpaquePublish"
    ? "remote-publish"
    : String(operation.id).endsWith(":validate")
    ? "local-read"
    : "local-exec",
  "run-command",
  {
    argv: operation.argv,
    cwd: operation.cwd,
    environmentNames: environmentNames(operation.environmentNames)
  },
  operation._tag === "OpaquePublish" && operation.irreversible
)

const trustedMessage = (
  target: "NPM" | "PyPI",
  operation: PackageRegistryRelease
): string => {
  const expectation = target === "NPM"
    ? `package ${operation.packageName} to already exist on the registry`
    : "a trusted publisher configured on PyPI"
  const publishCommand = target === "NPM" ? "npm publish" : "twine upload"
  const validationCommand = target === "NPM" ? "npm whoami" : "twine check"
  return `${target} trusted publishing authenticates during ${publishCommand} with CI OIDC; ` +
    `${validationCommand} does not validate this mode. This target expects provider ${
      operation.trustedProvider
    }, workflow ${operation.trustedWorkflow}, GitHub Actions permission id-token: write, and ${
      expectation
    }.`
}

const packageEffects = (operation: PackageRegistryRelease): ReadonlyArray<ProjectedEffect> => {
  const cwd = "."
  if (operation.registryKind === "npm") {
    const auth = operation.trustedPublishing
      ? effect(operation, "publish", "local-read", "record-note", {
          severity: "info",
          skipped: false,
          message: trustedMessage("NPM", operation)
        })
      : effect(operation, "publish", "local-read", "run-command", {
          argv: ["npm", "whoami", "--registry", operation.registryUrl],
          cwd,
          environmentNames: environmentNames(operation.environmentNames)
        })
    const existence = operation.verifyPackageExists
      ? [effect(operation, "publish", "local-read", "run-command", {
          argv: [
            "npm",
            "view",
            operation.packageName,
            "name",
            "--registry",
            operation.registryUrl
          ],
          cwd,
          environmentNames: []
        })]
      : []
    const publishArgs = [
      "npm",
      "publish",
      operation.packagePath,
      "--registry",
      operation.registryUrl,
      ...(operation.access === undefined ? [] : ["--access", operation.access]),
      ...(operation.provenance === true ? ["--provenance"] : [])
    ]
    return [
      { ...auth, description: operation.trustedPublishing
        ? "Record npm trusted publishing authentication mode."
        : "Validate npm CLI authentication." },
      ...existence.map((item) => ({
        ...item,
        description: "Verify npm package exists before trusted publishing."
      })),
      {
        ...effect(operation, "publish", "local-read", "run-command", {
          argv: ["npm", "pack", "--dry-run", "--json", operation.packagePath],
          cwd,
          environmentNames: []
        }),
        description: "Validate npm package contents with npm pack dry-run."
      },
      {
        ...effect(operation, "publish", "remote-publish", "run-command", {
          argv: publishArgs,
          cwd,
          environmentNames: environmentNames(operation.environmentNames)
        }, true),
        description: `Publish ${operation.packageName}@${operation.version} to npm.`
      },
      {
        ...effect(operation, "verify", "local-read", "run-command", {
          argv: [
            "npm",
            "view",
            `${operation.packageName}@${operation.version}`,
            "version",
            "--registry",
            operation.registryUrl
          ],
          cwd,
          environmentNames: []
        }),
        description: `Verify ${operation.packageName}@${operation.version} exists on npm.`,
        retry: { attempts: 11, delayMillis: 500 }
      }
    ]
  }
  const paths = operation.artifactPaths
  const trusted = operation.trustedPublishing
    ? [{
        ...effect(operation, "publish", "local-read", "record-note", {
          severity: "info",
          skipped: false,
          message: trustedMessage("PyPI", operation)
        }),
        description: "Record PyPI trusted publishing authentication mode."
      }]
    : []
  return [
    ...trusted,
    {
      ...effect(operation, "publish", "local-read", "run-command", {
        argv: [operation.clientExecutable, "-m", "twine", "check", ...paths],
        cwd,
        environmentNames: []
      }),
      description: "Validate Python distribution metadata with twine check."
    },
    {
      ...effect(operation, "publish", "remote-publish", "run-command", {
        argv: [
          operation.clientExecutable,
          "-m",
          "twine",
          "upload",
          "--non-interactive",
          "--repository-url",
          operation.registryUrl,
          ...paths
        ],
        cwd,
        environmentNames: environmentNames(operation.environmentNames)
      }, true),
      description:
        `Publish ${operation.packageName}@${operation.version} to PyPI-compatible registry.`
    }
  ]
}

const forgeEffects = (
  operation: Extract<Operation, { readonly _tag: "ForgeRelease" }>
): ReadonlyArray<ProjectedEffect> => {
  const credentialSlot = operation.credential.name === "NO_CREDENTIAL"
    ? "none"
    : operation.credential.name
  return [
    {
      ...effect(operation, "publish", "local-read", "record-note", {
        severity: "info",
        skipped: false,
        message:
          "GitHub release dry-run validation is simulated by the deterministic release plan; " +
          "GitHub Releases API creation is not called during validation."
      }),
      description: "Record simulated GitHub release dry-run validation."
    },
    effect(operation, "publish", "remote-publish", "forge-release", {
      provider: "github",
      repository: operation.repository,
      tag: operation.tag,
      title: operation.title,
      draft: operation.draft,
      prerelease: operation.prerelease,
      credentialSlot,
      assets: operation.assets
    }),
    {
      ...effect(operation, "verify", "remote-read", "verify-published", {
        provider: "github",
        repository: operation.repository,
        tag: operation.tag,
        draft: operation.draft,
        prerelease: operation.prerelease,
        credentialSlot,
        assetNames: operation.assets.map((asset) => asset.name)
      }),
      description: "Verify the GitHub release through the GitHub API."
    }
  ]
}

const projectEntry = ({ operation, stage }: OperationEntry): ReadonlyArray<ProjectedEffect> => {
  switch (operation._tag) {
    case "Check":
      return String(operation.id) === "declare:npm-package"
        ? []
        : [effect(operation, stage, "local-read", "check-output", { path: operation.path })]
    case "Exec":
      if (operation.contractFixtureId === "build.bun-compile/v1") {
        return [effect(operation, stage, "local-write", "materialize-output", {
          outputIds: operation.outputs.map((output) => output.id),
          materializer: "bun-compile"
        })]
      }
      if (operation.contractFixtureId === "build.pypi-wheel/v1") {
        return [effect(operation, stage, "local-write", "materialize-output", {
          outputIds: operation.outputs.map((output) => output.id),
          materializer: "pypi-wheel"
        })]
      }
      return [commandEffect(operation, stage)]
    case "Pack":
      return [effect(operation, stage, "local-write", "materialize-output", {
        outputIds: operation.outputs.map((output) => output.id),
        materializer: "archive"
      })]
    case "Digest":
      return []
    case "Write":
      return [effect(operation, stage, "local-write", "write-content", {
        path: operation.path,
        content: typeof operation.content === "string"
          ? { kind: "exact", bytes: operation.content }
          : { kind: "deferred-output-facts" }
      })]
    case "PackageRegistryRelease":
      return packageEffects(operation)
    case "PackageStorePublish":
      return [effect(operation, stage, "remote-publish", "package-store-publish", {
        profileId: operation.profileId, target: operation.target, inputIds: operation.inputs
      })]
    case "SupplyChainPublish":
      return [effect(operation, stage, "remote-publish", "supply-chain-publish", {
        variant: operation.variant, profileId: operation.profileId,
        target: operation.target, inputIds: operation.inputs
      })]
    case "ProviderPublish":
      return [effect(operation, stage, "remote-publish", "provider-publish", {
        profileId: operation.profileId, target: operation.target, inputIds: operation.inputs
      })]
    case "AnnouncementPublish":
      return [effect(operation, stage, "remote-publish", "announcement-publish", {
        profileId: operation.profileId, target: operation.target, inputIds: operation.inputs
      })]
    case "ForgeRelease":
      return forgeEffects(operation)
    case "OpaquePublish":
      return [commandEffect(operation, stage)]
    case "HttpRead":
      return [effect(operation, stage, "remote-read", "http-read", {
        method: operation.method,
        profileId: operation.wire.profileId
      })]
    case "ReviewedNoteTransform":
      return [effect(operation, stage, "remote-read", "reviewed-note-transform", {
        profileId: operation.profileId, inputIds: operation.inputs
      })]
    case "HttpPublish":
      return [effect(operation, stage, "remote-publish", "http-publish", {
        method: operation.method,
        profileId: operation.wire.profileId
      })]
  }
}

const outputFacts = (
  accepted: AcceptedPlan,
  workspace: string
): ReadonlyArray<BehaviorOutput> => accepted.outputs.flatMap(({ output }) => {
  if (output.provenance === "internal") return []
  const location = resolve(workspace, output.path)
  const materialized = existsSync(location) && statSync(location).isFile()
  return [BehaviorOutput.make({
    id: output.id,
    path: output.path,
    kind: output.kind,
    provenance: output.provenance ?? "candidate-operation",
    ...(output.platform === undefined ? {} : { platform: output.platform }),
    ...(materialized
      ? {
          size: statSync(location).size,
          digest: createHash("sha256").update(readFileSync(location)).digest("hex")
        }
      : {})
  })]
})

export const behaviorFromCandidate = Effect.fn("test.behaviorFromCandidate")(function*(
  config: unknown,
  workspace: string
) {
  const accepted = yield* compilePlan(config, Invocation.make({
    workspace: WorkspaceRoot.make(realpathSync(workspace)),
    commit: NonEmptyName.make("abc123"),
    snapshot: false
  }))
  const projected = operationEntries(accepted.plan).flatMap(projectEntry)
  const effects = projected.map((item, sequence) => BehaviorEffect.make({
    sequence,
    stage: item.stage,
    authority: item.authority,
    kind: item.kind,
    description: item.description,
    details: item.details
  }))
  return BehaviorContract.make({
    identity: BehaviorIdentity.make({
      name: accepted.plan.identity.name,
      version: accepted.plan.identity.version,
      tag: accepted.plan.identity.tag,
      commit: accepted.plan.identity.commit,
      snapshot: accepted.plan.identity.snapshot,
      versionSource: "manifest"
    }),
    outputs: outputFacts(accepted, workspace),
    effects,
    renderedFiles: operationEntries(accepted.plan).flatMap(({ operation }) => {
      if (operation._tag !== "Write") return []
      const content = operation.content
      if (typeof content === "string") return [{ path: operation.path, bytes: content }]
      return content.every((part) => typeof part === "string")
        ? [{ path: operation.path, bytes: content.join("") }]
        : []
    }),
    approvals: projected.map((item, sequence) => BehaviorApproval.make({
      sequence,
      execute: ["local-write", "local-exec", "remote-publish"].includes(item.authority),
      irreversible: item.irreversible
    })),
    retries: projected.flatMap((item, sequence) => item.retry === undefined
      ? []
      : [BehaviorRetry.make({ sequence, ...item.retry })]),
    execution: {
      scope: effects.map((item) => `${item.sequence}:${item.stage}:${item.kind}`),
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
})

export const candidateGroups = [
  "build",
  "process",
  "catalog",
  "package-publish",
  "forge"
] as const
export type CandidateGroup =
  | "build"
  | "process"
  | "catalog"
  | "package-publish"
  | "forge"

const roster = [
  { id: "agent-plugin", config: "examples/agent-plugin/release.config.json",
    workspace: "examples/agent-plugin", groups: ["process", "catalog", "forge"] },
  { id: "github-release", config: "examples/github-release/release.config.json",
    workspace: "examples/github-release", groups: ["forge"] },
  { id: "homebrew-tap", config: "examples/homebrew-tap/release.config.json",
    workspace: "examples/homebrew-tap", groups: ["catalog"] },
  { id: "multi-target", config: "examples/multi-target/release.config.json",
    workspace: "examples/multi-target", groups: ["catalog", "package-publish", "forge"] },
  { id: "npm-first-publish", config: "examples/npm-first-publish/release.config.json",
    workspace: "examples/npm-first-publish", groups: ["package-publish"] },
  { id: "npm-only", config: "examples/npm-only/release.config.json",
    workspace: "examples/npm-only", groups: ["package-publish"] },
  { id: "portable-cli", config: "examples/portable-cli/release.config.json",
    workspace: "examples/portable-cli",
    groups: ["build", "process", "catalog", "package-publish", "forge"] },
  { id: "pypi-registry", config: "examples/pypi-registry/release.config.json",
    workspace: "examples/pypi-registry", groups: ["package-publish"] },
  { id: "scoop-bucket", config: "examples/scoop-bucket/release.config.json",
    workspace: "examples/scoop-bucket", groups: ["catalog"] },
  { id: "command-builder", config: "test/fixtures/rewrite/oracle/command-builder.json",
    workspace: ".", groups: ["build"] },
  { id: "prebuilt-builder", config: "test/fixtures/rewrite/oracle/prebuilt-builder.json",
    workspace: ".", groups: ["build"] }
] as const

const runCandidateOracleEffect = Effect.fn("test.runCandidateOracle")(function*(
  group: CandidateGroup | undefined
) {
  const selected = roster.filter((item) =>
    group === undefined || (item.groups as ReadonlyArray<string>).includes(group)
  )
  const cases = yield* Effect.forEach(selected, (item) => Effect.gen(function*() {
    const config = JSON.parse(readFileSync(join(process.cwd(), item.config), "utf8"))
    const behavior = yield* behaviorFromCandidate(config, join(process.cwd(), item.workspace))
    const encoded = encodeBehaviorContract(behavior)
    return {
      id: item.id,
      groups: item.groups,
      behaviorHash: canonicalJsonHash(encoded),
      behavior: encoded
    }
  }))
  return {
    schemaVersion: 1,
    adapter: "candidate",
    status: "candidate-proven",
    group: group ?? "all",
    supportedRoster: selected.map((item) => item.id),
    pendingRoster: [],
    behaviorMismatches: 0,
    cases
  }
})
export const runCandidateOracle = (group?: CandidateGroup) =>
  runCandidateOracleEffect(group)
