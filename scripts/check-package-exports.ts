import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { isAbsolute, normalize, resolve } from "node:path"
import { cwd, exit } from "node:process"
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isReadonlyArray = (value: unknown): value is ReadonlyArray<unknown> =>
  Array.isArray(value)

const formatUnknown = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

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
  if (manifest.bin !== undefined) {
    failures.push("package.json must not declare a root bin; apps/release-ts owns the release executable")
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
      for (const subpath of Object.keys(exportsField)) {
        if (subpath.includes("*")) {
          failures.push(`package.json export ${subpath} must be explicit; wildcard exports are not allowed`)
        }
        if (bannedAggregateExportSet.has(subpath)) {
          failures.push(`package.json export ${subpath} is an aggregate entrypoint and must not be published`)
        }
        const specifier = packageImportSpecifier(packageName, subpath)
        try {
          const module = await import(specifier)
          if (subpath === "." && Object.keys(module).length > 0) {
            failures.push(`package root ${specifier} must be empty, got exports: ${Object.keys(module).join(", ")}`)
          }
        } catch (cause) {
          failures.push(`failed to import ${specifier}: ${formatUnknown(cause)}`)
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
    if (!isRecord(appManifest.bin) || appManifest.bin.release !== "dist/cli/main.js") {
      failures.push("apps/release-ts/package.json must own bin.release as dist/cli/main.js")
    }
    if (
      !isReadonlyArray(appManifest.sideEffects) ||
      !appManifest.sideEffects.some((value) => value === "./dist/cli/main.js")
    ) {
      failures.push("apps/release-ts/package.json sideEffects must preserve ./dist/cli/main.js")
    }
  }

  if (failures.length > 0) {
    console.error("Package export checks failed:")
    for (const failure of failures) {
      console.error(`- ${failure}`)
    }
    exit(1)
  }
}

await main()
