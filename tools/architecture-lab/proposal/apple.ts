/** Full proposed Apple surface. Schema/signatures only; native qualification is separate. */
import { Crypto, Effect, FileSystem, Path, PlatformError, Schema } from "effect"
import * as Artifact from "effect-build/Artifact"
import * as Tool from "effect-build/Author/Tool"
import * as File from "effect-build/Author/File"
import * as Tree from "effect-build/Author/Tree"
import * as Model from "effect-build-apple/Model"
import * as Notary from "effect-build-apple/Notary"
import * as Staple from "effect-build-apple/Staple"
import * as Assess from "effect-build-apple/Assess"
import { AdoptionError, Content, OwnedFile, OwnedTree, type ContentOwner } from "./adoption-api/adoption.js"
import type { Host, JournalEvent, Plan, Scope as JournalScope, ProviderDefinition, ReleaseError, ReleaseReport, RunOptions } from "./kernel-api.js"

const observedTool = <Name extends string>(name: Name) => Schema.declare<Tool.Observation<Name>>((value): value is Tool.Observation<Name> => Artifact.isProvenance(value) && "name" in value && value.name === name)
export class ApplicationSignature extends Schema.Class<ApplicationSignature>("Apple.ApplicationSignature")({
  certificateSha1: Model.CertificateSha1, tool: observedTool("codesign"), hardenedRuntime: Schema.Literal(true), secureTimestamp: Schema.Literal(true)
}) {}
export class DiskImageSignature extends Schema.Class<DiskImageSignature>("Apple.DiskImageSignature")({
  certificateSha1: Model.CertificateSha1, tool: observedTool("codesign"), secureTimestamp: Schema.Literal(true)
}) {}
export class InstallerSignature extends Schema.Class<InstallerSignature>("Apple.InstallerSignature")({
  certificateSha1: Model.CertificateSha1, signer: observedTool("productsign"), verifier: observedTool("pkgutil")
}) {}
const common = {
  format: Schema.Literal("ts-release/apple-preparation/1"), journalId: Schema.NonEmptyString,
  artifactName: Artifact.PortableRelativePath, architecture: Model.Architecture,
  principal: Schema.NonEmptyString, credentialRef: Schema.NonEmptyString,
  producerRevision: Schema.Literal("ef29a087baac8bdbcd90a54bb62a2dceb739dd91")
}
export class AppPreparation extends Schema.TaggedClass<AppPreparation>()("AppPreparation", {
  ...common, source: OwnedTree, bundleName: Artifact.PortableRelativePath.check(Schema.isPattern(/^[^/\\]+\.app$/)), signature: ApplicationSignature
}) {}
export class DmgPreparation extends Schema.TaggedClass<DmgPreparation>()("DmgPreparation", {
  ...common, source: OwnedFile, signature: DiskImageSignature
}) {}
export class PkgPreparation extends Schema.TaggedClass<PkgPreparation>()("PkgPreparation", {
  ...common, source: OwnedFile, signature: InstallerSignature
}) {}
export const ApplePreparation = Schema.Union([AppPreparation, DmgPreparation, PkgPreparation])
export type ApplePreparation = typeof ApplePreparation.Type
export type ApplePreparationInput = Omit<AppPreparation, "journalId"> | Omit<DmgPreparation, "journalId"> | Omit<PkgPreparation, "journalId">
export class ApplePreparations extends Schema.Class<ApplePreparations>("Apple.Preparations")({
  format: Schema.Literal("ts-release/apple-preparations/1"), journalId: Schema.NonEmptyString,
  preparations: Schema.Array(ApplePreparation).check(Schema.isMinLength(1))
}) {}
/** Identity hashes the exact caller-ordered members without derived journalId fields.
 * Reject duplicate member operations or case-colliding final artifactName values.
 * No user-authored journalId or future graph is admitted. */
export declare const createApplePreparations: (members: readonly [ApplePreparationInput, ...ApplePreparationInput[]]) => Effect.Effect<ApplePreparations, ReleaseError>
/** Strictly decode/recompute the collection hash and every member root before effects. */
export declare const loadApplePreparations: (value: unknown) => Effect.Effect<ApplePreparations, ReleaseError>
export class FinalApp extends Schema.TaggedClass<FinalApp>()("FinalApp", {
  kind: Schema.Literal("app"), identityKind: Schema.Literal("tree-manifest"), logicalName: Artifact.PortableRelativePath,
  artifactBytes: Artifact.DecimalBytesSchema, artifactDigest: Artifact.DigestSchema
}) {}
export class FinalDmg extends Schema.TaggedClass<FinalDmg>()("FinalDmg", {
  kind: Schema.Literal("dmg"), identityKind: Schema.Literal("file-bytes"), logicalName: Artifact.PortableRelativePath,
  artifactBytes: Artifact.DecimalBytesSchema, artifactDigest: Artifact.DigestSchema
}) {}
export class FinalPkg extends Schema.TaggedClass<FinalPkg>()("FinalPkg", {
  kind: Schema.Literal("pkg"), identityKind: Schema.Literal("file-bytes"), logicalName: Artifact.PortableRelativePath,
  artifactBytes: Artifact.DecimalBytesSchema, artifactDigest: Artifact.DigestSchema
}) {}
export const FinalArtifact = Schema.Union([FinalApp, FinalDmg, FinalPkg])
export type FinalArtifact = typeof FinalArtifact.Type
export class ReadyToPlan extends Schema.TaggedClass<ReadyToPlan>()("ReadyToPlan", {
  preparationId: Schema.NonEmptyString, acceptance: Notary.AcceptedReference,
  outputsBundleContent: Content, finalArtifact: FinalArtifact, assessment: Assess.GatekeeperAccepted
}) {}
export const AppleEvidence = Schema.Union([Notary.Observation, ReadyToPlan])
export type AppleEvidence = typeof AppleEvidence.Type
export type RestoredSource =
  | { readonly kind: "app"; readonly artifact: Model.DeveloperIdApplicationBundle }
  | { readonly kind: "dmg"; readonly artifact: Model.DeveloperIdDiskImage }
  | { readonly kind: "pkg"; readonly artifact: Model.DeveloperIdInstallerPackage }
