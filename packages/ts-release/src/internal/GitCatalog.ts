import { Effect, Schema } from "effect"
import type * as Redacted from "effect/Redacted"
import { Content } from "./ArtifactModel.js"
import { type ReadContent, type PutContent, readVerifiedContent } from "./Content.js"
import { ReleaseError, attempt, fail } from "./Error.js"
import { canonical, decodeOwned, sha256 } from "./Identity.js"
import { GitCas, type Operation } from "./ReleaseModel.js"
import { GitReceipt, pushWitness, validRef } from "./GitAuthority.js"
import { PROVIDER_CONTRACT, makeRequest, type ProviderDefinition } from "../Provider.js"
import { createOperation } from "../Plan.js"
import { publicUrl } from "../Http.js"

export class FileEdit extends Schema.Class<FileEdit>("GitFileEdit")({
  path: Schema.String,
  mode: Schema.Literals(["100644", "100755"]),
  content: Content,
}) {}
export class Identity extends Schema.Class<Identity>("GitIdentity")({
  name: Schema.String,
  email: Schema.String,
  timestamp: Schema.String,
  timezone: Schema.String,
}) {}
const coordinate = {
  remote: Schema.String,
  ref: Schema.String,
  principal: Schema.String,
  scope: Schema.String,
}
export class CommitInput extends Schema.Class<CommitInput>("GitCommitInput")({
  ...coordinate,
  expectedOld: Schema.String,
  baseObjects: Content,
  files: Schema.Array(FileEdit),
  message: Schema.String,
  author: Identity,
  committer: Identity,
}) {}
export class Intent extends Schema.Class<Intent>("GitCatalogIntent")({
  ...coordinate,
  expectedOld: Schema.String,
  desiredNew: Schema.String,
  objectFormat: Schema.Literals(["sha1", "sha256"]),
  objectSet: Content,
  files: Schema.Array(FileEdit),
}) {}
export type RefCoordinate = Pick<Intent, "remote" | "ref" | "principal" | "scope">
export type Credentials =
  | { readonly _tag: "Anonymous" }
  | { readonly _tag: "Bearer"; readonly token: Redacted.Redacted<string> }
  | {
      readonly _tag: "Basic"
      readonly username: string
      readonly password: Redacted.Redacted<string>
    }
export type ObserveRef = (
  input: RefCoordinate,
) => Effect.Effect<{ readonly oid: string | null }, ReleaseError>
export interface ObjectBuilder {
  readonly construct: (
    input: CommitInput,
    read: ReadContent,
  ) => Effect.Effect<
    {
      readonly desiredNew: string
      readonly objectFormat: "sha1" | "sha256"
      readonly objectSetBytes: Uint8Array
    },
    ReleaseError
  >
}
export const invalid = (): never =>
  fail("git-catalog", "Git catalog input or native evidence could not be admitted")
export const objectFormat = (oid: string): "sha1" | "sha256" =>
  /^[0-9a-f]{40}$/u.test(oid) ? "sha1" : /^[0-9a-f]{64}$/u.test(oid) ? "sha256" : invalid()
