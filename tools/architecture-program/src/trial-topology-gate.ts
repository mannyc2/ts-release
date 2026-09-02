import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, posix, resolve } from "node:path"
import { Effect, Schema } from "effect"
import * as ts from "typescript"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "./canonical-document.js"
import type { ArchitectureCandidateManifestV2 } from "./schema/candidate-manifest.js"
import { ArtifactId } from "./schema/primitives.js"
import { codePointCompare } from "./schema/trial-evidence.js"
import type { CandidateTreeInventory } from "./trial-inventory.js"
import { sha256Bytes } from "./trial-hash.js"

export const TRIAL_TOPOLOGY_FIXTURE_PATH = "topology-fixture.json"

const topologyGateIds = new Set([
  "GT02-packed-library-node",
  "GT03-packed-library-bun",
  "GT04-packed-cli",
  "GT05-packed-github-action",
  "GT06-packed-external-provider-two-instances",
  "GT07-lossless-effect-build-file-tree-adoption",
  "GT08-exact-runtime-declaration-surface",
  "GT09-exact-emitted-packed-inventory",
  "GT10-exact-static-type-dynamic-manifest-graph",
  "GT11-no-cycle-sibling-reversal-or-host-edge",
  "GT12-version-skew-partial-publication",
  "GT13-dry-run-build-publication-self-release",
  "GT14-tree-shaking-and-packed-bytes"
])

export const isRunnerOwnedTopologyGate = (gateId: string): boolean => topologyGateIds.has(gateId)

export class TopologyPackageCoordinate extends Schema.Class<TopologyPackageCoordinate>(
  "TopologyPackageCoordinate"
)({
  name: Schema.String,
  root: Schema.String,
  version: Schema.String
}) {}

export class TopologyCliCoordinate extends Schema.Class<TopologyCliCoordinate>(
  "TopologyCliCoordinate"
)({
  packageName: Schema.String,
  binName: Schema.String
}) {}

export class TopologyActionCoordinate extends Schema.Class<TopologyActionCoordinate>(
  "TopologyActionCoordinate"
)({
  packageName: Schema.String,
  exportSubpath: Schema.String
}) {}

export class TopologyFixtureV1 extends Schema.Class<TopologyFixtureV1>("TopologyFixtureV1")({
  schemaVersion: Schema.Literal("ts-release/topology-fixture/v1"),
  packages: Schema.NonEmptyArray(TopologyPackageCoordinate),
  libraryPackageName: Schema.String,
  cli: TopologyCliCoordinate,
  action: TopologyActionCoordinate,
  externalProviderPackageName: Schema.String,
  generatedInventoryPath: Schema.String,
  generatedSurfacePaths: Schema.Array(Schema.String)
}) {}

class GeneratedSurfacePackage extends Schema.Class<GeneratedSurfacePackage>(
  "GeneratedSurfacePackage"
)({
  name: Schema.String,
  runtimeExports: Schema.Array(Schema.String),
  declarationExports: Schema.Array(Schema.String)
}) {}

class GeneratedSurfaceInventory extends Schema.Class<GeneratedSurfaceInventory>(
  "GeneratedSurfaceInventory"
)({
  schemaVersion: Schema.Literal("ts-release/generated-surface-inventory/v1"),
  packages: Schema.Array(GeneratedSurfacePackage)
}) {}

export class TrialTopologyGateError extends Schema.TaggedError<TrialTopologyGateError>()(
  "TrialTopologyGateError",
  {
    failureIds: Schema.NonEmptyArray(ArtifactId),
    message: Schema.String
  }
) {
  constructor(values: ReadonlyArray<string>) {
    const ids = [...new Set(values)].sort(codePointCompare).map((value) => ArtifactId.make(value))
    const failureIds = (ids.length === 0
      ? [ArtifactId.make("gate.runner-topology-verification-failed")]
      : ids) as [typeof ArtifactId.Type, ...Array<typeof ArtifactId.Type>]
    super({
      failureIds,
      message: `Runner-owned topology verification failed: ${failureIds.join(", ")}`
    })
  }
}

interface PackageDocument {
  readonly name: string
  readonly version: string
  readonly type: "module"
  readonly private?: boolean
  readonly files: ReadonlyArray<string>
  readonly exports: Readonly<Record<string, unknown>>
  readonly bin: Readonly<Record<string, string>>
  readonly dependencies: Readonly<Record<string, string>>
  readonly optionalDependencies: Readonly<Record<string, string>>
  readonly peerDependencies: Readonly<Record<string, string>>
}

interface PackageAuthority {
  readonly coordinate: TopologyPackageCoordinate
  readonly candidateRoot: string
  readonly manifestPath: string
  readonly packageId: string
  readonly document: PackageDocument
  readonly runtimePath: string
  readonly declarationPath: string
  readonly runtimeExports: ReadonlyArray<string>
  readonly declarationExports: ReadonlyArray<string>
}

export interface TrialTopologyStaticInspection {
  readonly fixture: TopologyFixtureV1
  readonly packages: ReadonlyArray<PackageAuthority>
  readonly declarationSurfaceSha256: ReturnType<typeof sha256Bytes>
  readonly runtimePlusDeclarationExportCount: number
  readonly staticCheckCount: number
}

export interface TrialTopologyExecutionInspection {
  readonly checkCount: number
  readonly packedByteCount: number | null
}

const strict = { errors: "all", onExcessProperty: "error" } as const
const decodeFixture = Schema.decodeUnknownEffect(TopologyFixtureV1, strict)
const decodeSurface = Schema.decodeUnknownEffect(GeneratedSurfaceInventory, strict)
const textDecoder = new TextDecoder("utf-8", { fatal: true })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const sortedUnique = (values: ReadonlyArray<string>): boolean =>
  values.every((value, index) => index === 0 || codePointCompare(values[index - 1]!, value) < 0)

