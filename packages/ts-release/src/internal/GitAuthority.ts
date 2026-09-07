import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { ReleaseError, attempt, fail } from "./Error.js"
import { type Transport } from "../Provider.js"
import { RequestFacts } from "./ReleaseModel.js"

export class GitReceipt extends Schema.Class<GitReceipt>("ReleaseGitReceipt")({
  kind: Schema.Literal("git-push"),
  ref: Schema.String,
  desiredNew: Schema.String,
  porcelain: Schema.String,
}) {}
export interface GitExecution {
  readonly exitCode: number
  readonly stdout: string
}
export interface CoreGitOptions {
  readonly principal: string
  readonly scope: string
  /** Captured at the host boundary; implement with execFile/spawn, never a shell. */
  readonly execute: (arguments_: ReadonlyArray<string>) => Effect.Effect<GitExecution, ReleaseError>
  readonly otherwise?: Transport
}
export // Possession follows this core constructor, never a provider's data tag.
const authorityKey = (principal: string, scope: string): string =>
  JSON.stringify([principal, scope])
export const mechanisms = new WeakMap<Transport, ReadonlyMap<string, CoreGitOptions>>()
export const assertTransportBinding = (transport: Transport, facts: RequestFacts): void => {
  if (facts.replay._tag !== "GitCas") return
  const bindings = mechanisms.get(transport)
  if (!bindings)
    fail("untrusted-replay", "Conditional Git replay requires the captured core Git mechanism")
  if (!bindings.has(authorityKey(facts.principal, facts.scope)))
    fail("transport-authority", "Request authority differs from the captured Git credentials")
  if (
    facts.transport !== "core.git/1" ||
    facts.method !== "update-ref" ||
    facts.byteLength !== "0" ||
    facts.headers.length !== 0
  )
    fail("git-request", "Git updates have only native ref arguments and no HTTP payload")
  const { ref, expectedOld, desiredNew } = facts.replay
  if (
    !/^refs\/(?:heads|tags)\/[A-Za-z0-9][A-Za-z0-9/_.-]*$/u.test(ref) ||
    ref.includes("..") ||
    ref.endsWith(".") ||
    ref.endsWith("/")
  )
    fail("git-ref", "Conditional Git request has an invalid ref")
  if (
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(expectedOld) ||
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(desiredNew)
  )
    fail("git-oid", "Conditional Git request requires full native object IDs")
  if (!facts.endpoint || facts.endpoint.startsWith("-") || /[\u0000-\u0020]/u.test(facts.endpoint))
    fail("git-endpoint", "Git endpoint must be one literal argument")
}
/** The only protected mechanism in this experiment is one exact conditional push. */
export function makeCoreGitTransport(options: CoreGitOptions): Transport
export function makeCoreGitTransport(
  options: readonly [CoreGitOptions, ...CoreGitOptions[]],
  otherwise?: Transport,
): Transport
export function makeCoreGitTransport(
  input: CoreGitOptions | readonly [CoreGitOptions, ...CoreGitOptions[]],
  otherwise?: Transport,
): Transport {
  const options = Array.isArray(input) ? input : [input as CoreGitOptions]
  const fallback = Array.isArray(input) ? otherwise : (input as CoreGitOptions).otherwise
  if (options.length === 0)
    fail("git-bindings", "Conditional Git needs at least one authority binding")
  const bindings = new Map<string, CoreGitOptions>()
  for (const option of options) {
    const key = authorityKey(option.principal, option.scope)
    if (bindings.has(key) || (Array.isArray(input) && option.otherwise !== undefined))
      fail(
        "git-bindings",
        "Conditional Git bindings must be unique and use only the common fallback",
      )
    bindings.set(
      key,
      Object.freeze({ principal: option.principal, scope: option.scope, execute: option.execute }),
    )
  }
  const transport: Transport = {
    send: Effect.fn("ts-release.coreConditionalGit")(function* (request) {
      if (request.facts.replay._tag !== "GitCas") {
        if (fallback) return yield* fallback.send(request)
        return yield* new ReleaseError({
          code: "unsupported-transport",
          message: "No ordinary transport was installed",
        })
      }
      yield* attempt(() => assertTransportBinding(transport, request.facts))
      const owned = bindings.get(authorityKey(request.facts.principal, request.facts.scope))!
      const { ref, expectedOld, desiredNew } = request.facts.replay
      const result = yield* owned.execute([
        "push",
        "--porcelain",
        `--force-with-lease=${ref}:${expectedOld}`,
        "--",
        request.facts.endpoint,
        `${desiredNew}:${ref}`,
      ])
      const updates = result.stdout
        .split("\n")
        .filter((line) => line.includes(`\t${desiredNew}:${ref}\t`))
      if (result.exitCode !== 0 || updates.length !== 1 || !/^[ *+=]\t/u.test(updates[0]!))
        return {
          _tag: "Unknown" as const,
          reason: "Git did not confirm the exact conditional update",
        }
      return {
        _tag: "Accepted" as const,
        receipt: new GitReceipt({ kind: "git-push", ref, desiredNew, porcelain: result.stdout }),
      }
    }),
  }
  mechanisms.set(transport, bindings)
  return transport
}
