import { expect, test } from "bun:test"
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { dirname, join } from "node:path"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  makePreparedReferenceChannel,
  runAction,
  type ActionRuntime
} from "../apps/ts-release-action/src/commands.js"
import {
  makeActionPreparedReleaseStore,
  type ActionArtifactTransport,
  type ActionProducerContext
} from "../apps/ts-release-action/src/prepared-store.js"
import { makeReleaseApi } from "../src/api/api.js"
import { ReleaseRuntime, type ReleaseRuntimeShape } from "../src/api/runtime.js"
import type { RunCommand } from "../src/drivers/process.js"
import {
  AnonymousAuthStrategy,
  CanonicalAudience,
  CredentialRef,
  CredentialRequest,
  ProviderId,
  SubjectId,
  TokenAuthStrategy
} from "../src/model/authority.js"
import { NonEmptyName } from "../src/model/primitives.js"
import {
  CredentialProvider,
  makeCredentialProvider
} from "../src/publication/authority.js"
import {
  publishReleaseSubjects,
  ReleaseSubjectError,
  type ReleaseSubject
} from "../src/publication/coordinator.js"
import { HttpAuthorizer } from "../src/publication/http.js"
import {
  AbsenceBasis,
  Applied,
  AuthoritativelyAbsent,
  MutationPrecondition,
  NeedsMutation,
  PresentEquivalent,
  ProviderMutationFact,
  SafeReason
} from "../src/publication/report.js"
import { conservativeUnknownRecoveryProfile } from "../src/publication/recovery.js"
import {
  decodeCompletePreparedReleaseRef,
  encodeCompletePreparedReleaseRef
} from "../src/release/prepared-ref.js"
import {
  PreparedReleaseStore,
  type PreparedReleaseStoreShape
} from "../src/release/prepared-store.js"
import { contextFor } from "./core/runtime-fixture.js"
import { unavailableMutationServicesLayer } from "./fixtures/mutation-services.js"

const candidateCommit = "c".repeat(40)
const producer: ActionProducerContext = {
  repository: "owner/repository",
  workflowRef: "owner/repository/.github/workflows/release.yml@refs/heads/main",
  workflowSha: "d".repeat(40),
  runId: "224",
  runAttempt: "1",
  candidateCommit
}

const config = {
  project: {
    name: "fixture",
    version: "1.0.0",
    tag: "v1.0.0",
    commit: candidateCommit
  },
  preparations: [{
    kind: "artifact",
    id: "payload",
    run: ["fixture-build", "{output:payload}"],
    outputs: [{ id: "payload", path: "payload.txt" }]
  }],
  publish: {}
} as const

const artifactTransport = (
  artifactRoot: string,
  phase: "release" | "retry",
  events: Array<string>
): ActionArtifactTransport => ({
  upload: async ({ name, rootDirectory }) => {
    events.push(`${phase}:upload`)
    mkdirSync(artifactRoot, { recursive: true })
    cpSync(rootDirectory, join(artifactRoot, name), { recursive: true })
    return { id: 224, digest: `sha256:${"e".repeat(64)}` }
  },
  download: async ({ name, destination }) => {
    events.push(`${phase}:download-verify`)
    cpSync(join(artifactRoot, name), destination, { recursive: true })
    return { path: destination, digestMismatch: false }
  }
})

const actionRuntime = (
  workspace: string,
  values: Readonly<Record<string, string>>,
  phase: "release" | "retry",
  events: Array<string>
) => {
  const outputs: Record<string, string> = {}
  const summaries: Array<string> = []
  const preparedReference = makePreparedReferenceChannel({
    output: (name, value) => {
      outputs[name] = value
      events.push(`${phase}:output:${name}`)
    },
    summarize: async (message) => {
      summaries.push(message)
      events.push(`${phase}:summary`)
    }
  })
  const runtime: ActionRuntime = {
    workspace,
    input: (name) => values[name] ?? "",
    output: (name, value) => {
      outputs[name] = value
      events.push(`${phase}:output:${name}`)
    },
    read: (path) => readFileSync(path, "utf8"),
    write: (path, value) => {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, value)
    },
    preparedReference,
    summarize: async (message) => {
      summaries.push(message)
      events.push(`${phase}:summary`)
    }
  }
  return { outputs, preparedReference, runtime, summaries }
}