const safeRelativePath = (value: string, allowDot = false): boolean => {
  if (value === ".") return allowDot
  if (value.length === 0 || value !== value.normalize("NFC") || value.startsWith("/") ||
    value.endsWith("/") || value.includes("\\") || value.includes("\0")) return false
  const segments = value.split("/")
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..") &&
    posix.normalize(value) === value
}

const packageNamePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/
const versionPattern = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?$/

const candidatePath = (root: string, path: string): string => resolve(root, path)

const pathWithin = (root: string, path: string): boolean =>
  path === root || path.startsWith(`${root}/`)

const parseJson = (bytes: Uint8Array): unknown => parseCanonicalJsonBytes(bytes)

const readInventoriedBytes = Effect.fn("TrialTopologyGate.readInventoriedBytes")(function* (
  root: string,
  inventory: CandidateTreeInventory,
  path: string
) {
  const entry = inventory.entries.find((candidate) => candidate.path === path)
  if (entry === undefined) return yield* Effect.fail(new Error(`uninventoried topology path ${path}`))
  const absolute = candidatePath(root, path)
  if (!pathWithin(root, absolute)) return yield* Effect.fail(new Error(`escaping topology path ${path}`))
  const before = yield* Effect.tryPromise(() => lstat(absolute))
  if (!before.isFile() || before.isSymbolicLink()) {
    return yield* Effect.fail(new Error(`non-file topology path ${path}`))
  }
  const bytes = new Uint8Array(yield* Effect.tryPromise(() => readFile(absolute)))
  const after = yield* Effect.tryPromise(() => lstat(absolute))
  if (!after.isFile() || after.isSymbolicLink() || before.dev !== after.dev ||
    before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs ||
    bytes.byteLength !== entry.bytes || sha256Bytes(bytes) !== entry.sha256) {
    return yield* Effect.fail(new Error(`unstable topology path ${path}`))
  }
  return bytes
})

const readInventoriedText = Effect.fn("TrialTopologyGate.readInventoriedText")(function* (
  root: string,
  inventory: CandidateTreeInventory,
  path: string
) {
  const bytes = yield* readInventoriedBytes(root, inventory, path)
  return yield* Effect.try({ try: () => textDecoder.decode(bytes), catch: () => new Error(`${path} is not UTF-8`) })
})

const stringRecord = (value: unknown): Readonly<Record<string, string>> | null => {
  if (value === undefined) return {}
  if (!isRecord(value) || Object.values(value).some((item) => typeof item !== "string")) return null
  return value as Record<string, string>
}

const stringArray = (value: unknown): ReadonlyArray<string> | null =>
  Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null

const packageDocument = (value: unknown): PackageDocument | null => {
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.version !== "string" ||
    value.type !== "module" || (value.private !== undefined && typeof value.private !== "boolean") ||
    !isRecord(value.exports)) return null
  const files = stringArray(value.files)
  const bin = stringRecord(value.bin)
  const dependencies = stringRecord(value.dependencies)
  const optionalDependencies = stringRecord(value.optionalDependencies)
  const peerDependencies = stringRecord(value.peerDependencies)
  if (files === null || bin === null || dependencies === null || optionalDependencies === null ||
    peerDependencies === null) return null
  return {
    name: value.name,
    version: value.version,
    type: "module",
    ...(value.private === undefined ? {} : { private: value.private }),
    files,
    exports: value.exports,
    bin,
    dependencies,
    optionalDependencies,
    peerDependencies
  }
}

const exportTarget = (
  exports: Readonly<Record<string, unknown>>,
  subpath: string,
  condition: "import" | "types"
): string | null => {
  const value = exports[subpath]
  if (typeof value === "string") return condition === "import" ? value : null
  if (!isRecord(value)) return null
  const selected = value[condition] ?? (condition === "import" ? value.default : undefined)
  return typeof selected === "string" ? selected : null
}

const packageRelativeTarget = (value: string): string | null =>
  value.startsWith("./") && safeRelativePath(value.slice(2)) ? value.slice(2) : null

const exportedNames = (path: string, sourceText: string): ReadonlyArray<string> | null => {
  const source = ts.createSourceFile(path, sourceText, ts.ScriptTarget.ESNext, true)
  const names: Array<string> = []
  const pushBinding = (name: ts.BindingName): boolean => {
    if (ts.isIdentifier(name)) {
      names.push(name.text)
      return true
    }
    for (const element of name.elements) {
      if (ts.isOmittedExpression(element) || !pushBinding(element.name)) return false
    }
    return true
  }
  for (const statement of source.statements) {
    const exported = ts.canHaveModifiers(statement) &&
      ts.getModifiers(statement)?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword) === true
    if (ts.isVariableStatement(statement) && exported) {
      for (const declaration of statement.declarationList.declarations) if (!pushBinding(declaration.name)) return null
      continue
    }
    if ((ts.isClassDeclaration(statement) || ts.isFunctionDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)) && exported) {
      if (statement.name === undefined) return null
      names.push(statement.name.text)
      continue
    }
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause === undefined || !ts.isNamedExports(statement.exportClause)) return null
      for (const element of statement.exportClause.elements) names.push(element.name.text)
    }
    if (ts.isExportAssignment(statement)) return null
  }
  const sorted = [...new Set(names)].sort(codePointCompare)
  return sorted.length === names.length ? sorted : null
}

const normalizeDeclaration = (value: string): string =>
  value.replaceAll("\r\n", "\n").split("\n").map((line) => line.trimEnd()).join("\n")

const packageManifestPath = (coordinate: TopologyPackageCoordinate): string =>
  coordinate.root === "." ? "package.json" : `${coordinate.root}/package.json`

const rootedPath = (coordinate: TopologyPackageCoordinate, relative: string): string =>
  coordinate.root === "." ? relative : `${coordinate.root}/${relative}`