export const admitCoordinate = (input: RefCoordinate): RefCoordinate => {
  const value = decodeOwned(Schema.Struct(coordinate), input),
    url = publicUrl(value.remote, ["https:", "file:"])
  if (
    !url ||
    url.search ||
    url.href !== value.remote ||
    (url.protocol === "file:" && url.hostname !== "") ||
    !value.principal ||
    !value.scope
  )
    invalid()
  if (!validRef(value.ref)) invalid()
  return value
}
export const validateFiles = (files: readonly FileEdit[]): void => {
  if (!files.length) invalid()
  const paths = new Set<string>()
  for (const file of files) {
    if (
      !file.path ||
      file.path.length > 4096 ||
      file.path !== file.path.normalize("NFC") ||
      /[\\\u0000-\u001f\u007f]/u.test(file.path) ||
      file.path
        .split("/")
        .some((part) => !part || part === "." || part === ".." || part.toLowerCase() === ".git") ||
      !["100644", "100755"].includes(file.mode)
    )
      invalid()
    const folded = file.path.toLowerCase()
    if (
      [...paths].some(
        (path) => path === folded || path.startsWith(folded + "/") || folded.startsWith(path + "/"),
      )
    )
      invalid()
    paths.add(folded)
  }
}
export const ownIntent = (input: unknown): Intent => {
  const value = decodeOwned(Intent, input)
  const { remote, ref, principal, scope } = value
  admitCoordinate({ remote, ref, principal, scope })
  validateFiles(value.files)
  if (
    objectFormat(value.expectedOld) !== value.objectFormat ||
    objectFormat(value.desiredNew) !== value.objectFormat ||
    /^0+$/u.test(value.expectedOld) ||
    /^0+$/u.test(value.desiredNew)
  )
    invalid()
  return value
}
const descriptor = { definitionId: "git.catalog.update", intentVersion: "1", intentCodec: Intent }
export const update = Effect.fn("git.authorUpdate")(function* (
  input: Intent,
  dependsOn: readonly string[] = [],
) {
  return yield* createOperation(descriptor, yield* attempt(() => ownIntent(input)), dependsOn)
})
export const prepare = Effect.fn("git.prepareCommit")(function* (
  input: CommitInput,
  dependencies: {
    readonly objects: ObjectBuilder
    readonly readContent: ReadContent
    readonly putContent: PutContent
  },
) {
  const selected = yield* attempt(() => {
    const value = decodeOwned(CommitInput, input),
      { remote, ref, principal, scope } = value
    admitCoordinate({ remote, ref, principal, scope })
    validateFiles(value.files)
    return {
      value,
      construct: dependencies.objects.construct.bind(dependencies.objects),
      read: dependencies.readContent.bind(dependencies),
      put: dependencies.putContent.bind(dependencies),
    }
  })
  const built = yield* selected.construct(selected.value, selected.read)
  const bytes = new Uint8Array(built.objectSetBytes),
    desiredNew = built.desiredNew,
    format = built.objectFormat
  const content = new Content({ bytes: bytes.length, sha256: yield* sha256(bytes) })
  const stored = yield* selected.put(new Uint8Array(bytes))
  return yield* attempt(() => {
    if (canonical(stored) !== canonical(content)) invalid()
    const { remote, ref, expectedOld, files, principal, scope } = selected.value
    return ownIntent(
      new Intent({
        remote,
        ref,
        expectedOld,
        files,
        principal,
        scope,
        desiredNew,
        objectFormat: format,
        objectSet: content,
      }),
    )
  })
})
class RefObservation extends Schema.Class<RefObservation>("GitRefObservation")({
  intent: Intent,
  oid: Schema.NullOr(Schema.String),
}) {}
const refStatus = (intent: Intent, oid: string | null) => {
  if (oid !== null && objectFormat(oid) !== intent.objectFormat) invalid()
  return oid === intent.desiredNew
    ? "Satisfied"
    : oid === intent.expectedOld
      ? "Absent"
      : "Conflict"
}
export const definition = (dependencies: {
  readonly readContent: ReadContent
  readonly observeRef: ObserveRef
}): ProviderDefinition => {
  const observe = dependencies.observeRef.bind(dependencies)
  const read = dependencies.readContent.bind(dependencies)
  return {
    ...descriptor,
    contract: PROVIDER_CONTRACT,
    receiptVersion: "git.push/1",
    receiptCodec: GitReceipt,
    receiptCorresponds: (operation, request, input) => {
      const intent = ownIntent(operation.intent),
        receipt = Schema.decodeUnknownSync(GitReceipt)(input)
      return (
        request.endpoint === intent.remote &&
        request.principal === intent.principal &&
        request.scope === intent.scope &&
        request.replay._tag === "GitCas" &&
        request.replay.ref === intent.ref &&
        request.replay.expectedOld === intent.expectedOld &&
        request.replay.desiredNew === intent.desiredNew &&
        receipt.ref === intent.ref &&
        receipt.desiredNew === intent.desiredNew &&
        pushWitness(
          { exitCode: 0, stdout: receipt.porcelain },
          intent.ref,
          intent.expectedOld,
          intent.desiredNew,
        ) === receipt.porcelain
      )
    },
    classifyReceipt: () => "Satisfied",
    prepare: Effect.fn("git.prepareRequest")(function* (operation) {
      const intent = yield* attempt(() => ownIntent(operation.intent))
      yield* readVerifiedContent(read, intent.objectSet, 128 * 1024 * 1024)
      return yield* makeRequest({
        transport: "core.git/1",
        endpoint: intent.remote,
        method: "update-ref",
        headers: [],
        body: new Uint8Array(),
        principal: intent.principal,
        scope: intent.scope,
        replay: new GitCas({
          ref: intent.ref,
          expectedOld: intent.expectedOld,
          desiredNew: intent.desiredNew,
        }),
      })
    }),
    observationVersion: "git.ref/1",
    observationCodec: RefObservation,
    classifyObservation: (operation: Operation, input: unknown) => {
      const evidence = Schema.decodeUnknownSync(RefObservation)(input),
        intent = ownIntent(operation.intent)
      if (canonical(evidence.intent) !== canonical(intent)) invalid()
      return refStatus(intent, evidence.oid)
    },
    observe: Effect.fn("git.observeRef")(function* (operation) {
      const intent = yield* attempt(() => ownIntent(operation.intent)),
        { remote, ref, principal, scope } = intent
      const result = yield* observe({ remote, ref, principal, scope })
      const evidence = new RefObservation({ intent, oid: result.oid })
      return { status: refStatus(intent, evidence.oid), evidence }
    }),
  }
}
