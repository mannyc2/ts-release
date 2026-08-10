import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { writeFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import * as ts from "typescript"
import { AuthoredConfig } from "../src/resolve/authored.js"
import { commandNames } from "../apps/release-ts/src/cli/commands.js"
import { makeRepoScratchDirectory, removeScratchDirectory } from "./lib/scratch-workspace.js"

interface CodeBlock {
  readonly language: string
  readonly content: string
  readonly openingLine: number
  readonly contentStartLine: number
  readonly closingLine: number
}

interface PackageMetadata {
  readonly name: string
  readonly version: string
  readonly exports: Record<string, unknown>
}

interface CheckResult {
  readonly blockCount: number
  readonly packageImportCount: number
  readonly failures: ReadonlyArray<string>
  readonly blocks: ReadonlyArray<CodeBlock>
  readonly packageMetadata: PackageMetadata
}

const root = process.cwd()
const readmePath = join(root, "README.md")
const packageJsonPath = join(root, "package.json")

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const readTextFile = Effect.fn("scripts.checkReadme.readTextFile")(function*(path: string) {
  return yield* Effect.tryPromise({
    try: () => readFile(path, "utf8"),
    catch: (cause) => new Error(`Failed to read ${path}.`, { cause })
  })
})

const readPackageMetadata = Effect.fn("scripts.checkReadme.readPackageMetadata")(function*() {
  const contents = yield* readTextFile(packageJsonPath)
  const parsed = yield* Effect.try({
    try: () => JSON.parse(contents),
    catch: (cause) => new Error("package.json is not valid JSON.", { cause })
  })

  if (!isRecord(parsed)) {
    return yield* Effect.fail(new Error("package.json must parse to an object"))
  }

  const packageName = parsed.name
  const packageVersion = parsed.version
  if (typeof packageName !== "string" || packageName.length === 0) {
    return yield* Effect.fail(new Error("package.json name must be a non-empty string"))
  }
  if (typeof packageVersion !== "string" || packageVersion.length === 0) {
    return yield* Effect.fail(new Error("package.json version must be a non-empty string"))
  }

  const packageExports = parsed.exports
  if (!isRecord(packageExports)) {
    return yield* Effect.fail(new Error("package.json exports must be an object"))
  }

  return {
    name: packageName,
    version: packageVersion,
    exports: packageExports
  }
})

const extractCodeBlocks = Effect.fn("scripts.checkReadme.extractCodeBlocks")(function*(contents: string) {
  const lines = contents.split(/\r?\n/)
  const blocks: Array<CodeBlock> = []
  const failures: Array<string> = []
  let openLanguage: string | undefined
  let openingLine = 0
  let contentStartLine = 0
  let contentLines: Array<string> = []

  lines.forEach((line, index) => {
    const lineNumber = index + 1
    if (!line.startsWith("```")) {
      if (openLanguage !== undefined) {
        contentLines.push(line)
      }
      return
    }

    if (openLanguage === undefined) {
      openLanguage = line.slice(3).trim().split(/\s+/)[0] ?? ""
      openingLine = lineNumber
      contentStartLine = lineNumber + 1
      contentLines = []
      return
    }

    blocks.push({
      language: openLanguage,
      content: contentLines.join("\n"),
      openingLine,
      contentStartLine,
      closingLine: lineNumber
    })
    openLanguage = undefined
    openingLine = 0
    contentStartLine = 0
    contentLines = []
  })

  if (openLanguage !== undefined) {
    failures.push(`README.md:${openingLine}:1 fenced code block is missing a closing fence`)
  }

  return { blocks, failures }
})

const checkJsonBlock = Effect.fn("scripts.checkReadme.checkJsonBlock")(function*(block: CodeBlock) {
  return yield* Effect.sync(() => {
    const failures: Array<string> = []
    try {
      const value = JSON.parse(block.content) as unknown
      if (isRecord(value) && Object.hasOwn(value, "project")) {
        Schema.decodeUnknownSync(AuthoredConfig, { onExcessProperty: "error" })(value)
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      failures.push(`README.md:${block.contentStartLine}:1 invalid JSON snippet: ${message}`)
    }
    return failures
  })
})

const checkShellBlock = (block: CodeBlock): ReadonlyArray<string> => {
  const failures: Array<string> = []
  for (const match of block.content.matchAll(/\bts-release\s+([a-z-]+)/gu)) {
    const command = match[1]
    if (command !== undefined && !commandNames.includes(command as typeof commandNames[number])) {
      failures.push(`README.md:${block.contentStartLine}:1 unknown ts-release command ${command}`)
    }
  }
  return failures
}

const checkYamlBlock = (block: CodeBlock, packageMetadata: PackageMetadata): ReadonlyArray<string> => {
  const failures: Array<string> = []
  const expectedActionReference = `mannyc2/ts-release/apps/ts-release-action@v${packageMetadata.version}`
  if (block.content.includes("mannyc2/ts-release/apps/ts-release-action@") &&
    !block.content.includes(expectedActionReference)) {
    failures.push(`README.md:${block.contentStartLine}:1 Action examples must use ${expectedActionReference}`)
  }
  if (block.content.includes("__TS_RELEASE_ACTION_REF__")) failures.push(`README.md:${block.contentStartLine}:1 Action examples retain the candidate placeholder`)
  if (/mannyc2\/ts-release-action@/u.test(block.content)) {
    failures.push(`README.md:${block.contentStartLine}:1 Action examples must use the monorepo subpath`)
  }
  return failures
}

const formatTypeScriptDiagnostic = (
  sourceFile: ts.SourceFile,
  block: CodeBlock,
  diagnostic: ts.Diagnostic
): string => {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
  if (diagnostic.start === undefined) {
    return `README.md:${block.contentStartLine}:1 ${message}`
  }
  const diagnosticFile = diagnostic.file ?? sourceFile
  const position = diagnosticFile.getLineAndCharacterOfPosition(diagnostic.start)
  return `README.md:${block.contentStartLine + position.line}:${position.character + 1} ${message}`
}

const collectPackageImports = (
  sourceFile: ts.SourceFile,
  packageName: string
): ReadonlyArray<string> => {
  const imports: Array<string> = []
  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      (node.moduleSpecifier.text === packageName || node.moduleSpecifier.text.startsWith(`${packageName}/`))
    ) {
      imports.push(node.moduleSpecifier.text)
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      (node.moduleSpecifier.text === packageName || node.moduleSpecifier.text.startsWith(`${packageName}/`))
    ) {
      imports.push(node.moduleSpecifier.text)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return imports
}

const exportKeyForPackageImport = (packageName: string, specifier: string): string =>
  specifier === packageName ? "." : `.${specifier.slice(packageName.length)}`

const checkTypeScriptBlock = Effect.fn("scripts.checkReadme.checkTypeScriptBlock")(function*(
  block: CodeBlock,
  packageMetadata: PackageMetadata
) {
  return yield* Effect.sync(() => {
    const failures: Array<string> = []
    const sourceFile = ts.createSourceFile(
      `README.md:${block.openingLine}`,
      block.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )

    const syntaxCheck = ts.transpileModule(block.content, {
      compilerOptions: {
        module: ts.ModuleKind.NodeNext,
        target: ts.ScriptTarget.ES2022
      },
      fileName: `README.md:${block.openingLine}`,
      reportDiagnostics: true
    })

    for (const diagnostic of syntaxCheck.diagnostics ?? []) {
      failures.push(formatTypeScriptDiagnostic(sourceFile, block, diagnostic))
    }

    const packageImports = collectPackageImports(sourceFile, packageMetadata.name)
    for (const specifier of packageImports) {
      const exportKey = exportKeyForPackageImport(packageMetadata.name, specifier)
      if (!Object.hasOwn(packageMetadata.exports, exportKey)) {
        failures.push(
          `README.md:${block.contentStartLine}:1 package import ${specifier} is missing package.json export ${exportKey}`
        )
      }
    }

    return {
      failures,
      packageImportCount: packageImports.length
    }
  })
})

const checkCodeBlock = Effect.fn("scripts.checkReadme.checkCodeBlock")(function*(
  block: CodeBlock,
  packageMetadata: PackageMetadata
) {
  if (block.language === "json") {
    const failures = yield* checkJsonBlock(block)
    return { failures, packageImportCount: 0 }
  }

  if (block.language === "sh" || block.language === "bash" || block.language === "shell") {
    return { failures: checkShellBlock(block), packageImportCount: 0 }
  }

  if (block.language === "yaml" || block.language === "yml") {
    return { failures: checkYamlBlock(block, packageMetadata), packageImportCount: 0 }
  }

  if (block.language === "ts" || block.language === "typescript") {
    return yield* checkTypeScriptBlock(block, packageMetadata)
  }

  return { failures: [], packageImportCount: 0 }
})

const checkReadme = Effect.fn("scripts.checkReadme")(function*() {
  const packageMetadata = yield* readPackageMetadata()
  const readme = yield* readTextFile(readmePath)
  const { blocks, failures: fenceFailures } = yield* extractCodeBlocks(readme)
  const failures = [...fenceFailures]
  let packageImportCount = 0

  for (const block of blocks) {
    const result = yield* checkCodeBlock(block, packageMetadata)
    failures.push(...result.failures)
    packageImportCount += result.packageImportCount
  }

  return {
    blockCount: blocks.length,
    packageImportCount,
    failures,
    blocks,
    packageMetadata
  }
})

// Every package-importing ts block is proven against the SHIPPED declarations
// in dist/, so a public API change must update the README in the same commit.
const typecheckPackageBlocks = async (
  blocks: ReadonlyArray<CodeBlock>,
  packageMetadata: PackageMetadata
): Promise<{ readonly failures: ReadonlyArray<string>; readonly checkedBlocks: number }> => {
  const candidates = blocks.filter((block) => {
    if (block.language !== "ts" && block.language !== "typescript") {
      return false
    }
    const sourceFile = ts.createSourceFile(
      `block-${block.openingLine}.ts`,
      block.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )
    return collectPackageImports(sourceFile, packageMetadata.name).length > 0
  })
  if (candidates.length === 0) {
    return { failures: [], checkedBlocks: 0 }
  }

  const tempDir = await Effect.runPromise(
    makeRepoScratchDirectory(".tmp-readme-types-", root).pipe(
      Effect.provide(BunServices.layer)
    )
  )
  try {
    const fileForBlock = new Map<string, CodeBlock>()
    for (const block of candidates) {
      const path = join(tempDir, `block-${block.openingLine}.ts`)
      writeFileSync(path, block.content)
      fileForBlock.set(path, block)
    }

    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      skipLibCheck: false,
      noEmit: true,
      types: ["bun-types"],
      paths: {
        "@mannyc1/ts-release": [join(root, "dist/index.d.ts")],
        "@mannyc1/ts-release/node": [join(root, "dist/platform/node.d.ts")],
        "@mannyc1/ts-release/bun": [join(root, "dist/platform/bun.d.ts")]
      }
    }
    const program = ts.createProgram([...fileForBlock.keys()], options)
    const failures: Array<string> = []
    for (const diagnostic of program.getConfigFileParsingDiagnostics().concat(ts.getPreEmitDiagnostics(program))) {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
      const block = diagnostic.file === undefined
        ? undefined
        : fileForBlock.get(diagnostic.file.fileName)
      if (block === undefined || diagnostic.file === undefined || diagnostic.start === undefined) {
        failures.push(`README.md typecheck failed: ${message}`)
        continue
      }
      const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
      failures.push(
        `README.md:${block.contentStartLine + position.line}:${position.character + 1} ${message}`
      )
    }
    return { failures, checkedBlocks: candidates.length }
  } finally {
    await Effect.runPromise(
      removeScratchDirectory(tempDir, {
        expectedParent: root,
        allowedPrefixes: [".tmp-readme-types-"]
      }).pipe(Effect.provide(BunServices.layer))
    )
  }
}

const result: CheckResult = await Effect.runPromise(checkReadme().pipe(Effect.provide(BunServices.layer)))
const typechecked = await typecheckPackageBlocks(result.blocks, result.packageMetadata)
const failures = [...result.failures, ...typechecked.failures]

if (failures.length > 0) {
  console.error("README snippet checks failed:")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log(
  `Checked README snippets: ${result.blockCount} fenced blocks, ${result.packageImportCount} package imports, ${typechecked.checkedBlocks} typechecked blocks`
)
