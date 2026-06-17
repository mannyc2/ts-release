import * as Effect from "effect/Effect"
import {
  CommandSpec,
  executeGate,
  irreversibleGate,
  noApprovalGate,
  Operation,
  PublishCommandOperation,
  RenderFileOperation,
  ValidateCommandOperation
} from "../domain/operation.js"
import { ReleaseModel } from "../domain/release.js"
import {
  HomebrewTapTarget,
  TargetCapabilities
} from "../domain/target.js"
import { PlanConstructionError } from "../planner/errors.js"
import { HomebrewTargetAdapter } from "./adapter.js"
import {
  findRequiredArtifact,
  requireSha256FileArtifact,
  rejectNoDryRunInStrictMode,
  targetCapabilitiesFor,
  validationNoteOperation,
  validationStrategyForDryRun
} from "./adapter-helpers.js"

export type * from "../types/effect-internal.js"

const command = (
  executable: string,
  args: ReadonlyArray<string>
): CommandSpec =>
  CommandSpec.make({
    executable,
    args: [...args],
    requiredEnv: [],
    redactedEnv: []
  })

const rejectUnsupportedTokenEnv = Effect.fn("rejectUnsupportedHomebrewTokenEnv")(function*(target: HomebrewTapTarget) {
  if (target.tokenEnv !== undefined) {
    return yield* Effect.fail(
      PlanConstructionError.make({
        targetId: target.id,
        reason:
          "Homebrew tap targets currently publish with plain git push and require Git credentials to be configured outside the release plan; tokenEnv is not supported yet."
      })
    )
  }
})

export const homebrewTargetCapabilities = (target: HomebrewTapTarget): TargetCapabilities =>
  targetCapabilitiesFor(target, validationStrategyForDryRun(target.dryRunSupport))

const pathBaseName = (path: string): string => {
  const parts = path.replaceAll("\\", "/").split("/")
  return parts[parts.length - 1] ?? path
}

const rubyString = (value: string): string =>
  JSON.stringify(value)

const formulaClassName = (formulaName: string): string => {
  const parts = formulaName.split(/[^A-Za-z0-9]+/).filter((part) => part.length > 0)
  const className = parts.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join("")
  return className.length === 0 ? "GeneratedFormula" : className
}

const renderFormula = (target: HomebrewTapTarget, model: ReleaseModel): Effect.Effect<string, PlanConstructionError> =>
  Effect.gen(function*() {
    const artifact = yield* findRequiredArtifact(
      model,
      target.id,
      target.artifactId,
      `Homebrew target references missing artifact ${target.artifactId}.`
    )
    const validated = yield* requireSha256FileArtifact(artifact, {
      targetId: target.id,
      directoryReason: "Homebrew formula artifacts must be file-like, not directories.",
      checksumReason: "Homebrew formula rendering requires a sha256 artifact checksum."
    })

    const installLines = target.installPath === undefined
      ? ["    prefix.install Dir[\"*\"]"]
      : [`    bin.install ${rubyString(target.installPath)} => ${rubyString(target.formulaName)}`]
    const homepage = target.homepage ?? `https://github.com/${target.repository}`
    const url = target.url ?? validated.artifact.path

    return [
      `class ${formulaClassName(target.formulaName)} < Formula`,
      `  desc ${rubyString(`${model.identity.name} ${model.identity.version} release artifact`)}`,
      `  homepage ${rubyString(homepage)}`,
      `  url ${rubyString(url)}`,
      `  sha256 ${rubyString(validated.checksum.value)}`,
      `  version ${rubyString(model.identity.version)}`,
      "",
      "  def install",
      ...installLines,
      "  end",
      "end",
      ""
    ].join("\n")
  })

const dryRunOperation = (target: HomebrewTapTarget): Operation => {
  const dryRunSupport = target.dryRunSupport
  return dryRunSupport === "native"
    ? ValidateCommandOperation.make({
      id: `${target.id}:brew-audit`,
      targetId: target.id,
      description: "Validate generated Homebrew formula with brew audit.",
      risk: "read-only",
      gate: noApprovalGate("brew audit validates the generated formula without publishing."),
      command: command("brew", ["audit", "--strict", "--formula", target.formulaPath])
    })
    : validationNoteOperation({
      id: `${target.id}:brew-audit`,
      targetId: target.id,
      dryRunSupport,
      simulatedDescription: "Record simulated Homebrew formula validation.",
      skippedDescription: "Record skipped Homebrew formula validation.",
      simulatedMessage: "Homebrew formula validation is simulated by the deterministic release plan.",
      skippedMessage: "Homebrew formula validation was skipped because this target declares no dry-run support."
    })
}

export const planHomebrewOperations = Effect.fn("planHomebrewOperations")(function*(
  target: HomebrewTapTarget,
  model: ReleaseModel
) {
  yield* rejectUnsupportedTokenEnv(target)
  yield* rejectNoDryRunInStrictMode(target, model, "Homebrew tap target declares no dry-run support in strict mode.")

  const formula = yield* renderFormula(target, model)
  const publishRisk = target.mutability === "immutable" ? "irreversible" : "externally-visible"
  const publishGate = publishRisk === "irreversible"
    ? irreversibleGate("Pushing a Homebrew tap update is configured as irreversible.")
    : executeGate("Pushing a Homebrew tap update is externally visible.")
  const tapDirectory = target.tapDirectory ?? "."
  const operations: Array<Operation> = [
    RenderFileOperation.make({
      id: `${target.id}:homebrew-render-formula`,
      targetId: target.id,
      description: `Render Homebrew formula ${pathBaseName(target.formulaPath)}.`,
      risk: "writes-local",
      gate: executeGate("Rendering a Homebrew formula writes a local generated file."),
      path: target.formulaPath,
      contents: formula
    })
  ]

  if (target.dryRunSupport === "native") {
    operations.push(
      ValidateCommandOperation.make({
        id: `${target.id}:brew-version`,
        targetId: target.id,
        description: "Check Homebrew CLI availability.",
        risk: "read-only",
        gate: noApprovalGate("CLI availability validation is read-only."),
        command: command("brew", ["--version"])
      })
    )
  }

  operations.push(
    dryRunOperation(target),
    PublishCommandOperation.make({
      id: `${target.id}:homebrew-push`,
      targetId: target.id,
      description: `Push Homebrew tap update for ${model.identity.name}@${model.identity.version}.`,
      risk: publishRisk,
      gate: publishGate,
      command: command("git", ["-C", tapDirectory, "push"])
    })
  )

  return operations
})

export const HomebrewAdapter: HomebrewTargetAdapter = {
  targetTag: "HomebrewTapTarget",
  capabilities: homebrewTargetCapabilities,
  planOperations: planHomebrewOperations
}
