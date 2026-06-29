import * as Schema from "effect/Schema"

export type * from "../types/effect-internal.js"

export const ArtifactId = Schema.NonEmptyString
export type ArtifactId = typeof ArtifactId.Type

export const ArtifactFormat = Schema.Literals(["tarball", "zip", "file", "directory", "oci-image", "executable"])
export type ArtifactFormat = typeof ArtifactFormat.Type

export const ChecksumAlgorithm = Schema.Literals(["sha256", "sha512"])
export type ChecksumAlgorithm = typeof ChecksumAlgorithm.Type

export const ArtifactRecipeId = Schema.NonEmptyString
export type ArtifactRecipeId = typeof ArtifactRecipeId.Type

export const ArtifactOperatingSystem = Schema.Literals(["linux", "darwin", "windows"])
export type ArtifactOperatingSystem = typeof ArtifactOperatingSystem.Type

export const ArtifactArchitecture = Schema.Literals(["x64", "arm64"])
export type ArtifactArchitecture = typeof ArtifactArchitecture.Type

export const ArtifactLibc = Schema.Literals(["glibc", "musl"])
export type ArtifactLibc = typeof ArtifactLibc.Type

export const BunExecutableCompileTarget = Schema.Literals([
  "bun-linux-x64",
  "bun-linux-x64-baseline",
  "bun-linux-x64-modern",
  "bun-linux-arm64",
  "bun-windows-x64",
  "bun-windows-x64-baseline",
  "bun-windows-x64-modern",
  "bun-windows-arm64",
  "bun-darwin-x64",
  "bun-darwin-x64-baseline",
  "bun-darwin-x64-modern",
  "bun-darwin-arm64",
  "bun-linux-x64-musl",
  "bun-linux-x64-baseline-musl",
  "bun-linux-x64-modern-musl",
  "bun-linux-arm64-musl"
])
export type BunExecutableCompileTarget = typeof BunExecutableCompileTarget.Type

export class Checksum extends Schema.Class<Checksum>("Checksum")({
  algorithm: ChecksumAlgorithm,
  value: Schema.String
}) {}

export class InstallableArtifactVariant extends Schema.Class<InstallableArtifactVariant>(
  "InstallableArtifactVariant"
)({
  os: ArtifactOperatingSystem,
  arch: ArtifactArchitecture,
  libc: Schema.optionalKey(ArtifactLibc),
  binaryName: Schema.optionalKey(Schema.NonEmptyString),
  executableExtension: Schema.optionalKey(Schema.NonEmptyString),
  installPath: Schema.optionalKey(Schema.NonEmptyString),
  targetTriple: Schema.optionalKey(Schema.NonEmptyString)
}) {}

export class InstallableArtifactVariantOverride extends Schema.Class<InstallableArtifactVariantOverride>(
  "InstallableArtifactVariantOverride"
)({
  os: Schema.optionalKey(ArtifactOperatingSystem),
  arch: Schema.optionalKey(ArtifactArchitecture),
  libc: Schema.optionalKey(ArtifactLibc),
  binaryName: Schema.optionalKey(Schema.NonEmptyString),
  executableExtension: Schema.optionalKey(Schema.NonEmptyString),
  installPath: Schema.optionalKey(Schema.NonEmptyString),
  targetTriple: Schema.optionalKey(Schema.NonEmptyString)
}) {}

export class ArtifactIntent extends Schema.Class<ArtifactIntent>("ArtifactIntent")({
  id: ArtifactId,
  path: Schema.String,
  downloadUrl: Schema.optionalKey(Schema.String),
  format: ArtifactFormat,
  consumers: Schema.Array(Schema.String),
  checksum: Schema.optionalKey(Checksum),
  variant: Schema.optionalKey(InstallableArtifactVariant)
}) {}

export class BunExecutableArtifactOutput extends Schema.Class<BunExecutableArtifactOutput>(
  "BunExecutableArtifactOutput"
)({
  id: ArtifactId,
  target: BunExecutableCompileTarget,
  path: Schema.String,
  downloadUrl: Schema.optionalKey(Schema.String),
  consumers: Schema.Array(Schema.String),
  variant: Schema.optionalKey(InstallableArtifactVariantOverride)
}) {}

export class BunExecutableArtifactRecipe extends Schema.TaggedClass<BunExecutableArtifactRecipe>()(
  "BunExecutableArtifactRecipe",
  {
    id: ArtifactRecipeId,
    entrypoint: Schema.String,
    outputs: Schema.Array(BunExecutableArtifactOutput),
    minify: Schema.optionalKey(Schema.Boolean)
  }
) {}

