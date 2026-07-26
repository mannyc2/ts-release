import * as Effect from "effect/Effect"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { operationAuthority } from "../../src/rewrite/model/operation.js"
import {
  NonEmptyName,
  WorkspaceRoot
} from "../../src/rewrite/model/primitives.js"
import { operationEntries } from "../../src/rewrite/model/validate.js"
import {
  Invocation,
  compilePlan
} from "../../src/rewrite/plan/compiler.js"
import {
  BehaviorApproval,
  BehaviorContract,
  BehaviorEffect,
  BehaviorIdentity,
  BehaviorOutput,
  encodeBehaviorContract
} from "./behavior-contract.js"

export const behaviorFromCandidate = Effect.fn("test.behaviorFromCandidate")(function*(
  config: unknown,
  workspace: string
) {
  const accepted = yield* compilePlan(config, Invocation.make({
    workspace: WorkspaceRoot.make(workspace),
    commit: NonEmptyName.make("abc123"),
    snapshot: false
  }))
  const entries = operationEntries(accepted.plan)
  const effects = entries.map(({ operation, stage }, sequence) => {
    const authority = operationAuthority(operation)
    return BehaviorEffect.make({
      sequence,
      stage,
      authority,
      kind: operation._tag,
      description: `${operation._tag} ${operation.id}`,
      details: {
        inputs: operation.inputs,
        outputs: operation.outputs.map((output) => output.id)
      }
    })
  })
  return BehaviorContract.make({
    identity: BehaviorIdentity.make({
      name: accepted.plan.identity.name,
      version: accepted.plan.identity.version,
      tag: accepted.plan.identity.tag,
      commit: accepted.plan.identity.commit,
      snapshot: accepted.plan.identity.snapshot,
      versionSource: "candidate-config"
    }),
    outputs: accepted.outputs.map(({ output }) =>
      BehaviorOutput.make({
        id: output.id,
        path: output.path,
        kind: output.kind,
        provenance: "candidate-operation"
      })),
    effects,
    renderedFiles: entries.flatMap(({ operation }) =>
      operation._tag === "Write"
        ? [{ path: operation.path, bytes: operation.content }]
        : []),
    approvals: effects.map((effect) =>
      BehaviorApproval.make({
        sequence: effect.sequence,
        execute: ["LocalWrite", "LocalExec", "RemotePublish"].includes(effect.authority),
        irreversible: effect.authority === "RemotePublish"
      })),
    retries: [],
    execution: {
      scope: accepted.operationHashes.map((item) => `${item.operationId}:${item.hash}`),
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

export const runCandidateOracle = Effect.fn("test.runCandidateOracle")(function*() {
  const path = join(
    process.cwd(),
    "test/fixtures/rewrite/plan-v6/minimal.json"
  )
  const config = JSON.parse(readFileSync(path, "utf8"))
  const behavior = yield* behaviorFromCandidate(config, "/candidate-workspace")
  return {
    schemaVersion: 1,
    adapter: "candidate",
    status: "candidate-partial",
    supportedRoster: ["plan-v6/minimal"],
    pendingRoster: [
      "agent-plugin",
      "github-release",
      "homebrew-tap",
      "multi-target",
      "npm-first-publish",
      "npm-only",
      "portable-cli",
      "pypi-registry",
      "scoop-bucket",
      "command-builder",
      "prebuilt-builder"
    ],
    behavior: encodeBehaviorContract(behavior)
  }
})
