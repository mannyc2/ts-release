import { Crypto, Effect, FileSystem, Path, PlatformError, Schema } from "effect";
import * as File from "effect-build/Author/File";
import * as Tree from "effect-build/Author/Tree";
import * as Model from "effect-build-apple/Model";
import * as Notary from "effect-build-apple/Notary";
import * as Staple from "effect-build-apple/Staple";
import * as Assess from "effect-build-apple/Assess";
import { AdoptionError, type OwnedFile } from "../internal/ArtifactModel.js";
import { type ContentOwner } from "../internal/Content.js";
import { type ReleaseError } from "../internal/Error.js";
import { ReadyToPlan } from "./Model.js";
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
export type FinalNativeArtifact = ({
    readonly kind: "app";
    readonly artifact: Model.StapledApplicationBundle;
} | {
    readonly kind: "dmg";
    readonly artifact: Model.StapledDiskImage;
} | {
    readonly kind: "pkg";
    readonly artifact: Model.StapledInstallerPackage;
}) & {
    readonly assessment: Assess.GatekeeperAccepted;
};
export type NativeAppleError = ReleaseError | AdoptionError | Schema.SchemaError | PlatformError.PlatformError | File.PublicationFailure | File.FileVerificationFailed | Tree.PublicationFailure | Tree.TreeVerificationFailed | Model.ProductStateInvalid | Notary.SubmitAppError | Notary.ObserveError | Notary.ResultNotAccepted | Notary.ResultHasNoStapleTarget | Staple.StapleError | Assess.AssessError;
export type NativeAppleServices = Crypto.Crypto | FileSystem.FileSystem | Path.Path | Notary.Client | Staple.Stapler | Assess.Assessor;
export type DeriveDeliveryFiles<R = never> = (final: FinalNativeArtifact) => Effect.Effect<readonly OwnedFile[], NativeAppleError, R>;
/** Caller owns the workspace lifetime. Recreate source bytes through the actual
 * native finalizers; signature projection is reverified by native Apple tools. */
export declare const restorePreparedSource: (value: import("./Model.js").AppPreparation | import("./Model.js").DmgPreparation | import("./Model.js").PkgPreparation, contentOwner: ContentOwner, workspace: string) => Effect.Effect<RestoredSource, PlatformError.PlatformError | File.FileDestinationInvalid | File.FileCandidateMissing | File.FileCandidateChanged | File.FileDestinationLocked | File.FileCommitFailed | Tree.TreeDestinationInvalid | Tree.TreeCandidateMissing | Tree.TreeCandidateChanged | Tree.TreeDestinationLocked | Tree.TreeCommitFailed | AdoptionError | ReleaseError, FileSystem.FileSystem | Path.Path | Crypto.Crypto>;
export declare const submitPrepared: (value: import("./Model.js").AppPreparation | import("./Model.js").DmgPreparation | import("./Model.js").PkgPreparation, contentOwner: ContentOwner, workspace: string) => Effect.Effect<Notary.Submission, PlatformError.PlatformError | File.FileDestinationInvalid | File.FileCandidateMissing | File.FileCandidateChanged | File.FileDestinationLocked | File.FileCommitFailed | Tree.TreeDestinationInvalid | Tree.TreeCandidateMissing | Tree.TreeCandidateChanged | Tree.TreeDestinationLocked | Tree.TreeCommitFailed | Notary.SubmitAppError | AdoptionError | ReleaseError, FileSystem.FileSystem | Path.Path | Crypto.Crypto | Notary.Client>;
/** Only poll the recorded identity; accepted bytes are stapled, assessed, then
 * adopted. Derived output blobs are not selected until the journal's one CAS. */
export declare const finishPrepared: <R = never>(value: import("./Model.js").AppPreparation | import("./Model.js").DmgPreparation | import("./Model.js").PkgPreparation, recorded: Notary.Submission, preparationId: string, contentOwner: ContentOwner, workspace: string, deriveDeliveryFiles?: DeriveDeliveryFiles<R> | undefined) => Effect.Effect<Notary.Observation | ReadyToPlan, Schema.SchemaError | PlatformError.PlatformError | Model.ProductStateInvalid | File.FileDestinationInvalid | File.FileCandidateMissing | File.FileCandidateChanged | File.FileDestinationLocked | File.FileCommitFailed | File.FileVerificationFailed | Tree.TreeDestinationInvalid | Tree.TreeCandidateMissing | Tree.TreeCandidateChanged | Tree.TreeDestinationLocked | Tree.TreeCommitFailed | Tree.TreeVerificationFailed | Notary.AppleOperationInvalid | Notary.ResultNotAccepted | Notary.ResultHasNoStapleTarget | Notary.SubmissionOutcomeUnknown | Notary.SubmissionPreparationFailed | Notary.ObserveError | import("effect-build/Author/BorrowedOutput").BorrowedOutputExpired | import("effect-build/Author/BorrowedOutput").BorrowedOutputChanged | import("effect-build/Author/BorrowedOutput").BorrowedOutputEscaped | import("effect-build/Author/BorrowedOutput").BorrowedOutputMissing | import("effect-build/Author/BorrowedOutput").BorrowedOutputObservationFailed | import("effect-build/Author/BorrowedOutput").CleanupFailedAfterSuccessfulUse | AdoptionError | ReleaseError | Staple.AcceptanceMismatch, FileSystem.FileSystem | Path.Path | Crypto.Crypto | Notary.Client | Assess.Assessor | Staple.Stapler | Exclude<R, import("effect/Scope").Scope>>;
