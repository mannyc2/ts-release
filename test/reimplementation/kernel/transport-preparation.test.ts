import { expect, test } from "bun:test"
import { Effect } from "effect"
import {
  runRelease,
  ReleaseError,
  makeCoreGitTransport,
  type Transport,
  type JournalStore,
} from "@mannyc1/ts-release"
import { makeFixture, runWithHost, startEvents } from "./fixtures.js"

test("missing credentials or malformed prepared send fail before DispatchStarted", async () => {
  for (const prepare of [
    () =>
      Effect.fail(
        new ReleaseError({ code: "credential-unavailable", message: "Credential unavailable" }),
      ),
    () => Effect.succeed(null as unknown as Transport["send"]),
  ]) {
    const f = await makeFixture()
    const host = { ...f.host, transport: { ...f.host.transport, prepare } }
    await expect(runWithHost(host, runRelease({ plan: f.plan, authorize: true }))).rejects.toThrow()
    expect(await startEvents(f.store, f.plan)).toEqual([])
    expect(f.sends).toEqual([])
  }
})

test("preparation owns a separate request and captures the original service receiver", async () => {
  const f = await makeFixture()
  class Credentials {
    #prepared = 0
    send = f.host.transport.send
    prepare(
      request: Parameters<Transport["send"]>[0],
    ): Effect.Effect<Transport["send"], ReleaseError> {
      this.#prepared++
      expect(this.#prepared).toBe(1)
      request.body.fill(0)
      return Effect.succeed((actual: Parameters<Transport["send"]>[0]) => {
        expect(new TextDecoder().decode(actual.body)).toBe("exact artifact bytes")
        return this.send(actual)
      })
    }
  }
  const transport = new Credentials(),
    read = f.store.read
  const host = {
    ...f.host,
    transport,
    store: {
      append: f.store.append,
      read: (id: string) =>
        Effect.gen(function* () {
          transport.prepare = () =>
            Effect.fail(new ReleaseError({ code: "replaced", message: "Wrong receiver" }))
          return yield* read(id)
        }),
    },
  }
  expect(
    (await runWithHost(host, runRelease({ plan: f.plan, authorize: true }))).operations[0]?.status,
  ).toBe("Satisfied")
  expect(f.sends).toHaveLength(1)
  expect(f.sends[0]?.eventCount).toBe(1)
})

test("prepared sends are discarded on CAS loss and AlreadyRecorded; same-live ambiguous readback still sends once", async () => {
  for (const mode of ["RevisionMismatch", "AlreadyRecorded", "AmbiguousStorageOutcome"] as const) {
    const f = await makeFixture()
    let prepared = 0
    const store: JournalStore = {
      read: f.store.read,
      append: (id, revision, event) =>
        Effect.gen(function* () {
          if (event.body._tag !== "DispatchStarted")
            return yield* f.store.append(id, revision, event)
          if (mode === "RevisionMismatch") return { _tag: mode, revision }
          yield* f.store.append(id, revision, event)
          return mode === "AlreadyRecorded"
            ? { _tag: mode, revision: revision + 1 }
            : { _tag: mode }
        }),
    }
    const host = {
      ...f.host,
      store,
      transport: {
        ...f.host.transport,
        prepare: () =>
          Effect.sync(() => {
            prepared++
            return f.host.transport.send
          }),
      },
    }
    await runWithHost(host, runRelease({ plan: f.plan, authorize: true }))
    expect(prepared).toBe(1)
    expect(f.sends).toHaveLength(mode === "AmbiguousStorageOutcome" ? 1 : 0)
    if (mode !== "RevisionMismatch") {
      await runWithHost(host, runRelease({ plan: f.plan, authorize: true }))
      expect(prepared).toBe(mode === "AlreadyRecorded" ? 2 : 1)
      expect(f.sends).toHaveLength(mode === "AmbiguousStorageOutcome" ? 1 : 0)
    }
  }
})

test("concurrent runners can prepare twice but fresh CAS permits one captured send", async () => {
  const f = await makeFixture()
  let arrivals = 0
  let unblock!: () => void
  const both = new Promise<void>((resolve) => {
    unblock = resolve
  })
  const host = {
    ...f.host,
    transport: {
      ...f.host.transport,
      prepare: () =>
        Effect.gen(function* () {
          arrivals++
          if (arrivals === 2) unblock()
          yield* Effect.promise(() => both)
          return f.host.transport.send
        }),
    },
  }
  await Promise.all([
    runWithHost(host, runRelease({ plan: f.plan, authorize: true })),
    runWithHost(host, runRelease({ plan: f.plan, authorize: true })),
  ])
  expect(arrivals).toBe(2)
  expect(f.sends).toHaveLength(1)
  expect(await startEvents(f.store, f.plan)).toHaveLength(1)
})

test("core Git composition forwards ordinary HTTP preparation without bypassing it", async () => {
  const f = await makeFixture()
  let preparations = 0
  const transport = makeCoreGitTransport({
    principal: "git",
    scope: "refs",
    execute: () => Effect.succeed({ exitCode: 0, stdout: "" }),
    otherwise: {
      ...f.host.transport,
      prepare: () =>
        Effect.sync(() => {
          preparations++
          return f.host.transport.send
        }),
    },
  })
  expect(
    (await runWithHost({ ...f.host, transport }, runRelease({ plan: f.plan, authorize: true })))
      .operations[0]?.status,
  ).toBe("Satisfied")
  expect(preparations).toBe(1)
  expect(f.sends).toHaveLength(1)
})

test("present noncallable preparation cannot silently select the unprepared send path", async () => {
  for (const malformed of [false, 0, "", null, {}]) {
    const f = await makeFixture()
    let reads = 0
    const host = {
      ...f.host,
      store: {
        append: f.store.append,
        read: (id: string) =>
          Effect.gen(function* () {
            reads++
            return yield* f.store.read(id)
          }),
      },
      transport: { ...f.host.transport, prepare: malformed } as unknown as Transport,
    }
    await expect(runWithHost(host, runRelease({ plan: f.plan, authorize: true }))).rejects.toThrow(
      "callable",
    )
    expect(reads).toBe(0)
    expect(f.sends).toEqual([])
    expect(await startEvents(f.store, f.plan)).toEqual([])
  }
})
