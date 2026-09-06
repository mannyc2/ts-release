/** Full proposed Apple surface. Schema/signatures only; native qualification is separate. */
import { Crypto, Effect, FileSystem, Path, PlatformError, Schema } from "effect";
import * as Artifact from "effect-build/Artifact";
import * as Tool from "effect-build/Author/Tool";
import * as File from "effect-build/Author/File";
import * as Tree from "effect-build/Author/Tree";
import * as Model from "effect-build-apple/Model";
import * as Notary from "effect-build-apple/Notary";
import * as Staple from "effect-build-apple/Staple";
import * as Assess from "effect-build-apple/Assess";
import { AdoptionError, Content, OwnedFile, OwnedTree, type ContentOwner } from "./adoption-api/adoption.js";
import type { Host, JournalEvent, Plan, Scope as JournalScope, ProviderDefinition, ReleaseError, ReleaseReport, RunOptions } from "./kernel-api.js";
declare const ApplicationSignature_base: Schema.Class<ApplicationSignature, Schema.Struct<{
    readonly certificateSha1: Schema.String;
    readonly tool: Schema.declare<Tool.Observation<"codesign">, Tool.Observation<"codesign">>;
    readonly hardenedRuntime: Schema.Literal<true>;
    readonly secureTimestamp: Schema.Literal<true>;
}>, {}>;
export declare class ApplicationSignature extends ApplicationSignature_base {
}
declare const DiskImageSignature_base: Schema.Class<DiskImageSignature, Schema.Struct<{
    readonly certificateSha1: Schema.String;
    readonly tool: Schema.declare<Tool.Observation<"codesign">, Tool.Observation<"codesign">>;
    readonly secureTimestamp: Schema.Literal<true>;
}>, {}>;
export declare class DiskImageSignature extends DiskImageSignature_base {
}
declare const InstallerSignature_base: Schema.Class<InstallerSignature, Schema.Struct<{
    readonly certificateSha1: Schema.String;
    readonly signer: Schema.declare<Tool.Observation<"productsign">, Tool.Observation<"productsign">>;
    readonly verifier: Schema.declare<Tool.Observation<"pkgutil">, Tool.Observation<"pkgutil">>;
}>, {}>;
export declare class InstallerSignature extends InstallerSignature_base {
}
declare const AppPreparation_base: Schema.Class<AppPreparation, Schema.TaggedStruct<"AppPreparation", {
    readonly source: typeof OwnedTree;
    readonly bundleName: Schema.brand<Schema.String, "effect-build/Artifact/PortableRelativePath">;
    readonly signature: typeof ApplicationSignature;
    readonly format: Schema.Literal<"ts-release/apple-preparation/1">;
    readonly journalId: Schema.NonEmptyString;
    readonly artifactName: Schema.brand<Schema.String, "effect-build/Artifact/PortableRelativePath">;
    readonly architecture: Schema.Literals<readonly ["arm64", "x64"]>;
    readonly principal: Schema.NonEmptyString;
    readonly credentialRef: Schema.NonEmptyString;
    readonly producerRevision: Schema.Literal<"ef29a087baac8bdbcd90a54bb62a2dceb739dd91">;
}>, {}>;
export declare class AppPreparation extends AppPreparation_base {
}
declare const DmgPreparation_base: Schema.Class<DmgPreparation, Schema.TaggedStruct<"DmgPreparation", {
    readonly source: typeof OwnedFile;
    readonly signature: typeof DiskImageSignature;
    readonly format: Schema.Literal<"ts-release/apple-preparation/1">;
    readonly journalId: Schema.NonEmptyString;
    readonly artifactName: Schema.brand<Schema.String, "effect-build/Artifact/PortableRelativePath">;
    readonly architecture: Schema.Literals<readonly ["arm64", "x64"]>;
    readonly principal: Schema.NonEmptyString;
    readonly credentialRef: Schema.NonEmptyString;
    readonly producerRevision: Schema.Literal<"ef29a087baac8bdbcd90a54bb62a2dceb739dd91">;
}>, {}>;
export declare class DmgPreparation extends DmgPreparation_base {
}
declare const PkgPreparation_base: Schema.Class<PkgPreparation, Schema.TaggedStruct<"PkgPreparation", {
    readonly source: typeof OwnedFile;
    readonly signature: typeof InstallerSignature;
    readonly format: Schema.Literal<"ts-release/apple-preparation/1">;
    readonly journalId: Schema.NonEmptyString;
    readonly artifactName: Schema.brand<Schema.String, "effect-build/Artifact/PortableRelativePath">;
    readonly architecture: Schema.Literals<readonly ["arm64", "x64"]>;
    readonly principal: Schema.NonEmptyString;
    readonly credentialRef: Schema.NonEmptyString;
    readonly producerRevision: Schema.Literal<"ef29a087baac8bdbcd90a54bb62a2dceb739dd91">;
}>, {}>;
export declare class PkgPreparation extends PkgPreparation_base {
}
export declare const ApplePreparation: Schema.Union<readonly [typeof AppPreparation, typeof DmgPreparation, typeof PkgPreparation]>;
export type ApplePreparation = typeof ApplePreparation.Type;
export type ApplePreparationInput = Omit<AppPreparation, "journalId"> | Omit<DmgPreparation, "journalId"> | Omit<PkgPreparation, "journalId">;
declare const ApplePreparations_base: Schema.Class<ApplePreparations, Schema.Struct<{
    readonly format: Schema.Literal<"ts-release/apple-preparations/1">;
    readonly journalId: Schema.NonEmptyString;
    readonly preparations: Schema.$Array<Schema.Union<readonly [typeof AppPreparation, typeof DmgPreparation, typeof PkgPreparation]>>;
}>, {}>;
export declare class ApplePreparations extends ApplePreparations_base {
}
/** Identity hashes the exact caller-ordered members without derived journalId fields.
 * Reject duplicate member operations or case-colliding final artifactName values.
 * No user-authored journalId or future graph is admitted. */
