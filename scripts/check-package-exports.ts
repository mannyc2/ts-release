import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs"
import { isAbsolute, join, normalize, resolve } from "node:path"
import { cwd, exit } from "node:process"
import { pathToFileURL } from "node:url"
import * as ts from "typescript"
import { bannedAggregateExports, expectedPublicExports } from "./lib/public-api-policy.js"
import { makeRepoScratchDirectory, removeScratchDirectory } from "./lib/scratch-workspace.js"

interface FileTarget {
  readonly label: string
  readonly path: string
}

const root = cwd()
const bannedAggregateExportSet = new Set(bannedAggregateExports)
const expectedPublicExportSet = new Set(expectedPublicExports)
const ScriptLayer = BunServices.layer
// The published bin is the node BUNDLE, not the Bun TypeScript entry: an npm
// consumer has node and no bun (scripts/check-cli-bundle.ts runs it for real).
const expectedRootBin = {
  "ts-release": "./dist/bin/ts-release.js"
} as const
const expectedRootRuntimeExports = new Set([
  "CompletePreparedReleaseRef",
  "CorrectionReport",
  "CredentialFailureCause",
  "CredentialStrategyUnsupported",
  "CredentialStrategyUnsupportedCause",
  "CredentialUnavailable",
  "CredentialUnavailableCause",
  "GitHubActionsCompletePreparedReleaseRef",
  "LocalCompletePreparedReleaseRef",
  "ObservationReport",
  "PreparationModeUnsupported",
  "PreparedReleaseRefCodecError",
  "PreparedReleaseRefMalformedError",
  "PreparedReleaseRefUnknownSchemeError",
  "ReleaseAbortedError",
  "ReleaseIncompleteError",
  "ReleaseInputError",
  "ReleasePreparationError",
  "ReleaseReport",
  "ReleaseRuntime",
  "correct",
  "decodeCompletePreparedReleaseRef",
  "defineRelease",
  "encodeCompletePreparedReleaseRef",
  "encodeResolvedConfig",
  "inspect",
  "makeGitHubActionsCompletePreparedReleaseRef",
  "makeLocalCompletePreparedReleaseRef",
  "makeReleaseApi",
  "observe",
  "prepare",
  "publish",
  "release",
  "resolveConfig",
  "unsupportedExecutionHost",
])
const expectedHostRuntimeExports: Readonly<Record<string, ReadonlySet<string>>> = {
  "./node": new Set(["NodeReleaseLayer", "makeNodeReleaseLayer"]),
  "./bun": new Set(["BunReleaseLayer", "makeBunReleaseLayer"]),
  "./store": new Set([
    "PreparedCommitHandoffError",
    "PreparedManifestError",
    "PreparedReleaseV2",
    "PreparedStoreError",
    "decodePreparedRelease",
    "encodePreparedRelease",
    "makeLocalPreparedReleaseStore"
  ]),
  "./host": new Set([
    "CredentialAudienceMismatch",
    "CredentialPurposeMismatch",
    "CredentialStrategyUnsupported",
    "CredentialSubjectMismatch",
    "CredentialUnavailable",
    "ReleaseContextError",
    "Sha256Digest",
    "makeCredentialProvider",
    "makeCustomReleaseLayer",
    "makeSourceObserver",
    "sha256Digest"
  ])
}

