import { Effect, Schema } from "effect"
import * as Apple from "effect-build-apple"
import { Content, LogicalName, OwnedFile, OwnedTree } from "../internal/ArtifactModel.js"
import { finalize } from "../internal/BundleFinalize.js"
import { attempt, fail, failure } from "../internal/Error.js"
import { canonical, copyData, decodeOwned, hashCanonical } from "../internal/Identity.js"

/** Format 1 recorded effect-build-apple 0.6 signatures and tool observations; it is not loadable. */
export const PREPARATION_FORMAT = "ts-release/apple-preparation/2"
export const PREPARATIONS_FORMAT = "ts-release/apple-preparations/2"
/** The effect-build-apple contract a preparation was prepared against. */
export const PRODUCER_VERSION = "0.7.0"
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
const RETIRED_FORMATS = ["ts-release/apple-preparations/1"]
export const loadApplePreparations = Effect.fn("apple.loadPreparations")(function* (
  value: unknown,
) {
  const decoded = yield* attempt(() => {
    const format =
      typeof value === "object" && value !== null && "format" in value ? value.format : undefined
    if (typeof format === "string" && RETIRED_FORMATS.includes(format))
      fail(
        "preparation-format",
        `Apple preparation format ${format} records effect-build-apple 0.6 evidence; prepare the sources again with ${PRODUCER_VERSION}`,
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

/** The stapled product exactly as Gatekeeper accepted it, in effect-build-apple's
 * schema; its ticket is the notarization acceptance it was stapled from. */
export const StapledApp = Schema.Struct({
  ...Apple.SignedApp.fields,
  ticket: Apple.Notary.AcceptedReference,
}).check(
  Schema.makeFilter((value) =>
    Schema.is(Apple.SignedApp)(value) ? undefined : "invalid signed app artifact",
  ),
)
export const StapledDmg = Schema.Struct({
  ...Apple.SignedDmg.fields,
  ticket: Apple.Notary.AcceptedReference,
})
export const StapledPkg = Schema.Struct({
  ...Apple.SignedPkg.fields,
  ticket: Apple.Notary.AcceptedReference,
})
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