const fakePublicationBoundary = (events: Array<string>) => {
  const prepared = SubjectId.make("prepared:plan224-action-integration")
  const subjectId = SubjectId.make("fixture:plan224-action-mutation")
  const provider = ProviderId.make("fixture-provider")
  const audience = CanonicalAudience.make("https://provider.example.test/releases/")
  const credential = CredentialRef.make("PLAN224_PUBLISH_TOKEN")
  const observationRequest = CredentialRequest.make({
    subject: subjectId,
    provider,
    audience,
    purpose: "observe",
    strategy: AnonymousAuthStrategy.make({ kind: "anonymous" })
  })
  const mutationRequest = CredentialRequest.make({
    subject: subjectId,
    provider,
    audience,
    purpose: "publish",
    strategy: TokenAuthStrategy.make({ kind: "token", credential })
  })
  const decision = NeedsMutation.make({
    subject: subjectId,
    precondition: MutationPrecondition.make({ kind: NonEmptyName.make("provider-authorized-absence") })
  })
  const credentials = makeCredentialProvider({
    acquire: (request) => {
      events.push(`credential:${request.purpose}:${request.strategy.kind}`)
      if (request.strategy.kind === "anonymous") {
        return Effect.succeed({ _tag: "AnonymousAccess", purposes: ["observe"] } as const)
      }
      if (request.strategy.kind === "token") {
        return Effect.succeed({
          _tag: "ScopedSecret",
          purposes: ["publish"],
          ref: request.strategy.credential
        } as const)
      }
      return Effect.die("The Plan 224 Action fixture does not request workload identity.")
    }
  })
  const http: HttpAuthorizer["Service"] = {
    execute: (request) => Effect.sync(() => {
      events.push(`http:${request.url.endsWith("/before") ? "pre-mutation" : "post-mutation"}`)
      return { status: 200, headers: {}, body: "{}" }
    })
  }
  const subject: ReleaseSubject = {
    id: subjectId,
    recovery: conservativeUnknownRecoveryProfile,
    observationRequests: [observationRequest],
    mutationRequest,
    observe: (grant, context) => {
      if (grant._tag === "WorkloadIdentity") {
        return Effect.die("Workload identity cannot enter the fixture observation sink.")
      }
      return http.execute({
        subject: subjectId,
        method: "GET",
        url: `${audience}${context.phase === "pre-mutation" ? "before" : "after"}`
      }, grant).pipe(
        Effect.mapError(() => new ReleaseSubjectError({
          subject: subjectId,
          phase: "observe",
          commitment: "before-dispatch",
          reason: SafeReason.make("The fake observation boundary rejected its request.")
        })),
        Effect.as(context.phase === "pre-mutation"
        ? AuthoritativelyAbsent.make({
          subject: subjectId,
          basis: AbsenceBasis.make({
            kind: NonEmptyName.make("authenticated-not-found"),
            detail: SafeReason.make("The exact provider identity is absent.")
          })
        })
        : PresentEquivalent.make({ subject: subjectId }))
      )
    },
    decide: () => decision,
    mutate: () => Effect.sync(() => {
      events.push("mutation:dispatch")
      return Applied.make({
        subject: subjectId,
        fact: ProviderMutationFact.make({
          subject: subjectId,
          detail: SafeReason.make("The fake provider accepted the exact mutation.")
        })
      })
    })
  }

  return {
    credentials,
    http,
    run: publishReleaseSubjects({ prepared, subjects: [subject] }).pipe(
      Effect.provideService(CredentialProvider, credentials),
      Effect.flatMap((report) => report.status === "complete"
        ? Effect.void
        : Effect.die(`Expected the fake provider to converge, observed ${report.status}.`))
    )
  }
}

const apiLayer = (
  store: PreparedReleaseStoreShape,
  runtime: ReleaseRuntimeShape,
  credentials: CredentialProvider["Service"],
  http: HttpAuthorizer["Service"]
) => Layer.mergeAll(
  Layer.succeed(ReleaseRuntime, runtime),
  Layer.succeed(PreparedReleaseStore, store),
  Layer.succeed(CredentialProvider, credentials),
  Layer.succeed(HttpAuthorizer, http),
  unavailableMutationServicesLayer
)

