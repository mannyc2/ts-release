// Harness qualification uses the public providers and actual native transport.
// The production self-release application can use the same peer unchanged.
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createHash, randomUUID } from "node:crypto"
import { createConnection } from "node:net"
import { connect } from "node:tls"
import { lookup } from "node:dns"
import { Effect, Layer, Redacted } from "effect"
import { Host, createPlan, runRelease, observeRelease } from "@mannyc1/ts-release"
import { Content, File, encodeBundle, finalize } from "@mannyc1/ts-release/bundle"
import { makeHttpRead, makeHttpTransport, openGitJournal } from "@mannyc1/ts-release/node"
import * as Npm from "@mannyc1/ts-release-npm"
import * as GitHub from "@mannyc1/ts-release-github"

const [mode, inputFile] = process.argv.slice(2)
const options = { timeoutMilliseconds: 10000, maximumResponseBytes: 4 * 1024 * 1024 }
if (mode === "denied") {
  assert.throws(() => connect({ host: "unlisted.invalid", port: 443 }), /unlisted network/)
  assert.throws(() => createConnection({ host: "192.0.2.1", port: 443 }), /unlisted network/)
  assert.throws(() => lookup("unlisted.invalid", () => {}), /unlisted network/)
  assert.throws(
    () => connect({ host: "registry.npmjs.org", port: 443, rejectUnauthorized: false }),
    /unlisted network/,
  )
  console.log(JSON.stringify({ denied: 4, node: process.version }))
} else if (mode === "read") {
  const read = makeHttpRead({ ...options, credentials: () => Effect.succeed({}) })
  const response = await Effect.runPromise(
    read({
      url: "https://registry.npmjs.org/@fixture%2ftls",
      method: "GET",
      headers: [],
      principal: "fixture",
      scope: "read",
    }),
  )
  console.log(JSON.stringify({ status: response.status, node: process.version }))
} else {
  const input = JSON.parse(await readFile(inputFile, "utf8"))
  const bytes = new Uint8Array(await readFile(input.tarball))
  const tarball = new File({
    logicalName: "package.tgz",
    content: new Content({
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }),
    deliveryMode: 0o644,
    executable: null,
    producedBy: { name: "native-harness", version: "1" },
  })
  const bundle = await Effect.runPromise(finalize([tarball]))
  const access = { bundle, readContent: () => Effect.succeed(bytes.slice()) }
  const metadata = await Effect.runPromise(Npm.inspectTarball(tarball, access))
  const authorization = new Npm.TokenAuthorization({ principal: "fixture-npm" })
  const publication = await Effect.runPromise(
    Npm.publish(
      new Npm.PublishIntent({
        registry: "https://registry.npmjs.org/",
        name: metadata.name,
        version: metadata.version,
        tarball,
        integrity: metadata.integrity,
        shasum: metadata.shasum,
        initialTag: "latest",
        access: "public",
        authorization,
        provenance: new Npm.NoProvenance({}),
      }),
    ),
  )
  const repository = new GitHub.Repository({
    apiUrl: "https://api.github.com",
    ...input.repository,
  })
  const principal = "fixture-github",
    tagName = `v${metadata.version}`
  const tag = await Effect.runPromise(
    GitHub.lightweightTag(
      new GitHub.LightweightTag({
        repository,
        principal,
        tag: tagName,
        commit: input.commit,
      }),
      [publication.operationId],
    ),
  )
  const draft = await Effect.runPromise(
    GitHub.draft(
      new GitHub.DraftIntent({
        repository,
        principal,
        tag: tagName,
        tagSource: new GitHub.ManagedTag({ operationId: tag.operationId }),
        title: `Native ${metadata.version}`,
        body: "Retained fixture bytes",
        prerelease: false,
      }),
    ),
  )
  const asset = await Effect.runPromise(
    GitHub.uploadAsset(
      new GitHub.AssetIntent({
        repository,
        principal,
        draftOperation: draft.operationId,
        file: tarball,
        publicName: tarball.logicalName,
        mediaType: "application/octet-stream",
      }),
    ),
  )
  const publish = await Effect.runPromise(
    GitHub.publish(
      new GitHub.PublishIntent({
        repository,
        principal,
        draftOperation: draft.operationId,
        assetOperations: [asset.operationId],
      }),
    ),
  )
  const plan = await Effect.runPromise(
    createPlan(createHash("sha256").update(encodeBundle(bundle)).digest("hex"), [
      publication,
      tag,
      draft,
      asset,
      publish,
    ]),
  )
  const token = Redacted.make("native-fixture-ephemeral")
  const credentials = (binding) =>
    new URL(binding.endpoint).hostname === "registry.npmjs.org"
      ? Npm.authorizeToken({ authorization, binding, token })
      : GitHub.authorizeToken({ repository, binding, token })
  const read = makeHttpRead({
    ...options,
    credentials: (binding) =>
      new URL(binding.endpoint).hostname === "registry.npmjs.org"
        ? Effect.succeed({})
        : GitHub.authorizeToken({ repository, binding, token }),
  })
  const providers = [
    ...Npm.definitions({ ...access, read }),
    ...GitHub.definitions({ ...access, read }),
  ]
  const transport = makeHttpTransport({ ...options, providers, credentials })
  const report = await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const store = yield* openGitJournal({
          cacheDirectory: input.cacheDirectory,
          remote: input.journalRemote,
          principal: "fixture-journal",
          scope: "release",
          gitExecutable: input.gitExecutable,
          timeoutMilliseconds: 10000,
          maximumOutputBytes: 8 * 1024 * 1024,
          credentials: () => Effect.succeed({ _tag: "Anonymous" }),
        })
        const report = yield* (
          mode === "observe" ? observeRelease({ plan }) : runRelease({ plan, authorize: true })
        ).pipe(
          Effect.provide(
            Layer.succeed(Host, {
              store,
              providers,
              transport,
              now: Date.now,
              uniqueId: randomUUID,
            }),
          ),
        )
        const journal = yield* store.read(plan.journalId)
        return { report, journal, plan, node: process.version }
      }),
    ),
  )
  console.log(JSON.stringify(report))
}
