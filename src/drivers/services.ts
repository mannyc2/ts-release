import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { createHash } from "node:crypto"
import {
  AnnouncementPublish,
  ForgeRelease,
  HttpPublish,
  OpaquePublish,
  Operation,
  OutputDeclaration,
  PackageRegistryRelease,
  PackageStorePublish, ProviderPublish,
  PublishCredential,
  ReadCredential,
  SupplyChainPublish, SmtpPublish,
  type RemotePublishOp
} from "../model/operation.js"
import { CheckpointId, Digest, OutputId, SafeRelativePath, WorkspaceRoot } from "../model/primitives.js"
import { DriverError, MaterializedOutput } from "../model/run.js"
import type { ExecutionPermit, PublishPermit } from "../model/permit.js"

export class ProcessRequest extends Schema.TaggedClass<ProcessRequest>()("ProcessRequest", {
  argv: Schema.NonEmptyArray(Schema.String), cwd: SafeRelativePath,
  environmentNames: Schema.Array(Schema.NonEmptyString)
}) {}
export class CatalogPublishRequest
  extends Schema.TaggedClass<CatalogPublishRequest>()("CatalogPublishRequest", {
    operation: Schema.Union([
      HttpPublish,
      ForgeRelease,
      PackageRegistryRelease,
      PackageStorePublish,
      SupplyChainPublish, ProviderPublish, AnnouncementPublish, SmtpPublish,
      OpaquePublish
    ]),
    // Command publishers run in the plan workspace, never the ambient cwd:
    // .npmrc discovery walks up from here.
    root: WorkspaceRoot,
    checkpointId: CheckpointId,
    // Recorded durably for operator reconciliation on every mechanism;
    // transmitted as Idempotency-Key only on HttpPublish (command-line
    // publishers have no generic idempotency channel — npm/twine dedupe by
    // name+version server-side).
    clientReconciliationKey: Schema.NonEmptyString
  }) {}
export class CatalogStructuredRequest
  extends Schema.TaggedClass<CatalogStructuredRequest>()("CatalogStructuredRequest", {
    operation: Operation, root: WorkspaceRoot,
    availableOutputs: Schema.Array(OutputDeclaration)
  }) {}
export class SnapshotRequest extends Schema.TaggedClass<SnapshotRequest>()("SnapshotRequest", {
  root: WorkspaceRoot, source: SafeRelativePath, snapshotDirectory: Schema.NonEmptyString, outputId: OutputId
}) {}
export class ReadResult extends Schema.Class<ReadResult>("ReadResult")({
  found: Schema.Boolean, remoteId: Schema.optionalKey(Schema.NonEmptyString)
}) {}
export class NotDispatched extends Schema.TaggedClass<NotDispatched>()(
  "NotDispatched", { reason: Schema.String, retryable: Schema.Boolean }
) {}
export class Committed extends Schema.TaggedClass<Committed>()(
  "Committed", { observedOutcome: Schema.String, transmittedDigest: Schema.optionalKey(Digest) }
) {}
export class CommitmentUnknown extends Schema.TaggedClass<CommitmentUnknown>()(
  "CommitmentUnknown",
  { failure: Schema.String, observedRemoteId: Schema.optionalKey(Schema.NonEmptyString) }
) {}
export const MutationResult = Schema.Union([NotDispatched, Committed, CommitmentUnknown])
export type MutationResult = typeof MutationResult.Type

export class VerifiedContentHandle {
  private constructor(readonly facts: MaterializedOutput, private readonly content: Uint8Array) {}
  get bytes(): Uint8Array { return new Uint8Array(this.content) }
  static from(facts: MaterializedOutput, bytes: Uint8Array): VerifiedContentHandle {
    const digest = createHash("sha256").update(bytes).digest("hex")
    if (facts.digest !== digest || facts.size !== bytes.length)
      throw DriverError.make({ reason: "Snapshot verification failed.", commitment: "before-commit" })
    return new VerifiedContentHandle(facts, new Uint8Array(bytes))
  }
}
export type WorkspaceStoreShape = {
  readonly snapshot: (request: SnapshotRequest) =>
    Effect.Effect<MaterializedOutput, DriverError>,
  readonly verify: (directory: string, facts: MaterializedOutput) =>
    Effect.Effect<VerifiedContentHandle, DriverError>
}
export type CredentialStoreShape = {
  readonly getRead: (slot: ReadCredential, permit: ExecutionPermit) =>
    Effect.Effect<string, DriverError>,
  readonly getPublish: (slot: PublishCredential, permit: PublishPermit) =>
    Effect.Effect<string, DriverError>
}
type StructuredResult = { readonly outcome: string, readonly outputs: ReadonlyArray<MaterializedOutput> }
export type DriverCatalogShape = {
  readonly structured: (request: CatalogStructuredRequest, credential?: string) =>
    Effect.Effect<StructuredResult, DriverError>,
  readonly publish: (
    request: CatalogPublishRequest, content: VerifiedContentHandle | undefined,
    credential: string
  ) => Effect.Effect<MutationResult, DriverError>,
  readonly reconcile: (
    request: CatalogPublishRequest, credential: string
  ) => Effect.Effect<ReadResult, DriverError>
}
// Package-store, supply-chain, provider, and announcement publications carry an
// immutable profile and have no live transport in the node driver catalog.
// The parameter is the publish union, not `{ _tag: string }`: this decides
// whether a dispatch happens at all, so a tag that stops existing (or a value
// that was never an operation) must fail the compiler, not the wire.
export type ClosedProfilePublishOp = Extract<
  RemotePublishOp,
  { readonly _tag: typeof closedProfileTags[number] }
>
const closedProfileTags = [
  "PackageStorePublish", "SupplyChainPublish", "ProviderPublish", "AnnouncementPublish", "SmtpPublish"
] as const satisfies ReadonlyArray<RemotePublishOp["_tag"]>
export const isClosedProfilePublish = (
  operation: RemotePublishOp
): operation is ClosedProfilePublishOp =>
  (closedProfileTags as ReadonlyArray<string>).includes(operation._tag)
export class WorkspaceStore extends Context.Service<WorkspaceStore, WorkspaceStoreShape>()("WorkspaceStore") {}
export class CredentialStore extends Context.Service<
  CredentialStore, CredentialStoreShape
>()("CredentialStore") {}
export class DriverCatalog extends Context.Service<DriverCatalog, DriverCatalogShape>()("DriverCatalog") {}