export declare const createApplePreparations: (members: readonly [ApplePreparationInput, ...ApplePreparationInput[]]) => Effect.Effect<ApplePreparations, ReleaseError>;
/** Strictly decode/recompute the collection hash and every member root before effects. */
export declare const loadApplePreparations: (value: unknown) => Effect.Effect<ApplePreparations, ReleaseError>;
declare const FinalApp_base: Schema.Class<FinalApp, Schema.TaggedStruct<"FinalApp", {
    readonly kind: Schema.Literal<"app">;
    readonly identityKind: Schema.Literal<"tree-manifest">;
    readonly logicalName: Schema.brand<Schema.String, "effect-build/Artifact/PortableRelativePath">;
    readonly artifactBytes: Schema.declare<Artifact.DecimalBytes, Artifact.DecimalBytes>;
    readonly artifactDigest: Schema.declare<Artifact.Digest, Artifact.Digest>;
}>, {}>;
export declare class FinalApp extends FinalApp_base {
}
declare const FinalDmg_base: Schema.Class<FinalDmg, Schema.TaggedStruct<"FinalDmg", {
    readonly kind: Schema.Literal<"dmg">;
    readonly identityKind: Schema.Literal<"file-bytes">;
    readonly logicalName: Schema.brand<Schema.String, "effect-build/Artifact/PortableRelativePath">;
    readonly artifactBytes: Schema.declare<Artifact.DecimalBytes, Artifact.DecimalBytes>;
    readonly artifactDigest: Schema.declare<Artifact.Digest, Artifact.Digest>;
}>, {}>;
export declare class FinalDmg extends FinalDmg_base {
}
declare const FinalPkg_base: Schema.Class<FinalPkg, Schema.TaggedStruct<"FinalPkg", {
    readonly kind: Schema.Literal<"pkg">;
    readonly identityKind: Schema.Literal<"file-bytes">;
    readonly logicalName: Schema.brand<Schema.String, "effect-build/Artifact/PortableRelativePath">;
    readonly artifactBytes: Schema.declare<Artifact.DecimalBytes, Artifact.DecimalBytes>;
    readonly artifactDigest: Schema.declare<Artifact.Digest, Artifact.Digest>;
}>, {}>;
export declare class FinalPkg extends FinalPkg_base {
}
export declare const FinalArtifact: Schema.Union<readonly [typeof FinalApp, typeof FinalDmg, typeof FinalPkg]>;
export type FinalArtifact = typeof FinalArtifact.Type;
declare const ReadyToPlan_base: Schema.Class<ReadyToPlan, Schema.TaggedStruct<"ReadyToPlan", {
    readonly preparationId: Schema.NonEmptyString;
    readonly acceptance: typeof Notary.AcceptedReference;
    readonly outputsBundleContent: typeof Content;
    readonly finalArtifact: Schema.Union<readonly [typeof FinalApp, typeof FinalDmg, typeof FinalPkg]>;
    readonly assessment: typeof Assess.GatekeeperAccepted;
}>, {}>;
export declare class ReadyToPlan extends ReadyToPlan_base {
}
export declare const AppleEvidence: Schema.Union<readonly [typeof Notary.Observation, typeof ReadyToPlan]>;
export type AppleEvidence = typeof AppleEvidence.Type;
export type RestoredSource = {
    readonly kind: "app";
    readonly artifact: Model.DeveloperIdApplicationBundle;
} | {
    readonly kind: "dmg";
    readonly artifact: Model.DeveloperIdDiskImage;
} | {
    readonly kind: "pkg";
    readonly artifact: Model.DeveloperIdInstallerPackage;
};
export type FinalNativeArtifact = {
    readonly kind: "app";
    readonly artifact: Model.StapledApplicationBundle;
    readonly assessment: Assess.GatekeeperAccepted;
} | {
    readonly kind: "dmg";
    readonly artifact: Model.StapledDiskImage;
    readonly assessment: Assess.GatekeeperAccepted;
} | {
    readonly kind: "pkg";
    readonly artifact: Model.StapledInstallerPackage;
    readonly assessment: Assess.GatekeeperAccepted;
};
export type NativeAppleError = ReleaseError | AdoptionError | Schema.SchemaError | PlatformError.PlatformError | File.PublicationFailure | File.FileVerificationFailed | Tree.PublicationFailure | Tree.TreeVerificationFailed | Model.ProductStateInvalid | Notary.SubmitAppError | Notary.ObserveError | Staple.StapleError | Assess.AssessError;
export type NativeAppleServices = Crypto.Crypto | FileSystem.FileSystem | Path.Path | Notary.Client | Staple.Stapler | Assess.Assessor;
/** The callback constructs only already finalized owned delivery Files from the
 * actual stapled/assessed native artifact. It runs before Ready selection; outputs
 * are not inferred to have Gatekeeper acceptance merely from callback return. */
