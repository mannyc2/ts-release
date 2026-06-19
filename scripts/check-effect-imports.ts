import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { cwd, exit } from "node:process"
import * as ts from "typescript"

const root = cwd()
const scanRoots = [
  "src",
  "test",
  "scripts",
  "apps/release-ts/src",
  "apps/release-ts/scripts",
  "apps/release-ts/test",
  "apps/ts-release-action/src",
  "apps/ts-release-action/test"
]

const toDisplayPath = (path: string): string =>
  relative(root, path).replaceAll("\\", "/")

const collectTypeScriptFiles = (directory: string): Array<string> => {
  const files: Array<string> = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectTypeScriptFiles(path))
      continue
    }
    if (entry.isFile() && path.endsWith(".ts")) {
      files.push(path)
    }
  }
  return files
}

const location = (source: ts.SourceFile, position: number): string => {
  const line = source.getLineAndCharacterOfPosition(position)
  return `${toDisplayPath(source.fileName)}:${line.line + 1}:${line.character + 1}`
}

const checkFile = (file: string): Array<string> => {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const failures: Array<string> = []

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (node.moduleSpecifier.text === "effect") {
        failures.push(`${location(source, node.getStart(source))} imports from broad "effect"; use effect/<Module>`)
      }
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)) {
      if (node.moduleSpecifier.text === "effect") {
        failures.push(`${location(source, node.getStart(source))} exports from broad "effect"; use effect/<Module>`)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return failures
}

const files = scanRoots.flatMap((directory) => {
  const path = join(root, directory)
  return existsSync(path) ? collectTypeScriptFiles(path) : []
})
const failures = files.flatMap(checkFile)

if (failures.length > 0) {
  console.error("Effect import checks failed:")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  exit(1)
}
