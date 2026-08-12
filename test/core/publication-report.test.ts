import { describe, expect, test } from "bun:test"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import {
  CanonicalAudience,
  CredentialPurpose,
  ProviderId,
  SubjectId
} from "../../src/model/authority.js"
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
  RejectedBeforeDispatch,
  SafeReason,
  Started,
  SubjectReport,
  absentObservation,
  differentObservation,
  equivalentObservation,
  inconclusiveObservation,
  makeAlreadyEquivalent,
  makeAuthorityAcquired,
  makeAuthorityAcquiredButMutationNotDispatched,
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
const authority = (
  purposes: readonly [CredentialPurpose, ...Array<CredentialPurpose>] = ["publish"]
) => get(makeAuthorityAcquired({
  subject,
  provider: ProviderId.make("npm"),
  audience: CanonicalAudience.make("https://registry.npmjs.org/@scope/package"),
  purpose: "publish",
  grantKind: "ScopedSecret",
  purposes
}))

describe("correlated publication reports", () => {
  test("constructs only same-subject outcomes with their required terminal observation", () => {
    const already = get(makeAlreadyEquivalent(subject, [equivalent()]))
    expect(already._tag).toBe("AlreadyEquivalent")

    const converged = get(makeConvergedAfterMutation({
      subject,
      preObservations: [different()],
      decision: needsMutation(),
      authority: authority(),
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
      authority: authority(),
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
      authority: authority(),
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
        authority: authority(),
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
      authority: authority(),
      attempt: Started.make({ subject }),
      trace: [different()]
    }))])
    expect(uncertain.status).toBe("uncertain")
  })

  test("records bundled authority that was acquired but never dispatched", () => {
    const acquired = authority(["observe", "publish"])
    const cause = get(makeAuthorityAcquiredButMutationNotDispatched({
      subject,
      authority: acquired,
      attempt: RejectedBeforeDispatch.make({
        subject,
        reason: reason("local request construction rejected the mutation")
      })
    }))
    const blocked = get(makeBlockedSubject({
      subject,
      observations: [different()],
      cause
    }))

    expect(blocked.cause._tag).toBe("AuthorityAcquiredButMutationNotDispatched")
    if (blocked.cause._tag !== "AuthorityAcquiredButMutationNotDispatched") throw new Error("unexpected cause")
    expect(blocked.cause.authority).toMatchObject({
      subject,
      provider: "npm",
      audience: "https://registry.npmjs.org/@scope/package",
      purpose: "publish",
      grantKind: "ScopedSecret",
      purposes: ["observe", "publish"]
    })
    expect(blocked.cause.attempt.reason.toString()).toBe("local request construction rejected the mutation")
    expect(JSON.stringify(blocked)).not.toContain("credential")
  })

  test("requires acquired-authority evidence on dispatched outcomes", () => {
    const acquired = authority()
    const converged = get(makeConvergedAfterMutation({
      subject,
      preObservations: [different()],
      decision: needsMutation(),
      authority: acquired,
      attempt: applied(),
      postObservations: [equivalent()]
    }))
    const uncertain = get(makeUncertainSubject({
      subject,
      observations: [different()],
      decision: needsMutation(),
      authority: acquired,
      attempt: Started.make({ subject }),
      trace: [different()]
    }))

    expect(converged.authority).toEqual(acquired)
    expect(uncertain.authority).toEqual(acquired)
  })

  test("an equivalent outcome has no authority field", () => {
    const already = get(makeAlreadyEquivalent(subject, [equivalent()]))
    expect(Object.hasOwn(already, "authority")).toBe(false)
    expect(Object.hasOwn(Schema.encodeSync(SubjectReport)(already), "authority")).toBe(false)
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
