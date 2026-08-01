import * as Layer from "effect/Layer"
import type * as HttpClient from "effect/unstable/http/HttpClient"
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { ApprovalSigner, LocalApprovalSignerLayer } from "../apply/approval.js"
import { FileRunStoreLayer, RunStore } from "../apply/store.js"
import { LiveDriversLayer } from "../drivers/local.js"
import type { CredentialStore, DriverCatalog, WorkspaceStore } from "../drivers/services.js"

// Every service a release api needs, still owing the two capabilities that
// differ across hosts. A host closes those with its platform package; nothing
// below this line knows which runtime it is on.
export const ReleaseServicesLive: Layer.Layer<
  RunStore | WorkspaceStore | DriverCatalog | CredentialStore | ApprovalSigner,
  never,
  ChildProcessSpawner | HttpClient.HttpClient
> = Layer.mergeAll(LiveDriversLayer, FileRunStoreLayer, LocalApprovalSignerLayer)
