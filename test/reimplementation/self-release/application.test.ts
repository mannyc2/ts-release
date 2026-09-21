import { afterEach, expect, test } from "bun:test"
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { ConfigProvider, Effect, Schema } from "effect"
import { Host, Plan, createPlan, runRelease } from "@mannyc1/ts-release"
import { Bundle } from "@mannyc1/ts-release/bundle"
import type { CredentialBinding } from "@mannyc1/ts-release/http"
import * as Npm from "@mannyc1/ts-release-npm"
import { createApplication, npmCredentials } from "../../../apps/self-release/src/application.js"
import { NPM_PRINCIPAL, prepareRelease } from "../../../apps/self-release/src/prepare.js"
import { releaseJournalId } from "../../../apps/self-release/src/Model.js"
import { pack } from "../npm/fixtures.js"

const workspaces: string[] = []
afterEach(async () => {
  for (const directory of workspaces.splice(0))
    await rm(directory, { recursive: true, force: true })
})
const fixture = async (
  manifests = [
    { name: "@release-fixture/provider", version: "1.2.3" },
    { name: "@release-fixture/core", version: "1.2.3" },
  ],
) => {
  const work = await mkdtemp(join(tmpdir(), "release-application-"))
  workspaces.push(work)
  const packages = []
  for (const [index, manifest] of manifests.entries()) {
    const archiveFile = join(work, `${index}.tgz`)
    await writeFile(archiveFile, pack(manifest))
    packages.push({ archiveFile, publicName: `${index}.tgz` })
  }
  const notesFile = join(work, "notes.md")
  await writeFile(notesFile, "Exact release notes\n")
  return {
    work,
    input: {
      candidateDirectory: join(work, "candidate"),
      repository: { owner: "release-fixture", name: "example" },
      source: { commit: "a".repeat(40), tree: "b".repeat(40) },
      version: "1.2.3",
      title: "Example 1.2.3",
      notesFile,
      packages,
      corePackage: "@release-fixture/core",
      npm: { authorization: new Npm.TokenAuthorization({ principal: NPM_PRINCIPAL }) },
    },
  }
}
const preparedFixture = async () => {
  const f = await fixture()
  const identity = await Effect.runPromise(prepareRelease(f.input))
  const gitExecutable = await realpath(Bun.which("git")!)
  const journalDirectory = join(f.work, "journal.git")
  const initialized = Bun.spawnSync([gitExecutable, "init", "--bare", journalDirectory], {
    stdout: "pipe",
    stderr: "pipe",
  })
  expect(initialized.exitCode).toBe(0)
  return {
    ...f,
    identity,
    application: {
      ...identity,
      authorize: true,
      journal: {
        remote: pathToFileURL(journalDirectory).href,
        cacheDirectory: join(f.work, "journal-cache"),
        gitExecutable,
        principal: "release-history",
        scope: "release",
        timeoutMilliseconds: 5000,
        maximumOutputBytes: 16 * 1024 * 1024,
      },
      authentication: {
        mode: "Token" as const,
        npmTokenEnvironment: "RELEASE_FIXTURE_NPM_TOKEN",
        githubTokenEnvironment: "RELEASE_FIXTURE_GITHUB_TOKEN",
      },
    },
  }
}

