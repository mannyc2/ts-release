import { describe, expect, test } from "bun:test"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import { SubjectId } from "../../src/model/authority.js"
import { NonEmptyName } from "../../src/model/primitives.js"
import {
  AbsenceBasis,
  Applied,
  Conflict,
  CreateAuthorizationProof,
  DependencyBlocked,
  Difference,
  MutationPrecondition,
  NeedsMutation,
  ObservationReport,
  OutcomeUnknown,
  PresentDifferent,
  PresentEquivalent,
  ProviderAuthorizedCreate,
  ProviderMutationFact,
  SafeReason,
  Started,
  SubjectReport,
  absentObservation,
  differentObservation,
  equivalentObservation,
  inconclusiveObservation,
  makeAlreadyEquivalent,
  makeBlockedSubject,
  makeConvergedAfterMutation,
  makeNotReached,
  makeObservationReport,
  makeReleaseReport,
  makeUncertainSubject,
  ObservedSubject
} from "../../src/publication/report.js"

const subject = SubjectId.make("npm:@scope/package@1.0.0")
const otherSubject = SubjectId.make("github:owner/repo#v1.0.0")
const reason = (value: string) => SafeReason.make(value)
const equivalent = () => PresentEquivalent.make({ subject })
const different = () => PresentDifferent.make({
  subject,
  differences: [new Difference({
    field: NonEmptyName.make("digest"),
    expected: reason("expected sha256"),
    observed: reason("different sha256")
  })]
})
const needsMutation = () => NeedsMutation.make({
  subject,
  precondition: new MutationPrecondition({ kind: NonEmptyName.make("authoritative-absence") })
})
const applied = () => Applied.make({
  subject,
  fact: new ProviderMutationFact({ subject, detail: reason("provider accepted the exact bytes") })
})

const get = <A, E>(result: Result.Result<A, E>): A => Result.getOrThrow(result)

describe("correlated publication reports", () => {
  test("constructs only same-subject outcomes with their required terminal observation", () => {
    const already = get(makeAlreadyEquivalent(subject, [equivalent()]))
    expect(already._tag).toBe("AlreadyEquivalent")

    const converged = get(makeConvergedAfterMutation({
      subject,
      preObservations: [different()],
      decision: needsMutation(),
      attempt: applied(),
      postObservations: [equivalent()]
    }))
    expect(converged._tag).toBe("ConvergedAfterMutation")

    expect(Result.isFailure(makeAlreadyEquivalent(subject, [
      PresentEquivalent.make({ subject: otherSubject })
    ]))).toBe(true)
    expect(Result.isFailure(makeConvergedAfterMutation({
      subject,
      preObservations: [different()],
      decision: needsMutation(),
      attempt: applied(),
      postObservations: [different()]
    }))).toBe(true)
  })

  test("rejects invalid correlations during durable schema decoding", () => {
    expect(() => Schema.decodeUnknownSync(SubjectReport)({
      _tag: "AlreadyEquivalent",
      subject,
      observations: [{ _tag: "PresentEquivalent", subject: otherSubject }]
    })).toThrow("same-subject")

    expect(() => Schema.decodeUnknownSync(SubjectReport)({
      _tag: "ConvergedAfterMutation",
      subject,
      preObservations: [different()],
      decision: needsMutation(),
      attempt: applied(),
      postObservations: [different()]
    })).toThrow("final PresentEquivalent")
  })

  test("derives complete, blocked, and uncertain status centrally", () => {
    const complete = makeReleaseReport([
      get(makeAlreadyEquivalent(subject, [equivalent()])),
      get(makeConvergedAfterMutation({
        subject,
        preObservations: [different()],
        decision: ProviderAuthorizedCreate.make({
          subject,
          proof: new CreateAuthorizationProof({ kind: NonEmptyName.make("trusted-publisher") })
        }),
        attempt: new OutcomeUnknown({ subject, reason: reason("response lost after dispatch") }),
        postObservations: [equivalent()]
      }))
    ])
    expect(complete.status).toBe("complete")

    const blocked = makeReleaseReport([
      get(makeBlockedSubject({
        subject,
        observations: [different()],
        cause: Conflict.make({ subject, differences: different().differences })
      })),
      get(makeNotReached(otherSubject, new DependencyBlocked({ prerequisite: subject })))
    ])
    expect(blocked.status).toBe("blocked")

    const uncertain = makeReleaseReport([get(makeUncertainSubject({
      subject,
      observations: [different()],
      decision: Conflict.make({ subject, differences: different().differences }),
      attempt: Started.make({ subject }),
      trace: [different()]
    }))])
    expect(uncertain.status).toBe("uncertain")
  })

  test("requires nonempty reports and rejects a caller-supplied false status", () => {
    expect(() => Schema.decodeUnknownSync(ObservationReport)({ subjects: [], status: "equivalent" })).toThrow()
    expect(() => Schema.decodeUnknownSync(ObservationReport)({
      subjects: [new ObservedSubject({ subject, observation: inconclusiveObservation(reason("read timed out")) })],
      status: "equivalent"
    })).toThrow("derived")
  })
})

describe("read-only observation reports", () => {
  test("derive status without exposing mutation decisions or attempts", () => {
    expect(makeObservationReport([
      new ObservedSubject({ subject, observation: equivalentObservation() })
    ]).status).toBe("equivalent")

    expect(makeObservationReport([
      new ObservedSubject({ subject, observation: differentObservation(different().differences) }),
      new ObservedSubject({
        subject: otherSubject,
        observation: absentObservation(new AbsenceBasis({
          kind: NonEmptyName.make("authoritative-404"),
          detail: reason("repository and namespace were authenticated")
        }))
      })
    ]).status).toBe("different")

    expect(makeObservationReport([
      new ObservedSubject({ subject, observation: inconclusiveObservation(reason("visibility unknown")) })
    ]).status).toBe("inconclusive")

    expect(() => Schema.decodeUnknownSync(ObservationReport)({
      subjects: [{ subject, observation: applied() }],
      status: "equivalent"
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(ObservationReport)({
      subjects: [{ subject, observation: needsMutation() }],
      status: "different"
    })).toThrow()
  })

  test("bounds public reasons and rejects token-shaped material", () => {
    expect(() => SafeReason.make("")).toThrow()
    expect(() => SafeReason.make("x".repeat(2049))).toThrow()
    expect(() => SafeReason.make("npm_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL")).toThrow()
    expect(SafeReason.make("provider response unavailable").toString()).toBe("provider response unavailable")
  })
})