export type FinalNativeArtifact =
  | { readonly kind: "app"; readonly artifact: Model.StapledApplicationBundle; readonly assessment: Assess.GatekeeperAccepted }
  | { readonly kind: "dmg"; readonly artifact: Model.StapledDiskImage; readonly assessment: Assess.GatekeeperAccepted }
  | { readonly kind: "pkg"; readonly artifact: Model.StapledInstallerPackage; readonly assessment: Assess.GatekeeperAccepted }
export type NativeAppleError = ReleaseError | AdoptionError | Schema.SchemaError | PlatformError.PlatformError | File.PublicationFailure | File.FileVerificationFailed | Tree.PublicationFailure | Tree.TreeVerificationFailed | Model.ProductStateInvalid | Notary.SubmitAppError | Notary.ObserveError | Staple.StapleError | Assess.AssessError
export type NativeAppleServices = Crypto.Crypto | FileSystem.FileSystem | Path.Path | Notary.Client | Staple.Stapler | Assess.Assessor
/** The callback constructs only already finalized owned delivery Files from the
 * actual stapled/assessed native artifact. It runs before Ready selection; outputs
 * are not inferred to have Gatekeeper acceptance merely from callback return. */
export type DeriveDeliveryFiles<R = never> = (final: FinalNativeArtifact) => Effect.Effect<readonly OwnedFile[], NativeAppleError, R>
export declare const restorePreparedSource: (input: ApplePreparation, owner: ContentOwner, workspace: string) => Effect.Effect<RestoredSource, NativeAppleError, Crypto.Crypto | FileSystem.FileSystem | Path.Path>
/** App uses native Notary.submitApp; DMG/pkg use native Notary.submit with
 * exact discriminated source. Called only by the authorized opaque dispatch. */
export declare const submitPrepared: (input: ApplePreparation, owner: ContentOwner, workspace: string) => Effect.Effect<Notary.Submission, NativeAppleError, Crypto.Crypto | FileSystem.FileSystem | Path.Path | Notary.Client>
/** Polls only the accepted recorded submission identity; never submits again.
 * On acceptance: native stapleApp/stapleFile, Assess.assess, adopt final native
 * artifact and optional delivery files, persist one immutable output subbundle.
 * CAS in runPreparation selects exactly one ReadyToPlan for that operation. */
export declare function finishPrepared<R = never>(input: ApplePreparation, submission: Notary.Submission, preparationId: string, owner: ContentOwner, workspace: string, deriveDeliveryFiles?: DeriveDeliveryFiles<R>): Effect.Effect<AppleEvidence, NativeAppleError, NativeAppleServices | R>
export declare const preparationProvider: ProviderDefinition
export declare const preparationScopes: (inputs: ApplePreparations) => Effect.Effect<readonly Extract<JournalScope, { readonly _tag: "PreparationScope" }>[], ReleaseError>
/** Runs exactly one selected member through the common machine and physical
 * journal. The full immutable collection is admitted before selecting a member. */
export declare function runPreparation(inputs: ApplePreparations, preparationId: string, options: Omit<RunOptions, "plan">, complete: (submission: Notary.Submission, preparationId: string) => Effect.Effect<AppleEvidence, ReleaseError>): Effect.Effect<void, ReleaseError, Host>
/** Every selected Ready output member must appear byte-for-byte in the admitted
 * full final Bundle. Additional non-Apple members are allowed. Plan.bundleId is
 * finalBundleContent.sha256 and Plan.journalId is inputs.journalId. Exactly one
 * final publication scope is admitted beside the preparation scopes. */
export declare const validateApplePublication: (inputs: ApplePreparations, publication: Plan, finalBundleContent: Content, owner: ContentOwner) => Effect.Effect<readonly ReadyToPlan[], NativeAppleError, Crypto.Crypto | Host>
export declare const reportAppleContext: (inputs: ApplePreparations, owner: ContentOwner, publication?: { readonly plan: Plan; readonly finalBundleContent: Content }) => Effect.Effect<{ readonly journalId: string; readonly revision: number; readonly preparations: readonly ReleaseReport[]; readonly nativeFacts: readonly JournalEvent[]; readonly publication?: ReleaseReport }, NativeAppleError, Crypto.Crypto | Host>