const fixtureIssues = (fixture: TopologyFixtureV1): ReadonlyArray<string> => {
  const names = fixture.packages.map(({ name }) => name)
  const roots = fixture.packages.map(({ root }) => root)
  const nameSet = new Set(names)
  return [
    ...(fixture.packages.some(({ name }) => !packageNamePattern.test(name))
      ? ["gate.runner-topology-package-name"] : []),
    ...(fixture.packages.some(({ root }) => !safeRelativePath(root, true))
      ? ["gate.runner-topology-package-root"] : []),
    ...(fixture.packages.some(({ version }) => !versionPattern.test(version))
      ? ["gate.runner-topology-package-version"] : []),
    ...(new Set(names).size !== names.length ? ["gate.runner-topology-package-name-duplicate"] : []),
    ...(new Set(roots).size !== roots.length ? ["gate.runner-topology-package-root-duplicate"] : []),
    ...(!nameSet.has(fixture.libraryPackageName) || !nameSet.has(fixture.cli.packageName) ||
      !nameSet.has(fixture.action.packageName) || !nameSet.has(fixture.externalProviderPackageName)
      ? ["gate.runner-topology-coordinate-reference"] : []),
    ...(!packageNamePattern.test(fixture.cli.packageName) || fixture.cli.binName.length === 0 ||
      fixture.cli.binName.includes("/") || fixture.cli.binName.includes("\\")
      ? ["gate.runner-topology-cli-coordinate"] : []),
    ...(!packageNamePattern.test(fixture.action.packageName) ||
      !fixture.action.exportSubpath.startsWith("./") ||
      !safeRelativePath(fixture.action.exportSubpath.slice(2))
      ? ["gate.runner-topology-action-coordinate"] : []),
    ...(!safeRelativePath(fixture.generatedInventoryPath)
      ? ["gate.runner-topology-generated-inventory-path"] : []),
    ...(fixture.generatedSurfacePaths.length === 0 ||
      fixture.generatedSurfacePaths.some((path) => !safeRelativePath(path)) ||
      !sortedUnique(fixture.generatedSurfacePaths)
      ? ["gate.runner-topology-generated-surface-paths"] : [])
  ]
}

const roleNodes = (
  manifest: ArchitectureCandidateManifestV2,
  match: (roleId: string) => boolean
): ReadonlySet<string> => {
  const nodes = new Set<string>()
  for (const file of manifest.files) {
    if (!file.ownerRoleIds.some(match)) continue
    if (file.moduleId !== null) nodes.add(file.moduleId)
    if (file.packageId !== null) nodes.add(file.packageId)
  }
  return nodes
}

const graphCycle = (edges: ReadonlyArray<{ readonly fromId: string; readonly toId: string }>): boolean => {
  const targets = new Map<string, Array<string>>()
  for (const edge of edges) targets.set(edge.fromId, [...(targets.get(edge.fromId) ?? []), edge.toId])
  const active = new Set<string>()
  const complete = new Set<string>()
  const visit = (node: string): boolean => {
    if (active.has(node)) return true
    if (complete.has(node)) return false
    active.add(node)
    if ((targets.get(node) ?? []).some(visit)) return true
    active.delete(node)
    complete.add(node)
    return false
  }
  return [...new Set(edges.flatMap(({ fromId, toId }) => [fromId, toId]))].some(visit)
}

const resolveSourceModule = (
  sourcePath: string,
  specifier: string,
  pathToModuleId: ReadonlyMap<string, string>
): string | null => {
  if (!specifier.startsWith(".")) return null
  const base = posix.normalize(posix.join(posix.dirname(sourcePath), specifier))
  const candidates = [base, base.replace(/\.(?:m?js|cjs)$/u, ".ts"), `${base}.ts`, `${base}/index.ts`]
  for (const candidate of candidates) {
    const moduleId = pathToModuleId.get(candidate)
    if (moduleId !== undefined) return moduleId
  }
  return null
}

const sourceEdges = Effect.fn("TrialTopologyGate.sourceEdges")(function* (
  root: string,
  manifest: ArchitectureCandidateManifestV2,
  inventory: CandidateTreeInventory
) {
  const product = manifest.files.filter((file) =>
    (file.laneId === "product-source" || file.laneId === "generated-product-input" ||
      file.laneId === "action-source") && file.path.endsWith(".ts") && file.moduleId !== null)
  const pathToModuleId = new Map(product.map((file) => [file.path, file.moduleId!] as const))
  const edges: Array<{ readonly id: string; readonly fromId: string; readonly toId: string; readonly kind: string }> = []
  let nonliteralDynamic = false
  for (const file of product) {
    const text = yield* readInventoriedText(root, inventory, file.path)
    const source = ts.createSourceFile(file.path, text, ts.ScriptTarget.ESNext, true)
    const add = (specifier: string, kind: "static" | "type-only" | "dynamic") => {
      const target = resolveSourceModule(file.path, specifier, pathToModuleId)
      if (target === null) return
      edges.push({
        id: `${file.moduleId}->${target}:${kind}`,
        fromId: file.moduleId!,
        toId: target,
        kind
      })
    }
    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
        const clause = statement.importClause
        const typeOnly = clause?.isTypeOnly === true || (clause?.namedBindings !== undefined &&
          ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.length > 0 &&
          clause.namedBindings.elements.every(({ isTypeOnly }) => isTypeOnly))
        add(statement.moduleSpecifier.text, typeOnly ? "type-only" : "static")
      } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined &&
        ts.isStringLiteral(statement.moduleSpecifier)) {
        add(statement.moduleSpecifier.text, statement.isTypeOnly ? "type-only" : "static")
      }
    }
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0]!)) nonliteralDynamic = true
        else add(node.arguments[0].text, "dynamic")
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return { edges, nonliteralDynamic }
})