test("preparation retains original bytes and authors provider-first npm and complete GitHub dependencies", async () => {
  const f = await fixture()
  const result = await Effect.runPromise(prepareRelease(f.input))
  const bundle = Schema.decodeUnknownSync(Bundle)(
    JSON.parse(await readFile(join(result.candidateDirectory, "bundle.json"), "utf8")),
  )
  const plan = Schema.decodeUnknownSync(Plan)(
    JSON.parse(await readFile(join(result.candidateDirectory, "plan.json"), "utf8")),
  )
  expect(plan.planId).toBe(result.planId)
  expect(plan.bundleId).toBe(result.bundleSha256)
  expect(bundle.artifacts.map((artifact) => artifact.logicalName).sort()).toEqual([
    "0.tgz",
    "1.tgz",
    "release-notes.md",
    "source.json",
  ])
  const npm = plan.operations.filter((operation) => operation.definitionId === "npm.publish")
  const core = npm.find(
    (operation) => (operation.intent as Npm.PublishIntent).name === f.input.corePackage,
  )!
  const provider = npm.find((operation) => operation.operationId !== core.operationId)!
  expect(core.dependsOn).toEqual([provider.operationId])
  const tag = plan.operations.find(
    (operation) => operation.definitionId === "github.lightweight-tag",
  )!
  expect(tag.dependsOn).toEqual(npm.map((operation) => operation.operationId).sort())
  const publication = plan.operations.find(
    (operation) => operation.definitionId === "github.publish",
  )!
  const assets = plan.operations.filter((operation) => operation.definitionId === "github.asset")
  for (const operation of [...npm, ...assets])
    expect(publication.dependsOn).toContain(operation.operationId)
  expect(assets).toHaveLength(4)
  const archive = bundle.artifacts.find((artifact) => artifact.logicalName === "0.tgz")!
  if (archive._tag !== "OwnedFile") throw new Error("Expected owned archive")
  const original = await readFile(f.input.packages[0]!.archiveFile)
  await writeFile(f.input.packages[0]!.archiveFile, "changed producer output")
  expect(
    await readFile(join(result.candidateDirectory, "content", archive.content.sha256)),
  ).toEqual(original)
  await expect(Effect.runPromise(prepareRelease(f.input))).rejects.toThrow("candidate-directory")
})

test("changed preparation at the same release coordinate cannot escape the original uncertain journal", async () => {
  const f = await preparedFixture()
  await writeFile(f.input.notesFile, "Changed release notes\n")
  const changed = await Effect.runPromise(
    prepareRelease({
      ...f.input,
      candidateDirectory: join(f.work, "changed-candidate"),
    }),
  )
  const originalPlan = Schema.decodeUnknownSync(Plan)(
    JSON.parse(await readFile(join(f.identity.candidateDirectory, "plan.json"), "utf8")),
  )
  const changedPlan = Schema.decodeUnknownSync(Plan)(
    JSON.parse(await readFile(join(changed.candidateDirectory, "plan.json"), "utf8")),
  )
  expect(changedPlan.planId).not.toBe(originalPlan.planId)
  expect(changedPlan.journalId).toBe(originalPlan.journalId)
  expect(originalPlan.journalId).toBe("npm-github:release-fixture/example:v1.2.3")
  const source = JSON.parse(
    await readFile(join(f.identity.candidateDirectory, "bundle.json"), "utf8"),
  )
  const sourceFile = source.artifacts.find(
    (artifact: { logicalName: string }) => artifact.logicalName === "source.json",
  )
  expect(
    releaseJournalId(
      JSON.parse(
        await readFile(
          join(f.identity.candidateDirectory, "content", sourceFile.content.sha256),
          "utf8",
        ),
      ),
    ),
  ).toBe(originalPlan.journalId)
  let sends = 0
  const transport = {
    send: () =>
      Effect.sync(() => {
        sends++
        return { _tag: "Unknown" as const, reason: "fixture response lost" }
      }),
  }
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const original = yield* createApplication(f.application)
        yield* runRelease({
          plan: original.options.plan,
          authorize: true,
          observe: false,
          maxDispatches: 1,
        }).pipe(Effect.provideService(Host, { ...original.host, transport }))
        expect(sends).toBe(1)
        const history = yield* original.host.store.read(originalPlan.journalId)
        expect(
          history.events.filter((event) => event.body._tag === "DispatchStarted"),
        ).toHaveLength(1)
        const resumed = yield* createApplication({
          ...f.application,
          ...changed,
          journal: {
            ...f.application.journal,
            cacheDirectory: join(f.work, "fresh-journal-cache"),
          },
        })
        const result = yield* Effect.exit(
          runRelease({ plan: resumed.options.plan, authorize: true, observe: false }).pipe(
            Effect.provideService(Host, { ...resumed.host, transport }),
          ),
        )
        expect(result._tag).toBe("Failure")
        expect(JSON.stringify(result)).toContain("unknown scope")
        expect(sends).toBe(1)
      }),
    ),
  )
  const differentJournal = await Effect.runPromise(
    createPlan(changedPlan.bundleId, changedPlan.operations, "fresh-history"),
  )
  await writeFile(join(changed.candidateDirectory, "plan.json"), JSON.stringify(differentJournal))
  await expect(
    Effect.runPromise(
      Effect.scoped(
        createApplication({
          ...f.application,
          ...changed,
          planId: differentJournal.planId,
        }),
      ),
    ),
  ).rejects.toThrow("release coordinate's journal")
})