export class PyPiWheelBinaryArtifact extends Schema.Class<PyPiWheelBinaryArtifact>("PyPiWheelBinaryArtifact")({
  os: ArtifactOperatingSystem,
  arch: ArtifactArchitecture,
  sourcePath: Schema.String,
  wheelPath: Schema.String
}) {}

export class PyPiWheelArtifactRecipe extends Schema.TaggedClass<PyPiWheelArtifactRecipe>()(
  "PyPiWheelArtifactRecipe",
  {
    id: ArtifactId,
    path: Schema.String,
    wheelTag: Schema.String,
    packageName: Schema.String,
    moduleName: Schema.String,
    consoleScript: Schema.String,
    summary: Schema.String,
    homepage: Schema.String,
    license: Schema.String,
    requiresPython: Schema.String,
    binaries: Schema.Array(PyPiWheelBinaryArtifact),
    consumers: Schema.Array(Schema.String)
  }
) {}

export const ArtifactRecipe = Schema.Union([BunExecutableArtifactRecipe, PyPiWheelArtifactRecipe])
export type ArtifactRecipe = typeof ArtifactRecipe.Type

export class ArtifactInventoryItem extends Schema.Class<ArtifactInventoryItem>("ArtifactInventoryItem")({
  id: ArtifactId,
  path: Schema.String,
  downloadUrl: Schema.optionalKey(Schema.String),
  format: ArtifactFormat,
  consumers: Schema.Array(Schema.String),
  sizeBytes: Schema.Number,
  checksum: Schema.optionalKey(Checksum),
  variant: Schema.optionalKey(InstallableArtifactVariant)
}) {}

export const bunExecutableCompileTargetVariant = (
  target: BunExecutableCompileTarget
): InstallableArtifactVariant => {
  switch (target) {
    case "bun-linux-x64":
    case "bun-linux-x64-baseline":
    case "bun-linux-x64-modern":
      return InstallableArtifactVariant.make({
        os: "linux",
        arch: "x64",
        libc: "glibc",
        targetTriple: target
      })
    case "bun-linux-arm64":
      return InstallableArtifactVariant.make({
        os: "linux",
        arch: "arm64",
        libc: "glibc",
        targetTriple: target
      })
    case "bun-linux-x64-musl":
    case "bun-linux-x64-baseline-musl":
    case "bun-linux-x64-modern-musl":
      return InstallableArtifactVariant.make({
        os: "linux",
        arch: "x64",
        libc: "musl",
        targetTriple: target
      })
    case "bun-linux-arm64-musl":
      return InstallableArtifactVariant.make({
        os: "linux",
        arch: "arm64",
        libc: "musl",
        targetTriple: target
      })
    case "bun-darwin-x64":
    case "bun-darwin-x64-baseline":
    case "bun-darwin-x64-modern":
      return InstallableArtifactVariant.make({
        os: "darwin",
        arch: "x64",
        targetTriple: target
      })
    case "bun-darwin-arm64":
      return InstallableArtifactVariant.make({
        os: "darwin",
        arch: "arm64",
        targetTriple: target
      })
    case "bun-windows-x64":
    case "bun-windows-x64-baseline":
    case "bun-windows-x64-modern":
      return InstallableArtifactVariant.make({
        os: "windows",
        arch: "x64",
        executableExtension: ".exe",
        targetTriple: target
      })
    case "bun-windows-arm64":
      return InstallableArtifactVariant.make({
        os: "windows",
        arch: "arm64",
        executableExtension: ".exe",
        targetTriple: target
      })
  }
}

export const bunExecutableOutputVariant = (
  target: BunExecutableCompileTarget,
  override: InstallableArtifactVariantOverride | undefined
): InstallableArtifactVariant => {
  const derived = bunExecutableCompileTargetVariant(target)
  const fields = {
    os: override?.os ?? derived.os,
    arch: override?.arch ?? derived.arch,
    ...(override?.libc !== undefined
      ? { libc: override.libc }
      : derived.libc === undefined ? {} : { libc: derived.libc }),
    ...(override?.binaryName === undefined ? {} : { binaryName: override.binaryName }),
    ...(override?.executableExtension !== undefined
      ? { executableExtension: override.executableExtension }
      : derived.executableExtension === undefined ? {} : { executableExtension: derived.executableExtension }),
    ...(override?.installPath === undefined ? {} : { installPath: override.installPath }),
    targetTriple: override?.targetTriple ?? derived.targetTriple ?? target
  }
  return InstallableArtifactVariant.make(fields)
}

export const artifactIntentOrder = (left: ArtifactIntent, right: ArtifactIntent): number =>
  left.id.localeCompare(right.id)

export const artifactInventoryOrder = (
  left: ArtifactInventoryItem,
  right: ArtifactInventoryItem
): number => left.id.localeCompare(right.id)