const staticGraphIssues = Effect.fn("TrialTopologyGate.staticGraphIssues")(function* (
  root: string,
  manifest: ArchitectureCandidateManifestV2,
  inventory: CandidateTreeInventory,
  packages: ReadonlyArray<PackageAuthority>
) {
  const packageNameToId = new Map(packages.map(({ coordinate, packageId }) =>
    [coordinate.name, packageId] as const))
  const manifestEdges = packages.flatMap(({ document, packageId }) => {
    const all = { ...document.peerDependencies, ...document.optionalDependencies, ...document.dependencies }
    return Object.keys(all).filter((name) => packageNameToId.has(name)).map((name) => {
      const toId = packageNameToId.get(name)!
      return { id: `${packageId}->${toId}:manifest`, fromId: packageId, toId, kind: "manifest" }
    })
  })
  const observedSource = yield* sourceEdges(root, manifest, inventory)
  const observed = [...observedSource.edges, ...manifestEdges]
    .sort((left, right) => codePointCompare(left.id, right.id))
  const declared = manifest.dependencyEdges
    .map(({ id, fromId, toId, kind }) => ({ id, fromId, toId, kind }))
    .sort((left, right) => codePointCompare(left.id, right.id))
  const exact = JSON.stringify(observed) === JSON.stringify(declared)
  const neutral = roleNodes(manifest, (role) =>
    role === "role-kernel" || role === "role-machine" || role === "role-kernel-workflow")
  const providers = roleNodes(manifest, (role) => role.includes("provider"))
  const hosts = roleNodes(manifest, (role) => role.includes("host") || role === "role-cli-host")
  const providerRoles = new Map<string, ReadonlySet<string>>()
  for (const file of manifest.files) {
    const roles = new Set(file.ownerRoleIds.filter((role) => role.includes("provider")))
    for (const node of [file.moduleId, file.packageId]) if (node !== null && roles.size > 0) {
      providerRoles.set(node, new Set([...(providerRoles.get(node) ?? []), ...roles]))
    }
  }
  const sibling = observed.some(({ fromId, toId }) => {
    const from = providerRoles.get(fromId)
    const to = providerRoles.get(toId)
    return from !== undefined && to !== undefined && [...from].some((role) => !to.has(role))
  })
  return [
    ...(observedSource.nonliteralDynamic ? ["gate.runner-topology-nonliteral-dynamic-import"] : []),
    ...(!exact ? ["gate.runner-topology-dependency-graph-mismatch"] : []),
    ...(graphCycle(observed) ? ["gate.runner-topology-dependency-cycle"] : []),
    ...(sibling ? ["gate.runner-topology-provider-sibling-edge"] : []),
    ...(observed.some(({ fromId, toId }) => neutral.has(fromId) &&
      (providers.has(toId) || hosts.has(toId)))
      ? ["gate.runner-topology-neutral-reversal-edge"] : [])
  ]
})

