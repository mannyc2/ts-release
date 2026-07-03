import * as Schema from "effect/Schema"
import { InstallableArtifactVariant } from "../domain/artifact.js"

export type * from "../types/effect-internal.js"

export const PlatformTarget = Schema.Literals([
  "linux-x64",
  "linux-x64-musl",
  "linux-arm64",
  "linux-arm64-musl",
  "darwin-x64",
  "darwin-arm64",
  "windows-x64",
  "windows-arm64"
])
export type PlatformTarget = typeof PlatformTarget.Type

export const allPlatformTargets: ReadonlyArray<PlatformTarget> = [
  "linux-x64",
  "linux-x64-musl",
  "linux-arm64",
  "linux-arm64-musl",
  "darwin-x64",
  "darwin-arm64",
  "windows-x64",
  "windows-arm64"
]

export const platformTargetVariant = (target: PlatformTarget): InstallableArtifactVariant => {
  switch (target) {
    case "linux-x64":
      return InstallableArtifactVariant.make({ os: "linux", arch: "x64", libc: "glibc", targetTriple: target })
    case "linux-x64-musl":
      return InstallableArtifactVariant.make({ os: "linux", arch: "x64", libc: "musl", targetTriple: target })
    case "linux-arm64":
      return InstallableArtifactVariant.make({ os: "linux", arch: "arm64", libc: "glibc", targetTriple: target })
    case "linux-arm64-musl":
      return InstallableArtifactVariant.make({ os: "linux", arch: "arm64", libc: "musl", targetTriple: target })
    case "darwin-x64":
      return InstallableArtifactVariant.make({ os: "darwin", arch: "x64", targetTriple: target })
    case "darwin-arm64":
      return InstallableArtifactVariant.make({ os: "darwin", arch: "arm64", targetTriple: target })
    case "windows-x64":
      return InstallableArtifactVariant.make({ os: "windows", arch: "x64", executableExtension: ".exe", targetTriple: target })
    case "windows-arm64":
      return InstallableArtifactVariant.make({ os: "windows", arch: "arm64", executableExtension: ".exe", targetTriple: target })
  }
}

export const platformTargetSuffix = (target: PlatformTarget): string =>
  target