test("public npm GET and HEAD observations never acquire token or OIDC credentials", async () => {
  for (const mode of ["Token", "Trusted"] as const) {
    const authorization =
      mode === "Token"
        ? new Npm.TokenAuthorization({ principal: NPM_PRINCIPAL })
        : new Npm.TrustedAuthorization({
            principal: NPM_PRINCIPAL,
            repository: "release-fixture/example",
            workflow: ".github/workflows/release.yml",
            workflowRef: "refs/heads/main",
            issuer: "https://token.actions.githubusercontent.com",
            audience: "npm:registry.npmjs.org",
          })
    const operation = await Effect.runPromise(
      Npm.distTag(
        new Npm.DistTagIntent({
          registry: "https://registry.npmjs.org/",
          name: "@release-fixture/core",
          version: "1.2.3",
          tag: "latest",
          authorization,
        }),
      ),
    )
    const bindings: CredentialBinding[] = []
    const providers = Npm.definitions({
      bundle: new Bundle({ format: "ts-release/bundle/2", artifacts: [] }),
      readContent: () => Effect.die("Observation should not read content"),
      read: (request) =>
        Effect.sync(() => {
          bindings.push({
            endpoint: request.url,
            principal: request.principal,
            scope: request.scope,
            method: request.method,
          })
          return {
            status: 404,
            headers: { "content-type": "application/json" },
            body: new TextEncoder().encode("{}"),
          }
        }),
    })
    await Effect.runPromise(
      providers.find((provider) => provider.definitionId === "npm.dist-tag")!.observe!(operation, {
        own: { operation, receipts: [], observations: [] },
        dependencies: [],
      }),
    )
    let configReads = 0,
      credentialRequests = 0
    const config = ConfigProvider.make(() =>
      Effect.sync(() => {
        configReads++
        return undefined
      }),
    )
    const unexpected = () =>
      Effect.sync(() => {
        credentialRequests++
        throw new Error("Unexpected authority acquisition")
      })
    const authentication =
      mode === "Token"
        ? {
            mode,
            npmTokenEnvironment: "ABSENT_NPM_TOKEN",
            githubTokenEnvironment: "ABSENT_GITHUB_TOKEN",
          }
        : { mode, githubTokenEnvironment: "ABSENT_GITHUB_TOKEN" }
    const options = {
      publications: [{ name: "@release-fixture/core", authorization }],
      authentication,
      trusted: { oidc: unexpected, exchange: unexpected },
      local: null,
    }
    for (const method of ["GET", "HEAD"] as const)
      expect(
        await Effect.runPromise(
          npmCredentials({ ...bindings[0]!, method }, options).pipe(
            Effect.provide(ConfigProvider.layer(config)),
          ),
        ),
      ).toEqual({})
    await expect(
      Effect.runPromise(npmCredentials(bindings[0]!, { ...options, publications: [] })),
    ).rejects.toThrow("outside the retained cohort")
    expect(configReads).toBe(0)
    expect(credentialRequests).toBe(0)
  }
})

