import { Crypto, Effect, FileSystem, Option, Path, PlatformError, Schema } from "effect"
import * as Artifact from "effect-build/Artifact"
import * as File from "effect-build/Author/File"
import * as Tree from "effect-build/Author/Tree"
import * as Model from "effect-build-apple/Model"
import * as Notary from "effect-build-apple/Notary"
import * as Staple from "effect-build-apple/Staple"
import * as Assess from "effect-build-apple/Assess"
import { adoptFile, adoptTree, restoreTree } from "../EffectBuild.js"
import { AdoptionError, type OwnedFile } from "../internal/ArtifactModel.js"
import { encodeBundle, loadBundle } from "../internal/BundleCodec.js"
import { finalize } from "../internal/BundleFinalize.js"
import { captureContentOwner, readVerifiedContent, type ContentOwner } from "../internal/Content.js"
import { attempt, failure, type ReleaseError } from "../internal/Error.js"
import { decodeOwned, sameBytes } from "../internal/Identity.js"
import { ApplePreparation, FinalApp, FinalDmg, FinalPkg, ReadyToPlan } from "./Model.js"
import { classifyEvidence, sourceCorresponds } from "./Provider.js"

export type RestoredSource =
  | { readonly kind: "app"; readonly artifact: Model.DeveloperIdApplicationBundle }
  | { readonly kind: "dmg"; readonly artifact: Model.DeveloperIdDiskImage }
  | { readonly kind: "pkg"; readonly artifact: Model.DeveloperIdInstallerPackage }
export type FinalNativeArtifact = (
  | { readonly kind: "app"; readonly artifact: Model.StapledApplicationBundle }
  | { readonly kind: "dmg"; readonly artifact: Model.StapledDiskImage }
  | { readonly kind: "pkg"; readonly artifact: Model.StapledInstallerPackage }
) & { readonly assessment: Assess.GatekeeperAccepted }
export type NativeAppleError =
  | ReleaseError
  | AdoptionError
  | Schema.SchemaError
  | PlatformError.PlatformError
  | File.PublicationFailure
  | File.FileVerificationFailed
  | Tree.PublicationFailure
  | Tree.TreeVerificationFailed
  | Model.ProductStateInvalid
  | Notary.SubmitAppError
  | Notary.ObserveError
  | Notary.ResultNotAccepted
  | Notary.ResultHasNoStapleTarget
  | Staple.StapleError
  | Assess.AssessError
export type NativeAppleServices =
  | Crypto.Crypto
  | FileSystem.FileSystem
  | Path.Path
  | Notary.Client
  | Staple.Stapler
  | Assess.Assessor
export type DeriveDeliveryFiles<R = never> = (
  final: FinalNativeArtifact,
) => Effect.Effect<readonly OwnedFile[], NativeAppleError, R>
const mismatch = () => failure("apple-native-binding", "Apple native evidence differs")
/** Native app trees can retain readonly nested directories. Make only private
 * real directories removable, with bounded enumeration and no symlink traversal. */
const privateWorkspace = Effect.fn("apple.privateWorkspace")(function* (
  owner: ContentOwner,
  directory: string,
  prefix: string,
) {
  const fs = yield* FileSystem.FileSystem,
    path = yield* Path.Path
  const readDirectory = owner.readDirectoryBounded.bind(owner)
  return yield* Effect.acquireRelease(fs.makeTempDirectory({ directory, prefix }), (root) =>
    Effect.gen(function* () {
      const pending = [root]
      let remaining = 300_000
      while (pending.length) {
        const current = pending.pop()!
        if (Option.isSome(yield* Effect.option(fs.readLink(current)))) continue
        yield* fs.chmod(current, 0o700)
        const names = yield* readDirectory(current, remaining)
        remaining -= names.length
        if (remaining < 0) return yield* mismatch()
        for (const name of names) {
          const entry = path.join(current, name)
          if (Option.isSome(yield* Effect.option(fs.readLink(entry)))) continue
          if ((yield* fs.stat(entry)).type === "Directory") pending.push(entry)
        }
      }
      yield* fs.remove(root, { recursive: true, force: true })
    }).pipe(Effect.orDie),
  )
})

/** Caller owns the workspace lifetime. Recreate source bytes through the actual
 * native finalizers; signature projection is reverified by native Apple tools. */
