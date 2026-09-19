import { expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { pathToFileURL } from "node:url"
import {
  Host,
  createPlan,
  runRelease,
  type HostShape,
} from "../../../packages/ts-release/src/index.js"
import * as Git from "../../../packages/ts-release/src/Git.js"
import { makeGitCatalogHost } from "../../../packages/ts-release/src/Node.js"
import { makeRequest } from "../../../packages/ts-release/src/Provider.js"
import { canonical } from "../../../packages/ts-release/src/internal/Identity.js"
import { openGitRuntime } from "../../../packages/ts-release/src/platform/GitProcess.js"
import { MemoryJournal } from "../kernel/fixtures.js"
import { contentFixture, identity, native, processOptions, seed } from "./git-fixture.js"

for (const format of ["sha1", "sha256"] as const)
  test(`native ${format} host captures, rebuilds and conditionally publishes multiple scopes from owned objects`, async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runtime = yield* openGitRuntime(processOptions),
            remote = yield* runtime.repository(format)
          const old = seed(remote.directory),
            content = contentFixture(),
            resolutions: Git.RefCoordinate[] = []
          const coordinates = ["first", "second", "third"].map((name, index) => ({
            remote: pathToFileURL(remote.directory).href,
            ref: `refs/heads/${name}`,
            principal: index === 2 ? "other-publisher" : "publisher",
            scope: index === 2 ? "other-scope" : "catalog",
          }))
          for (const coordinate of coordinates)
            native(remote.directory, ["update-ref", coordinate.ref, old])
          const options = {
            ...processOptions,
            readContent: content.read,
            credentials: (coordinate: Git.RefCoordinate) =>
              Effect.sync(() => {
                resolutions.push(coordinate)
                return { _tag: "Anonymous" as const }
              }),
          }
          const intents = yield* Effect.scoped(
            Effect.gen(function* () {
              const builder = yield* makeGitCatalogHost(options),
                values: Git.Intent[] = []
              for (const coordinate of coordinates) {
                expect((yield* builder.observeRef(coordinate)).oid).toBe(old)
                const baseObjects = content.put(
                  yield* builder.captureBase({ ...coordinate, expectedOld: old }),
                )
                values.push(
                  yield* Git.prepare(
                    new Git.CommitInput({
                      ...coordinate,
                      expectedOld: old,
                      baseObjects,
                      files: [
                        new Git.FileEdit({
                          path: "Formula/tool.rb",
                          mode: "100644",
                          content: content.put("class Tool < Formula\nend\n"),
                        }),
                      ],
                      message: "Release\n",
                      author: identity,
                      committer: identity,
                    }),
                    {
                      objects: builder.objects,
                      readContent: content.read,
                      putContent: (bytes) => Effect.sync(() => content.put(bytes)),
                    },
                  ),
                )
              }
              return values as [Git.Intent, ...Git.Intent[]]
            }),
          )
          // Builder scope (including every private native repository) is now gone.
          const host = yield* makeGitCatalogHost(options),
            provider = Git.definition({ readContent: content.read, observeRef: host.observeRef }),
            transport = host.transport(intents)
          const operations = yield* Effect.forEach(intents, (intent) => Git.update(intent))
          const plan = yield* createPlan("owned-git-catalog-fixture", operations),
            store = new MemoryJournal()
          let serial = 0
          const application: HostShape = {
            store,
            transport,
            providers: [provider],
            now: () => 1000,
            uniqueId: () => `native-git-${++serial}`,
          }
          const report = yield* runRelease({ plan, authorize: true }).pipe(
            Effect.provide(Layer.succeed(Host, application)),
          )
          expect(report.operations.map((operation) => operation.status)).toEqual([
            "Satisfied",
            "Satisfied",
            "Satisfied",
          ])
          for (const intent of intents) {
            expect(native(remote.directory, ["rev-parse", intent.ref]).toString().trim()).toBe(
              intent.desiredNew,
            )
            expect(
              native(remote.directory, ["show", `${intent.ref}:Formula/tool.rb`]).toString(),
            ).toBe("class Tool < Formula\nend\n")
          }
          const events = (yield* store.read(plan.journalId)).events
          expect(events.filter((event) => event.body._tag === "DispatchStarted")).toHaveLength(3)
          expect(events.filter((event) => event.body._tag === "ReceiptAccepted")).toHaveLength(3)
          yield* runRelease({ plan, authorize: true }).pipe(
            Effect.provide(Layer.succeed(Host, application)),
          )
          const resumed = (yield* store.read(plan.journalId)).events
          expect(resumed.filter((event) => event.body._tag === "DispatchStarted")).toHaveLength(3)
          expect(resumed.slice(events.length).map((event) => event.body._tag)).toEqual([
            "ObservationRecorded",
            "ObservationRecorded",
            "ObservationRecorded",
          ])
          expect(
            resolutions.every((coordinate) =>
              coordinates.some((expected) => canonical(expected) === canonical(coordinate)),
            ),
          ).toBe(true)
        }),
      ),
    )
  }, 30000)

