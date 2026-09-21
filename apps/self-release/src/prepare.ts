import { mkdir, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { Effect, Schema } from "effect"
import { createPlan, loadPlan, type Operation } from "@mannyc1/ts-release"
import { File, encodeBundle, finalize, type ReadContent } from "@mannyc1/ts-release/bundle"
import { fileContentOwner, makeGithubOidcTokenSource } from "@mannyc1/ts-release/node"
import * as GitHub from "@mannyc1/ts-release-github"
import * as Npm from "@mannyc1/ts-release-npm"
import {
  GITHUB_PRINCIPAL,
  NPM_PRINCIPAL,
  PreparationInput,
  SourceIdentity,
  attempt,
  failure,
  io,
  read,
  requireNodeProvenance,
  sha256,
} from "./Model.js"

export { GITHUB_PRINCIPAL, NPM_PRINCIPAL, PreparationInput } from "./Model.js"

/** Adopt already-produced bytes once. Only explicitly authorized provenance
 * attestation can contact a remote service; package/release publication is a Plan. */
export const prepareRelease = Effect.fn("release.prepare")(function* (raw: unknown) {
  const input = yield* attempt("preparation-input", () =>
    Schema.decodeUnknownSync(PreparationInput, { onExcessProperty: "error" })(raw),
  )
  const repository = yield* attempt(
    "repository",
    () => new GitHub.Repository({ apiUrl: "https://api.github.com", ...input.repository }),
  )
  const source = new SourceIdentity({ repository, ...input.source, version: input.version })
  const provenance = input.npm.provenance
  yield* attempt("preparation-policy", () => {
    if (!input.packages.length || input.npm.authorization.principal !== NPM_PRINCIPAL)
      throw new Error("Expected a nonempty package cohort and its explicit npm principal")
    if (input.npm.authorization._tag === "TrustedAuthorization" && !provenance)
      throw new Error("Trusted publishing requires retained provenance")
    if (provenance) {
      requireNodeProvenance()
      if (
        provenance.source.sourceCommit !== source.commit ||
        provenance.source.repository !== `${repository.owner}/${repository.name}`
      )
        throw new Error("Provenance must name the selected repository and source")
    }
    const names = [
      "source.json",
      "release-notes.md",
      ...input.packages.map((entry) => entry.publicName),
      ...(input.assets ?? []).map((entry) => entry.publicName),
      ...(provenance ? input.packages.map((entry) => `${entry.publicName}.sigstore.json`) : []),
    ]
    if (
      new Set(names).size !== names.length ||
      names.some(
        (name) =>
          name.length > 255 ||
          name !== name.normalize("NFC") ||
          /[/\\\u0000-\u001f\u007f]/u.test(name) ||
          name === "." ||
          name === "..",
      )
    )
      throw new Error("Release asset names must be unique portable file names")
  })
  const candidateDirectory = resolve(input.candidateDirectory)
  // Refuse replacement: a failed or interrupted preparation remains inspectable.
  yield* io("candidate-directory", () =>
    mkdir(candidateDirectory, { recursive: false, mode: 0o700 }),
  )
  const owner = fileContentOwner(join(candidateDirectory, "content"))
  const readContent: ReadContent = (content) =>
    owner
      .read(content)
      .pipe(Effect.mapError(() => failure("content", "Owned release bytes differ")))
  const files: File[] = []
  const mediaTypes = new Map<string, string>()
  const retain = Effect.fn("release.retain")(function* (
    logicalName: string,
    bytes: Uint8Array,
    mediaType: string,
  ) {
    const content = yield* owner
      .putOwned(bytes)
      .pipe(Effect.mapError(() => failure("content", "Release bytes could not be retained")))
    const file = new File({
      logicalName,
      content,
      deliveryMode: 0o644,
      executable: null,
      producedBy: { name: "ts-release/application", version: "1" },
    })
    files.push(file)
    mediaTypes.set(logicalName, mediaType)
    return file
  })
  const notesBytes = yield* read(input.notesFile, 1024 * 1024)
  const notes = yield* attempt("notes", () =>
    new TextDecoder("utf-8", { fatal: true }).decode(notesBytes),
  )
  yield* retain("release-notes.md", notesBytes, "text/markdown")
  yield* retain(
    "source.json",
    new TextEncoder().encode(JSON.stringify(Schema.encodeSync(SourceIdentity)(source))),
    "application/json",
  )
  const packages: Array<{ file: File; metadata: Npm.PackageMetadata }> = []
  for (const entry of input.packages) {
    const file = yield* retain(
      entry.publicName,
      yield* read(entry.archiveFile, 512 * 1024 * 1024),
      "application/octet-stream",
    )
    const metadata = yield* Npm.inspectTarball(file, {
      bundle: yield* finalize(files),
      readContent,
    })
    if (metadata.private || metadata.version !== input.version)
      return yield* failure(
        "package-cohort",
        "Every selected package must be public at the selected version",
      )
    packages.push({ file, metadata })
  }
  if (
    new Set(packages.map((entry) => entry.metadata.name)).size !== packages.length ||
    (input.corePackage !== undefined &&
      !packages.some((entry) => entry.metadata.name === input.corePackage))
  )
    return yield* failure(
      "package-cohort",
      "Package names must be unique and include the selected core",
    )
  for (const entry of input.assets ?? [])
    yield* retain(entry.publicName, yield* read(entry.file, 512 * 1024 * 1024), entry.mediaType)

  const intents: Npm.PublishIntent[] = []
  const attester = provenance
    ? Npm.makeSigstoreAttester({
        source: provenance.source,
        ...provenance.trust,
        oidc: makeGithubOidcTokenSource({
          timeoutMilliseconds: provenance.trust.timeoutMilliseconds,
          maximumResponseBytes: 1024 * 1024,
        }),
        fulcioUrl: "https://fulcio.sigstore.dev",
        rekorUrl: "https://rekor.sigstore.dev",
      })
    : undefined
  for (const { file, metadata } of packages) {
    let retainedProvenance: Npm.Provenance = new Npm.NoProvenance({})
    if (provenance && attester) {
      const attestation = yield* Npm.createProvenance(
        {
          authorize: provenance.authorize,
          name: metadata.name,
          version: metadata.version,
          tarball: file,
          source: provenance.source,
        },
        { bundle: yield* finalize(files), readContent, attest: attester },
      )
      retainedProvenance = new Npm.GitHubActionsProvenance({
        source: provenance.source,
        bundle: yield* retain(
          `${file.logicalName}.sigstore.json`,
          attestation.bytes,
          attestation.mediaType,
        ),
        mediaType: attestation.mediaType,
      })
    }
    intents.push(
      new Npm.PublishIntent({
        registry: "https://registry.npmjs.org/",
        name: metadata.name,
        version: metadata.version,
        integrity: metadata.integrity,
        shasum: metadata.shasum,
        tarball: file,
        initialTag: input.npm.initialTag ?? "latest",
        access: "public",
        authorization: input.npm.authorization,
        provenance: retainedProvenance,
      }),
    )
  }
  const npm: Operation[] = []
  for (const intent of intents.filter((intent) => intent.name !== input.corePackage))
    npm.push(yield* Npm.publish(intent))
  const core = intents.find((intent) => intent.name === input.corePackage)
  if (core)
    npm.push(
      yield* Npm.publish(
        core,
        npm.map((operation) => operation.operationId),
      ),
    )
  const tag = yield* GitHub.lightweightTag(
    new GitHub.LightweightTag({
      repository,
      tag: `v${input.version}`,
      commit: source.commit,
      principal: GITHUB_PRINCIPAL,
    }),
    npm.map((operation) => operation.operationId),
  )
  const draft = yield* GitHub.draft(
    new GitHub.DraftIntent({
      repository,
      tag: `v${input.version}`,
      tagSource: new GitHub.ManagedTag({ operationId: tag.operationId }),
      title: input.title,
      body: notes,
      prerelease: input.version.includes("-"),
      principal: GITHUB_PRINCIPAL,
    }),
  )
  const assets: Operation[] = []
  for (const file of files)
    assets.push(
      yield* GitHub.uploadAsset(
        new GitHub.AssetIntent({
          repository,
          draftOperation: draft.operationId,
          file,
          publicName: file.logicalName,
          mediaType: mediaTypes.get(file.logicalName)!,
          principal: GITHUB_PRINCIPAL,
        }),
      ),
    )
  const publication = yield* GitHub.publish(
    new GitHub.PublishIntent({
      repository,
      draftOperation: draft.operationId,
      assetOperations: assets.map((operation) => operation.operationId),
      principal: GITHUB_PRINCIPAL,
    }),
    npm.map((operation) => operation.operationId),
  )
  const bundle = yield* finalize(files)
  const bundleBytes = encodeBundle(bundle)
  const bundleSha256 = sha256(bundleBytes)
  const plan = yield* createPlan(bundleSha256, [...npm, tag, draft, ...assets, publication])
  const noRead = () =>
    Effect.fail(failure("prepare-network", "Plan admission cannot read a publication destination"))
  yield* loadPlan(plan, [
    ...Npm.definitions({
      bundle,
      readContent,
      read: noRead,
      ...(provenance ? { verifyProvenance: Npm.makeSigstoreVerifier(provenance.trust) } : {}),
    }),
    ...GitHub.definitions({ bundle, readContent, read: noRead }),
  ])
  yield* io("bundle", () =>
    writeFile(join(candidateDirectory, "bundle.json"), bundleBytes, { flag: "wx", mode: 0o600 }),
  )
  yield* io("plan", () =>
    writeFile(join(candidateDirectory, "plan.json"), JSON.stringify(plan), {
      flag: "wx",
      mode: 0o600,
    }),
  )
  return { candidateDirectory, bundleSha256, planId: plan.planId }
})
