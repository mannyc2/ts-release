// Compile every public effect-build 0.7.0 entry against the selected Effect release candidate.
import * as Entry0 from "effect-build"
import * as Entry1 from "effect-build/Artifact"
import * as Entry2 from "effect-build/Checksums"
import * as Entry3 from "effect-build/Commit"
import * as Entry4 from "effect-build/Executable"
import * as Entry5 from "effect-build/Layout"
import * as Entry6 from "effect-build/Target"
import * as Entry7 from "effect-build/Tool"
import * as Entry8 from "effect-build-apple"
import * as Entry9 from "effect-build-archives"
import * as Entry10 from "effect-build-bun"
import * as Entry11 from "effect-build-deno"
import * as Entry12 from "effect-build-deno/api"
import * as Entry13 from "effect-build-esbuild"
import * as Entry14 from "effect-build-nfpm"
import * as Entry15 from "effect-build-node-sea"
import * as Entry16 from "effect-build-python"
import * as Entry17 from "effect-build-sbom"
import * as Entry18 from "effect-build-windows"
import type { ContentOwner, File } from "@mannyc1/ts-release/bundle"
import { adoptFile, adoptTree, restoreTree } from "@mannyc1/ts-release/effect-build"
import * as Apple from "@mannyc1/ts-release/apple"
export const appleEntry = Apple
export type ApplePreparationRun = ReturnType<typeof Apple.runPreparation>
export type AppleNativeCompletion = ReturnType<typeof Apple.finishPrepared>
export type ApplePublication = ReturnType<typeof Apple.validateApplePublication>
export const upstreamEntries = [
  Entry0,
  Entry1,
  Entry2,
  Entry3,
  Entry4,
  Entry5,
  Entry6,
  Entry7,
  Entry8,
  Entry9,
  Entry10,
  Entry11,
  Entry12,
  Entry13,
  Entry14,
  Entry15,
  Entry16,
  Entry17,
  Entry18,
] as const
export type SourceFile = Parameters<ContentOwner["putFileOwned"]>[0]
export type FileAdoption = ReturnType<typeof adoptFile>
export type TreeAdoption = ReturnType<typeof adoptTree>
export type TreeRestoration = ReturnType<typeof restoreTree>
export type DurableFile = File