test("application admits retained data and resolves real HTTP transport credentials lazily", async () => {
  const f = await preparedFixture()
  const requested: string[] = []
  const config = ConfigProvider.make((path) =>
    Effect.sync(() => {
      const name = path.join(".")
      requested.push(name)
      return name === "RELEASE_FIXTURE_NPM_TOKEN" || name === "RELEASE_FIXTURE_GITHUB_TOKEN"
        ? ConfigProvider.makeValue("non-secret-fixture-token")
        : undefined
    }),
  )
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const app = yield* createApplication(f.application)
        expect(app.options.authorize).toBe(true)
        expect(app.options.plan.operations.length).toBeGreaterThan(0)
        expect(requested).toEqual([])
        expect((yield* app.host.store.read(app.options.plan.journalId)).events).toEqual([])
        for (const definitionId of ["npm.publish", "github.lightweight-tag"]) {
          const operation = app.options.plan.operations.find(
            (operation) => operation.definitionId === definitionId,
          )!
          const provider = app.host.providers.find(
            (provider) => provider.definitionId === definitionId,
          )!
          const request = yield* provider.prepare(operation, {
            own: { operation, receipts: [], observations: [] },
            dependencies: [],
          })
          expect(typeof (yield* app.host.transport.prepare!(request))).toBe("function")
        }
        expect(requested).toEqual(["RELEASE_FIXTURE_NPM_TOKEN", "RELEASE_FIXTURE_GITHUB_TOKEN"])
      }),
    ).pipe(Effect.provide(ConfigProvider.layer(config))),
  )
})

test("application rejects changed Bundle, Plan and owned bytes before loading credentials", async () => {
  const f = await preparedFixture()
  const rejected = (input: unknown) => Effect.runPromise(Effect.scoped(createApplication(input)))
  await expect(rejected({ ...f.application, bundleSha256: "f".repeat(64) })).rejects.toThrow(
    "Bundle differs",
  )
  await expect(rejected({ ...f.application, planId: "f".repeat(64) })).rejects.toThrow(
    "Plan differs",
  )
  const planFile = join(f.identity.candidateDirectory, "plan.json")
  const originalPlan = await readFile(planFile, "utf8")
  const plan = JSON.parse(originalPlan)
  plan.operations.find(
    (operation: { dependsOn: string[] }) => operation.dependsOn.length,
  ).dependsOn = []
  await writeFile(planFile, JSON.stringify(plan))
  await expect(rejected(f.application)).rejects.toThrow()
  await expect(
    rejected({
      ...f.application,
      authentication: {
        mode: "Local",
        npmConfigFile: join(f.work, "absent-credentials"),
        githubTokenEnvironment: "RELEASE_FIXTURE_GITHUB_TOKEN",
      },
    }),
  ).rejects.toThrow("Plan ID mismatch")
  await writeFile(planFile, originalPlan)
  const bundle = JSON.parse(
    await readFile(join(f.identity.candidateDirectory, "bundle.json"), "utf8"),
  )
  const owned = join(f.identity.candidateDirectory, "content", bundle.artifacts[0].content.sha256)
  await chmod(owned, 0o600)
  await writeFile(owned, "changed owned content")
  await expect(rejected(f.application)).rejects.toThrow("owned content")
})

test("application refuses credential-mode changes and foreign journal token destinations", async () => {
  const f = await preparedFixture()
  const rejected = (input: unknown) => Effect.runPromise(Effect.scoped(createApplication(input)))
  await expect(
    rejected({
      ...f.application,
      authentication: { mode: "Trusted", githubTokenEnvironment: "RELEASE_FIXTURE_GITHUB_TOKEN" },
    }),
  ).rejects.toThrow("publication-policy")
  await expect(
    rejected({
      ...f.application,
      journal: { ...f.application.journal, remote: "https://unrelated.invalid/repository.git" },
    }),
  ).rejects.toThrow("journal-remote")
})

