import { Effect, Schema } from "effect"
import * as Artifact from "effect-build/Artifact"
import * as Apple from "effect-build-apple"
import { Content, LogicalName, OwnedFile, OwnedTree } from "../internal/ArtifactModel.js"
import { finalize } from "../internal/BundleFinalize.js"
import { attempt, fail, failure } from "../internal/Error.js"
import { canonical, copyData, decodeOwned, hashCanonical } from "../internal/Identity.js"

/** Earlier formats retain retired provider evidence and must be prepared again. */
export const PREPARATION_FORMAT = "ts-release/apple-preparation/3"
export const PREPARATIONS_FORMAT = "ts-release/apple-preparations/3"
/** The effect-build-apple contract a preparation was prepared against. */
export const PRODUCER_VERSION = "0.8.0"
export const Product = Schema.Literals(["app", "dmg", "pkg"])
export type Product = typeof Product.Type
/** Signing evidence in effect-build-apple's own shape: apps carry the hardened runtime. */
export const ApplicationSignature = Apple.SignedApp.fields.signature
export const ProductSignature = Apple.SignedDmg.fields.signature

const preparation = {
  format: Schema.Literal(PREPARATION_FORMAT),
  journalId: Schema.NonEmptyString,
  artifactName: LogicalName,
  principal: Schema.NonEmptyString,
  credentialRef: Schema.NonEmptyString,
  producerVersion: Schema.Literal(PRODUCER_VERSION),
}
export class AppPreparation extends Schema.TaggedClass<AppPreparation>()("AppPreparation", {
  ...preparation,
  source: OwnedTree,
  bundleName: LogicalName.check(Schema.isPattern(/^[^/]+\.app$/u)),
  signature: ApplicationSignature,
}) {}
export class DmgPreparation extends Schema.TaggedClass<DmgPreparation>()("DmgPreparation", {
  ...preparation,
  source: OwnedFile,
  signature: ProductSignature,
}) {}
export class PkgPreparation extends Schema.TaggedClass<PkgPreparation>()("PkgPreparation", {
  ...preparation,
  source: OwnedFile,
  signature: ProductSignature,
}) {}
export const ApplePreparation = Schema.Union([AppPreparation, DmgPreparation, PkgPreparation])
export type ApplePreparation = typeof ApplePreparation.Type
export type ApplePreparationInput =
  | Omit<AppPreparation, "journalId">
  | Omit<DmgPreparation, "journalId">
  | Omit<PkgPreparation, "journalId">
export const productOf = (input: ApplePreparation): Product =>
  input._tag === "AppPreparation" ? "app" : input._tag === "DmgPreparation" ? "dmg" : "pkg"
/** The size and digest a preparation's source must present wherever it appears. */
export const sourceIdentity = (input: ApplePreparation): Content =>
  input._tag === "AppPreparation"
    ? new Content({ bytes: input.source.bytes, sha256: input.source.sha256 })
    : input.source.content

export class ApplePreparations extends Schema.Class<ApplePreparations>(
  "ts-release/ApplePreparations",
)({
  format: Schema.Literal(PREPARATIONS_FORMAT),
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
      Effect.mapError(() => failure("preparation-source", "Apple source artifact is invalid")),
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
  const journalId = yield* hashCanonical(PREPARATIONS_FORMAT, preimage)
  return yield* attempt(() =>
    decodeOwned(ApplePreparations, {
      format: PREPARATIONS_FORMAT,
      journalId,
      preparations: preimage.map((input) => ({ ...input, journalId })),
    }),
  )
})
const RETIRED_FORMATS = ["ts-release/apple-preparations/1", "ts-release/apple-preparations/2"]
export const loadApplePreparations = Effect.fn("apple.loadPreparations")(function* (
  value: unknown,
) {
  const decoded = yield* attempt(() => {
    const format =
      typeof value === "object" && value !== null && "format" in value ? value.format : undefined
    if (typeof format === "string" && RETIRED_FORMATS.includes(format))
      fail(
        "preparation-format",
        `Apple preparation format ${format} records retired effect-build-apple evidence; prepare the sources again with ${PRODUCER_VERSION}`,
      )
    return decodeOwned(ApplePreparations, value)
  })
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

// Release-owned evidence composes upstream identity and signing contracts.
export const SignedApp = Artifact.HashedDirectory.pipe(
  Schema.fieldsAssign({
    product: Apple.SignedApp.fields.product,
    signature: Apple.SignedApp.fields.signature,
  }),
).check(
  Schema.makeFilter((value) =>
    Schema.is(Apple.SignedApp)(value) ? undefined : "invalid signed app artifact",
  ),
)
export const SignedDmg = Artifact.HashedFile.pipe(
  Schema.fieldsAssign({
    product: Apple.SignedDmg.fields.product,
    signature: Apple.SignedDmg.fields.signature,
  }),
)
export const SignedPkg = Artifact.HashedFile.pipe(
  Schema.fieldsAssign({
    product: Apple.SignedPkg.fields.product,
    signature: Apple.SignedPkg.fields.signature,
  }),
)
export const SignedProduct = Schema.Union([SignedApp, SignedDmg, SignedPkg])
export type SignedProduct = typeof SignedProduct.Type
export const SubmissionReference = Schema.Struct({
  submissionId: Schema.NonEmptyString,
  kind: Schema.Literals(["zip", "dmg", "pkg"]),
  artifact: SignedProduct,
})
export type SubmissionReference = typeof SubmissionReference.Type
export const AcceptedReference = SubmissionReference.pipe(
  Schema.fieldsAssign({ status: Apple.Notary.Accepted }),
)
export type AcceptedReference = typeof AcceptedReference.Type
/** Release-owned final identity, signature metadata, and accepted submission binding. */
export const StapledApp = SignedApp.pipe(Schema.fieldsAssign({ ticket: AcceptedReference }))
export const StapledDmg = SignedDmg.pipe(Schema.fieldsAssign({ ticket: AcceptedReference }))
export const StapledPkg = SignedPkg.pipe(Schema.fieldsAssign({ ticket: AcceptedReference }))
export const StapledProduct = Schema.Union([StapledApp, StapledDmg, StapledPkg])
export type StapledProduct = typeof StapledProduct.Type
/** The owned final artifact a preparation selected. */
export const FinalArtifact = Schema.Struct({
  product: Product,
  logicalName: LogicalName,
  identity: Content,
})
export type FinalArtifact = typeof FinalArtifact.Type
export class ReadyToPlan extends Schema.TaggedClass<ReadyToPlan>()("ReadyToPlan", {
  preparationId: Schema.NonEmptyString,
  assessed: StapledProduct,
  finalArtifact: FinalArtifact,
  outputsBundleContent: Content,
}) {}
/** A notarization still in progress or rejected is observed through Apple's own record. */
export const AppleEvidence = Schema.Union([Apple.Notary.Info, ReadyToPlan])
export type AppleEvidence = typeof AppleEvidence.Type