test("native Git preflight admits exact objects and authority before a journal start; captured send rejects changed requests and competing refs", async () => {
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const runtime = yield* openGitRuntime(processOptions),
          remote = yield* runtime.repository("sha1"),
          old = seed(remote.directory),
          content = contentFixture()
        const coordinate = {
          remote: pathToFileURL(remote.directory).href,
          ref: "refs/heads/release",
          principal: "publisher",
          scope: "catalog",
        }
        native(remote.directory, ["update-ref", coordinate.ref, old])
        let credentials = 0
        const options = {
          ...processOptions,
          readContent: content.read,
          credentials: () =>
            Effect.sync(() => {
              credentials++
              return { _tag: "Anonymous" as const }
            }),
        }
        const host = yield* makeGitCatalogHost(options),
          baseObjects = content.put(yield* host.captureBase({ ...coordinate, expectedOld: old }))
        const intent = yield* Git.prepare(
          new Git.CommitInput({
            ...coordinate,
            expectedOld: old,
            baseObjects,
            files: [
              new Git.FileEdit({
                path: "release.txt",
                mode: "100644",
                content: content.put("release\n"),
              }),
            ],
            author: identity,
            committer: identity,
            message: "Release\n",
          }),
          {
            objects: host.objects,
            readContent: content.read,
            putContent: (bytes) => Effect.sync(() => content.put(bytes)),
          },
        )
        const provider = Git.definition({ readContent: content.read, observeRef: host.observeRef }),
          operation = yield* Git.update(intent),
          request = yield* provider.prepare(operation, {
            own: { operation, receipts: [], observations: [] },
            dependencies: [],
          }),
          transport = host.transport([intent])
        const before = credentials,
          send = yield* transport.prepare!(request)
        expect(credentials).toBe(before + 1)
        expect(native(remote.directory, ["rev-parse", coordinate.ref]).toString().trim()).toBe(old)
        const altered = yield* makeRequest({
          ...request.facts,
          endpoint: "file:///tmp/other.git",
          body: request.body,
        })
        expect((yield* Effect.exit(send(altered)))._tag).toBe("Failure")
        // Native third-party commit wins the ref between preflight and dispatch.
        const tree = native(remote.directory, ["rev-parse", `${old}^{tree}`])
          .toString()
          .trim()
        const competitor = native(
          remote.directory,
          ["commit-tree", tree, "-p", old],
          Buffer.from("Competitor\n"),
        )
          .toString()
          .trim()
        native(remote.directory, ["update-ref", coordinate.ref, competitor, old])
        expect((yield* send(request))._tag).toBe("Unknown")
        expect(native(remote.directory, ["rev-parse", coordinate.ref]).toString().trim()).toBe(
          competitor,
        )
        const damaged = content.stored.get(intent.objectSet.sha256)!
        damaged[0] = damaged[0]! ^ 1
        const plan = yield* createPlan("damaged-git-object-set", [operation]),
          store = new MemoryJournal()
        // Skip observation to reach publication preparation with deliberately damaged owned bytes.
        const {
          observe: _,
          observationVersion: __,
          observationCodec: ___,
          classifyObservation: ____,
          ...publication
        } = provider
        const application: HostShape = {
          store,
          transport,
          providers: [publication],
          now: () => 1000,
          uniqueId: () => "damaged-event",
        }
        const count = credentials
        expect(
          (yield* Effect.exit(
            runRelease({ plan, authorize: true }).pipe(
              Effect.provide(Layer.succeed(Host, application)),
            ),
          ))._tag,
        ).toBe("Failure")
        expect((yield* store.read(plan.journalId)).events).toEqual([])
        expect(credentials).toBe(count)
      }),
    ),
  )
}, 30000)