test("Action release durably verifies and exposes its artifact before mutation, then a fresh attempt resumes without rebuilding", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-plan224-"))
  const releaseWorkspace = join(root, "release")
  const retryWorkspace = join(root, "retry")
  const artifactRoot = join(root, "artifacts")
  const events: Array<string> = []
  let sourceObservations = 0
  let preparationRuns = 0
  let releaseCalls = 0
  let publishCalls = 0
  let releaseApi: ReturnType<typeof makeReleaseApi> | undefined
  let retryApi: ReturnType<typeof makeReleaseApi> | undefined

  try {
    mkdirSync(releaseWorkspace, { recursive: true })
    mkdirSync(retryWorkspace, { recursive: true })
    writeFileSync(join(releaseWorkspace, "package.json"), JSON.stringify({
      name: "fixture",
      version: "1.0.0"
    }))
    writeFileSync(join(releaseWorkspace, "release.config.json"), JSON.stringify(config))

    const runtime: ReleaseRuntimeShape = {
      source: {
        observe: (workspace) => Effect.sync(() => {
          sourceObservations += 1
          return contextFor(workspace.toString(), candidateCommit)
        })
      },
      run: (({ argv, cwd, environmentNames }) => Effect.sync(() => {
        preparationRuns += 1
        expect(argv[0]).toBe("fixture-build")
        expect(environmentNames).toEqual([])
        writeFileSync(join(cwd, "payload.txt"), "prepared payload\n")
        return { exitCode: 0, stdout: "", stderr: "" }
      })) satisfies RunCommand
    }
    const boundary = fakePublicationBoundary(events)
    const releaseAction = actionRuntime(
      releaseWorkspace,
      { command: "release", config: "release.config.json" },
      "release",
      events
    )
    const durableStore = makeActionPreparedReleaseStore({
      workspace: releaseWorkspace,
      context: producer,
      artifacts: artifactTransport(artifactRoot, "release", events),
      onCommit: (reference) => releaseAction.preparedReference.emit(
        encodeCompletePreparedReleaseRef(reference)
      )
    })

    // npm/GitHub mutation is deliberately unavailable until Plans 225/226.
    // Attach the shared provider-neutral coordinator immediately after the
    // real Action store has completed upload, download verification, and its
    // reference handoff. This acceptance seam changes no prepared bytes.
    const coordinatedStore: PreparedReleaseStoreShape = {
      commit: (manifest, blobs) => durableStore.commit(manifest, blobs).pipe(
        Effect.tap(() => boundary.run.pipe(Effect.orDie))
      ),
      load: durableStore.load
    }
    releaseApi = makeReleaseApi(apiLayer(
      coordinatedStore,
      runtime,
      boundary.credentials,
      boundary.http
    ))

    await runAction({
      release: async (input) => {
        releaseCalls += 1
        return releaseApi!.release(input)
      },
      prepare: (input) => releaseApi!.prepare(input),
      publish: (input) => releaseApi!.publish(input)
    }, releaseAction.runtime)

    expect(releaseCalls).toBe(1)
    expect(preparationRuns).toBe(1)
    const preparedText = releaseAction.outputs["prepared-ref"]
    expect(preparedText).toMatch(/^prepared:gha:/u)
    const prepared = await Effect.runPromise(decodeCompletePreparedReleaseRef(preparedText!))
    expect(prepared).toMatchObject({ scheme: "gha", runId: producer.runId, attempt: producer.runAttempt })

    const ordered = [
      events.indexOf("release:upload"),
      events.indexOf("release:download-verify"),
      events.indexOf("release:output:prepared-ref"),
      events.indexOf("credential:publish:token"),
      events.indexOf("mutation:dispatch")
    ]
    expect(ordered.every((index) => index >= 0)).toBe(true)
    expect(ordered).toEqual([...ordered].sort((left, right) => left - right))

    const observationsAfterRelease = sourceObservations
    const runsAfterRelease = preparationRuns
    const retryAction = actionRuntime(
      retryWorkspace,
      { command: "publish", prepared: preparedText! },
      "retry",
      events
    )
    const retryStore = makeActionPreparedReleaseStore({
      workspace: retryWorkspace,
      context: { ...producer, runAttempt: "2" },
      artifacts: artifactTransport(artifactRoot, "retry", events)
    })
    retryApi = makeReleaseApi(apiLayer(
      retryStore,
      runtime,
      boundary.credentials,
      boundary.http
    ))

    await runAction({
      release: (input) => retryApi!.release(input),
      prepare: (input) => retryApi!.prepare(input),
      publish: async (input) => {
        publishCalls += 1
        return retryApi!.publish(input)
      }
    }, retryAction.runtime)

    expect(publishCalls).toBe(1)
    expect(retryAction.outputs["prepared-ref"]).toBe(preparedText)
    expect(events.filter((event) => event === "retry:download-verify")).toHaveLength(1)
    expect(events.filter((event) => event === "retry:upload")).toHaveLength(0)
    expect(sourceObservations).toBe(observationsAfterRelease)
    expect(preparationRuns).toBe(runsAfterRelease)
  } finally {
    await retryApi?.dispose()
    await releaseApi?.dispose()
    rmSync(root, { recursive: true, force: true })
  }
})