test("local authentication supplies the same prepared npm transport and exposes only its rejection hook", async () => {
  const f = await preparedFixture()
  const npmConfigFile = join(f.work, "fixture.npmrc")
  await writeFile(npmConfigFile, "//registry.npmjs.org/:_authToken=non-secret-fixture-token\n", {
    mode: 0o600,
  })
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const app = yield* createApplication({
          ...f.application,
          authentication: {
            mode: "Local",
            npmConfigFile,
            githubTokenEnvironment: "RELEASE_FIXTURE_GITHUB_TOKEN",
          },
        })
        const operation = app.options.plan.operations.find(
          (operation) => operation.definitionId === "npm.publish",
        )!
        const provider = app.host.providers.find(
          (provider) => provider.definitionId === "npm.publish",
        )!
        const request = yield* provider.prepare(operation, {
          own: { operation, receipts: [], observations: [] },
          dependencies: [],
        })
        expect(typeof (yield* app.host.transport.prepare!(request))).toBe("function")
        expect(typeof app.onRejected).toBe("function")
        expect((yield* app.host.store.read(app.options.plan.journalId)).events).toEqual([])
      }),
    ),
  )
})

test("preparation refuses private, mixed-version and duplicate package cohorts", async () => {
  for (const manifests of [
    [{ name: "@release-fixture/core", version: "1.2.3", private: true }],
    [{ name: "@release-fixture/core", version: "1.2.4" }],
    [
      { name: "@release-fixture/core", version: "1.2.3" },
      { name: "@release-fixture/core", version: "1.2.3" },
    ],
  ]) {
    const f = await fixture(manifests)
    await expect(Effect.runPromise(prepareRelease(f.input))).rejects.toThrow(/package/i)
  }
})

test("trusted preparation requires explicit provenance authorization before retaining a candidate", async () => {
  const f = await fixture()
  await expect(
    Effect.runPromise(
      prepareRelease({
        ...f.input,
        npm: {
          authorization: new Npm.TrustedAuthorization({
            principal: NPM_PRINCIPAL,
            repository: "release-fixture/example",
            workflow: ".github/workflows/release.yml",
            workflowRef: "refs/heads/main",
            issuer: "https://token.actions.githubusercontent.com",
            audience: "npm:registry.npmjs.org",
          }),
        },
      }),
    ),
  ).rejects.toThrow("preparation-policy")
  await mkdir(f.input.candidateDirectory)
})

test("provenance preparation rejects missing approval and Bun before reading trust material or invoking an attester", async () => {
  const f = await fixture()
  const provenance = {
    authorize: true,
    source: new Npm.ProvenanceSource({
      format: "npm-github-actions-provenance-source/v1",
      serverUrl: "https://github.com",
      repository: "release-fixture/example",
      workflow: ".github/workflows/release.yml",
      workflowRef: "refs/heads/main",
      sourceRef: "refs/heads/main",
      sourceCommit: f.input.source.commit,
      eventName: "workflow_dispatch",
      repositoryId: "1",
      repositoryOwnerId: "1",
      runnerEnvironment: "github-hosted",
      runId: "1",
      runAttempt: "1",
      repositoryVisibility: "public",
    }),
    trust: {
      tufRootPath: "/absent/root",
      tufCachePath: "/absent/cache",
      timeoutMilliseconds: 1000,
    },
  }
  await expect(
    Effect.runPromise(
      prepareRelease({
        ...f.input,
        npm: { ...f.input.npm, provenance: { ...provenance, authorize: false } },
      }),
    ),
  ).rejects.toThrow("preparation-input")
  await expect(
    Effect.runPromise(
      prepareRelease({
        ...f.input,
        npm: { ...f.input.npm, provenance },
      }),
    ),
  ).rejects.toThrow("preparation-policy")
  await mkdir(f.input.candidateDirectory)
})