// SPEC §13 is normative about the root surface, so it is asserted, not
// trusted: the bullet list under "The root runtime exports are exactly:" must
// name the same set this gate holds.
const specRootExports = (failures: Array<string>): ReadonlySet<string> => {
  const spec = join(root, "SPEC.md")
  if (!existsSync(spec)) {
    failures.push("SPEC.md must exist")
    return new Set()
  }
  const section = readFileSync(spec, "utf8").split("## 14.")[0]?.split("## 13.")[1] ?? ""
  const marker = "The root runtime exports are exactly:"
  const lines = section.split("\n")
  const start = lines.findIndex((line) => line.trim() === marker)
  if (start < 0) {
    failures.push(`SPEC.md section 13 must contain the line "${marker}"`)
    return new Set()
  }
  const names = new Set<string>()
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "" && names.size > 0) break
    if (line.trim() === "") continue
    if (!line.startsWith("-") && !line.startsWith("  ")) break
    for (const [, name] of line.matchAll(/`([A-Za-z][A-Za-z0-9]*)`/gu)) names.add(name!)
  }
  return names
}
const checkSpecSurface = (failures: Array<string>): void => {
  const declared = specRootExports(failures)
  for (const name of expectedRootRuntimeExports) {
    if (!declared.has(name)) failures.push(`SPEC.md section 13 omits root export ${name}`)
  }
  for (const name of declared) {
    if (!expectedRootRuntimeExports.has(name)) {
      failures.push(`SPEC.md section 13 names ${name}, which the root does not export`)
    }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isReadonlyArray = (value: unknown): value is ReadonlyArray<unknown> =>
  Array.isArray(value)

const readManifest = (
  path: string,
  label: string,
  failures: Array<string>
): Record<string, unknown> | undefined => {
  if (!existsSync(path)) {
    failures.push(`${label} must exist`)
    return undefined
  }
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
  if (!isRecord(parsed)) {
    failures.push(`${label} did not parse to an object`)
    return undefined
  }
  return parsed
}

const collectExportTargets = (
  exportsField: unknown,
  failures: Array<string>
): Array<FileTarget> => {
  if (!isRecord(exportsField)) {
    failures.push("package.json exports must be an object")
    return []
  }

  const targets: Array<FileTarget> = []
  for (const [subpath, value] of Object.entries(exportsField)) {
    if (typeof value === "string") {
      targets.push({ label: `exports.${subpath}`, path: value })
      continue
    }
    if (!isRecord(value)) {
      failures.push(`exports.${subpath} must be a string or condition object`)
      continue
    }
    for (const [condition, target] of Object.entries(value)) {
      if (typeof target === "string") {
        targets.push({ label: `exports.${subpath}.${condition}`, path: target })
      }
    }
  }
  return targets
}

const collectBinTargets = (
  binField: unknown,
  packageName: string,
  failures: Array<string>
): Array<FileTarget> => {
  if (binField === undefined) {
    return []
  }
  if (typeof binField === "string") {
    return [{ label: `bin.${packageName}`, path: binField }]
  }
  if (!isRecord(binField)) {
    failures.push("package.json bin must be a string or object")
    return []
  }
  const targets: Array<FileTarget> = []
  for (const [name, path] of Object.entries(binField)) {
    if (typeof path === "string") {
      targets.push({ label: `bin.${name}`, path })
    } else {
      failures.push(`bin.${name} must be a string path`)
    }
  }
  return targets
}

const collectSideEffectTargets = (
  sideEffectsField: unknown,
  failures: Array<string>
): Array<FileTarget> => {
  if (sideEffectsField === undefined) {
    return []
  }
  if (!isReadonlyArray(sideEffectsField)) {
    failures.push("package.json sideEffects must be an array when present")
    return []
  }

  const targets: Array<FileTarget> = []
  for (const value of sideEffectsField) {
    if (typeof value !== "string") {
      failures.push("package.json sideEffects entries must be strings")
      continue
    }
    if (value.startsWith("./") && !value.includes("*")) {
      targets.push({ label: `sideEffects.${value}`, path: value })
    }
  }
  return targets
}

const packageImportSpecifier = (packageName: string, subpath: string): string =>
  subpath === "." ? packageName : `${packageName}/${subpath.slice(2)}`

const checkTargetExists = (target: FileTarget, failures: Array<string>): void => {
  const packageRelativeTarget = target.path.startsWith("./")
    ? target.path
    : target.label.startsWith("bin.")
    ? target.path
    : undefined

  if (packageRelativeTarget === undefined) {
    failures.push(`${target.label} must use a relative package path, got ${target.path}`)
    return
  }
  if (isAbsolute(packageRelativeTarget) || normalize(packageRelativeTarget).startsWith("..")) {
    failures.push(`${target.label} must stay inside the package, got ${target.path}`)
    return
  }
  const absolutePath = resolve(root, packageRelativeTarget)
  if (!existsSync(absolutePath)) {
    failures.push(`${target.label} points to missing file ${target.path}`)
  }
}

const checkDeclarationTarget = (target: FileTarget, failures: Array<string>): void => {
  if (!target.path.endsWith(".d.ts")) {
    return
  }
  const contents = readFileSync(resolve(root, target.path), "utf8")
  if (/\bany\b/.test(contents)) {
    failures.push(`${target.label} leaks \`any\` in public declaration ${target.path}`)
  }
}

// The public ENTRY declarations must never name effect/unstable specifiers
// directly — at Effect GA those paths move and every consumer breaks. (The
// transitive ReleaseServicesLive requirement types are its documented
// contract and are exempt; this guards the entry files.)
const checkEntryDeclaration = (target: FileTarget, failures: Array<string>): void => {
  if (!target.path.startsWith("./dist/") || !target.path.endsWith(".js")) {
    return
  }
  const declaration = resolve(root, `${target.path.slice(0, -3)}.d.ts`)
  if (!existsSync(declaration)) {
    failures.push(`${target.label} has no built declaration ${target.path.slice(0, -3)}.d.ts`)
    return
  }
  const contents = readFileSync(declaration, "utf8")
  for (const prefix of ["effect/unstable/http", "effect/unstable/process", "effect/unstable/cli"]) {
    if (contents.includes(`"${prefix}`)) {
      failures.push(`${target.label} declaration names ${prefix}; alias the type behind a package path`)
    }
  }
}

const formatDiagnostic = (diagnostic: ts.Diagnostic): string => {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
  if (diagnostic.file === undefined || diagnostic.start === undefined) {
    return message
  }
  const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
  const file = diagnostic.file.fileName.startsWith(root)
    ? diagnostic.file.fileName.slice(root.length + 1)
    : diagnostic.file.fileName
  return `${file}:${position.line + 1}:${position.character + 1} ${message}`
}

const checkConsumerTypeResolution = async (
  packageName: string,
  exportsField: Record<string, unknown>,
  failures: Array<string>
): Promise<void> => {
  const tempDir = await Effect.runPromise(
    makeRepoScratchDirectory(".tmp-package-export-types-", root).pipe(
      Effect.provide(ScriptLayer)
    )
  )
  try {
    const consumerPath = resolve(tempDir, "consumer.ts")
    const source = Object.keys(exportsField)
      .map((subpath, index) => {
        const binding = `export${index}`
        return `import * as ${binding} from ${JSON.stringify(packageImportSpecifier(packageName, subpath))}\nvoid ${binding}\n`
      })
      .join("\n")
    writeFileSync(consumerPath, source)

    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      skipLibCheck: false,
      noEmit: true,
      types: ["bun-types"]
    }
    const program = ts.createProgram([consumerPath], options)
    const diagnostics = ts.getPreEmitDiagnostics(program)
    for (const diagnostic of diagnostics) {
      failures.push(`consumer typecheck failed: ${formatDiagnostic(diagnostic)}`)
    }
  } finally {
    await Effect.runPromise(
      removeScratchDirectory(tempDir, {
        expectedParent: root,
        allowedPrefixes: [".tmp-package-export-types-"]
      }).pipe(Effect.provide(ScriptLayer))
    )
  }
}

interface ExternalConsumerResult {
  readonly calls: {
    readonly source: number
    readonly run: number
    readonly commit: number
    readonly load: number
    readonly credential: number
    readonly http: number
  }
  readonly observed: string
  readonly published: string
}

const decodeText = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

const runExternalCommand = (
  argv: ReadonlyArray<string>,
  directory: string
): { readonly status: number, readonly stdout: string, readonly stderr: string } => {
  const result = Bun.spawnSync([...argv], {
    cwd: directory,
    env: { PATH: process.env.PATH ?? "" },
    stdout: "pipe",
    stderr: "pipe",
    timeout: 30_000
  })
  return {
    status: result.exitCode,
    stdout: decodeText(result.stdout),
    stderr: decodeText(result.stderr)
  }
}

const checkExternalLibraryConsumer = async (
  packageName: string,
  failures: Array<string>
): Promise<void> => {
  const tempDir = await Effect.runPromise(
    makeRepoScratchDirectory(".tmp-external-library-consumer-", root).pipe(
      Effect.provide(ScriptLayer)
    )
  )
  try {
    const fixturePath = resolve(root, "test", "fixtures", "external-library-consumer.ts")
    const consumerPath = resolve(tempDir, "consumer.ts")
    const source = readFileSync(fixturePath, "utf8")
    const sourceFile = ts.createSourceFile(
      consumerPath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )
    const expectedPackageImports = new Set([
      packageName,
      `${packageName}/host`,
      `${packageName}/store`
    ])
    const observedPackageImports = new Set<string>()
    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
      const specifier = statement.moduleSpecifier.text
      if (specifier.startsWith(".")) {
        failures.push(`external library consumer must not use relative import ${specifier}`)
      }
      if (specifier === packageName || specifier.startsWith(`${packageName}/`)) {
        observedPackageImports.add(specifier)
        if (!expectedPackageImports.has(specifier)) {
          failures.push(`external library consumer imports unsupported package subpath ${specifier}`)
        }
      }
    }
    for (const specifier of expectedPackageImports) {
      if (!observedPackageImports.has(specifier)) {
        failures.push(`external library consumer must exercise ${specifier}`)
      }
    }

    writeFileSync(consumerPath, source)
    writeFileSync(resolve(tempDir, "package.json"), `${JSON.stringify({
      name: "external-ts-release-consumer",
      private: true,
      type: "module"
    }, null, 2)}\n`)
    writeFileSync(resolve(tempDir, "tsconfig.json"), `${JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        types: ["bun-types"]
      }
    }, null, 2)}\n`)
    const packageScope = resolve(tempDir, "node_modules", "@mannyc1")
    mkdirSync(packageScope, { recursive: true })
    symlinkSync(root, resolve(packageScope, "ts-release"), "dir")

    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      skipLibCheck: false,
      noEmit: true,
      types: ["bun-types"]
    }
    const program = ts.createProgram([consumerPath], options)
    for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
      failures.push(`external library consumer typecheck failed: ${formatDiagnostic(diagnostic)}`)
    }

    const workspace = resolve(tempDir, "workspace")
    mkdirSync(workspace, { recursive: true })
    writeFileSync(resolve(workspace, "package.json"), `${JSON.stringify({
      name: "external-library-fixture",
      version: "1.0.0",
      repository: "https://github.com/owner/fixture.git"
    }, null, 2)}\n`)
    writeFileSync(resolve(workspace, "payload.txt"), "external package bytes\n")
    for (const argv of [
      ["git", "init", "--quiet"],
      ["git", "add", "--all"],
      [
        "git", "-c", "user.name=External Library Fixture",
        "-c", "user.email=external-library@example.test",
        "commit", "--quiet", "-m", "fixture"
      ]
    ]) {
      const initialized = runExternalCommand(argv, workspace)
      if (initialized.status !== 0) {
        failures.push(`external library consumer setup failed: ${initialized.stderr || initialized.stdout}`)
        return
      }
    }

    const executed = runExternalCommand([
      process.execPath,
      "run",
      consumerPath,
      workspace,
      resolve(tempDir, "prepared-store")
    ], tempDir)
    if (executed.status !== 0) {
      failures.push(`external library consumer execution failed: ${executed.stderr || executed.stdout}`)
      return
    }
    let result: ExternalConsumerResult
    try {
      result = JSON.parse(executed.stdout.trim()) as ExternalConsumerResult
    } catch {
      failures.push(`external library consumer emitted invalid JSON: ${executed.stdout}`)
      return
    }
    const expectedCalls: ExternalConsumerResult["calls"] = {
      source: 3,
      run: 1,
      commit: 1,
      load: 2,
      credential: 4,
      http: 2
    }
    for (const [boundary, expected] of Object.entries(expectedCalls)) {
      const actual = result.calls[boundary as keyof ExternalConsumerResult["calls"]]
      if (actual !== expected) {
        failures.push(`external library consumer ${boundary} boundary calls were ${actual}, expected ${expected}`)
      }
    }
    if (result.observed !== "inconclusive" || result.published !== "blocked") {
      failures.push(
        `external library consumer returned observe=${result.observed} publish=${result.published}, expected inconclusive/blocked`
      )
    }
  } finally {
    await Effect.runPromise(
      removeScratchDirectory(tempDir, {
        expectedParent: root,
        allowedPrefixes: [".tmp-external-library-consumer-"]
      }).pipe(Effect.provide(ScriptLayer))
    )
  }
}

