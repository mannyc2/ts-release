// Compile every admitted public upstream entry against the selected Effect beta.
import * as Api0 from "effect-build"
import * as Api1 from "effect-build/Artifact"
import * as Api2 from "effect-build/Author/BorrowedOutput"
import * as Api3 from "effect-build/Author/Executable"
import * as Api4 from "effect-build/Author/File"
import * as Api5 from "effect-build/Author/Tool"
import * as Api6 from "effect-build/Author/Tree"
import * as Api7 from "effect-build/Matrix"
import * as Api8 from "effect-build/SystemTarget"
import * as Api9 from "effect-build-apple"
import * as Api10 from "effect-build-apple/AppBundle"
import * as Api11 from "effect-build-apple/Assess"
import * as Api12 from "effect-build-apple/CodeSign"
import * as Api13 from "effect-build-apple/DiskImage"
import * as Api14 from "effect-build-apple/InstallerPackage"
import * as Api15 from "effect-build-apple/Model"
import * as Api16 from "effect-build-apple/Notary"
import * as Api17 from "effect-build-apple/Staple"
import * as Api18 from "effect-build-archives"
import * as Api19 from "effect-build-archives/Archive"
import * as Api20 from "effect-build-archives/ArchiveError"
import * as Api21 from "effect-build-archives/Model"
import * as Api22 from "effect-build-archives/SourceArchive"
import * as Api23 from "effect-build-bun"
import * as Api24 from "effect-build-bun/Api"
import * as Api25 from "effect-build-bun/Command"
import * as Api26 from "effect-build-deno"
import * as Api27 from "effect-build-deno/Command"
import * as Api28 from "effect-build-esbuild"
import * as Api29 from "effect-build-esbuild/Api"
import * as Api30 from "effect-build-esbuild/Command"
import * as Api31 from "effect-build-nfpm"
import * as Api32 from "effect-build-nfpm/Package"
import * as Api33 from "effect-build-node-sea"
import * as Api34 from "effect-build-node-sea/Command"
import * as Api35 from "effect-build-python"
import * as Api36 from "effect-build-python/Build"
import * as Api37 from "effect-build-python/PythonBuildError"
import * as Api38 from "effect-build-sbom"
import * as Api39 from "effect-build-sbom/Generate"
import * as Api40 from "effect-build-windows"
import * as Api41 from "effect-build-windows/SignMsix"
import type { ContentOwner, File } from "@mannyc1/ts-release/bundle"
import { adoptFile, adoptTree, restoreTree } from "@mannyc1/ts-release/effect-build"
import * as Apple from "@mannyc1/ts-release/apple"
export const appleEntry = Apple
export type ApplePreparationRun = ReturnType<typeof Apple.runPreparation>
export type AppleNativeCompletion = ReturnType<typeof Apple.finishPrepared>
export type ApplePublication = ReturnType<typeof Apple.validateApplePublication>
export const upstreamEntries = [
  Api0,
  Api1,
  Api2,
  Api3,
  Api4,
  Api5,
  Api6,
  Api7,
  Api8,
  Api9,
  Api10,
  Api11,
  Api12,
  Api13,
  Api14,
  Api15,
  Api16,
  Api17,
  Api18,
  Api19,
  Api20,
  Api21,
  Api22,
  Api23,
  Api24,
  Api25,
  Api26,
  Api27,
  Api28,
  Api29,
  Api30,
  Api31,
  Api32,
  Api33,
  Api34,
  Api35,
  Api36,
  Api37,
  Api38,
  Api39,
  Api40,
  Api41,
] as const
export type IdentityReader = Parameters<ContentOwner["putFileOwned"]>[0]
export type FileAdoption = ReturnType<typeof adoptFile>
export type TreeAdoption = ReturnType<typeof adoptTree>
export type TreeRestoration = ReturnType<typeof restoreTree>
export type DurableFile = File
