import { Effect, Schema } from "effect"
import * as Artifact from "effect-build/Artifact"
import type * as Tool from "effect-build/Author/Tool"
import * as Native from "effect-build-apple/Model"
import * as Notary from "effect-build-apple/Notary"
import * as Assess from "effect-build-apple/Assess"
import { Content, OwnedFile, OwnedTree } from "../internal/ArtifactModel.js"
import { finalize } from "../internal/BundleFinalize.js"
import { ReleaseError, attempt, fail } from "../internal/Error.js"
import { canonical, copyData, decodeOwned, hashCanonical } from "../internal/Identity.js"

const observation = <Name extends string>(name: Name) =>
  Schema.declare<Tool.Observation<Name>>(
    (value): value is Tool.Observation<Name> =>
      Artifact.isProvenance(value) && "name" in value && value.name === name,
  )
export class ApplicationSignature extends Schema.Class<ApplicationSignature>(
  "ts-release/ApplicationSignature",
)({
  certificateSha1: Native.CertificateSha1,
  tool: observation("codesign"),
  hardenedRuntime: Schema.Literal(true),
  secureTimestamp: Schema.Literal(true),
}) {}
export class DiskImageSignature extends Schema.Class<DiskImageSignature>(
  "ts-release/DiskImageSignature",
)({
  certificateSha1: Native.CertificateSha1,
  tool: observation("codesign"),
  secureTimestamp: Schema.Literal(true),
}) {}
export class InstallerSignature extends Schema.Class<InstallerSignature>(
  "ts-release/InstallerSignature",
)({
  certificateSha1: Native.CertificateSha1,
  signer: observation("productsign"),
  verifier: observation("pkgutil"),
}) {}
const preparation = {
  format: Schema.Literal("ts-release/apple-preparation/1"),
  journalId: Schema.NonEmptyString,
  artifactName: Artifact.PortableRelativePath,
  architecture: Native.Architecture,
  principal: Schema.NonEmptyString,
  credentialRef: Schema.NonEmptyString,
  producerRevision: Schema.Literal("ef29a087baac8bdbcd90a54bb62a2dceb739dd91"),
}
export class AppPreparation extends Schema.TaggedClass<AppPreparation>()("AppPreparation", {
  ...preparation,
  source: OwnedTree,
  bundleName: Artifact.PortableRelativePath.check(Schema.isPattern(/^[^/\\]+\.app$/u)),
  signature: ApplicationSignature,
}) {}
export class DmgPreparation extends Schema.TaggedClass<DmgPreparation>()("DmgPreparation", {
  ...preparation,
  source: OwnedFile,
  signature: DiskImageSignature,
}) {}
export class PkgPreparation extends Schema.TaggedClass<PkgPreparation>()("PkgPreparation", {
  ...preparation,
  source: OwnedFile,
  signature: InstallerSignature,
}) {}
export const ApplePreparation = Schema.Union([AppPreparation, DmgPreparation, PkgPreparation])
export type ApplePreparation = typeof ApplePreparation.Type
export type ApplePreparationInput =
  | Omit<AppPreparation, "journalId">
  | Omit<DmgPreparation, "journalId">
  | Omit<PkgPreparation, "journalId">
export class ApplePreparations extends Schema.Class<ApplePreparations>(
  "ts-release/ApplePreparations",
)({
  format: Schema.Literal("ts-release/apple-preparations/1"),
  journalId: Schema.NonEmptyString,
  preparations: Schema.Array(ApplePreparation),
}) {}

/** One root owns the exact caller-ordered native inputs, before a publication
 * graph exists. No caller-authored journal identity or borrowed path is retained. */
export const createApplePreparations = Effect.fn("apple.createPreparations")(function* (
  members: readonly [ApplePreparationInput, ...ApplePreparationInput[]],
) {
  const admitted = yield* attempt(() => {
    const values = copyData(members)
    if (!Array.isArray(values) || values.length === 0)
      fail("preparation-set", "Nonempty Apple preparation inputs required")
    return values.map((value: unknown) => {
      if (!value || typeof value !== "object" || "journalId" in value)
        fail("preparation-root", "Apple journal identity must be derived")
      return decodeOwned(ApplePreparation, { ...value, journalId: "unassigned" })
    })
  })
  for (const input of admitted)
    yield* finalize([input.source]).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "preparation-source",
            message: "Apple source artifact could not be admitted",
          }),
      ),
    )
  const preimage = admitted.map(({ journalId: _, ...input }) => input)
  yield* attempt(() => {
    if (
      new Set(admitted.map((input) => input.artifactName.toLowerCase())).size !== admitted.length ||
      new Set(preimage.map(canonical)).size !== admitted.length
    )
      fail(
        "preparation-set",
        "Apple preparations require unique operations and final artifact names",
      )
  })
  const journalId = yield* hashCanonical("ts-release/apple-preparations/1", preimage)
  return yield* attempt(() =>
    decodeOwned(ApplePreparations, {
      format: "ts-release/apple-preparations/1",
      journalId,
      preparations: preimage.map((input) => ({ ...input, journalId })),
    }),
  )
})
export const loadApplePreparations = Effect.fn("apple.loadPreparations")(function* (
  value: unknown,
) {
  const decoded = yield* attempt(() => decodeOwned(ApplePreparations, value))
  const inputs = decoded.preparations.map(({ journalId: _, ...input }) => input)
  const expected = yield* createApplePreparations(
    inputs as [ApplePreparationInput, ...ApplePreparationInput[]],
  )
  yield* attempt(() => {
    if (canonical(decoded) !== canonical(expected))
      fail("preparation-root", "Apple preparation collection differs from its derived root")
  })
  return expected
})
const finalArtifact = {
  logicalName: Artifact.PortableRelativePath,
  artifactBytes: Artifact.DecimalBytesSchema,
  artifactDigest: Artifact.DigestSchema,
}
export class FinalApp extends Schema.TaggedClass<FinalApp>()("FinalApp", {
  ...finalArtifact,
  kind: Schema.Literal("app"),
  identityKind: Schema.Literal("tree-manifest"),
}) {}
export class FinalDmg extends Schema.TaggedClass<FinalDmg>()("FinalDmg", {
  ...finalArtifact,
  kind: Schema.Literal("dmg"),
  identityKind: Schema.Literal("file-bytes"),
}) {}
export class FinalPkg extends Schema.TaggedClass<FinalPkg>()("FinalPkg", {
  ...finalArtifact,
  kind: Schema.Literal("pkg"),
  identityKind: Schema.Literal("file-bytes"),
}) {}
export const FinalArtifact = Schema.Union([FinalApp, FinalDmg, FinalPkg])
export type FinalArtifact = typeof FinalArtifact.Type
export class ReadyToPlan extends Schema.TaggedClass<ReadyToPlan>()("ReadyToPlan", {
  preparationId: Schema.NonEmptyString,
  acceptance: Notary.AcceptedReference,
  outputsBundleContent: Content,
  finalArtifact: FinalArtifact,
  assessment: Assess.GatekeeperAccepted,
}) {}
export const AppleEvidence = Schema.Union([Notary.Observation, ReadyToPlan])
export type AppleEvidence = typeof AppleEvidence.Type