export const inspectTopologyGateStatic = Effect.fn(
  "TrialTopologyGate.inspectStatic"
)(function* (input: {
  readonly root: string
  readonly manifest: ArchitectureCandidateManifestV2
  readonly inventory: CandidateTreeInventory
}) {
  const failures: Array<string> = []
  const fixtureValue = yield* Effect.result(Effect.gen(function* () {
    const bytes = yield* readInventoriedBytes(input.root, input.inventory, TRIAL_TOPOLOGY_FIXTURE_PATH)
    const value = yield* Effect.try({ try: () => parseJson(bytes), catch: () => new Error("invalid fixture JSON") })
    return yield* decodeFixture(value)
  }))
  if (fixtureValue._tag === "Failure") {
    return yield* new TrialTopologyGateError(["gate.runner-topology-fixture-schema"])
  }
  const fixture = fixtureValue.success
  failures.push(...fixtureIssues(fixture))
  const inventoryPaths: ReadonlySet<string> = new Set<string>(
    input.inventory.entries.map(({ path }) => path)
  )
  if (!inventoryPaths.has(fixture.generatedInventoryPath) ||
    fixture.generatedSurfacePaths.some((path) => !inventoryPaths.has(path))) {
    failures.push("gate.runner-topology-generated-path-uninventoried")
  }

  const packages: Array<PackageAuthority> = []
  const internalNames = new Set(fixture.packages.map(({ name }) => name))
  const released = new Set<string>()
  for (const coordinate of fixture.packages) {
    const manifestPath = packageManifestPath(coordinate)
    const manifestFile = input.manifest.files.find(({ path }) => path === manifestPath)
    const value = yield* Effect.result(Effect.gen(function* () {
      const bytes = yield* readInventoriedBytes(input.root, input.inventory, manifestPath)
      return yield* Effect.try({ try: () => parseJson(bytes), catch: () => new Error("invalid package JSON") })
    }))
    const document = value._tag === "Success" ? packageDocument(value.success) : null
    if (manifestFile?.packageId === null || manifestFile === undefined || document === null) {
      failures.push("gate.runner-topology-package-manifest")
      continue
    }
    if (document.name !== coordinate.name || document.version !== coordinate.version ||
      document.private === true || !sortedUnique(document.files) || document.files.length === 0 ||
      document.files.some((path) => !safeRelativePath(path))) {
      failures.push("gate.runner-topology-package-coordinate")
    }
    const allDependencies = {
      ...document.peerDependencies,
      ...document.optionalDependencies,
      ...document.dependencies
    }
    for (const [name, version] of Object.entries(allDependencies)) {
      if (internalNames.has(name) && (version !== fixture.packages.find((item) => item.name === name)?.version ||
        !released.has(name))) failures.push("gate.runner-topology-publication-order-or-version")
    }
    if (Object.keys(document.exports).length === 0 ||
      Object.keys(document.exports).some((key) => key !== "." &&
        (!key.startsWith("./") || key.includes("*")))) {
      failures.push("gate.runner-topology-package-exports")
    }
    const runtimeTarget = exportTarget(document.exports, ".", "import")
    const declarationTarget = exportTarget(document.exports, ".", "types")
    const runtimeRelative = runtimeTarget === null ? null : packageRelativeTarget(runtimeTarget)
    const declarationRelative = declarationTarget === null ? null : packageRelativeTarget(declarationTarget)
    if (runtimeRelative === null || declarationRelative === null) {
      failures.push("gate.runner-topology-package-main-surface")
      continue
    }
    const runtimePath = rootedPath(coordinate, runtimeRelative)
    const declarationPath = rootedPath(coordinate, declarationRelative)
    const runtimeText = yield* Effect.result(readInventoriedText(input.root, input.inventory, runtimePath))
    const declarationText = yield* Effect.result(readInventoriedText(
      input.root,
      input.inventory,
      declarationPath
    ))
    if (runtimeText._tag === "Failure" || declarationText._tag === "Failure") {
      failures.push("gate.runner-topology-package-surface-unavailable")
      continue
    }
    const runtimeExports = exportedNames(runtimePath, runtimeText.success)
    const declarationExports = exportedNames(declarationPath, declarationText.success)
    if (runtimeExports === null || declarationExports === null) {
      failures.push("gate.runner-topology-package-surface-ambiguous")
      continue
    }
    packages.push({
      coordinate,
      candidateRoot: candidatePath(input.root, coordinate.root),
      manifestPath,
      packageId: manifestFile.packageId,
      document,
      runtimePath,
      declarationPath,
      runtimeExports,
      declarationExports
    })
    released.add(coordinate.name)
  }
  if (packages.length !== fixture.packages.length) failures.push("gate.runner-topology-package-set")

  const expectedSurfacePaths = packages.flatMap(({ runtimePath, declarationPath }) =>
    [runtimePath, declarationPath]).sort(codePointCompare)
  if (JSON.stringify(expectedSurfacePaths) !== JSON.stringify(fixture.generatedSurfacePaths)) {
    failures.push("gate.runner-topology-generated-surface-path-mismatch")
  }
  const surfaceValue = yield* Effect.result(Effect.gen(function* () {
    const bytes = yield* readInventoriedBytes(input.root, input.inventory, fixture.generatedInventoryPath)
    const value = yield* Effect.try({ try: () => parseJson(bytes), catch: () => new Error("invalid surface JSON") })
    return yield* decodeSurface(value)
  }))
  if (surfaceValue._tag === "Failure") {
    failures.push("gate.runner-topology-generated-surface-schema")
  } else {
    const expected = packages.map(({ coordinate, runtimeExports, declarationExports }) => ({
      name: coordinate.name,
      runtimeExports,
      declarationExports
    })).sort((left, right) => codePointCompare(left.name, right.name))
    const observed = surfaceValue.success.packages.map(({ name, runtimeExports, declarationExports }) => ({
      name,
      runtimeExports,
      declarationExports
    }))
    if (!sortedUnique(observed.map(({ name }) => name)) ||
      observed.some(({ runtimeExports, declarationExports }) =>
        !sortedUnique(runtimeExports) || !sortedUnique(declarationExports)) ||
      JSON.stringify(expected) !== JSON.stringify(observed)) {
      failures.push("gate.runner-topology-generated-surface-mismatch")
    }
  }

  if (packages.length === fixture.packages.length) {
    failures.push(...yield* staticGraphIssues(input.root, input.manifest, input.inventory, packages))
  }
  const cliPackage = packages.find(({ coordinate }) => coordinate.name === fixture.cli.packageName)
  if (cliPackage?.document.bin[fixture.cli.binName] === undefined ||
    packageRelativeTarget(cliPackage.document.bin[fixture.cli.binName]!) === null) {
    failures.push("gate.runner-topology-cli-bin")
  }
  const actionPackage = packages.find(({ coordinate }) => coordinate.name === fixture.action.packageName)
  if (actionPackage === undefined ||
    exportTarget(actionPackage.document.exports, fixture.action.exportSubpath, "import") === null) {
    failures.push("gate.runner-topology-action-export")
  }
  if (failures.length > 0) return yield* new TrialTopologyGateError(failures)

  const normalizedDeclarations = [] as Array<{ readonly path: string; readonly sha256: string }>
  for (const item of packages) {
    const text = yield* readInventoriedText(input.root, input.inventory, item.declarationPath)
    normalizedDeclarations.push({
      path: item.declarationPath,
      sha256: sha256Bytes(new TextEncoder().encode(normalizeDeclaration(text)))
    })
  }
  normalizedDeclarations.sort((left, right) => codePointCompare(left.path, right.path))
  const declarationSurfaceSha256 = sha256Bytes(canonicalJsonBytes(normalizedDeclarations))
  return {
    fixture,
    packages,
    declarationSurfaceSha256,
    runtimePlusDeclarationExportCount: packages.reduce((total, item) =>
      total + item.runtimeExports.length + item.declarationExports.length, 0),
    staticCheckCount: 12
  } satisfies TrialTopologyStaticInspection
})

interface ProcessResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

/**
 * Exact executable paths the runner-owned gate uses for dynamic verification.
 * Inside the gate sandbox these are the fixed read-only mounts; hostile tests
 * bind their own verified host paths. The gate never resolves executables from
 * PATH and never falls back.
 */
export interface TopologyGateExecutables {
  readonly bun: string
  readonly node: string
  readonly tar: string
}

const execute = (
  argv: ReadonlyArray<string>,
  cwd: string,
  environment: Readonly<Record<string, string>>
): ProcessResult => {
  const result = Bun.spawnSync([...argv], {
    cwd,
    env: environment,
    stdin: new Uint8Array(),
    stdout: "pipe",
    stderr: "pipe"
  })
  return {
    exitCode: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr)
  }
}

