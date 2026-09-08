import { Effect, Schema } from "effect"
import { ReleaseError, attempt, fail, reject } from "./Error.js"
import { verifyRequest, type Transport } from "../Provider.js"
import { RequestFacts } from "./ReleaseModel.js"
import { canonical } from "./Identity.js"

export class GitReceipt extends Schema.Class<GitReceipt>("ReleaseGitReceipt")({
  kind: Schema.Literal("git-push"),
  ref: Schema.String,
  desiredNew: Schema.String,
  porcelain: Schema.String,
}) {}
export const validRef = (ref: string): boolean =>
  /^refs\/(?:heads|tags)\/[A-Za-z0-9][A-Za-z0-9/_.-]*$/u.test(ref) &&
  !ref.includes("..") &&
  !ref
    .split("/")
    .some((part) => !part || part.startsWith(".") || part.endsWith(".") || part.endsWith(".lock"))
export type GitExecution = Readonly<{ exitCode: number; stdout: string }>
export interface CoreGitOptions {
  readonly principal: string
  readonly scope: string
  /** Captured at the host boundary; implement with execFile/spawn, never a shell. */
  readonly execute: (arguments_: ReadonlyArray<string>) => Effect.Effect<GitExecution, ReleaseError>
  /** Resolve credentials and verify native objects before DispatchStarted. */
  readonly prepare?: (
    arguments_: ReadonlyArray<string>,
  ) => Effect.Effect<CoreGitOptions["execute"], ReleaseError>
  readonly otherwise?: Transport
}
export const conditionalArguments = (
  remote: string,
  ref: string,
  expectedOld: string,
  desiredNew: string,
): readonly string[] =>
  Object.freeze([
    "push",
    "--porcelain",
    `--force-with-lease=${ref}:${expectedOld}`,
    "--",
    remote,
    `${desiredNew}:${ref}`,
  ])
export // Possession follows this core constructor, never a provider's data tag.
const authorityKey = (principal: string, scope: string): string =>
  JSON.stringify([principal, scope])
export const mechanisms = new WeakMap<Transport, ReadonlyMap<string, CoreGitOptions>>()
/** Keep the exact core mechanism identity; ordinary ports retain their state
 * behind a captured function, never behind a mutable method lookup. */
export const captureTransport = (transport: Transport): Transport => {
  if (mechanisms.has(transport)) return transport
  const send = transport.send,
    prepare = transport.prepare
  if (typeof send !== "function" || (prepare !== undefined && typeof prepare !== "function"))
    fail("transport-capability", "Transport send and any declared preparation must be callable")
  return Object.freeze({
    send: send.bind(transport),
    ...(prepare === undefined ? {} : { prepare: prepare.bind(transport) }),
  })
}
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
  if (!validRef(ref)) fail("git-ref", "Conditional Git request has an invalid ref")
  if (
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(expectedOld) ||
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(desiredNew) ||
    expectedOld.length !== desiredNew.length ||
    /^0+$/u.test(desiredNew)
  )
    fail("git-oid", "Conditional Git request requires full native object IDs")
  if (!facts.endpoint || facts.endpoint.startsWith("-") || /[\u0000-\u0020]/u.test(facts.endpoint))
    fail("git-endpoint", "Git endpoint must be one literal argument")
}
/** Retain only the exact native status line; remote messages are not receipts. */
export const pushWitness = (
  result: GitExecution,
  ref: string,
  expectedOld: string,
  desiredNew: string,
): string | undefined => {
  if (result.exitCode !== 0 || result.stdout.length > 65536) return
  const updates = result.stdout.split("\n").filter((line) => /^[ *+=!\-]\t/u.test(line))
  if (updates.length !== 1) return
  const line = updates[0]!,
    fields = line.split("\t")
  if (fields.length !== 3 || fields[1] !== `${desiredNew}:${ref}`) return
  const flag = fields[0],
    summary = fields[2]!
  if (flag === "=" && summary === "[up to date]") return line
  if (
    flag === "*" &&
    /^0+$/u.test(expectedOld) &&
    summary === (ref.startsWith("refs/tags/") ? "[new tag]" : "[new branch]")
  )
    return line
  const range = /^([0-9a-f]{4,64})(\.{2,3})([0-9a-f]{4,64})( \(forced update\))?$/u.exec(summary)
  if (
    range &&
    expectedOld.startsWith(range[1]!) &&
    desiredNew.startsWith(range[3]!) &&
    ((flag === " " && range[2] === ".." && !range[4]) ||
      (flag === "+" && range[2] === "..." && range[4]))
  )
    return line
}
/** The protected mechanism is one exact conditional push. */
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
  const source = Array.isArray(input) ? otherwise : (input as CoreGitOptions).otherwise
  const fallback = source && captureTransport(source)
  if (options.length === 0)
    fail("git-bindings", "Conditional Git needs at least one authority binding")
  const bindings = new Map<string, CoreGitOptions>()
  for (const option of options) {
    const principal = option.principal,
      scope = option.scope,
      execute = option.execute,
      prepare = option.prepare
    const key = authorityKey(principal, scope)
    if (typeof execute !== "function" || (prepare !== undefined && typeof prepare !== "function"))
      fail("git-bindings", "Git execution and any preparation must be callable")
    if (bindings.has(key) || (Array.isArray(input) && option.otherwise !== undefined))
      fail(
        "git-bindings",
        "Conditional Git bindings must be unique and use only the common fallback",
      )
    bindings.set(
      key,
      Object.freeze({
        principal,
        scope,
        execute: execute.bind(option),
        ...(prepare === undefined ? {} : { prepare: prepare.bind(option) }),
      }),
    )
  }
  const transport: Transport = {
    prepare: Effect.fn("ts-release.prepareCoreTransport")(function* (request) {
      const selected = yield* verifyRequest(request)
      if (selected.facts.replay._tag === "GitCas") {
        yield* attempt(() => assertTransportBinding(transport, selected.facts))
        const owned = bindings.get(authorityKey(selected.facts.principal, selected.facts.scope))!
        const { ref, expectedOld, desiredNew } = selected.facts.replay
        const args = conditionalArguments(selected.facts.endpoint, ref, expectedOld, desiredNew)
        const execute = owned.prepare ? yield* owned.prepare(args) : owned.execute
        if (typeof execute !== "function")
          return yield* reject("git-bindings", "Prepared Git execution must be callable")
        return Effect.fn("ts-release.coreConditionalGit")(function* (actual) {
          const checked = yield* verifyRequest(actual)
          if (canonical(checked.facts) !== canonical(selected.facts))
            return yield* reject("git-request", "Prepared Git request changed before execution")
          const porcelain = pushWitness(yield* execute(args), ref, expectedOld, desiredNew)
          return porcelain === undefined
            ? {
                _tag: "Unknown" as const,
                reason: "Git did not confirm the exact conditional update",
              }
            : {
                _tag: "Accepted" as const,
                receipt: new GitReceipt({ kind: "git-push", ref, desiredNew, porcelain }),
              }
        }) as Transport["send"]
      }
      if (!fallback)
        return yield* reject("unsupported-transport", "No ordinary transport was installed")
      return fallback.prepare ? yield* fallback.prepare(request) : fallback.send
    }),
    send: Effect.fn("ts-release.coreConditionalGit")(function* (request) {
      if (request.facts.replay._tag !== "GitCas") {
        if (fallback) return yield* fallback.send(request)
        return yield* reject("unsupported-transport", "No ordinary transport was installed")
      }
      return yield* (yield* transport.prepare!(request))(request)
    }),
  }
  mechanisms.set(transport, bindings)
  return Object.freeze(transport)
}