const main = async (): Promise<void> => {
  const failures: Array<string> = []
  const manifest = readManifest(resolve(root, "package.json"), "package.json", failures)
  const appManifest = readManifest(
    resolve(root, "apps", "release-ts", "package.json"),
    "apps/release-ts/package.json",
    failures
  )
  if (manifest === undefined) {
    throw new Error("package.json is required for package export checks")
  }
  const packageName = manifest.name
  if (typeof packageName !== "string" || packageName.length === 0) {
    failures.push("package.json name must be a non-empty string")
  }
  if (!isRecord(manifest.bin)) {
    failures.push("package.json must declare the ts-release root bin")
  } else {
    for (const [name, path] of Object.entries(expectedRootBin)) {
      if (manifest.bin[name] !== path) {
        failures.push(`package.json bin.${name} must point at ${path}`)
      }
    }
    for (const name of Object.keys(manifest.bin)) {
      if (!Object.hasOwn(expectedRootBin, name)) {
        failures.push(`package.json bin.${name} is not in the intentional root bin list`)
      }
    }
  }
  if (
    isReadonlyArray(manifest.sideEffects) &&
    manifest.sideEffects.some((value) => value === "./dist/cli/main.js")
  ) {
    failures.push("package.json must not preserve root CLI sideEffects; apps/release-ts owns dist/cli/main.js")
  }

  const exportTargets = collectExportTargets(manifest.exports, failures)
  const binTargets = collectBinTargets(manifest.bin, typeof packageName === "string" ? packageName : "package", failures)
  const sideEffectTargets = collectSideEffectTargets(manifest.sideEffects, failures)

  for (const target of [...exportTargets, ...binTargets, ...sideEffectTargets]) {
    checkTargetExists(target, failures)
  }
  for (const target of exportTargets) {
    checkDeclarationTarget(target, failures)
    checkEntryDeclaration(target, failures)
  }

  if (typeof packageName === "string") {
    const exportsField = manifest.exports
    if (isRecord(exportsField)) {
      const actualExports = new Set(Object.keys(exportsField))
      for (const expected of expectedPublicExportSet) {
        if (!actualExports.has(expected)) {
          failures.push(`package.json is missing intentional public export ${expected}`)
        }
      }
      for (const actual of actualExports) {
        if (!expectedPublicExportSet.has(actual)) {
          failures.push(`package.json export ${actual} is not in the intentional public API list`)
        }
      }
      await checkConsumerTypeResolution(packageName, exportsField, failures)
      await checkExternalLibraryConsumer(packageName, failures)
      for (const subpath of Object.keys(exportsField)) {
        if (subpath.includes("*")) {
          failures.push(`package.json export ${subpath} must be explicit; wildcard exports are not allowed`)
        }
        if (bannedAggregateExportSet.has(subpath)) {
          failures.push(`package.json export ${subpath} is an aggregate entrypoint and must not be published`)
        }
        const specifier = packageImportSpecifier(packageName, subpath)
        // Import the BUILT artifact, not the bare specifier: under `bun run`,
        // tsconfig paths resolve the bare name to src/, so a dist/ regression
        // would pass. The runtime proof must load what ships.
        const exportValue = exportsField[subpath]
        const builtTarget = typeof exportValue === "string"
          ? exportValue
          : isRecord(exportValue) && typeof exportValue.default === "string"
          ? exportValue.default
          : undefined
        if (builtTarget === undefined) {
          failures.push(`package export ${specifier} has no importable default target`)
          continue
        }
        try {
          const module = await import(pathToFileURL(resolve(root, builtTarget)).href)
          const expectedExports = subpath === "."
            ? expectedRootRuntimeExports
            : expectedHostRuntimeExports[subpath]
          if (expectedExports !== undefined) {
            const actualRuntimeExports = new Set(Object.keys(module))
            for (const expected of expectedExports) {
              if (!actualRuntimeExports.has(expected)) {
                failures.push(`package export ${specifier} is missing runtime export ${expected}`)
              }
            }
            for (const actual of actualRuntimeExports) {
              if (!expectedExports.has(actual)) {
                failures.push(`package export ${specifier} exposes unexpected runtime export ${actual}`)
              }
            }
          }
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause)
          failures.push(`failed to import ${specifier}: ${message}`)
        }
      }
    }
  }

  if (appManifest !== undefined) {
    if (appManifest.private !== true) {
      failures.push("apps/release-ts/package.json must remain private until an app publishing plan changes it")
    }
    if (appManifest.exports !== undefined) {
      failures.push("apps/release-ts/package.json must not declare root library exports")
    }
    // The app declares NO bin: it is private, it has no build, and the only
    // shipped executable is the root bundle above.
    if (appManifest.bin !== undefined) {
      failures.push("apps/release-ts/package.json must not declare a bin; the root bundle is the only executable")
    }
    if (
      !isReadonlyArray(appManifest.sideEffects) ||
      !appManifest.sideEffects.some((value) => value === "./dist/cli/main.js")
    ) {
      failures.push("apps/release-ts/package.json sideEffects must preserve ./dist/cli/main.js")
    }
  }

  checkSpecSurface(failures)

  if (failures.length > 0) {
    console.error("Package export checks failed:")
    for (const failure of failures) {
      console.error(`- ${failure}`)
    }
    exit(1)
  }
}

await main()