export const restorePreparedSource = Effect.fn("apple.restoreSource")(function* (
  value: ApplePreparation,
  contentOwner: ContentOwner,
  workspace: string,
) {
  const owner = captureContentOwner(contentOwner)
  const input = yield* attempt(() => decodeOwned(ApplePreparation, value))
  const fs = yield* FileSystem.FileSystem,
    path = yield* Path.Path
  if (!path.isAbsolute(workspace)) return yield* mismatch()
  const bundle = yield* finalize([input.source])
  yield* loadBundle(owner, encodeBundle(bundle))
  yield* fs.makeDirectory(workspace, { recursive: true })
  let restored: RestoredSource
  if (input._tag === "AppPreparation") {
    const source = input.source
    const artifact = yield* restoreTree(
      owner,
      source,
      path.join(workspace, input.bundleName),
      source.provenance,
    )
    const native = {
      ...artifact,
      architecture: input.architecture,
      signature: new Model.DeveloperIdApplicationSignature({
        ...input.signature,
        architecture: input.architecture,
      }),
    }
    if (!Model.hasDeveloperIdApplicationSignature(native)) return yield* mismatch()
    restored = { kind: "app", artifact: native }
  } else {
    const kind = input._tag === "DmgPreparation" ? "dmg" : "pkg"
    const artifact = yield* File.publish(
      {
        destination: path.join(workspace, `source.${kind}`),
        observation: "hashed",
        provenance: input.source.provenance,
      },
      (candidate) =>
        Effect.gen(function* () {
          yield* fs.writeFile(candidate, new Uint8Array(yield* owner.read(input.source.content)))
        }),
    )
    if (
      artifact.bytes !== input.source.content.bytes ||
      artifact.digest.value !== input.source.content.sha256
    )
      return yield* mismatch()
    const signature =
      input._tag === "DmgPreparation"
        ? new Model.DeveloperIdDiskImageSignature({
            ...input.signature,
            architecture: input.architecture,
          })
        : new Model.DeveloperIdInstallerSignature({
            ...input.signature,
            architecture: input.architecture,
          })
    const native = { ...artifact, architecture: input.architecture, signature }
    if (input._tag === "DmgPreparation") {
      if (!Model.hasDeveloperIdDiskImageSignature(native)) return yield* mismatch()
      restored = { kind: "dmg", artifact: native }
    } else {
      if (!Model.hasDeveloperIdInstallerSignature(native)) return yield* mismatch()
      restored = { kind: "pkg", artifact: native }
    }
  }
  return restored
})

export const submitPrepared = Effect.fn("apple.submitPrepared")(function* (
  value: ApplePreparation,
  contentOwner: ContentOwner,
  workspace: string,
) {
  const owner = captureContentOwner(contentOwner)
  const input = yield* attempt(() => decodeOwned(ApplePreparation, value))
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const privateRoot = yield* privateWorkspace(owner, workspace, "apple-submit-")
      const source = yield* restorePreparedSource(input, owner, privateRoot)
      return source.kind === "app"
        ? yield* Notary.submitApp({ bundle: source.artifact })
        : source.kind === "dmg"
          ? yield* Notary.submit({ kind: "dmg", artifact: source.artifact })
          : yield* Notary.submit({ kind: "pkg", artifact: source.artifact })
    }),
  )
})

/** Only poll the recorded identity; accepted bytes are stapled, assessed, then
 * adopted. Derived output blobs are not selected until the journal's one CAS. */
