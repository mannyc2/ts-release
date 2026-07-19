import * as Schema from "effect/Schema"
import { InstallableArtifactVariant } from "./artifact.js"
import variants from "../assets/platform-variants.json" with { type: "json" }

// Invariant: one target table owns every platform fact used by schemas, templates, and builders.

export type PlatformTarget = `linux-${"x64" | "arm64"}${"" | "-musl"}` | `${"darwin" | "windows"}-${"x64" | "arm64"}`
export const PlatformTarget = Schema.Literals(Object.keys(variants) as ReadonlyArray<PlatformTarget>)
const platformVariants = variants as Record<PlatformTarget, Omit<InstallableArtifactVariant, "targetTriple">>

export const platformTargetVariant = (target: PlatformTarget): InstallableArtifactVariant =>
  InstallableArtifactVariant.make({ ...platformVariants[target], targetTriple: target })
