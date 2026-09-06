/** Proposed host signatures. The loading and one-send transport mechanisms
 * are packed experiments; complete credential implementations are migration work. */
import type { Effect, Scope } from "effect"
import type { HostShape, JournalStore, ReleaseError, ReleaseReport, RunOptions, Transport } from "./kernel-api.js"
import type { CredentialBinding, CredentialHeaders, GitCatalog, HttpProviderDefinition } from "./provider-api.js"

export interface Application {
  readonly host: HostShape
  readonly options: RunOptions
}
export type CreateApplication = (input: unknown) => Effect.Effect<Application, ReleaseError, Scope.Scope>
export declare const runApplication: (applicationPath: string, input: unknown) => Promise<ReleaseReport>
export declare const runAction: (input: { readonly application: string; readonly input: unknown }) => Promise<{
  readonly report: ReleaseReport
  readonly outputs: { readonly planId: string; readonly journalRevision: string }
}>

export type CredentialRequest = CredentialBinding
/** Ephemeral headers. The resolver checks origin, principal and scope before
 * returning secrets; the transport rejects collisions with durable headers. */
export type ResolveCredentials = (request: CredentialRequest) => Effect.Effect<CredentialHeaders, ReleaseError>
export interface HttpTransportOptions {
  readonly credentials: ResolveCredentials
  /** Captured once. Exactly one definition must own the full request before
   * resolving credentials; its native decoder classifies the response. */
  readonly providers: readonly HttpProviderDefinition[]
  readonly timeoutMilliseconds: number
  readonly maximumResponseBytes: number
}
/** One native request per dispatch. No automatic write retry or redirect. */
export declare const makeHttpTransport: (options: HttpTransportOptions) => Transport
/** SQLite is the Bun local default; release path is always explicit. */
export declare const openSqliteJournal: (path: string) => Effect.Effect<JournalStore, ReleaseError, Scope.Scope>
/** Configured remote ref store; no implication of hosted qualification. */
export declare const openGitJournal: (options: {
  readonly cacheDirectory: string
  readonly remote: string
  readonly principal: string
  readonly scope: string
  readonly gitExecutable: string
  readonly timeoutMilliseconds: number
  readonly maximumOutputBytes: number
  /** Reacquired for the exact remote/ref/public authority. Ambient Git
   * credential helpers and inherited secret environment are not admitted. */
  readonly credentials: (request: GitCatalog.RefCoordinate) => Effect.Effect<GitCatalog.Credentials, ReleaseError>
}) => Effect.Effect<JournalStore, ReleaseError, Scope.Scope>