const requireExit = (result: ProcessResult, failureId: string): void => {
  if (result.exitCode !== 0) throw new TrialTopologyGateError([failureId])
  if (result.stdout.length + result.stderr.length > 1_048_576) {
    throw new TrialTopologyGateError(["gate.runner-topology-process-output-limit"])
  }
}

interface PackedTopology {
  readonly root: string
  readonly consumerRoot: string
  readonly tarballs: ReadonlyMap<string, string>
  readonly packedByteCount: number
  readonly environment: Readonly<Record<string, string>>
  readonly executables: TopologyGateExecutables
}

const expectedPackedFiles = (
  item: PackageAuthority,
  inventory: CandidateTreeInventory
): ReadonlyArray<string> => {
  const prefix = item.coordinate.root === "." ? "" : `${item.coordinate.root}/`
  const relativeEntries = inventory.entries.flatMap(({ path }) => {
    if (!path.startsWith(prefix)) return []
    const relative = path.slice(prefix.length)
    if (relative === "package.json" || item.document.files.some((declared) =>
      relative === declared || relative.startsWith(`${declared}/`))) return [`package/${relative}`]
    return []
  })
  return [...new Set(relativeEntries)].sort(codePointCompare)
}

const preparePackedTopology = async (
  executables: TopologyGateExecutables,
  inventory: CandidateTreeInventory,
  inspection: TrialTopologyStaticInspection
): Promise<PackedTopology> => {
  const work = await mkdtemp(join(tmpdir(), "architecture-topology-gate-"))
  const tarRoot = join(work, "tarballs")
  const consumerRoot = join(work, "consumer")
  const home = join(work, "home")
  const scratch = join(work, "tmp")
  await mkdir(tarRoot)
  await mkdir(consumerRoot)
  await mkdir(home)
  await mkdir(scratch)
  const environment = {
    PATH: process.env.PATH ?? "/runtime:/usr/bin",
    HOME: home,
    LC_ALL: "C",
    LANG: "C",
    TZ: "UTC",
    NO_COLOR: "1",
    TMPDIR: scratch,
    BUN_INSTALL_CACHE_DIR: join(work, "bun-cache")
  }
  const tarballs = new Map<string, string>()
  let packedByteCount = 0
  for (const item of inspection.packages) {
    requireExit(execute([
      executables.bun,
      "pm",
      "pack",
      "--dry-run",
      "--ignore-scripts",
      "--quiet"
    ], item.candidateRoot, environment), "gate.runner-topology-pack-dry-run")
    const before = new Set(await readdir(tarRoot))
    requireExit(execute([
      executables.bun,
      "pm",
      "pack",
      "--ignore-scripts",
      "--quiet",
      "--destination",
      tarRoot
    ], item.candidateRoot, environment), "gate.runner-topology-pack")
    const created = (await readdir(tarRoot)).filter((name) => !before.has(name) && name.endsWith(".tgz"))
    if (created.length !== 1) throw new TrialTopologyGateError(["gate.runner-topology-pack-output"])
    const tarball = join(tarRoot, created[0]!)
    packedByteCount += (await stat(tarball)).size
    const listed = execute([executables.tar, "-tzf", tarball], work, environment)
    requireExit(listed, "gate.runner-topology-pack-inventory")
    const entries = listed.stdout.split("\n").filter(Boolean).sort(codePointCompare)
    if (JSON.stringify(entries) !== JSON.stringify(expectedPackedFiles(item, inventory))) {
      throw new TrialTopologyGateError(["gate.runner-topology-pack-inventory-mismatch"])
    }
    const installRoot = join(consumerRoot, "node_modules", ...item.coordinate.name.split("/"))
    await mkdir(installRoot, { recursive: true })
    requireExit(execute([
      executables.tar,
      "-xzf",
      tarball,
      "--strip-components=1",
      "-C",
      installRoot
    ], work, environment), "gate.runner-topology-pack-extraction")
    const packedManifest = packageDocument(JSON.parse(await readFile(join(installRoot, "package.json"), "utf8")))
    if (packedManifest?.name !== item.coordinate.name ||
      packedManifest.version !== item.coordinate.version) {
      throw new TrialTopologyGateError(["gate.runner-topology-packed-coordinate"])
    }
    tarballs.set(item.coordinate.name, tarball)
  }
  if (!Number.isSafeInteger(packedByteCount) || packedByteCount <= 0) {
    throw new TrialTopologyGateError(["gate.runner-topology-packed-byte-count"])
  }
  await writeFile(join(consumerRoot, "package.json"), "{\"private\":true,\"type\":\"module\"}\n")
  return { root: work, consumerRoot, tarballs, packedByteCount, environment, executables }
}

const packageSubpath = (packageName: string, subpath: string): string =>
  `${packageName}/${subpath.slice(2)}`

