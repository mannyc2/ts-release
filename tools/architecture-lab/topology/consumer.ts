import { readFile, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { Effect, Schema, Layer } from "effect"
import { createOperation, createPlan, loadPlan, Host, Plan, runRelease, type ProviderDefinition, type Candidate } from "@lab/kernel"
import { npm, NpmIntent } from "@lab/npm"
import { python, PythonFileIntent } from "@lab/python"
import { GitJournal } from "@lab/host/git"
import { httpTransport } from "@lab/host/http"

export interface Input {
  readonly endpoint: string
  readonly prefix: string
  readonly kinds: ReadonlyArray<"npm" | "python" | "external">
  readonly instances: number
  readonly tarballBase64: string
  readonly integrity: string
  readonly pythonBase64: string
  readonly pythonSha256: string
  readonly planFile: string
  readonly storeDirectory: string
  readonly remote: string
  readonly store: "git" | "sqlite"
  readonly candidate: Candidate
  readonly authorize: boolean
  readonly observe: boolean
}

/** User-authored composition; provider modules are ordinary executable imports. */
export const createApplication = Effect.fn("Fixture.createApplication")(function*(input: Input) {
  const providers: ProviderDefinition[] = [npm, python]
  if (input.kinds.includes("external")) providers.push((yield* Effect.promise(()=>import("@lab/external"))).external)
  const saved = yield* Effect.promise(async()=>{try { return await readFile(input.planFile, "utf8") } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }})
  const plan = yield* Effect.gen(function* () {
    if (saved !== undefined) return yield* loadPlan(JSON.parse(saved), providers)
    const operations = []
    for (const kind of input.kinds) for (let index = 0; index < input.instances; index++) {
      const name = `${input.prefix}-${index}`
      const definition = kind === "npm" ? npm : kind === "python" ? python : providers.find(p => p.definitionId === "external.publish")!
      const intent = kind === "npm" ? new NpmIntent({
        registry: input.endpoint, packageName: name, version: "1.0.0", initialTag: "latest",
        filename: "fixture-1.0.0.tgz", tarballBase64: input.tarballBase64, integrity: input.integrity
      }) : kind === "python" ? new PythonFileIntent({
        index: input.endpoint, project: name, version: "1.0.0", filename: "fixture-1.0.0.tar.gz",
        filetype: "sdist", pythonVersion: "source", contentBase64: input.pythonBase64, sha256: input.pythonSha256
      }) : { endpoint: input.endpoint, instanceId: name, value: `value-${index}` }
      operations.push(yield* createOperation(definition, intent))
    }
    const created = yield* createPlan(input.prefix, operations)
    yield* Effect.promise(() => writeFile(input.planFile, JSON.stringify(Schema.encodeSync(Plan)(created))))
    return created
  })
  const store = input.store === "sqlite"
    ? yield* Effect.acquireRelease(Effect.promise(async()=>new (await import("@lab/host/sqlite")).SqliteJournal(`${input.storeDirectory}.sqlite`)),store=>Effect.sync(()=>store.close()))
    : new GitJournal(input.storeDirectory, input.remote)
  return {
    host: { store, providers, transport: httpTransport, now: Date.now, uniqueId: randomUUID },
    options: { candidate: input.candidate, plan, authorize: input.authorize, observe: input.observe }
  }
})

export async function library(input: Input) {
  return Effect.runPromise(Effect.scoped(Effect.gen(function*(){
    const app = yield* createApplication(input)
    return yield* runRelease(app.options).pipe(Effect.provide(Layer.succeed(Host, app.host)))
  })))
}
