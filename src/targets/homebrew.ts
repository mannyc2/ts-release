import * as Effect from "effect/Effect"
import type {
  ArtifactArchitecture,
  ArtifactInventoryItem,
  Checksum
} from "../domain/artifact.js"
import {
  Operation,
  RenderFileOperation
} from "../domain/operation.js"
import { ReleaseModel } from "../domain/release.js"
import {
  HomebrewTapTarget,
  TargetCapabilities
} from "../domain/target.js"
import { PlanConstructionError } from "../planner/errors.js"
import { HomebrewTargetAdapter } from "./adapter.js"
import {
  catalogGitPublishOperations,
  catalogPathBaseName,
  dryRunValidationOperation,
  findRequiredArtifact,
  noAuthCommand,
  readOnlyCommandValidationOperation,
  requireSha256FileArtifact,
  rejectNoDryRunInStrictMode,
  rejectUnsupportedCatalogTokenEnv,
  targetCapabilitiesFor,
  validationStrategyForDryRun
} from "./adapter-helpers.js"

export type * from "../types/effect-internal.js"

const rejectUnsupportedTokenEnv = Effect.fn("rejectUnsupportedHomebrewTokenEnv")(function*(target: HomebrewTapTarget) {
  return yield* rejectUnsupportedCatalogTokenEnv({
    targetId: target.id,
    targetLabel: "Homebrew tap",
    tokenEnv: target.tokenEnv
  })
})

export const homebrewTargetCapabilities = (target: HomebrewTapTarget): TargetCapabilities =>
  targetCapabilitiesFor(target, validationStrategyForDryRun(target.dryRunSupport))

const rubyString = (value: string): string =>
  JSON.stringify(value)

const formulaClassName = (formulaName: string): string => {
  const parts = formulaName.split(/[^A-Za-z0-9]+/).filter((part) => part.length > 0)
  const className = parts.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join("")
  return className.length === 0 ? "GeneratedFormula" : className
}

interface HomebrewArtifact {
  readonly artifact: ArtifactInventoryItem
  readonly checksum: Checksum
}

interface HomebrewVariantArtifact extends HomebrewArtifact {
  readonly arch: ArtifactArchitecture
}

const artifactUrl = (artifact: ArtifactInventoryItem, fallbackUrl: string | undefined): string =>
  fallbackUrl ?? artifact.downloadUrl ?? artifact.path

const singleArtifactBinaryName = (
  target: HomebrewTapTarget,
  artifact: ArtifactInventoryItem
): string | undefined =>
  target.installPath !== undefined ? target.formulaName : artifact.variant?.binaryName

const multiArtifactBinaryName = (
  target: HomebrewTapTarget,
  artifacts: ReadonlyArray<HomebrewVariantArtifact>
): string =>
  target.installPath !== undefined
    ? target.formulaName
    : artifacts.find((entry) => entry.artifact.variant?.binaryName !== undefined)
      ?.artifact.variant?.binaryName ?? target.formulaName

const singleArtifactInstallLines = (
  target: HomebrewTapTarget,
  artifact: ArtifactInventoryItem
): ReadonlyArray<string> => {
  if (target.installPath !== undefined) {
    return [
      `    bin.install ${rubyString(target.installPath)} => ${rubyString(target.formulaName)}`,
      `    chmod 0755, bin/${rubyString(target.formulaName)}`
    ]
  }
  const binaryName = artifact.variant?.binaryName
  return binaryName === undefined
    ? ["    prefix.install Dir[\"*\"]"]
    : [
      `    bin.install ${rubyString(catalogPathBaseName(artifact.path))} => ${rubyString(binaryName)}`,
      `    chmod 0755, bin/${rubyString(binaryName)}`
    ]
}

