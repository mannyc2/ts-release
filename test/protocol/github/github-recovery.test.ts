import { describe, expect, it } from "@effect/bun-test"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as TestClock from "effect/testing/TestClock"
import { SubjectId } from "../../../src/model/authority.js"
import { CredentialProvider } from "../../../src/publication/authority.js"
import { publishReleaseSubjects } from "../../../src/publication/coordinator.js"
import { makeGithubSubjects } from "../../../src/publication/github.js"
import {
  GithubProtocolScenarioSchemaVersion,
  makeGithubProtocolDouble,
  type GithubProtocolFaultV1,
  type GithubProtocolScenarioV1
} from "./double.js"
import {
  githubProtocolCredentials,
  makeGithubFixture,
  preparedCommit
} from "./fixture.js"

const apiBase = "https://api.github.com/repos/owner/project"
const releaseUrl = `${apiBase}/releases/tags/v1.0.0`

const visibilityFault = (): GithubProtocolFaultV1 => ({
  phase: "observe",
  method: "GET",
  url: releaseUrl,
  afterMutationCount: 1,
  outcome: { _tag: "HttpStatus", status: 404 }
})

const scenario = (faults: Array<GithubProtocolFaultV1>): GithubProtocolScenarioV1 => ({
  schemaVersion: GithubProtocolScenarioSchemaVersion,
  repository: "owner/project",
  tag: "v1.0.0",
  targetCommit: preparedCommit,
  faults
})

const publication = (faults: Array<GithubProtocolFaultV1>) => {
  const fixture = makeGithubFixture([])
  const double = makeGithubProtocolDouble(scenario(faults))
  const subject = makeGithubSubjects(
    fixture.bundle,
    fixture.publication,
    double.http,
    double.mutationHttp
  )[0]
  const run = publishReleaseSubjects({
    prepared: SubjectId.make("prepared:github-recovery-protocol"),
    subjects: [subject]
  }).pipe(Effect.provideService(CredentialProvider, githubProtocolCredentials()))
  return { double, run }
}

describe("GitHub provider read convergence protocol", () => {
  it.effect("one post-create hidden 404 becomes VisibilityPending and then converges without another mutation", () =>
    Effect.gen(function*() {
      const fixture = publication([visibilityFault(), visibilityFault()])
      const fiber = yield* fixture.run.pipe(Effect.forkChild)
      yield* TestClock.adjust(Duration.seconds(1))
      const report = yield* Fiber.join(fiber)

      expect(report.status).toBe("complete")
      expect(report.subjects[1]).toMatchObject({
        _tag: "ConvergedAfterMutation",
        attempt: { _tag: "Applied" },
        postObservations: [
          { _tag: "Inconclusive" },
          { _tag: "VisibilityPending" },
          { _tag: "PresentEquivalent" }
        ]
      })
      expect(fixture.double.mutationCount()).toBe(1)
    }))

  it.effect("repeated post-create hidden 404s exhaust the bounded profile with the full ordered trace", () =>
    Effect.gen(function*() {
      const fixture = publication(Array.from({ length: 10 }, visibilityFault))
      const fiber = yield* fixture.run.pipe(Effect.forkChild)
      yield* TestClock.adjust(Duration.seconds(60))
      const report = yield* Fiber.join(fiber)

      expect(report.status).toBe("uncertain")
      expect(report.subjects[1]).toMatchObject({
        _tag: "UncertainSubject",
        attempt: { _tag: "Applied" },
        trace: Array.from({ length: 5 }, () => [
          { _tag: "Inconclusive" },
          { _tag: "VisibilityPending" }
        ]).flat()
      })
      expect(fixture.double.mutationCount()).toBe(1)
    }))
})
