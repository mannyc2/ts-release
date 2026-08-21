import { describe, expect, it } from "@effect/bun-test"
import { spawnSync } from "node:child_process"
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import {
  ArtifactId,
  ArtifactRef,
  adoptArtifactBundle
} from "../../../src/release/artifact-bundle.js"
import {
  AuthorizationIdentity,
  ActorId,
  DispatchId,
  DispatchStarted,
  EndpointIdentity,
  JournalEntry,
  JournalStore,
  ObservationRecorded,
  ReleaseJournal,
  RequestFingerprint,
  RiskAccepted,
  TransportId,
  inMemoryJournalStoreLayer,
  makeInMemoryJournalStore
} from "../../../src/release/journal.js"
import {
  OperationObservationConcluded,
  OperationReceiptAccepted,
  OperationReconciliationRequired,
  deriveReleaseReport,
  encodeReleaseReport
} from "../../../src/release/release-report.js"
import {
  encodeProviderIntent,
  makeReleasePlan
} from "../../../src/release/release-plan.js"
import {
  NpmAuthorizationIdentity,
  NpmDispatchRejectedBeforeStart,
  NpmDispatchResultUnavailable,
  NpmDistTag,
  NpmPackageName,
  NpmPreparedRequestError,
  NpmPublishDefinition,
  NpmPublishIntent,
  NpmPublicationObservation,
  NpmPublishReceiptInvalid,
  NpmPublishedExact,
  NpmRegistryUrl,
  NpmTokenAuthorization,
  NpmVersion,
  decodeNpmPublishReceipt,
  npmCliVersion,
  npmTarballFilename,
  observeNpmPublication,
  prepareNpmPublishRequest,
  type PreparedNpmPublishRequest
} from "../../../src/publication/npm-native.js"
import {
  decideNpmJournalAction,
  executeNpmOperation,
  makeNpmObservationClassifier,
  NpmOperationInputError
} from "../../../src/publication/npm-operation.js"
import {
  makeNpmClientLayerForOperation,
  type NpmNativeOperationBoundary,
  type NpmPublishInvocation
} from "../../../src/platform/npm-native-client.js"

const packageName = "@ts-release-fixtures/native-npm-target"
const version = "1.2.3"
const artifactId = ArtifactId.make("npm-tarball")
const authorizationIdentity = NpmAuthorizationIdentity.make("fixture-credential-reference")

interface PackFile {
  readonly path: string
  readonly size: number
  readonly mode: number
}

interface PackBody {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly size: number
  readonly unpackedSize: number
  readonly shasum: string
  readonly integrity: string
  readonly filename: string
  readonly files: ReadonlyArray<PackFile>
  readonly entryCount: number
  readonly bundled: ReadonlyArray<string>
}

interface CommandResult {
  readonly stdout: string
  readonly stderr: string
}

const run = (
  executable: string,
  args: ReadonlyArray<string>,
  cwd: string,
  environment: Readonly<Record<string, string>> = {}
): CommandResult => {
  const result = spawnSync(executable, [...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CI: "true", NPM_CONFIG_UPDATE_NOTIFIER: "false", ...environment },
    stdio: "pipe"
  })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) {
    throw new Error(`${executable} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`)
  }
  return { stdout: result.stdout, stderr: result.stderr }
}

const runToFile = (
  executable: string,
  args: ReadonlyArray<string>,
  cwd: string,
  outputPath: string
): void => {
  const output = openSync(outputPath, "wx", 0o600)
  try {
    const result = spawnSync(executable, [...args], {
      cwd,
      env: { ...process.env, CI: "true", NPM_CONFIG_UPDATE_NOTIFIER: "false" },
      stdio: ["ignore", output, "pipe"]
    })
    if (result.error !== undefined) throw result.error
    if (result.status !== 0) {
      throw new Error(`${executable} ${args.join(" ")} failed:\n${result.stderr}`)
    }
  } finally {
    closeSync(output)
  }
}

const packDirectory = (
  root: string,
  source: string,
  label: string,
  expectedFilename: string
): { readonly tarballPath: string; readonly bytes: Uint8Array } => {
  const destination = join(root, label)
  const cache = join(root, `${label}-cache`)
  mkdirSync(destination)
  run("npm", [
    "pack", source, "--json", "--ignore-scripts", "--offline",
    "--pack-destination", destination, "--cache", cache
  ], process.cwd())
  const tarballPath = join(destination, expectedFilename)
  return { tarballPath, bytes: new Uint8Array(readFileSync(tarballPath)) }
}

const packTarget = (directory: string) => packDirectory(
  directory,
  join(process.cwd(), "test", "fixtures", "native-npm-target"),
  "packed-target",
  npmTarballFilename(packageName, version)
)