export type DeriveDeliveryFiles<R = never> = (final: FinalNativeArtifact) => Effect.Effect<readonly OwnedFile[], NativeAppleError, R>;
export declare const restorePreparedSource: (input: ApplePreparation, owner: ContentOwner, workspace: string) => Effect.Effect<RestoredSource, NativeAppleError, Crypto.Crypto | FileSystem.FileSystem | Path.Path>;
/** App uses native Notary.submitApp; DMG/pkg use native Notary.submit with
 * exact discriminated source. Called only by the authorized opaque dispatch. */
export declare const submitPrepared: (input: ApplePreparation, owner: ContentOwner, workspace: string) => Effect.Effect<Notary.Submission, NativeAppleError, Crypto.Crypto | FileSystem.FileSystem | Path.Path | Notary.Client>;
/** Polls only the accepted recorded submission identity; never submits again.
 * On acceptance: native stapleApp/stapleFile, Assess.assess, adopt final native
 * artifact and optional delivery files, persist one immutable output subbundle.
 * CAS in runPreparation selects exactly one ReadyToPlan for that operation. */
export declare function finishPrepared<R = never>(input: ApplePreparation, submission: Notary.Submission, preparationId: string, owner: ContentOwner, workspace: string, deriveDeliveryFiles?: DeriveDeliveryFiles<R>): Effect.Effect<AppleEvidence, NativeAppleError, NativeAppleServices | R>;
export declare const preparationProvider: ProviderDefinition;
export declare const preparationScopes: (inputs: ApplePreparations) => Effect.Effect<readonly Extract<JournalScope, {
    readonly _tag: "PreparationScope";
}>[], ReleaseError>;
/** Runs exactly one selected member through the common machine and physical
 * journal. The full immutable collection is admitted before selecting a member. */
export declare function runPreparation(inputs: ApplePreparations, preparationId: string, options: Omit<RunOptions, "plan">, complete: (submission: Notary.Submission, preparationId: string) => Effect.Effect<AppleEvidence, ReleaseError>): Effect.Effect<void, ReleaseError, Host>;
/** Every selected Ready output member must appear byte-for-byte in the admitted
 * full final Bundle. Additional non-Apple members are allowed. Plan.bundleId is
 * finalBundleContent.sha256 and Plan.journalId is inputs.journalId. Exactly one
 * final publication scope is admitted beside the preparation scopes. */
export declare const validateApplePublication: (inputs: ApplePreparations, publication: Plan, finalBundleContent: Content, owner: ContentOwner) => Effect.Effect<readonly ReadyToPlan[], NativeAppleError, Crypto.Crypto | Host>;
export declare const reportAppleContext: (inputs: ApplePreparations, owner: ContentOwner, publication?: {
    readonly plan: Plan;
    readonly finalBundleContent: Content;
}) => Effect.Effect<{
    readonly journalId: string;
    readonly revision: number;
    readonly preparations: readonly ReleaseReport[];
    readonly nativeFacts: readonly JournalEvent[];
    readonly publication?: ReleaseReport;
}, NativeAppleError, Crypto.Crypto | Host>;
export {};