const multiArtifactInstallLines = (
  target: HomebrewTapTarget,
  artifacts: ReadonlyArray<HomebrewVariantArtifact>
): ReadonlyArray<string> => {
  if (target.installPath !== undefined) {
    return [
      `    bin.install ${rubyString(target.installPath)} => ${rubyString(target.formulaName)}`,
      `    chmod 0755, bin/${rubyString(target.formulaName)}`
    ]
  }
  const binaryName = multiArtifactBinaryName(target, artifacts)
  return [
    `    bin.install Dir["*"].find { |path| File.file?(path) } => ${rubyString(binaryName)}`,
    `    chmod 0755, bin/${rubyString(binaryName)}`
  ]
}

const formulaTestLines = (binaryName: string | undefined): ReadonlyArray<string> =>
  binaryName === undefined
    ? []
    : [
      "",
      "  test do",
      `    assert File.exist?(bin/${rubyString(binaryName)})`,
      `    assert File.executable?(bin/${rubyString(binaryName)})`,
      "  end"
    ]

const requireHomebrewArtifact = Effect.fn("requireHomebrewArtifact")(function*(
  target: HomebrewTapTarget,
  model: ReleaseModel,
  artifactId: string
) {
  const artifact = yield* findRequiredArtifact(
    model,
    target.id,
    artifactId,
    `Homebrew target references missing artifact ${artifactId}.`
  )
  return yield* requireSha256FileArtifact(artifact, {
    targetId: target.id,
    directoryReason: "Homebrew formula artifacts must be file-like, not directories.",
    checksumReason: "Homebrew formula rendering requires a sha256 artifact checksum."
  })
})

const homebrewArchBlock = (arch: ArtifactArchitecture): string =>
  arch === "arm64" ? "on_arm" : "on_intel"

const homebrewArchOrder = (left: HomebrewVariantArtifact, right: HomebrewVariantArtifact): number => {
  const priority = (arch: ArtifactArchitecture) => arch === "arm64" ? 0 : 1
  return priority(left.arch) - priority(right.arch)
}

const validateHomebrewVariantArtifacts = Effect.fn("validateHomebrewVariantArtifacts")(function*(
  target: HomebrewTapTarget,
  artifacts: ReadonlyArray<HomebrewArtifact>
) {
  const seen = new Set<ArtifactArchitecture>()
  const entries: Array<HomebrewVariantArtifact> = []
  for (const entry of artifacts) {
    const variant = entry.artifact.variant
    if (variant === undefined || variant.os !== "darwin") {
      return yield* Effect.fail(
        PlanConstructionError.make({
          targetId: target.id,
          reason: `Homebrew artifact ${entry.artifact.id} must declare a darwin installable variant.`
        })
      )
    }
    if (seen.has(variant.arch)) {
      return yield* Effect.fail(
        PlanConstructionError.make({
          targetId: target.id,
          reason: `Homebrew target has multiple ${variant.arch} artifacts.`
        })
      )
    }
    seen.add(variant.arch)
    entries.push({
      artifact: entry.artifact,
      checksum: entry.checksum,
      arch: variant.arch
    })
  }
  return entries.sort(homebrewArchOrder)
})

const renderFormulaForArtifact = (
  target: HomebrewTapTarget,
  model: ReleaseModel,
  entry: HomebrewArtifact
): string => {
  const homepage = target.homepage ?? `https://github.com/${target.repository}`
  const description = target.description ?? `${model.identity.name} ${model.identity.version} release artifact`
  const url = artifactUrl(entry.artifact, target.url)
  return [
    `class ${formulaClassName(target.formulaName)} < Formula`,
    `  desc ${rubyString(description)}`,
    `  homepage ${rubyString(homepage)}`,
    `  url ${rubyString(url)}`,
    `  sha256 ${rubyString(entry.checksum.value)}`,
    `  version ${rubyString(model.identity.version)}`,
	    "",
	    "  def install",
	    ...singleArtifactInstallLines(target, entry.artifact),
	    "  end",
	    ...formulaTestLines(singleArtifactBinaryName(target, entry.artifact)),
	    "end",
	    ""
	  ].join("\n")
}

