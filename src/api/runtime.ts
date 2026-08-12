import * as Context from "effect/Context"
import * as Schema from "effect/Schema"
import type { CatalogRepositoryTransport } from "../publication/catalog-git.js"
import type { PublicationHttp } from "../publication/http.js"
import type { SourceObserverShape } from "../release/context.js"
import type { RunCommand } from "../drivers/process.js"
import type { PreparedReleaseStoreShape } from "../release/prepared-store.js"

export class ReleaseRuntimeError
  extends Schema.TaggedErrorClass<ReleaseRuntimeError>()("ReleaseRuntimeError", { reason: Schema.String }) {}

export interface ReleaseRuntimeShape {
  readonly source: SourceObserverShape
  readonly run: RunCommand
  readonly http: PublicationHttp
  readonly catalog: CatalogRepositoryTransport
  readonly preparedStore: (workspace: string, explicitDirectory?: string) => PreparedReleaseStoreShape
}

export class ReleaseRuntime extends Context.Service<ReleaseRuntime, ReleaseRuntimeShape>()("ReleaseRuntime") {}
