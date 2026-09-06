import { randomUUID } from "node:crypto"
import { Effect } from "effect"
import { createOperation, createPlan } from "@lab/kernel"
import { GitJournal } from "@lab/host/git"
import { httpTransport } from "@lab/host/http"
import { provider } from "@lab/provider"

export const createApplication = Effect.fn("Extension.createApplication")(function*(input: { intent: unknown; work: string; remote: string; candidate: "M1" | "M2" }) {
  const plan = yield* Effect.gen(function*() {
    const operation = yield* createOperation(provider, input.intent)
    return yield* createPlan("extension", [operation])
  })
  return {
    host: { store: new GitJournal(input.work, input.remote), providers: [provider], transport: httpTransport, now: Date.now, uniqueId: randomUUID },
    options: { plan, candidate: input.candidate, authorize: true, observe: true }
  }
})