const packManifest = (
  directory: string,
  label: string,
  manifest: Readonly<Record<string, unknown>>
): { readonly tarballPath: string; readonly bytes: Uint8Array } => {
  const source = join(directory, `${label}-source`)
  mkdirSync(source)
  writeFileSync(join(source, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  writeFileSync(join(source, "index.js"), "export const fixture = true\n")
  const name = String(manifest.name)
  const manifestVersion = String(manifest.version)
  return packDirectory(directory, source, `${label}-packed`, npmTarballFilename(name, manifestVersion))
}

const makeRelease = (tarball: Uint8Array) => Effect.gen(function*() {
  const bundle = yield* adoptArtifactBundle([{ artifactId, bytes: tarball }])
  const intent = NpmPublishIntent.make({
    schemaVersion: "npm-publish-intent/v1",
    artifact: ArtifactRef.make({ artifactId }),
    packageName: NpmPackageName.make(packageName),
    version: NpmVersion.make(version),
    registryUrl: NpmRegistryUrl.make("https://registry.npmjs.org/"),
    distTag: NpmDistTag.make("latest"),
    access: "public",
    authorization: NpmTokenAuthorization.make({ mode: "token", identity: authorizationIdentity }),
    provenance: false
  })
  const durableIntent = yield* encodeProviderIntent({ definition: NpmPublishDefinition, intent })
  const plan = yield* makeReleasePlan({ bundle, intents: [durableIntent] })
  return { bundle, intent, plan, operation: plan.operations[0]! }
})

type ReleaseFixture = Effect.Success<ReturnType<typeof makeRelease>>

const operationInput = (
  release: ReleaseFixture,
  dispatchId = DispatchId.make("dispatch-native-npm-1")
) => ({
  bundle: release.bundle,
  plan: release.plan,
  operationId: release.operation.operationId,
  dispatchId,
  startedAtEpochMillis: 1_000,
  recordedAtEpochMillis: 1_001
})

/** Exact npm 12.0.2 keyed-success protocol double; local npm pack only creates acceptance artifacts. */
const npm12KeyedSuccess = (request: PreparedNpmPublishRequest): string => {
  const fixture = join(process.cwd(), "test", "fixtures", "native-npm-target")
  const files = ["bin.js", "index.js", "package.json"].map((path) => {
    const stat = statSync(join(fixture, path))
    return { path, size: stat.size, mode: stat.mode & 0o777 }
  })
  const body: PackBody = {
    id: `${packageName}@${version}`,
    name: packageName,
    version,
    size: request.tarball.byteLength,
    unpackedSize: files.reduce((total, file) => total + file.size, 0),
    shasum: request.tarball.shasum,
    integrity: request.tarball.integrity,
    filename: request.tarball.filename,
    files,
    entryCount: files.length,
    bundled: []
  }
  return JSON.stringify({ [packageName]: body })
}

const defaultBoundary = (): NpmNativeOperationBoundary => ({
  probeVersion: () => Effect.succeed({ exitCode: 0, stdout: `${npmCliVersion}\n`, stderr: "" }),
  publish: (invocation) => Effect.succeed({
    exitCode: 0,
    stdout: npm12KeyedSuccess(invocation.request),
    stderr: ""
  }),
  observe: () => Effect.succeed({ status: 500, body: "{}" })
})

const operationLayer = (
  directory: string,
  boundary: NpmNativeOperationBoundary,
  userConfigText = "//registry.npmjs.org/:_authToken=fixture-secret\ndry-run=true\n",
  journalLayer = inMemoryJournalStoreLayer
) => {
  const userConfigPath = join(directory, ".npmrc")
  writeFileSync(userConfigPath, userConfigText, { mode: 0o600 })
  return {
    userConfigPath,
    layer: Layer.mergeAll(
      journalLayer,
      makeNpmClientLayerForOperation({
        temporaryRoot: join(directory, "scoped-npm"),
        userConfigPath,
        authorizationIdentity,
        boundary
      })
    )
  }
}

const installPackedConsumers = (directory: string, tarballPath: string): void => {
  const npmConsumer = join(directory, "npm-consumer")
  const bunConsumer = join(directory, "bun-consumer")
  const bunTemporary = join(directory, "bun-tmp")
  const bunInstall = join(directory, "bun-install")
  const expectedIdentity = "native-npm-target@1.2.3"
  mkdirSync(npmConsumer)
  mkdirSync(bunConsumer)
  mkdirSync(bunTemporary)
  mkdirSync(bunInstall)
  const manifest = `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`
  writeFileSync(join(npmConsumer, "package.json"), manifest)
  writeFileSync(join(bunConsumer, "package.json"), `${JSON.stringify({
    private: true,
    type: "module",
    dependencies: { [packageName]: `file:${tarballPath}` }
  }, null, 2)}\n`)

  run("npm", [
    "install", tarballPath, "--ignore-scripts", "--offline", "--no-audit", "--no-fund",
    "--cache", join(directory, "npm-consumer-cache")
  ], npmConsumer)
  run("node", [
    "--input-type=module", "--eval",
    `import { fixtureIdentity } from ${JSON.stringify(packageName)}; ` +
      `if (fixtureIdentity !== ${JSON.stringify(expectedIdentity)}) throw new Error("wrong npm import")`
  ], npmConsumer)
  const npmBinOutput = join(npmConsumer, "bin-output.txt")
  runToFile(join(npmConsumer, "node_modules", ".bin", "native-npm-target"), [], npmConsumer, npmBinOutput)
  expect(readFileSync(npmBinOutput, "utf8").trim()).toBe(expectedIdentity)

  run("bun", [
    "install", "--ignore-scripts", "--no-cache", "--registry", "http://127.0.0.1:9"
  ], bunConsumer, { BUN_TMPDIR: bunTemporary, BUN_INSTALL: bunInstall, TMPDIR: bunTemporary })
  run("bun", [
    "--eval", `import { fixtureIdentity } from ${JSON.stringify(packageName)}; ` +
      `if (fixtureIdentity !== ${JSON.stringify(expectedIdentity)}) throw new Error("wrong Bun import")`
  ], bunConsumer)
  const bunBinOutput = join(bunConsumer, "bin-output.txt")
  runToFile(join(bunConsumer, "node_modules", ".bin", "native-npm-target"), [], bunConsumer, bunBinOutput)
  expect(readFileSync(bunBinOutput, "utf8").trim()).toBe(expectedIdentity)
}

describe("native npm vertical", () => {
  it.effect("records the pinned npm 12 protocol-double success and proves the tgz in clean consumers", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => mkdtempSync(join(tmpdir(), "ts-release-native-npm-"))),
      (directory) => Effect.gen(function*() {
        const packed = yield* Effect.sync(() => packTarget(directory))
        const release = yield* makeRelease(packed.bytes)
        const expectedRequest = yield* prepareNpmPublishRequest(release.intent, {
          artifact: ArtifactRef.make({ artifactId }),
          bytes: packed.bytes
        })
        let dispatches = 0
        let observations = 0
        let captured: NpmPublishInvocation | undefined
        let materializedBytes: Uint8Array | undefined
        let materializedUserConfig: string | undefined
        const boundary: NpmNativeOperationBoundary = {
          probeVersion: (invocation) => Effect.sync(() => {
            expect(invocation).toMatchObject({
              kind: "npm-version-probe",
              executable: "npm",
              argv: ["npm", "--version"],
              inheritEnvironment: false,
              stdin: "ignore",
              terminal: false,
              retry: "none"
            })
            return { exitCode: 0, stdout: `${npmCliVersion}\n`, stderr: "" }
          }),
          publish: (invocation) => Effect.sync(() => {
            dispatches += 1
            captured = invocation
            materializedBytes = new Uint8Array(readFileSync(invocation.argv[2]!))
            const userConfigIndex = invocation.argv.indexOf("--userconfig")
            materializedUserConfig = readFileSync(invocation.argv[userConfigIndex + 1]!, "utf8")
            return { exitCode: 0, stdout: npm12KeyedSuccess(invocation.request), stderr: "" }
          }),
          observe: () => Effect.sync(() => {
            observations += 1
            return { status: 500, body: "{}" }
          })
        }
        const { layer, userConfigPath } = operationLayer(directory, boundary)

        const result = yield* Effect.gen(function*() {
          const first = yield* executeNpmOperation(operationInput(release))
          const second = yield* executeNpmOperation(operationInput(
            release,
            DispatchId.make("dispatch-that-must-not-run")
          ))
          const report = yield* deriveReleaseReport({
            bundle: release.bundle,
            plan: release.plan,
            journal: second,
            classifyObservation: makeNpmObservationClassifier(expectedRequest)
          })
          return { first, second, report }
        }).pipe(Effect.provide(layer))

        expect(result.first.revision).toBe(2)
        expect(result.second.revision).toBe(2)
        expect(dispatches).toBe(1)
        expect(observations).toBe(0)
        expect(materializedBytes).toEqual(packed.bytes)
        const invocation = captured
        if (invocation === undefined) throw new Error("npm publish invocation was not captured.")
        const scopedTarballPath = invocation.argv[2]!
        const scopedUserConfigPath = invocation.argv[invocation.argv.indexOf("--userconfig") + 1]!
        expect(scopedTarballPath).not.toBe(packed.tarballPath)
        expect(scopedUserConfigPath).not.toBe(userConfigPath)
        expect(existsSync(scopedTarballPath)).toBe(false)
        expect(existsSync(scopedUserConfigPath)).toBe(false)
        expect(materializedUserConfig).toContain("dry-run=true")
        expect(invocation.argv).toEqual([
          "npm", "publish", scopedTarballPath, "--ignore-scripts",
          "--registry", "https://registry.npmjs.org/",
          "--tag", "latest", "--access", "public",
          "--fetch-retries=0", "--provenance=false", "--dry-run=false",
          "--userconfig", scopedUserConfigPath, "--json"
        ])
        expect(invocation).toMatchObject({
          inheritEnvironment: false,
          stdin: "ignore",
          stdout: "capture",
          stderr: "capture",
          terminal: false,
          retry: "none",
          authorizationIdentity
        })
        expect(invocation.environment).not.toHaveProperty("NPM_CONFIG_DRY_RUN")
        expect(result.report.operations[0]?.progress).toBeInstanceOf(OperationReceiptAccepted)
        const reportText = encodeReleaseReport(result.report)
        expect(reportText).not.toContain("consumer")
        expect(reportText).not.toContain("fixture-secret")

        const request = invocation.request
        expect(expectedRequest).toEqual(request)
        expect((yield* decodeNpmPublishReceipt(
          request,
          JSON.stringify({ id: `${packageName}@${version}` })
        ).pipe(Effect.flip))).toBeInstanceOf(NpmPublishReceiptInvalid)

        yield* Effect.sync(() => installPackedConsumers(directory, packed.tarballPath))
      }),
      (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true }))
    ))

  it.effect("records absence after possible dispatch once and then requires honest reconciliation", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => mkdtempSync(join(tmpdir(), "ts-release-native-npm-absence-"))),
      (directory) => Effect.gen(function*() {
        const packed = yield* Effect.sync(() => packTarget(directory))
        const release = yield* makeRelease(packed.bytes)
        const request = yield* prepareNpmPublishRequest(release.intent, {
          artifact: ArtifactRef.make({ artifactId }),
          bytes: packed.bytes
        })
        let dispatches = 0
        let observations = 0
        const boundary = defaultBoundary()
        const ambiguous: NpmNativeOperationBoundary = {
          ...boundary,
          publish: () => {
            dispatches += 1
            return Effect.fail(new NpmDispatchResultUnavailable({
              schemaVersion: "npm-dispatch-error/v1",
              commitment: "possible-dispatch",
              reason: "connection closed after request bytes were handed off"
            }))
          },
          observe: () => Effect.sync(() => {
            observations += 1
            return { status: 404, body: "{}" }
          })
        }
        const { layer } = operationLayer(directory, ambiguous)
        const journal = yield* Effect.gen(function*() {
          const first = yield* executeNpmOperation(operationInput(release))
          expect(first.revision).toBe(2)
          return yield* executeNpmOperation(operationInput(
            release,
            DispatchId.make("dispatch-absence-must-not-run")
          ))
        }).pipe(Effect.provide(layer))

        expect(dispatches).toBe(1)
        expect(observations).toBe(1)
        expect(journal.revision).toBe(2)
        expect(decideNpmJournalAction(journal, release.operation.operationId, request)).toBe("stop")
        const report = yield* deriveReleaseReport({
          bundle: release.bundle,
          plan: release.plan,
          journal,
          classifyObservation: makeNpmObservationClassifier(request)
        })
        expect(report.operations[0]?.progress).toBeInstanceOf(OperationReconciliationRequired)
      }),
      (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true }))
    ))

  it.effect("accepts an exact read after response loss and never resends", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => mkdtempSync(join(tmpdir(), "ts-release-native-npm-exact-"))),
      (directory) => Effect.gen(function*() {
        const packed = yield* Effect.sync(() => packTarget(directory))
        const release = yield* makeRelease(packed.bytes)
        const request = yield* prepareNpmPublishRequest(release.intent, {
          artifact: ArtifactRef.make({ artifactId }),
          bytes: packed.bytes
        })
        let dispatches = 0
        let observations = 0
        const boundary: NpmNativeOperationBoundary = {
          ...defaultBoundary(),
          publish: () => {
            dispatches += 1
            return Effect.fail(new NpmDispatchResultUnavailable({
              schemaVersion: "npm-dispatch-error/v1",
              commitment: "possible-dispatch",
              reason: "response stream ended before a receipt"
            }))
          },
          observe: () => Effect.sync(() => {
            observations += 1
            return {
              status: 200,
              body: JSON.stringify({
                name: packageName,
                "dist-tags": { latest: version },
                versions: {
                  [version]: {
                    name: packageName,
                    version,
                    dist: { integrity: request.tarball.integrity, shasum: request.tarball.shasum }
                  }
                }
              })
            }
          })
        }
        const { layer } = operationLayer(directory, boundary)
        const journal = yield* Effect.gen(function*() {
          const first = yield* executeNpmOperation(operationInput(release))
          expect(decideNpmJournalAction(first, release.operation.operationId, request)).toBe("complete")
          return yield* executeNpmOperation(operationInput(
            release,
            DispatchId.make("dispatch-exact-must-not-run")
          ))
        }).pipe(Effect.provide(layer))
        expect(dispatches).toBe(1)
        expect(observations).toBe(1)
        const report = yield* deriveReleaseReport({
          bundle: release.bundle,
          plan: release.plan,
          journal,
          classifyObservation: makeNpmObservationClassifier(request)
        })
        expect(report.operations[0]?.progress).toBeInstanceOf(OperationObservationConcluded)
        expect(report.operations[0]?.progress).toMatchObject({ conclusion: "satisfied" })
      }),
      (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true }))
    ))

  it.effect("keeps dist-tag correction separate from immutable-byte conflict", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => mkdtempSync(join(tmpdir(), "ts-release-native-npm-differences-"))),
      (directory) => Effect.gen(function*() {
        const packed = yield* Effect.sync(() => packTarget(directory))
        const release = yield* makeRelease(packed.bytes)
        const request = yield* prepareNpmPublishRequest(release.intent, {
          artifact: ArtifactRef.make({ artifactId }),
          bytes: packed.bytes
        })
        const metadata = (distTags: Readonly<Record<string, string>>, shasum: string) => ({
          status: 200,
          body: JSON.stringify({
            name: packageName,
            "dist-tags": distTags,
            versions: {
              [version]: {
                name: packageName,
                version,
                dist: { integrity: request.tarball.integrity, shasum }
              }
            }
          })
        })
        const classify = (response: ReturnType<typeof metadata>) => {
          const observation = observeNpmPublication(request, response)
          return makeNpmObservationClassifier(request)({
            operation: release.operation,
            revision: 1,
            observation: ObservationRecorded.make({
              schemaVersion: 1,
              operationId: release.operation.operationId,
              observation: Schema.encodeSync(NpmPublicationObservation)(observation),
              recordedAtEpochMillis: 1
            })
          })
        }

        expect(classify(metadata({}, request.tarball.shasum))).toBe("inconclusive")
        expect(classify(metadata({ latest: "1.2.2" }, request.tarball.shasum))).toBe("inconclusive")
        expect(classify(metadata({ latest: version }, "0".repeat(40)))).toBe("conflict")
        const forgedExact = NpmPublishedExact.make({
          schemaVersion: "npm-publication-observation/v1",
          integrity: request.tarball.integrity,
          shasum: request.tarball.shasum,
          distTagVersion: NpmVersion.make("1.2.2")
        })
        expect(makeNpmObservationClassifier(request)({
          operation: release.operation,
          revision: 1,
          observation: ObservationRecorded.make({
            schemaVersion: 1,
            operationId: release.operation.operationId,
            observation: Schema.encodeSync(NpmPublicationObservation)(forgedExact),
            recordedAtEpochMillis: 1
          })
        })).toBeUndefined()

        const exact = observeNpmPublication(
          request,
          metadata({ latest: version }, request.tarball.shasum)
        )
        const conflict = observeNpmPublication(
          request,
          metadata({ latest: version }, "0".repeat(40))
        )
        const absent = observeNpmPublication(request, { status: 404, body: "{}" })
        const evidenceDispatchId = DispatchId.make("dispatch-evidence-precedence")
        const startedEvent = DispatchStarted.make({
          schemaVersion: 1,
          operationId: release.operation.operationId,
          dispatchId: evidenceDispatchId,
          attempt: 1,
          providerDefinitionId: release.operation.intent.providerDefinitionId,
          transportId: TransportId.make(`npm-cli/${npmCliVersion}`),
          endpointIdentity: EndpointIdentity.make("https://registry.npmjs.org/"),
          requestFingerprint: RequestFingerprint.make("a".repeat(64)),
          authorizationIdentity: AuthorizationIdentity.make(authorizationIdentity.toString()),
          replayProtection: { scheme: "replay.none/1" },
          replayBasis: { reason: "npm publish has no trusted automatic replay law" },
          startedAtEpochMillis: 1
        })
        const actionAfterLaterAbsence = (
          first: typeof NpmPublicationObservation.Type
        ) => decideNpmJournalAction(ReleaseJournal.make({
          schemaVersion: 1,
          planId: release.plan.planId,
          revision: 3,
          entries: [
            JournalEntry.make({ revision: 1, event: startedEvent }),
            JournalEntry.make({
              revision: 2,
              event: ObservationRecorded.make({
                schemaVersion: 1,
                operationId: release.operation.operationId,
                dispatchId: evidenceDispatchId,
                observation: Schema.encodeSync(NpmPublicationObservation)(first),
                recordedAtEpochMillis: 2
              })
            }),
            JournalEntry.make({
              revision: 3,
              event: ObservationRecorded.make({
                schemaVersion: 1,
                operationId: release.operation.operationId,
                dispatchId: evidenceDispatchId,
                observation: Schema.encodeSync(NpmPublicationObservation)(absent),
                recordedAtEpochMillis: 3
              })
            })
          ]
        }), release.operation.operationId, request)

        expect(actionAfterLaterAbsence(exact)).toBe("complete")
        expect(actionAfterLaterAbsence(conflict)).toBe("conflict")

        const decodeObservation = Schema.decodeUnknownSync(NpmPublicationObservation, {
          onExcessProperty: "error"
        })
        const difference = {
          field: "name",
          expected: packageName,
          observed: { _tag: "NpmObservedValue", value: "other-package" }
        } as const
        expect(() => decodeObservation({
          _tag: "NpmPublishedDifferent",
          schemaVersion: "npm-publication-observation/v1",
          differences: [difference, difference]
        })).toThrow()
        expect(() => decodeObservation({
          _tag: "NpmPublishedDifferent",
          schemaVersion: "npm-publication-observation/v1",
          differences: [{
            ...difference,
            observed: { _tag: "NpmObservedValue", value: packageName }
          }]
        })).toThrow()
      }),
      (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true }))
    ))

  it.effect("keeps exit-zero success when the local npm JSON report is unavailable", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => mkdtempSync(join(tmpdir(), "ts-release-native-npm-malformed-"))),
      (directory) => Effect.gen(function*() {
        const packed = yield* Effect.sync(() => packTarget(directory))
        const release = yield* makeRelease(packed.bytes)
        let dispatches = 0
        let observations = 0
        const boundary: NpmNativeOperationBoundary = {
          ...defaultBoundary(),
          publish: () => Effect.sync(() => {
            dispatches += 1
            return { exitCode: 0, stdout: "{}", stderr: "" }
          }),
          observe: () => Effect.sync(() => {
            observations += 1
            return { status: 404, body: "{}" }
          })
        }
        const { layer } = operationLayer(directory, boundary)
        const journal = yield* Effect.gen(function*() {
          yield* executeNpmOperation(operationInput(release))
          return yield* executeNpmOperation(operationInput(
            release,
            DispatchId.make("accepted-must-not-resend")
          ))
        }).pipe(Effect.provide(layer))
        expect(dispatches).toBe(1)
        expect(observations).toBe(0)
        expect(journal.revision).toBe(2)
        expect(journal.entries[1]?.event).toMatchObject({
          _tag: "ReceiptAccepted",
          receipt: { cliReportedFacts: { _tag: "NpmCliReportUnavailable" } }
        })
      }),
      (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true }))
    ))

  it.effect("rejects hostile tarball manifests and wrong npm versions before durable dispatch", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => mkdtempSync(join(tmpdir(), "ts-release-native-npm-preflight-"))),
      (directory) => Effect.gen(function*() {
        const wrongCoordinate = yield* Effect.sync(() => packManifest(directory, "wrong-coordinate", {
          name: "wrong-native-npm-target",
          version,
          type: "module"
        }))
        const hostileConfig = yield* Effect.sync(() => packManifest(directory, "hostile-config", {
          name: packageName,
          version,
          type: "module",
          publishConfig: { registry: "https://registry.example.invalid/" }
        }))
        const rootPolicy = yield* Effect.sync(() => packManifest(directory, "root-policy", {
          name: packageName,
          version,
          type: "module",
          packageExtensions: { "broken-package@1": { dependencies: { missing: "1" } } }
        }))
        let probes = 0
        let dispatches = 0
        const boundary: NpmNativeOperationBoundary = {
          ...defaultBoundary(),
          probeVersion: () => Effect.sync(() => {
            probes += 1
            return { exitCode: 0, stdout: `${npmCliVersion}\n`, stderr: "" }
          }),
          publish: (invocation) => Effect.sync(() => {
            dispatches += 1
            return { exitCode: 0, stdout: npm12KeyedSuccess(invocation.request), stderr: "" }
          })
        }

        for (const packed of [wrongCoordinate, hostileConfig, rootPolicy]) {
          const release = yield* makeRelease(packed.bytes)
          const isolated = join(directory, `case-${probes}-${packed.bytes.byteLength}`)
          mkdirSync(isolated)
          const { layer } = operationLayer(isolated, boundary)
          const error = yield* executeNpmOperation(operationInput(release)).pipe(
            Effect.provide(layer),
            Effect.flip
          )
          expect(error).toBeInstanceOf(NpmPreparedRequestError)
        }
        expect(probes).toBe(0)
        expect(dispatches).toBe(0)

        const valid = yield* Effect.sync(() => packTarget(directory))
        const release = yield* makeRelease(valid.bytes)
        const wrongVersion: NpmNativeOperationBoundary = {
          ...defaultBoundary(),
          probeVersion: () => Effect.succeed({ exitCode: 0, stdout: "10.9.4\n", stderr: "" }),
          publish: (invocation) => Effect.sync(() => {
            dispatches += 1
            return { exitCode: 0, stdout: npm12KeyedSuccess(invocation.request), stderr: "" }
          })
        }
        const versionCase = join(directory, "wrong-version-case")
        mkdirSync(versionCase)
        const { layer } = operationLayer(versionCase, wrongVersion)
        const outcome = yield* Effect.gen(function*() {
          const error = yield* executeNpmOperation(operationInput(release)).pipe(Effect.flip)
          const store = yield* JournalStore
          const journal = yield* store.read(release.plan.planId)
          return { error, journal }
        }).pipe(Effect.provide(layer))
        expect(outcome.error).toBeInstanceOf(NpmDispatchRejectedBeforeStart)
        expect(outcome.journal.revision).toBe(0)
        expect(dispatches).toBe(0)
      }),
      (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true }))
    ))

  it.effect("rejects a continuation whose durable request fingerprint does not correspond", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => mkdtempSync(join(tmpdir(), "ts-release-native-npm-correspondence-"))),
      (directory) => Effect.gen(function*() {
        const packed = yield* Effect.sync(() => packTarget(directory))
        const release = yield* makeRelease(packed.bytes)
        const durableDispatchId = DispatchId.make("dispatch-with-wrong-fingerprint")
        const { layer } = operationLayer(directory, defaultBoundary())
        const error = yield* Effect.gen(function*() {
          const store = yield* JournalStore
          yield* store.appendIfRevision(release.plan.planId, 0, DispatchStarted.make({
            schemaVersion: 1,
            operationId: release.operation.operationId,
            dispatchId: durableDispatchId,
            attempt: 1,
            providerDefinitionId: release.operation.intent.providerDefinitionId,
            transportId: TransportId.make(`npm-cli/${npmCliVersion}`),
            endpointIdentity: EndpointIdentity.make("https://registry.npmjs.org/"),
            requestFingerprint: RequestFingerprint.make("0".repeat(64)),
            authorizationIdentity: AuthorizationIdentity.make(authorizationIdentity.toString()),
            replayProtection: { scheme: "replay.none/1" },
            replayBasis: { reason: "fixture" },
            startedAtEpochMillis: 1
          }))
          return yield* executeNpmOperation(operationInput(
            release,
            DispatchId.make("must-not-dispatch")
          )).pipe(Effect.flip)
        }).pipe(Effect.provide(layer))
        expect(error).toBeInstanceOf(NpmOperationInputError)
        if (!(error instanceof NpmOperationInputError)) throw new Error("Expected npm correspondence error.")
        expect(error.reason).toContain("does not correspond")
      }),
      (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true }))
    ))

  it.effect("retries safe admission after an unrelated journal CAS winner", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => mkdtempSync(join(tmpdir(), "ts-release-native-npm-admission-race-"))),
      (directory) => Effect.gen(function*() {
        const packed = yield* Effect.sync(() => packTarget(directory))
        const release = yield* makeRelease(packed.bytes)
        let injected = false
        let dispatches = 0
        const racingJournalLayer = Layer.effect(JournalStore, Effect.gen(function*() {
          const base = yield* makeInMemoryJournalStore()
          return JournalStore.of({
            read: base.read,
            appendIfRevision: Effect.fn("AdmissionRace.appendIfRevision")(
              function*(planId, expectedRevision, event) {
                if (!injected && event instanceof DispatchStarted) {
                  injected = true
                  yield* base.appendIfRevision(planId, expectedRevision, RiskAccepted.make({
                    schemaVersion: 1,
                    operationId: event.operationId,
                    acceptedBy: ActorId.make("fixture-maintainer"),
                    basis: { reason: "independent journal event won the first CAS" },
                    recordedAtEpochMillis: 999
                  }))
                }
                return yield* base.appendIfRevision(planId, expectedRevision, event)
              }
            )
          })
        }))
        const boundary: NpmNativeOperationBoundary = {
          ...defaultBoundary(),
          publish: (invocation) => Effect.sync(() => {
            dispatches += 1
            return { exitCode: 0, stdout: npm12KeyedSuccess(invocation.request), stderr: "" }
          })
        }
        const { layer } = operationLayer(
          directory,
          boundary,
          "//registry.npmjs.org/:_authToken=fixture-secret\n",
          racingJournalLayer
        )
        const journal = yield* executeNpmOperation(operationInput(release)).pipe(Effect.provide(layer))

        expect(injected).toBe(true)
        expect(dispatches).toBe(1)
        expect(journal.entries.map((entry) => entry.event._tag)).toEqual([
          "RiskAccepted",
          "DispatchStarted",
          "ReceiptAccepted"
        ])
      }),
      (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true }))
    ))

  it.effect("preserves a concurrent observation and then appends the in-flight success receipt", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => mkdtempSync(join(tmpdir(), "ts-release-native-npm-concurrent-"))),
      (directory) => Effect.gen(function*() {
        const packed = yield* Effect.sync(() => packTarget(directory))
        const release = yield* makeRelease(packed.bytes)
        const request = yield* prepareNpmPublishRequest(release.intent, {
          artifact: ArtifactRef.make({ artifactId }),
          bytes: packed.bytes
        })
        const publishEntered = yield* Deferred.make<void>()
        const publishRelease = yield* Deferred.make<void>()
        let dispatches = 0
        let observations = 0
        const boundary: NpmNativeOperationBoundary = {
          ...defaultBoundary(),
          publish: (invocation) => Effect.gen(function*() {
            dispatches += 1
            yield* Deferred.succeed(publishEntered, undefined)
            yield* Deferred.await(publishRelease)
            return { exitCode: 0, stdout: npm12KeyedSuccess(invocation.request), stderr: "" }
          }),
          observe: () => Effect.sync(() => {
            observations += 1
            return { status: 404, body: "{}" }
          })
        }
        const { layer } = operationLayer(directory, boundary)
        const journal = yield* Effect.gen(function*() {
          const first = yield* executeNpmOperation(operationInput(release)).pipe(Effect.forkChild)
          yield* Deferred.await(publishEntered)
          const observerJournal = yield* executeNpmOperation(operationInput(
            release,
            DispatchId.make("concurrent-observer-must-not-send")
          ))
          expect(observerJournal.revision).toBe(2)
          yield* Deferred.succeed(publishRelease, undefined)
          return yield* Fiber.join(first)
        }).pipe(Effect.provide(layer))

        expect(dispatches).toBe(1)
        expect(observations).toBe(1)
        expect(journal.revision).toBe(3)
        expect(journal.entries.map((entry) => entry.event._tag)).toEqual([
          "DispatchStarted",
          "ObservationRecorded",
          "ReceiptAccepted"
        ])
        const report = yield* deriveReleaseReport({
          bundle: release.bundle,
          plan: release.plan,
          journal,
          classifyObservation: makeNpmObservationClassifier(request)
        })
        expect(report.operations[0]?.progress).toBeInstanceOf(OperationReceiptAccepted)
      }),
      (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true }))
    ))

  it.effect("preserves a stronger ambiguous-dispatch observation after a racing absence", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => mkdtempSync(join(tmpdir(), "ts-release-native-npm-observation-race-"))),
      (directory) => Effect.gen(function*() {
        const packed = yield* Effect.sync(() => packTarget(directory))
        const release = yield* makeRelease(packed.bytes)
        const request = yield* prepareNpmPublishRequest(release.intent, {
          artifact: ArtifactRef.make({ artifactId }),
          bytes: packed.bytes
        })
        const publishEntered = yield* Deferred.make<void>()
        const publishRelease = yield* Deferred.make<void>()
        let observations = 0
        const boundary: NpmNativeOperationBoundary = {
          ...defaultBoundary(),
          publish: () => Effect.gen(function*() {
            yield* Deferred.succeed(publishEntered, undefined)
            yield* Deferred.await(publishRelease)
            return yield* new NpmDispatchResultUnavailable({
              schemaVersion: "npm-dispatch-error/v1",
              commitment: "possible-dispatch",
              reason: "response was lost after request handoff"
            })
          }),
          observe: () => Effect.sync(() => {
            observations += 1
            return observations === 1
              ? { status: 404, body: "{}" }
              : {
                status: 200,
                body: JSON.stringify({
                  name: packageName,
                  "dist-tags": { latest: version },
                  versions: {
                    [version]: {
                      name: packageName,
                      version,
                      dist: { integrity: request.tarball.integrity, shasum: request.tarball.shasum }
                    }
                  }
                })
              }
          })
        }
        const { layer } = operationLayer(directory, boundary)
        const journal = yield* Effect.gen(function*() {
          const sender = yield* executeNpmOperation(operationInput(release)).pipe(Effect.forkChild)
          yield* Deferred.await(publishEntered)
          const racingAbsence = yield* executeNpmOperation(operationInput(
            release,
            DispatchId.make("racing-observer-must-not-send")
          ))
          expect(racingAbsence.revision).toBe(2)
          yield* Deferred.succeed(publishRelease, undefined)
          return yield* Fiber.join(sender)
        }).pipe(Effect.provide(layer))

        expect(observations).toBe(2)
        expect(journal.revision).toBe(3)
        expect(journal.entries.slice(1).map((entry) => entry.event._tag)).toEqual([
          "ObservationRecorded",
          "ObservationRecorded"
        ])
        expect(decideNpmJournalAction(
          journal,
          release.operation.operationId,
          request
        )).toBe("complete")
        const report = yield* deriveReleaseReport({
          bundle: release.bundle,
          plan: release.plan,
          journal,
          classifyObservation: makeNpmObservationClassifier(request)
        })
        expect(report.operations[0]?.progress).toMatchObject({
          _tag: "OperationObservationConcluded",
          conclusion: "satisfied",
          observationRevision: 3
        })
      }),
      (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true }))
    ))
})