export const finishPrepared = Effect.fn("apple.finishPrepared")(function* <R = never>(
  value: ApplePreparation,
  recorded: Notary.Submission,
  preparationId: string,
  contentOwner: ContentOwner,
  workspace: string,
  deriveDeliveryFiles?: DeriveDeliveryFiles<R>,
) {
  const owner = captureContentOwner(contentOwner)
  const input = yield* attempt(() => decodeOwned(ApplePreparation, value))
  const submission = yield* attempt(() => decodeOwned(Notary.Submission, recorded))
  if (!sourceCorresponds(input, submission)) return yield* mismatch()
  const result = submission.status._tag === "Accepted" ? submission : yield* Notary.info(submission)
  if (!sourceCorresponds(input, result)) return yield* mismatch()
  yield* attempt(() => classifyEvidence(input, preparationId, result, [submission]))
  if (result.status._tag !== "Accepted")
    return yield* attempt(() => decodeOwned(Notary.Observation, result))
  const acceptance = yield* Notary.acceptedReference(result)
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const path = yield* Path.Path
      const privateRoot = yield* privateWorkspace(owner, workspace, "apple-finish-")
      const source = yield* restorePreparedSource(input, owner, path.join(privateRoot, "source"))
      let final: FinalNativeArtifact
      if (source.kind === "app") {
        if (input._tag !== "AppPreparation") return yield* mismatch()
        const artifact = yield* Staple.stapleApp({
          source: source.artifact,
          acceptance,
          outdir: path.join(privateRoot, input.bundleName),
        })
        final = {
          kind: "app",
          artifact,
          assessment: yield* Assess.assess({ kind: "app", artifact }),
        }
      } else {
        const artifact = yield* Staple.stapleFile(
          source.kind === "dmg"
            ? {
                kind: "dmg",
                source: source.artifact,
                acceptance,
                outfile: path.join(privateRoot, "final.dmg"),
              }
            : {
                kind: "pkg",
                source: source.artifact,
                acceptance,
                outfile: path.join(privateRoot, "final.pkg"),
              },
        )
        if (source.kind === "dmg" && artifact.signature._tag === "DeveloperIdDiskImageSignature") {
          const selected = { ...artifact, signature: artifact.signature }
          final = {
            kind: "dmg",
            artifact: selected,
            assessment: yield* Assess.assess({ kind: "dmg", artifact: selected }),
          }
        } else if (
          source.kind === "pkg" &&
          artifact.signature._tag === "DeveloperIdInstallerSignature"
        ) {
          const selected = { ...artifact, signature: artifact.signature }
          final = {
            kind: "pkg",
            artifact: selected,
            assessment: yield* Assess.assess({ kind: "pkg", artifact: selected }),
          }
        } else return yield* mismatch()
      }
      const adopted =
        final.kind === "app"
          ? yield* adoptTree(owner, input.artifactName, final.artifact)
          : yield* adoptFile(owner, input.artifactName, final.artifact)
      const fields = {
        logicalName: adopted.logicalName,
        artifactBytes: Artifact.decimalBytes(
          adopted._tag === "OwnedTree" ? adopted.totalBytes : adopted.content.bytes,
        ),
        artifactDigest: Artifact.sha256Digest(
          adopted._tag === "OwnedTree" ? adopted.upstreamManifestSha256 : adopted.content.sha256,
        ),
      }
      const finalArtifact =
        final.kind === "app"
          ? new FinalApp({ ...fields, kind: "app", identityKind: "tree-manifest" })
          : final.kind === "dmg"
            ? new FinalDmg({ ...fields, kind: "dmg", identityKind: "file-bytes" })
            : new FinalPkg({ ...fields, kind: "pkg", identityKind: "file-bytes" })
      if (
        final.assessment.kind !== finalArtifact.kind ||
        final.assessment.identityKind !== finalArtifact.identityKind ||
        final.assessment.architecture !== input.architecture ||
        final.assessment.artifactBytes !== finalArtifact.artifactBytes ||
        final.assessment.artifactDigest.value !== finalArtifact.artifactDigest.value
      )
        return yield* mismatch()
      const derived = deriveDeliveryFiles ? yield* deriveDeliveryFiles(final) : []
      if (derived.some((artifact) => artifact._tag !== "OwnedFile")) return yield* mismatch()
      const outputs = yield* finalize([adopted, ...derived])
      const bytes = encodeBundle(outputs)
      const outputsBundleContent = yield* owner.putOwned(bytes)
      const stored = yield* readVerifiedContent(owner.read, outputsBundleContent, bytes.length)
      if (!sameBytes(stored, bytes)) return yield* mismatch()
      yield* loadBundle(owner, stored)
      const ready = yield* attempt(() =>
        decodeOwned(ReadyToPlan, {
          _tag: "ReadyToPlan",
          preparationId,
          acceptance,
          outputsBundleContent,
          finalArtifact,
          assessment: final.assessment,
        }),
      )
      yield* attempt(() => classifyEvidence(input, preparationId, ready, [submission]))
      return ready
    }),
  )
})