const renderFormulaForVariants = (
  target: HomebrewTapTarget,
  model: ReleaseModel,
  entries: ReadonlyArray<HomebrewVariantArtifact>
): string => {
  const homepage = target.homepage ?? `https://github.com/${target.repository}`
  const description = target.description ?? `${model.identity.name} ${model.identity.version} release artifact`
  const variantLines = entries.flatMap((entry) => [
    `    ${homebrewArchBlock(entry.arch)} do`,
    `      url ${rubyString(artifactUrl(entry.artifact, undefined))}`,
    `      sha256 ${rubyString(entry.checksum.value)}`,
    "    end",
    ""
  ])

  return [
    `class ${formulaClassName(target.formulaName)} < Formula`,
    `  desc ${rubyString(description)}`,
    `  homepage ${rubyString(homepage)}`,
    `  version ${rubyString(model.identity.version)}`,
    "",
    "  on_macos do",
    ...variantLines,
    "  end",
	    "",
	    "  def install",
	    ...multiArtifactInstallLines(target, entries),
	    "  end",
	    ...formulaTestLines(multiArtifactBinaryName(target, entries)),
	    "end",
	    ""
	  ].join("\n")
}

const renderFormula = (target: HomebrewTapTarget, model: ReleaseModel): Effect.Effect<string, PlanConstructionError> =>
  Effect.gen(function*() {
    const artifactIds = target.artifactIds ?? [target.artifactId]
    const artifacts = yield* Effect.forEach(artifactIds, (artifactId) =>
      requireHomebrewArtifact(target, model, artifactId)
    )
    if (target.artifactIds === undefined) {
      const artifact = artifacts[0]
      if (artifact !== undefined) {
        return renderFormulaForArtifact(target, model, artifact)
      }
    }
    const variants = yield* validateHomebrewVariantArtifacts(target, artifacts)
    return renderFormulaForVariants(target, model, variants)
  })

const dryRunOperation = (target: HomebrewTapTarget): Operation =>
  dryRunValidationOperation({
    id: `${target.id}:brew-audit`,
    targetId: target.id,
    dryRunSupport: target.dryRunSupport,
    nativeDescription: "Validate generated Homebrew formula with brew audit.",
    command: noAuthCommand("brew", ["audit", "--strict", "--formula", target.formulaPath]),
    simulatedDescription: "Record simulated Homebrew formula validation.",
    skippedDescription: "Record skipped Homebrew formula validation.",
    simulatedMessage: "Homebrew formula validation is simulated by the deterministic release plan.",
    skippedMessage: "Homebrew formula validation was skipped because this target declares no dry-run support."
  })

export const planHomebrewOperations = Effect.fn("planHomebrewOperations")(function*(
  target: HomebrewTapTarget,
  model: ReleaseModel
) {
  yield* rejectUnsupportedTokenEnv(target)
  yield* rejectNoDryRunInStrictMode(target, model, "Homebrew tap target declares no dry-run support in strict mode.")

  const formula = yield* renderFormula(target, model)
  const operations: Array<Operation> = [
    RenderFileOperation.make({
      id: `${target.id}:homebrew-render-formula`,
      targetId: target.id,
      description: `Render Homebrew formula ${catalogPathBaseName(target.formulaPath)}.`,
      risk: "writes-local",
      path: target.formulaPath,
      contents: formula
    })
  ]

  if (target.dryRunSupport === "native") {
    operations.push(
      readOnlyCommandValidationOperation({
        id: `${target.id}:brew-version`,
        targetId: target.id,
        description: "Check Homebrew CLI availability.",
        command: noAuthCommand("brew", ["--version"])
      })
    )
  }

  operations.push(
    dryRunOperation(target),
    ...catalogGitPublishOperations({
      id: `${target.id}:homebrew-push`,
      targetId: target.id,
      description: `Push Homebrew tap update for ${model.identity.name}@${model.identity.version}.`,
      mutability: target.mutability,
      directory: target.tapDirectory,
      filePath: target.formulaPath,
      commitMessage: `Update ${target.formulaName} to ${model.identity.version}`
    })
  )

  return operations
})

export const HomebrewAdapter: HomebrewTargetAdapter = {
  targetTag: "HomebrewTapTarget",
  capabilities: homebrewTargetCapabilities,
  planOperations: planHomebrewOperations
}
