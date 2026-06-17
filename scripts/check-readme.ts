import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import * as ts from "typescript"

interface CodeBlock {
  readonly language: string
  readonly content: string
  readonly openingLine: number
  readonly contentStartLine: number
  readonly closingLine: number
}

interface PackageMetadata {
  readonly name: string
  readonly exports: Record<string, unknown>
}

interface CheckResult {
  readonly blockCount: number
  readonly packageImportCount: number
  readonly failures: ReadonlyArray<string>
}

const root = process.cwd()
const readmePath = join(root, "README.md")
const packageJsonPath = join(root, "package.json")

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const formatUnknown = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const readTextFile = Effect.fn("scripts.checkReadme.readTextFile")(function*(path: string) {
  return yield* Effect.tryPromise({
    try: () => readFile(path, "utf8"),
    catch: (cause) => new Error(`Failed to read ${path}: ${formatUnknown(cause)}`)
  })
})

const readPackageMetadata = Effect.fn("scripts.checkReadme.readPackageMetadata")(function*() {
  const contents = yield* readTextFile(packageJsonPath)
  const parsed = yield* Effect.try({
    try: () => JSON.parse(contents),
    catch: (cause) => new Error(`package.json is not valid JSON: ${formatUnknown(cause)}`)
  })

  if (!isRecord(parsed)) {
    return yield* Effect.fail(new Error("package.json must parse to an object"))
  }

  const packageName = parsed.name
  if (typeof packageName !== "string" || packageName.length === 0) {
    return yield* Effect.fail(new Error("package.json name must be a non-empty string"))
  }

  const packageExports = parsed.exports
  if (!isRecord(packageExports)) {
    return yield* Effect.fail(new Error("package.json exports must be an object"))
  }

  return {
    name: packageName,
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
      JSON.parse(block.content)
    } catch (cause) {
      failures.push(`README.md:${block.contentStartLine}:1 invalid JSON snippet: ${formatUnknown(cause)}`)
    }
    return failures
  })
})

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
    failures
  }
})

const result: CheckResult = await Effect.runPromise(checkReadme().pipe(Effect.provide(BunServices.layer)))

if (result.failures.length > 0) {
  console.error("README snippet checks failed:")
  for (const failure of result.failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log(`Checked README snippets: ${result.blockCount} fenced blocks, ${result.packageImportCount} package imports`)
