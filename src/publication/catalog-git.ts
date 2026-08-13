import { createHash } from "node:crypto"
import * as Effect from "effect/Effect"
import type { CredentialRequest } from "../model/authority.js"
import { CredentialRequest as CredentialRequestSchema, SubjectId } from "../model/authority.js"
import {
  CatalogManagedState,
  compareCatalogVersions,
  decodeCatalogManagedState
} from "../model/catalog.js"
import { digestEquals, sha256Digest } from "../model/digest.js"
import { NonEmptyName } from "../model/primitives.js"
import type { PreparedCatalogPublication } from "../release/prepared.js"
import type { PreparedBundle } from "../release/prepared-store.js"
import type { CredentialGrant, MutationCredentialGrant, PublisherOperation, ScopedSecret } from "./authority.js"
import { ReleaseSubjectError, type ReleaseObservationContext, type ReleaseSubject } from "./coordinator.js"
import type { AuthorizedMutationHttpShape, HttpAuthorizerShape, HttpResponse, MutationHttpRequest } from "./http.js"
import {
  AbsenceBasis,
  Applied,
  AuthoritativelyAbsent,
  Conflict,
  Difference,
  InconclusiveObservation,
  MutationPrecondition,
  NeedsMutation,
  OutcomeUnknown,
  PresentDifferent,
  PresentEquivalent,
  ProviderAlreadyEquivalent,
  ProviderBlocked,
  ProviderMutationFact,
  ProviderRejectionFact,
  RejectedByProvider,
  SafeReason,
  Started,
  VisibilityBasis,
  VisibilityPending,
  type MutationAttempt,
  type MutationDecision,
  type Observation,
  type ProviderDecision
} from "./report.js"
import { makeRecoveryCapabilityProfile } from "./recovery.js"

const apiVersion = "2022-11-28"
const jsonHeaders = {
  accept: "application/vnd.github+json",
  "x-github-api-version": apiVersion
} as const
const objectSha = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u

export const catalogRecoveryCapabilityProfile = makeRecoveryCapabilityProfile({
  observation: "exact",
  authoritativeAbsence: "provider-specific",
  createAuthorization: "none",
  replay: "conditional",
  identifierReuse: "reusable",
  correction: ["forward-catalog-state"],
  exposure: "persistent-to-consumers",
  historyRequirement: "optional-evidence",
  readConvergence: {
    contract: {
      _tag: "assumed",
      basis: "ASSUMED/UNVERIFIED: no authorized live mutation evidence establishes GitHub Git-data read-convergence timing."
    },
    observationRetry: {
      maxAttempts: 5,
      backoff: { baseMs: 1_000, factor: 2, capMs: 15_000 },
      totalBudgetMs: 60_000
    },
    retryEligible: "VisibilityPending | Inconclusive",
    exhaustion: "UncertainSubject with full trace"
  }
})