const consumerProgram = (
  inspection: TrialTopologyStaticInspection,
  operation: "library" | "action" | "external" | "adoption" | "all"
): string => {
  const fixture = inspection.fixture
  const imports = `const lib=await import(${JSON.stringify(fixture.libraryPackageName)});`
  const library = `const operations=await lib.runLibraryConsumer('runner-library');if(!Array.isArray(operations)||operations.length!==2||operations.map(x=>x.providerId).join(',')!=='provider-a,provider-b')throw Error('library');`
  const action = `const action=await import(${JSON.stringify(packageSubpath(fixture.action.packageName, fixture.action.exportSubpath))});const actionResult=await action.runAction('runner-action');if(actionResult?.artifact!=='action-bundle'||actionResult.operations?.length!==2)throw Error('action');`
  const external = `const external=await import(${JSON.stringify(fixture.externalProviderPackageName)});if(!Array.isArray(external.externalProvider?.instances)||external.externalProvider.instances.length!==2||new Set(external.externalProvider.instances).size!==2||typeof external.externalProvider.prepare!=='function')throw Error('external-shape');for(const instanceId of external.externalProvider.instances){const value=external.externalProvider.prepare(instanceId,'runner-external');if(value.instanceId!==instanceId||value.providerId!=='external-provider')throw Error('external-instance')}const packed=await lib.runPackedExternal('runner-external');if(!Array.isArray(packed)||packed.length!==2||new Set(packed.map(x=>x.instanceId)).size!==2)throw Error('external-consumer');`
  const adoption = `const fileBytes=Uint8Array.from([1,2,3]);const treeBytes=Uint8Array.from([4,5]);const source=[{logicalName:'file',bytes:fileBytes,sizeDecimal:'3',mode:420},{logicalName:'tree/root',bytes:treeBytes,sizeDecimal:'2',mode:493,symlinkTarget:'nested/target'}];const adopted=lib.adoptFinalizedArtifacts(source);fileBytes[0]=9;treeBytes[0]=9;if(adopted.length!==2||adopted[0].bytes[0]!==1||adopted[1].bytes[0]!==4||adopted[0].sizeDecimal!=='3'||adopted[1].mode!==493||adopted[1].symlinkTarget!=='nested/target')throw Error('adoption');`
  return `${imports}${operation === "library" ? library : ""}${operation === "action" ? action : ""}${operation === "external" ? external : ""}${operation === "adoption" ? adoption : ""}${operation === "all" ? `${library}${action}${external}${adoption}` : ""}`
}

const runConsumer = (
  executable: string,
  program: string,
  packed: PackedTopology,
  failureId: string
): void => requireExit(execute([
  executable,
  "--input-type=module",
  "--eval",
  program
], packed.consumerRoot, packed.environment), failureId)

const verifyRuntimeSurface = (
  inspection: TrialTopologyStaticInspection,
  packed: PackedTopology
): void => {
  const expected = Object.fromEntries(inspection.packages.map((item) =>
    [item.coordinate.name, item.runtimeExports]))
  const program = `const expected=${JSON.stringify(expected)};for(const [name,names] of Object.entries(expected)){const actual=Object.keys(await import(name)).sort();if(JSON.stringify(actual)!==JSON.stringify(names))throw Error('surface:'+name+':'+actual.join(','))}`
  runConsumer(packed.executables.node, program, packed, "gate.runner-topology-runtime-surface")
}

const verifyCli = (
  inspection: TrialTopologyStaticInspection,
  packed: PackedTopology
): void => {
  const fixture = inspection.fixture
  const item = inspection.packages.find(({ coordinate }) => coordinate.name === fixture.cli.packageName)!
  const target = packageRelativeTarget(item.document.bin[fixture.cli.binName]!)!
  const absolute = join(packed.consumerRoot, "node_modules", ...item.coordinate.name.split("/"), target)
  const result = execute(
    [packed.executables.node, absolute, "runner-cli"],
    packed.consumerRoot,
    packed.environment
  )
  requireExit(result, "gate.runner-topology-packed-cli")
  if (result.stderr.length !== 0 || result.stdout.trim() !== "provider-a,provider-b") {
    throw new TrialTopologyGateError(["gate.runner-topology-packed-cli-output"])
  }
}

const verifyPartialPublication = async (
  inspection: TrialTopologyStaticInspection,
  packed: PackedTopology
): Promise<void> => {
  const partial = join(packed.root, "partial")
  const external = inspection.packages.find(({ coordinate }) =>
    coordinate.name === inspection.fixture.externalProviderPackageName)!
  const installRoot = join(partial, "node_modules", ...external.coordinate.name.split("/"))
  const tarball = packed.tarballs.get(external.coordinate.name)!
  await mkdir(installRoot, { recursive: true })
  requireExit(execute([
    packed.executables.tar, "-xzf", tarball, "--strip-components=1", "-C", installRoot
  ], packed.root, packed.environment), "gate.runner-topology-partial-extraction")
  await writeFile(join(partial, "package.json"), "{\"private\":true,\"type\":\"module\"}\n")
  const program = `await import(${JSON.stringify(external.coordinate.name)})`
  const node = execute(
    [packed.executables.node, "--input-type=module", "--eval", program],
    partial,
    packed.environment
  )
  const bun = execute([packed.executables.bun, "--eval", program], partial, packed.environment)
  if (node.exitCode === 0 || bun.exitCode === 0) {
    throw new TrialTopologyGateError(["gate.runner-topology-partial-publication-accepted"])
  }
}

const verifyVersionSkew = async (
  inspection: TrialTopologyStaticInspection,
  packed: PackedTopology
): Promise<void> => {
  const dependencyName = inspection.fixture.packages.some(({ name }) => name === "@trial/release")
    ? "@trial/release"
    : "@trial/kernel"
  const dependency = inspection.packages.find(({ coordinate }) => coordinate.name === dependencyName)!
  const skew = join(packed.root, "skew")
  await cp(packed.consumerRoot, skew, { recursive: true })
  const packageRoot = join(skew, "node_modules", ...dependencyName.split("/"))
  const manifestPath = join(packageRoot, "package.json")
  const document = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>
  document.version = "999.0.0-hostile"
  await writeFile(manifestPath, JSON.stringify(document))
  const runtimePath = join(packageRoot, dependency.runtimePath.slice(
    dependency.coordinate.root === "." ? 0 : dependency.coordinate.root.length + 1
  ))
  const runtime = await readFile(runtimePath, "utf8")
  if (!runtime.includes(dependency.coordinate.version)) {
    throw new TrialTopologyGateError(["gate.runner-topology-version-marker-unavailable"])
  }
  await writeFile(runtimePath, runtime.replaceAll(dependency.coordinate.version, "999.0.0-hostile"))
  const program = `const lib=await import(${JSON.stringify(inspection.fixture.libraryPackageName)});const external=await import(${JSON.stringify(inspection.fixture.externalProviderPackageName)});if(typeof external.verifyRootConsumer==='function')await external.verifyRootConsumer('skew');else await lib.runLibraryConsumer('skew')`
  const node = execute(
    [packed.executables.node, "--input-type=module", "--eval", program],
    skew,
    packed.environment
  )
  const bun = execute([packed.executables.bun, "--eval", program], skew, packed.environment)
  if (node.exitCode === 0 || bun.exitCode === 0) {
    throw new TrialTopologyGateError(["gate.runner-topology-version-skew-accepted"])
  }
}

