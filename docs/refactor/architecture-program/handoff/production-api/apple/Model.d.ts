import { Effect, Schema } from "effect";
import * as Artifact from "effect-build/Artifact";
import type * as Tool from "effect-build/Author/Tool";
import * as Notary from "effect-build-apple/Notary";
import * as Assess from "effect-build-apple/Assess";
import { Content, OwnedFile, OwnedTree } from "../internal/ArtifactModel.js";
import { ReleaseError } from "../internal/Error.js";
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
/** One root owns the exact caller-ordered native inputs, before a publication
 * graph exists. No caller-authored journal identity or borrowed path is retained. */
export declare const createApplePreparations: (members: readonly [ApplePreparationInput, ...ApplePreparationInput[]]) => Effect.Effect<ApplePreparations, ReleaseError, never>;
export declare const loadApplePreparations: (value: unknown) => Effect.Effect<ApplePreparations, ReleaseError, never>;
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
export {};
