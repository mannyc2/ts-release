import * as Effect from "effect/Effect"
import {
  CommandSpec,
  executeGate,
  irreversibleGate,
  noApprovalGate,
  Operation,
  PublishCommandOperation,
  RenderFileOperation,
  ValidateCommandOperation,
  ValidationNoteOperation
} from "../domain/operation.js"
import { ReleaseModel } from "../domain/release.js"
import {
  HomebrewTapTarget,
  TargetCapabilities,
  targetAuthRequirement,
  TargetValidationStrategy
} from "../domain/target.js"
import { PlanConstructionError } from "../planner/errors.js"
import { HomebrewTargetAdapter } from "./adapter.js"

export type * from "../types/effect-internal.js"

const envNames = (target: HomebrewTapTarget): ReadonlyArray<string> =>
  target.tokenEnv === undefined ? [] : [target.tokenEnv]

const command = (
  target: HomebrewTapTarget,
  executable: string,
  args: ReadonlyArray<string>,
  includeAuth: boolean,
  cwd: string | undefined = undefined
): CommandSpec =>
  CommandSpec.make({
    executable,
    args: [...args],
    ...(cwd === undefined ? {} : { cwd }),
    requiredEnv: includeAuth ? envNames(target) : [],
    redactedEnv: includeAuth ? envNames(target) : []
  })

const validationStrategy = (target: HomebrewTapTarget): TargetValidationStrategy => {
  if (target.dryRunSupport === "native") {
    return "native-command"
  }
  if (target.dryRunSupport === "simulated") {
    return "simulated-plan"
  }
  return "skipped"
}

export const homebrewTargetCapabilities = (target: HomebrewTapTarget): TargetCapabilities =>
  TargetCapabilities.make({
    targetId: target.id,
    targetTag: target._tag,
    authRequirement: targetAuthRequirement(target),
    dryRunSupport: target.dryRunSupport,
    mutability: target.mutability,
    recovery: target.recovery,
    validationStrategy: validationStrategy(target)
  })

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
    const artifact = model.artifacts.find((item) => item.id === target.artifactId)
    if (artifact === undefined) {
      return yield* Effect.fail(
        PlanConstructionError.make({
          targetId: target.id,
          reason: `Homebrew target references missing artifact ${target.artifactId}.`
        })
      )
    }
    if (artifact.format === "directory") {
      return yield* Effect.fail(
        PlanConstructionError.make({
          targetId: target.id,
          reason: "Homebrew formula artifacts must be file-like, not directories."
        })
      )
    }
    if (artifact.checksum === undefined || artifact.checksum.algorithm !== "sha256") {
      return yield* Effect.fail(
        PlanConstructionError.make({
          targetId: target.id,
          reason: "Homebrew formula rendering requires a sha256 artifact checksum."
        })
      )
    }

    const installLines = target.installPath === undefined
      ? ["    prefix.install Dir[\"*\"]"]
      : [`    bin.install ${rubyString(target.installPath)} => ${rubyString(target.formulaName)}`]
    const homepage = target.homepage ?? `https://github.com/${target.repository}`
    const url = target.url ?? artifact.path

    return [
      `class ${formulaClassName(target.formulaName)} < Formula`,
      `  desc ${rubyString(`${model.identity.name} ${model.identity.version} release artifact`)}`,
      `  homepage ${rubyString(homepage)}`,
      `  url ${rubyString(url)}`,
      `  sha256 ${rubyString(artifact.checksum.value)}`,
      `  version ${rubyString(model.identity.version)}`,
      "",
      "  def install",
      ...installLines,
      "  end",
      "end",
      ""
    ].join("\n")
  })

const dryRunOperation = (target: HomebrewTapTarget): Operation =>
  target.dryRunSupport === "native"
    ? ValidateCommandOperation.make({
      id: `${target.id}:brew-audit`,
      targetId: target.id,
      description: "Validate generated Homebrew formula with brew audit.",
      risk: "read-only",
      gate: noApprovalGate("brew audit validates the generated formula without publishing."),
      command: command(target, "brew", ["audit", "--strict", "--formula", target.formulaPath], false)
    })
    : ValidationNoteOperation.make({
      id: `${target.id}:brew-audit`,
      targetId: target.id,
      description: target.dryRunSupport === "simulated"
        ? "Record simulated Homebrew formula validation."
        : "Record skipped Homebrew formula validation.",
      risk: "read-only",
      gate: noApprovalGate("Validation notes do not modify local or remote state."),
      message: target.dryRunSupport === "simulated"
        ? "Homebrew formula validation is simulated by the deterministic release plan."
        : "Homebrew formula validation was skipped because this target declares no dry-run support.",
      skipped: target.dryRunSupport === "none",
      severity: target.dryRunSupport === "none" ? "warning" : "info"
    })

export const planHomebrewOperations = Effect.fn("planHomebrewOperations")(function*(
  target: HomebrewTapTarget,
  model: ReleaseModel
) {
  if (model.strict && target.dryRunSupport === "none") {
    return yield* Effect.fail(
      PlanConstructionError.make({
        targetId: target.id,
        reason: "Homebrew tap target declares no dry-run support in strict mode."
      })
    )
  }

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
        command: command(target, "brew", ["--version"], false)
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
      command: command(target, "git", ["-C", tapDirectory, "push"], true)
    })
  )

  return operations
})

export const HomebrewAdapter: HomebrewTargetAdapter = {
  targetTag: "HomebrewTapTarget",
  capabilities: homebrewTargetCapabilities,
  planOperations: planHomebrewOperations
}