const verifyBuildAndSelfRelease = async (
  root: string,
  repositoryRoot: string,
  inspection: TrialTopologyStaticInspection,
  packed: PackedTopology
): Promise<void> => {
  const buildRoot = join(packed.root, "build")
  await cp(root, buildRoot, { recursive: true })
  await symlink(
    resolve(repositoryRoot, "tools/architecture-program/node_modules"),
    join(buildRoot, "node_modules"),
    "dir"
  )
  const typescript = resolve(
    repositoryRoot,
    "tools/architecture-program/node_modules/typescript/bin/tsc"
  )
  requireExit(execute([
    packed.executables.bun,
    typescript,
    "-p",
    join(buildRoot, "tsconfig.json"),
    "--noEmit"
  ], buildRoot, packed.environment), "gate.runner-topology-build-dry-run")
  runConsumer(packed.executables.node, consumerProgram(inspection, "all"), packed,
    "gate.runner-topology-self-release")
}

const verifyTreeShaking = async (
  inspection: TrialTopologyStaticInspection,
  packed: PackedTopology
): Promise<void> => {
  const entry = join(packed.root, "tree-shake-entry.mjs")
  const output = join(packed.root, "tree-shake-output.mjs")
  await writeFile(entry, `import { runLibraryConsumer } from ${JSON.stringify(inspection.fixture.libraryPackageName)};const values=await runLibraryConsumer('tree-shake');if(values.length!==2)throw Error('tree-shake');\n`)
  requireExit(execute([
    packed.executables.bun,
    "build",
    entry,
    "--outfile",
    output,
    "--target=node",
    "--minify"
  ], packed.consumerRoot, packed.environment), "gate.runner-topology-tree-shake-build")
  const outputBytes = (await stat(output)).size
  if (outputBytes <= 0 || outputBytes >= packed.packedByteCount) {
    throw new TrialTopologyGateError(["gate.runner-topology-tree-shake-size"])
  }
  requireExit(execute([packed.executables.node, output], packed.root, packed.environment),
    "gate.runner-topology-tree-shake-execution")
}

export const executeTopologyGate = Effect.fn("TrialTopologyGate.execute")(function* (input: {
  readonly gateId: string
  readonly root: string
  readonly repositoryRoot: string
  readonly executables: TopologyGateExecutables
  readonly inventory: CandidateTreeInventory
  readonly inspection: TrialTopologyStaticInspection
}) {
  if (!isRunnerOwnedTopologyGate(input.gateId)) {
    return { checkCount: 0, packedByteCount: null } satisfies TrialTopologyExecutionInspection
  }
  return yield* Effect.tryPromise({
    try: async () => {
      const packed = await preparePackedTopology(
        input.executables,
        input.inventory,
        input.inspection
      )
      try {
        switch (input.gateId) {
          case "GT02-packed-library-node":
            runConsumer(packed.executables.node, consumerProgram(input.inspection, "library"),
              packed, "gate.runner-topology-packed-library-node")
            break
          case "GT03-packed-library-bun":
            runConsumer(packed.executables.bun, consumerProgram(input.inspection, "library"),
              packed, "gate.runner-topology-packed-library-bun")
            break
          case "GT04-packed-cli":
            verifyCli(input.inspection, packed)
            break
          case "GT05-packed-github-action":
            runConsumer(packed.executables.node, consumerProgram(input.inspection, "action"),
              packed, "gate.runner-topology-packed-action")
            break
          case "GT06-packed-external-provider-two-instances":
            runConsumer(packed.executables.node, consumerProgram(input.inspection, "external"),
              packed, "gate.runner-topology-packed-external-provider")
            break
          case "GT07-lossless-effect-build-file-tree-adoption":
            runConsumer(packed.executables.node, consumerProgram(input.inspection, "adoption"),
              packed, "gate.runner-topology-lossless-adoption")
            break
          case "GT08-exact-runtime-declaration-surface":
            verifyRuntimeSurface(input.inspection, packed)
            break
          case "GT09-exact-emitted-packed-inventory":
          case "GT10-exact-static-type-dynamic-manifest-graph":
          case "GT11-no-cycle-sibling-reversal-or-host-edge":
            // The packed-inventory equality in preparePackedTopology and the
            // static graph verification in inspectTopologyGateStatic are the
            // whole runner-owned obligation for these three gates.
            break
          case "GT12-version-skew-partial-publication":
            await verifyPartialPublication(input.inspection, packed)
            await verifyVersionSkew(input.inspection, packed)
            break
          case "GT13-dry-run-build-publication-self-release":
            await verifyBuildAndSelfRelease(
              input.root,
              input.repositoryRoot,
              input.inspection,
              packed
            )
            break
          case "GT14-tree-shaking-and-packed-bytes":
            await verifyTreeShaking(input.inspection, packed)
            break
          default:
            throw new TrialTopologyGateError(["gate.runner-topology-unknown-gate"])
        }
        return {
          checkCount: input.gateId === "GT12-version-skew-partial-publication" ? 4 : 2,
          packedByteCount: input.gateId === "GT14-tree-shaking-and-packed-bytes"
            ? packed.packedByteCount
            : null
        } satisfies TrialTopologyExecutionInspection
      } finally {
        await rm(packed.root, { recursive: true, force: true })
      }
    },
    catch: (cause) => cause instanceof TrialTopologyGateError
      ? cause
      : new TrialTopologyGateError(["gate.runner-topology-execution-failed"])
  })
})