type JsonObject = Readonly<Record<string, unknown>>
const object = (value: unknown): JsonObject | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : undefined
const string = (value: unknown): string | undefined => typeof value === "string" ? value : undefined
const parseJson = (body: string | Uint8Array): unknown | undefined => {
  try {
    return JSON.parse(typeof body === "string" ? body : new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown
  } catch {
    return undefined
  }
}
const bytesEqual = (left: Uint8Array | undefined, right: Uint8Array): boolean =>
  left !== undefined && left.length === right.length && left.every((byte, index) => byte === right[index])

interface TreeEntry {
  readonly path: string
  readonly mode: string
  readonly type: "blob" | "tree" | "commit"
  readonly sha: string
}

interface RepositorySnapshot {
  readonly commit: string
  readonly rootTree: string
  readonly tree: ReadonlyMap<string, TreeEntry>
  readonly target?: Uint8Array
  readonly state?: Uint8Array
}

interface MutationPlan {
  readonly snapshot: RepositorySnapshot
}

export interface CatalogSubjectPair {
  readonly id?: SubjectId
  readonly purpose?: "publish" | "correct"
  readonly target: Uint8Array
  readonly state: Uint8Array
  /** Exact old pair that authorizes one forward correction. */
  readonly baselineTarget?: Uint8Array
  readonly baselineState?: Uint8Array
}

const observationRequests = (
  publication: PreparedCatalogPublication,
  subject: SubjectId
): readonly [CredentialRequest, ...Array<CredentialRequest>] => publication.authority.observationStrategies.map((strategy) =>
  CredentialRequestSchema.make({
    subject,
    provider: publication.authority.provider,
    audience: publication.authority.audience,
    purpose: "observe",
    strategy
  })) as [CredentialRequest, ...Array<CredentialRequest>]

const mutationRequest = (
  publication: PreparedCatalogPublication,
  subject: SubjectId,
  purpose: "publish" | "correct"
): CredentialRequest => CredentialRequestSchema.make({
  subject,
  provider: publication.authority.provider,
  audience: publication.authority.audience,
  purpose,
  strategy: publication.authority.publishStrategy
})

const failure = (
  subject: SubjectId,
  phase: "observe" | "mutate",
  commitment: "before-dispatch" | "unknown",
  reason: string
): ReleaseSubjectError => new ReleaseSubjectError({
  subject,
  phase,
  commitment,
  reason: SafeReason.make(reason)
})

const inconclusive = (subject: SubjectId, reason: string): InconclusiveObservation =>
  InconclusiveObservation.make({ subject, reason: SafeReason.make(reason) })
const difference = (field: string, expected: string, observed: string): Difference => Difference.make({
  field: NonEmptyName.make(field),
  expected: SafeReason.make(expected),
  observed: SafeReason.make(observed)
})
const fingerprint = (bytes: Uint8Array): string => `sha256-${sha256Digest(bytes).hex}`

const get = (
  subject: SubjectId,
  http: HttpAuthorizerShape,
  grant: Exclude<CredentialGrant, { readonly _tag: "WorkloadIdentity" }>,
  url: string
): Effect.Effect<HttpResponse, ReleaseSubjectError> => http.execute({
  subject,
  method: "GET",
  url,
  headers: jsonHeaders
}, grant).pipe(Effect.mapError((cause) => failure(
  subject,
  "observe",
  cause._tag === "CredentialPlatformError" ? cause.commitment : "before-dispatch",
  "GitHub catalog observation failed at the authorized HTTP boundary."
)))

const treeEntries = (value: unknown, expectedSha: string): ReadonlyArray<TreeEntry> | undefined => {
  const root = object(value)
  if (root?.sha !== expectedSha || root.truncated !== false || !Array.isArray(root.tree)) return undefined
  const result: Array<TreeEntry> = []
  const paths = new Set<string>()
  for (const raw of root.tree) {
    const entry = object(raw)
    const path = string(entry?.path)
    const mode = string(entry?.mode)
    const type = entry?.type
    const sha = string(entry?.sha)
    if (path === undefined || path.length === 0 || path.startsWith("/") || path.includes("\\") ||
        path.split("/").some((part) => part === "" || part === "..") || paths.has(path) ||
        mode === undefined || !/^[0-7]{6}$/u.test(mode) ||
        (type !== "blob" && type !== "tree" && type !== "commit") || sha === undefined || !objectSha.test(sha)) {
      return undefined
    }
    paths.add(path)
    result.push({ path, mode, type, sha })
  }
  return result
}

const gitObjectDigest = (bytes: Uint8Array, length: number): string => {
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`)
  const content = new Uint8Array(header.length + bytes.length)
  content.set(header)
  content.set(bytes, header.length)
  return createHash(length === 40 ? "sha1" : "sha256").update(content).digest("hex")
}

const blobBytes = (value: unknown, expectedSha: string): Uint8Array | undefined => {
  const blob = object(value)
  const content = string(blob?.content)?.replaceAll(/\s/gu, "")
  if (blob?.sha !== expectedSha || blob.encoding !== "base64" || content === undefined ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(content)) return undefined
  const bytes = new Uint8Array(Buffer.from(content, "base64"))
  return gitObjectDigest(bytes, expectedSha.length) === expectedSha ? bytes : undefined
}

const readSnapshot = Effect.fn("CatalogGitSubject.readSnapshot")(function*(
  publication: PreparedCatalogPublication,
  subject: SubjectId,
  http: HttpAuthorizerShape,
  grant: Exclude<CredentialGrant, { readonly _tag: "WorkloadIdentity" }>
) {
  const base = publication.authority.audience.toString()
  const repository = yield* get(subject, http, grant, base)
  if (repository.status === 404) return { _tag: "Inconclusive", reason: "Catalog repository is missing or hidden." } as const
  if (repository.status !== 200 || object(parseJson(repository.body))?.full_name !== publication.repository) {
    return { _tag: "Inconclusive", reason: "Catalog repository visibility or identity was not proved." } as const
  }
  const fullRef = `refs/heads/${publication.branch}`
  const ref = yield* get(subject, http, grant, `${base}/git/ref/heads/${encodeURIComponent(publication.branch)}`)
  const refObject = object(parseJson(ref.body))
  const commit = string(object(refObject?.object)?.sha)
  if (ref.status !== 200 || refObject?.ref !== fullRef || commit === undefined || !objectSha.test(commit)) {
    return { _tag: "Inconclusive", reason: "Catalog branch ref is missing, hidden, or malformed." } as const
  }
  const commitResponse = yield* get(subject, http, grant, `${base}/git/commits/${commit}`)
  const commitObject = object(parseJson(commitResponse.body))
  const rootTree = string(object(commitObject?.tree)?.sha)
  if (commitResponse.status !== 200 || commitObject?.sha !== commit || rootTree === undefined || !objectSha.test(rootTree)) {
    return { _tag: "Inconclusive", reason: "Catalog branch commit/root tree was malformed." } as const
  }
  const treeResponse = yield* get(subject, http, grant, `${base}/git/trees/${rootTree}?recursive=1`)
  const entries = treeResponse.status === 200 ? treeEntries(parseJson(treeResponse.body), rootTree) : undefined
  if (entries === undefined) return { _tag: "Inconclusive", reason: "Catalog full tree was truncated, malformed, or unavailable." } as const
  const tree = new Map(entries.map((entry) => [entry.path, entry]))
  const targetEntry = tree.get(publication.targetPath.toString())
  const stateEntry = tree.get(publication.statePath.toString())
  if ((targetEntry !== undefined && (targetEntry.type !== "blob" || !["100644", "100755"].includes(targetEntry.mode))) ||
      (stateEntry !== undefined && (stateEntry.type !== "blob" || stateEntry.mode !== "100644"))) {
    return { _tag: "Inconclusive", reason: "Catalog managed paths have unsupported Git object types or modes." } as const
  }
  const readBlob = (entry: TreeEntry | undefined) => entry === undefined
    ? Effect.succeed(undefined)
    : get(subject, http, grant, `${base}/git/blobs/${entry.sha}`).pipe(Effect.map((response) =>
      response.status === 200 ? blobBytes(parseJson(response.body), entry.sha) : undefined))
  const target = yield* readBlob(targetEntry)
  const state = yield* readBlob(stateEntry)
  if ((targetEntry !== undefined && target === undefined) || (stateEntry !== undefined && state === undefined)) {
    return { _tag: "Inconclusive", reason: "Catalog target or managed-state blob was malformed or unavailable." } as const
  }
  return {
    _tag: "Snapshot",
    snapshot: { commit, rootTree, tree, ...(target === undefined ? {} : { target }), ...(state === undefined ? {} : { state }) }
  } as const
})

const pairObservation = (
  publication: PreparedCatalogPublication,
  subject: SubjectId,
  pair: CatalogSubjectPair,
  snapshot: RepositorySnapshot,
  context: ReleaseObservationContext,
  setPlan: (plan: MutationPlan | undefined) => void
): Observation => {
  const absentPair = snapshot.target === undefined && snapshot.state === undefined
  if (absentPair) {
    if (context.phase === "post-mutation" && context.attempt._tag !== "RejectedBeforeDispatch" &&
        context.attempt._tag !== "RejectedByProvider") return VisibilityPending.make({
      subject,
      expectation: SafeReason.make("The exact catalog target/state pair becomes visible at the updated branch ref."),
      basis: VisibilityBasis.make({
        kind: NonEmptyName.make("catalog-git-ref-convergence"),
        detail: SafeReason.make("The same invocation attempted one conditional GitHub ref update.")
      })
    })
    setPlan({ snapshot })
    return AuthoritativelyAbsent.make({
      subject,
      basis: AbsenceBasis.make({
        kind: NonEmptyName.make("catalog-visible-repository-pair-absent"),
        detail: SafeReason.make("The visible branch full tree omits both exact managed paths.")
      })
    })
  }
  if (snapshot.target === undefined || snapshot.state === undefined) return PresentDifferent.make({
    subject,
    differences: [difference("catalog.pair", "both files present or absent", "half-present")]
  })
  if (bytesEqual(snapshot.target, pair.target) && bytesEqual(snapshot.state, pair.state)) {
    return PresentEquivalent.make({ subject })
  }
  if (pair.baselineTarget !== undefined && pair.baselineState !== undefined &&
      bytesEqual(snapshot.target, pair.baselineTarget) && bytesEqual(snapshot.state, pair.baselineState)) {
    if (context.phase === "post-mutation" && context.attempt._tag !== "RejectedBeforeDispatch" &&
        context.attempt._tag !== "RejectedByProvider") return VisibilityPending.make({
      subject,
      expectation: SafeReason.make("The forward catalog correction becomes visible at the branch ref."),
      basis: VisibilityBasis.make({
        kind: NonEmptyName.make("catalog-git-ref-convergence"),
        detail: SafeReason.make("The old exact pair remains visible immediately after one conditional update attempt.")
      })
    })
    setPlan({ snapshot })
    return PresentDifferent.make({
      subject,
      differences: [difference("catalog.correction", "forward replacement", "exact prepared baseline")]
    })
  }
  const observedState = decodeCatalogManagedState(snapshot.state)
  const expectedState = decodeCatalogManagedState(pair.state)
  if (observedState === undefined || expectedState === undefined) return inconclusive(
    subject,
    "Catalog managed state is malformed or noncanonical."
  )
  if (!digestEquals(observedState.targetDigest, sha256Digest(snapshot.target)) ||
      !digestEquals(expectedState.targetDigest, sha256Digest(pair.target))) return inconclusive(
    subject,
    "Catalog managed state does not bind the exact adjacent target bytes."
  )
  if (pair.baselineTarget === undefined && observedState.status === "active" && expectedState.status === "active") {
    const ordering = compareCatalogVersions(observedState.generation.toString(), expectedState.generation.toString())
    if (ordering < 0 && observedState.catalogId === expectedState.catalogId &&
        observedState.renderer === expectedState.renderer &&
        observedState.sourceRepository === expectedState.sourceRepository) {
      setPlan({ snapshot })
      return PresentDifferent.make({
        subject,
        differences: [difference("catalog.generation", expectedState.generation.toString(), observedState.generation.toString())]
      })
    }
  }
  return PresentDifferent.make({
    subject,
    differences: [
      difference("catalog.target", fingerprint(pair.target), fingerprint(snapshot.target)),
      difference("catalog.state", fingerprint(pair.state), fingerprint(snapshot.state))
    ]
  })
}

const managedAncestors = (paths: ReadonlyArray<string>): ReadonlySet<string> => {
  const result = new Set<string>()
  for (const path of paths) {
    const parts = path.split("/")
    for (let index = 1; index < parts.length; index += 1) result.add(parts.slice(0, index).join("/"))
  }
  return result
}

const treePreserved = (
  before: ReadonlyMap<string, TreeEntry>,
  after: ReadonlyArray<TreeEntry>,
  targetPath: string,
  targetSha: string,
  statePath: string,
  stateSha: string
): boolean => {
  const afterMap = new Map(after.map((entry) => [entry.path, entry]))
  const managed = new Set([targetPath, statePath])
  const ancestors = managedAncestors([targetPath, statePath])
  const target = afterMap.get(targetPath)
  const state = afterMap.get(statePath)
  if (target?.type !== "blob" || target.mode !== "100644" || target.sha !== targetSha ||
      state?.type !== "blob" || state.mode !== "100644" || state.sha !== stateSha) return false
  for (const [path, entry] of before) {
    if (managed.has(path) || ancestors.has(path)) continue
    const candidate = afterMap.get(path)
    if (candidate === undefined || candidate.mode !== entry.mode || candidate.type !== entry.type || candidate.sha !== entry.sha) return false
  }
  for (const path of afterMap.keys()) {
    if (!before.has(path) && !managed.has(path) && !ancestors.has(path)) return false
  }
  return true
}

const mutationAttempt = (
  subject: SubjectId,
  code: string,
  detail: string
): RejectedByProvider => RejectedByProvider.make({
  subject,
  fact: ProviderRejectionFact.make({
    subject,
    code: NonEmptyName.make(code),
    detail: SafeReason.make(detail)
  })
})

export const makeCatalogSubject = (
  publication: PreparedCatalogPublication,
  http: HttpAuthorizerShape,
  mutationHttp: AuthorizedMutationHttpShape,
  pair: CatalogSubjectPair
): ReleaseSubject => {
  const subject = pair.id ?? publication.authority.subject
  const purpose = pair.purpose ?? "publish"
  let plan: MutationPlan | undefined
  const observe = Effect.fn("CatalogGitSubject.observe")(function*(grant: CredentialGrant, context: ReleaseObservationContext) {
    plan = undefined
    if (grant._tag === "WorkloadIdentity") return inconclusive(subject, "Catalog Git observation does not accept workload identity.")
    const result = yield* readSnapshot(publication, subject, http, grant)
    if (result._tag === "Inconclusive") return inconclusive(subject, result.reason)
    return pairObservation(publication, subject, pair, result.snapshot, context, (value) => { plan = value })
  })
  const decide = (observation: Observation): ProviderDecision => {
    if (observation._tag === "PresentEquivalent") return ProviderAlreadyEquivalent.make({ subject })
    if (plan !== undefined && (observation._tag === "AuthoritativelyAbsent" || observation._tag === "PresentDifferent")) {
      return NeedsMutation.make({
        subject,
        precondition: MutationPrecondition.make({ kind: NonEmptyName.make("catalog-observed-ref-and-root-tree") })
      })
    }
    if (observation._tag === "PresentDifferent") return Conflict.make({ subject, differences: observation.differences })
    return ProviderBlocked.make({
      subject,
      reason: SafeReason.make("Catalog observation did not prove an exact conditional pair update.")
    })
  }

  const mutate = Effect.fn("CatalogGitSubject.mutate")(function*(
    decision: MutationDecision,
    grant: MutationCredentialGrant
  ): Effect.fn.Return<MutationAttempt, ReleaseSubjectError> {
    const selected = plan
    plan = undefined
    if (decision._tag !== "NeedsMutation" || decision.precondition.kind !== "catalog-observed-ref-and-root-tree" ||
        selected === undefined || grant._tag !== "ScopedSecret") {
      return yield* failure(subject, "mutate", "before-dispatch", "Catalog mutation lacks its exact observed ref/tree plan or token grant.")
    }
    const operation: PublisherOperation = purpose === "publish"
      ? {
          _tag: "PublishOperation",
          subject,
          provider: publication.authority.provider,
          audience: publication.authority.audience,
          purpose,
          decision
        }
      : {
          _tag: "CorrectionOperation",
          subject,
          provider: publication.authority.provider,
          audience: publication.authority.audience,
          purpose,
          decision
        }
    const dispatch = (request: MutationHttpRequest) => mutationHttp.execute(operation, request, grant).pipe(
      Effect.mapError((cause) => failure(
        subject,
        "mutate",
        cause._tag === "CredentialPlatformError" ? cause.commitment : "before-dispatch",
        "GitHub catalog mutation failed at the authorized HTTP boundary."
      ))
    )
    const json = (value: unknown): { readonly body: string, readonly headers: Readonly<Record<string, string>> } => {
      const body = JSON.stringify(value)
      return {
        body,
        headers: { ...jsonHeaders, "content-type": "application/json", "content-length": String(new TextEncoder().encode(body).length) }
      }
    }
    const base = publication.authority.audience.toString()
    const createBlob = Effect.fn("CatalogGitSubject.createBlob")(function*(bytes: Uint8Array) {
      const response = yield* dispatch({
        method: "POST",
        url: `${base}/git/blobs`,
        credentialScheme: "bearer",
        ...json({ content: Buffer.from(bytes).toString("base64"), encoding: "base64" })
      })
      const sha = string(object(parseJson(response.body))?.sha)
      return response.status === 201 && sha !== undefined && objectSha.test(sha) && gitObjectDigest(bytes, sha.length) === sha
        ? { _tag: "Created", sha } as const
        : { _tag: "Rejected", attempt: mutationAttempt(subject, `catalog-blob-http-${response.status}`, "GitHub did not prove exact catalog blob creation.") } as const
    })
    const targetBlob = yield* createBlob(pair.target)
    if (targetBlob._tag === "Rejected") return targetBlob.attempt
    const stateBlob = yield* createBlob(pair.state)
    if (stateBlob._tag === "Rejected") return stateBlob.attempt
    const treeResponse = yield* dispatch({
      method: "POST",
      url: `${base}/git/trees`,
      credentialScheme: "bearer",
      ...json({
        base_tree: selected.snapshot.rootTree,
        tree: [
          { path: publication.targetPath, mode: "100644", type: "blob", sha: targetBlob.sha },
          { path: publication.statePath, mode: "100644", type: "blob", sha: stateBlob.sha }
        ]
      })
    })
    const proposedTree = string(object(parseJson(treeResponse.body))?.sha)
    if (treeResponse.status !== 201 || proposedTree === undefined || !objectSha.test(proposedTree)) {
      return mutationAttempt(subject, `catalog-tree-http-${treeResponse.status}`, "GitHub did not prove base-tree catalog tree creation.")
    }
    const proposedResponse = yield* get(subject, http, grant, `${base}/git/trees/${proposedTree}?recursive=1`)
    const proposedEntries = proposedResponse.status === 200 ? treeEntries(parseJson(proposedResponse.body), proposedTree) : undefined
    if (proposedEntries === undefined || !treePreserved(
      selected.snapshot.tree,
      proposedEntries,
      publication.targetPath.toString(),
      targetBlob.sha,
      publication.statePath.toString(),
      stateBlob.sha
    )) return mutationAttempt(subject, "catalog-tree-preservation-refused", "Proposed GitHub tree did not preserve every unrelated path, object, and mode.")
    const commitResponse = yield* dispatch({
      method: "POST",
      url: `${base}/git/commits`,
      credentialScheme: "bearer",
      ...json({
        message: purpose === "correct"
          ? `Correct ${publication.catalogId} catalog state`
          : `Publish ${publication.catalogId} ${publication.version}`,
        tree: proposedTree,
        parents: [selected.snapshot.commit]
      })
    })
    const commit = string(object(parseJson(commitResponse.body))?.sha)
    if (commitResponse.status !== 201 || commit === undefined || !objectSha.test(commit)) {
      return mutationAttempt(subject, `catalog-commit-http-${commitResponse.status}`, "GitHub did not prove exact-parent catalog commit creation.")
    }
    const refResponse = yield* dispatch({
      method: "PATCH",
      url: `${base}/git/refs/heads/${encodeURIComponent(publication.branch)}`,
      credentialScheme: "bearer",
      ...json({ sha: commit, force: false })
    })
    if (refResponse.status === 409 || refResponse.status === 422) {
      return mutationAttempt(subject, `catalog-ref-http-${refResponse.status}`, "The catalog branch moved or refused the non-force update; reobservation is required.")
    }
    if (refResponse.status !== 200) {
      return OutcomeUnknown.make({
        subject,
        reason: SafeReason.make(`GitHub catalog ref update returned HTTP ${refResponse.status}; exact reobservation decides the outcome.`)
      })
    }
    const ref = object(parseJson(refResponse.body))
    if (ref?.ref !== `refs/heads/${publication.branch}` || object(ref.object)?.sha !== commit) {
      return OutcomeUnknown.make({
        subject,
        reason: SafeReason.make("GitHub accepted the catalog ref request but returned no exact updated-ref proof.")
      })
    }
    return Started.make({ subject })
  })

  return {
    id: subject,
    recovery: catalogRecoveryCapabilityProfile,
    observationRequests: observationRequests(publication, subject),
    mutationRequest: mutationRequest(publication, subject, purpose),
    observe,
    decide,
    mutate
  }
}

export const makeCatalogPublicationSubject = (
  bundle: PreparedBundle,
  publication: PreparedCatalogPublication,
  http: HttpAuthorizerShape,
  mutationHttp: AuthorizedMutationHttpShape
): ReleaseSubject => {
  const target = bundle.blobs.get(publication.targetArtifactId.toString())
  const state = bundle.blobs.get(publication.stateArtifactId.toString())
  if (target === undefined || state === undefined || !digestEquals(sha256Digest(target), publication.targetDigest) ||
      !digestEquals(sha256Digest(state), publication.stateDigest)) {
    const invalid = makeCatalogSubject(publication, http, mutationHttp, {
      target: new Uint8Array(), state: new Uint8Array()
    })
    return {
      ...invalid,
      observe: () => Effect.succeed(inconclusive(
        invalid.id,
        "Prepared catalog target/state bytes are missing or disagree with their durable digests."
      )),
      decide: () => ProviderBlocked.make({
        subject: invalid.id,
        reason: SafeReason.make("Prepared catalog target/state evidence is unavailable.")
      }),
      mutate: () => Effect.fail(failure(
        invalid.id,
        "mutate",
        "before-dispatch",
        "Prepared catalog target/state evidence is unavailable."
      ))
    }
  }
  return makeCatalogSubject(publication, http, mutationHttp, { target, state })
}
