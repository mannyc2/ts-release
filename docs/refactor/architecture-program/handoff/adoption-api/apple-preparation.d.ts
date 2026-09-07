/** Compiler-derived research shape adapted to the proposed production contract.
 * Target durable formats and selected producer pin differ from the frozen research
 * bytes. No production implementation or native acceptance is claimed. */
import { Effect, FileSystem, Schema } from "effect";
import * as Artifact from "effect-build/Artifact";
import * as Tool from "effect-build/Author/Tool";
import * as Tree from "effect-build/Author/Tree";
import * as Model from "effect-build-apple/Model";
import * as Notary from "effect-build-apple/Notary";
import * as Staple from "effect-build-apple/Staple";
import * as Assess from "effect-build-apple/Assess";
import { Content, OwnedTree, type ContentOwner } from "./adoption.js";
import { Host, ReleaseError, type Plan, type ProviderDefinition, type RunOptions } from "../kernel-api.js";
declare const ApplicationSignature_base: Schema.Class<ApplicationSignature, Schema.Struct<{
    readonly certificateSha1: Schema.String;
    readonly tool: Schema.declare<Tool.Observation<"codesign">, Tool.Observation<"codesign">>;
    readonly hardenedRuntime: Schema.Literal<true>;
    readonly secureTimestamp: Schema.Literal<true>;
}>, {}>;
/** Consumer-owned durable projection: upstream Model signature is not a Schema. */
export declare class ApplicationSignature extends ApplicationSignature_base {
}
declare const ApplePreparation_base: Schema.Class<ApplePreparation, Schema.Struct<{
    readonly format: Schema.Literal<"ts-release/apple-preparation/1">;
    readonly journalId: Schema.NonEmptyString;
    readonly bundleName: Schema.brand<Schema.String, "effect-build/Artifact/PortableRelativePath">;
    readonly source: typeof OwnedTree;
    readonly architecture: Schema.Literals<readonly ["arm64", "x64"]>;
    readonly signature: typeof ApplicationSignature;
    readonly principal: Schema.NonEmptyString;
    readonly credentialRef: Schema.NonEmptyString;
    readonly producerRevision: Schema.Literal<"ef29a087baac8bdbcd90a54bb62a2dceb739dd91">;
}>, {}>;
/** Fixed native request, without destinations, operation graph, or derived plan recipe. */
export declare class ApplePreparation extends ApplePreparation_base {
}
declare const ReadyToPlan_base: Schema.Class<ReadyToPlan, Schema.TaggedStruct<"ReadyToPlan", {
    readonly preparationId: Schema.String;
    readonly acceptance: typeof Notary.AcceptedReference;
    readonly bundleContent: typeof Content;
    readonly finalTree: Schema.Struct<{
        readonly logicalName: Schema.brand<Schema.String, "effect-build/Artifact/PortableRelativePath">;
        readonly totalBytes: Schema.declare<Artifact.DecimalBytes, Artifact.DecimalBytes>;
        readonly manifestSha256: Schema.String;
    }>;
    readonly assessment: typeof Assess.GatekeeperAccepted;
}>, {}>;
export declare class ReadyToPlan extends ReadyToPlan_base {
}
export declare const AppleEvidence: Schema.Union<readonly [typeof Notary.Observation, typeof ReadyToPlan]>;
/** Owned source bytes are restored into a new upstream-finalized private tree. */
export declare const restoreSource: (input: ApplePreparation, owner: ContentOwner, outdir: string) => Effect.Effect<Model.DeveloperIdApplicationBundle, Schema.SchemaError | Tree.Failure<import("effect/PlatformError").PlatformError | import("./adoption.js").AdoptionError, never> | ReleaseError, FileSystem.FileSystem | import("effect/Path").Path | import("effect/Crypto").Crypto>;
export declare const preparationProvider: ProviderDefinition;
/** Public Notary.submitApp performs its ZIP creation internally; no wire claim. */
export declare const submitPreparedApp: (input: ApplePreparation, owner: ContentOwner, outdir: string) => Effect.Effect<Notary.Submission, Schema.SchemaError | Tree.Failure<import("effect/PlatformError").PlatformError | import("./adoption.js").AdoptionError, never> | Notary.SubmitAppError | ReleaseError, FileSystem.FileSystem | import("effect/Path").Path | import("effect/Crypto").Crypto | Notary.Client>;
/** Polling uses the persisted public submission. It never guesses a missing ID. */
export declare const finishPreparedApp: (preparationId: string, input: ApplePreparation, submission: Notary.Submission, owner: ContentOwner, sourceDir: string, outputDir: string) => Effect.Effect<{
    status: "Pending" | "Conflict";
    evidence: {
        readonly status: {
            readonly _tag: "Pending";
            readonly providerStatus: string;
        } | {
            readonly _tag: "Accepted";
            readonly providerStatus: "Accepted";
        } | {
            readonly _tag: "Rejected";
            readonly providerStatus: string;
            readonly summary?: string;
        };
        readonly kind: "dmg" | "pkg" | "zip";
        readonly tool: Tool.Observation<"notarytool">;
        readonly artifactBytes: Artifact.DecimalBytes;
        readonly artifactDigest: Artifact.Digest;
        readonly submissionId: string;
        readonly architecture: "x64" | "arm64";
        readonly submissionTool: Tool.Observation<"notarytool">;
        readonly name?: string;
        readonly message?: string;
        readonly stapleTarget?: {
            readonly kind: "app" | "dmg" | "pkg";
            readonly identityKind: "file-bytes" | "tree-manifest";
            readonly artifactBytes: Artifact.DecimalBytes;
            readonly artifactDigest: Artifact.Digest;
            readonly bundleName?: string;
        };
        readonly transportTool?: Tool.Observation<"ditto">;
        readonly createdDate?: string;
    };
} | {
    status: "Satisfied";
    evidence: {
        readonly _tag: "ReadyToPlan";
        readonly preparationId: string;
        readonly acceptance: {
            readonly kind: "dmg" | "pkg" | "zip";
            readonly tool: Tool.Observation<"notarytool">;
            readonly providerStatus: "Accepted";
            readonly artifactBytes: Artifact.DecimalBytes;
            readonly artifactDigest: Artifact.Digest;
            readonly submissionId: string;
            readonly architecture: "x64" | "arm64";
            readonly submissionTool: Tool.Observation<"notarytool">;
            readonly stapleTarget: {
                readonly kind: "app" | "dmg" | "pkg";
                readonly identityKind: "file-bytes" | "tree-manifest";
                readonly artifactBytes: Artifact.DecimalBytes;
                readonly artifactDigest: Artifact.Digest;
                readonly bundleName?: string;
            };
            readonly transportTool?: Tool.Observation<"ditto">;
        };
        readonly bundleContent: {
            readonly bytes: string;
            readonly sha256: string;
        };
        readonly finalTree: {
            readonly logicalName: string;
            readonly totalBytes: Artifact.DecimalBytes;
            readonly manifestSha256: string;
        };
        readonly assessment: {
            readonly kind: "app" | "dmg" | "pkg";
            readonly architecture: "x64" | "arm64";
            readonly identityKind: "file-bytes" | "tree-manifest";
            readonly artifactBytes: Artifact.DecimalBytes;
            readonly artifactDigest: Artifact.Digest;
            readonly accepted: true;
            readonly gatekeeper: Tool.Observation<string>;
            readonly structuralVerifier: Tool.Observation<string>;
        };
    };
}, Schema.SchemaError | import("effect/PlatformError").PlatformError | Tree.TreeDestinationInvalid | Tree.TreeCandidateMissing | Tree.TreeCandidateChanged | Tree.TreeDestinationLocked | Tree.TreeCommitFailed | Tree.TreeVerificationFailed | import("./adoption.js").AdoptionError | Model.ProductStateInvalid | import("effect-build/Author/File").FileDestinationInvalid | import("effect-build/Author/File").FileCandidateMissing | import("effect-build/Author/File").FileCandidateChanged | import("effect-build/Author/File").FileDestinationLocked | import("effect-build/Author/File").FileCommitFailed | import("effect-build/Author/File").FileVerificationFailed | Notary.AppleToolChanged | Notary.AppleToolFailed | Notary.AppleOperationInvalid | Notary.ResultNotAccepted | Notary.ResultHasNoStapleTarget | Notary.ResponseInvalid | Notary.CorrelationFailed | Staple.AcceptanceMismatch | import("effect-build/Author/BorrowedOutput").BorrowedOutputExpired | import("effect-build/Author/BorrowedOutput").BorrowedOutputChanged | import("effect-build/Author/BorrowedOutput").BorrowedOutputEscaped | import("effect-build/Author/BorrowedOutput").BorrowedOutputMissing | import("effect-build/Author/BorrowedOutput").BorrowedOutputObservationFailed | import("effect-build/Author/BorrowedOutput").CleanupFailedAfterSuccessfulUse | ReleaseError, FileSystem.FileSystem | import("effect/Path").Path | import("effect/Crypto").Crypto | Notary.Client | Staple.Stapler | Assess.Assessor>;
export declare const preparationScope: (input: ApplePreparation) => Effect.Effect<{
    readonly _tag: "PreparationScope";
    readonly plan: Plan;
}, ReleaseError, never>;
/** The ordinary machine owns submit permission; native completion records a fact in its same journal. */
export declare const runPreparation: (input: ApplePreparation, options: Omit<RunOptions, "plan">, complete: (submission: Notary.Submission, preparationId: string) => Effect.Effect<{
    status: "Satisfied" | "Pending" | "Conflict";
    evidence: unknown;
}, ReleaseError>) => Effect.Effect<undefined, ReleaseError, Host>;
/** The sole final plan binds the first CAS-selected ReadyToPlan bytes in this root. */
export declare const validateApplePublication: (input: ApplePreparation, publication: Plan, owner: ContentOwner) => Effect.Effect<ReadyToPlan, Schema.SchemaError | import("effect/PlatformError").PlatformError | import("./adoption.js").AdoptionError | ReleaseError, import("effect/Crypto").Crypto | Host>;
/** A selected publication report alone cannot represent the producer prefix. */
export declare const reportAppleContext: (input: ApplePreparation, owner: ContentOwner, publication?: Plan | undefined) => Effect.Effect<{
    nativeFacts: import("../kernel-api.js").JournalEvent[];
    publication?: {
        revision: number;
        planId: string;
        superseded: boolean;
        operations: ReadonlyArray<import("../kernel-api.js").OperationReport>;
    };
    journalId: string;
    revision: number;
    preparation: {
        revision: number;
        planId: string;
        superseded: boolean;
        operations: ReadonlyArray<import("../kernel-api.js").OperationReport>;
    };
}, Schema.SchemaError | import("effect/PlatformError").PlatformError | import("./adoption.js").AdoptionError | ReleaseError, import("effect/Crypto").Crypto | Host>;
export {};
