/** Implemented native host declarations. The Action adapter remains W10 work. */
import type { FinalizedReport } from "./production-api/platform/Application.js"
export * from "./production-api/Node.js"
export { openSqliteJournal } from "./production-api/platform/SqliteJournal.js"
export type { CredentialBinding as CredentialRequest, ResolveCredentials, HttpTransportOptions } from "./production-api/Http.js"
export declare const runAction: (input: { readonly application: string; readonly input: unknown }) => Promise<{
  readonly report: FinalizedReport
  readonly outputs: { readonly planId: string; readonly journalRevision: string }
}>
