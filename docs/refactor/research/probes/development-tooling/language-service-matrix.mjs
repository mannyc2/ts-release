import { spawnSync } from "node:child_process"
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const fixture = join(here, "fixture")

const run = (command, args, cwd) => {
  const started = Number(process.hrtime.bigint()) / 1_000_000
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    maxBuffer: 16 * 1024 * 1024
  })
  return {
    status: result.status,
    milliseconds: Math.round((Number(process.hrtime.bigint()) / 1_000_000 - started) * 100) / 100,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  }
}

const effectVersions = ["4.0.0-beta.83", "4.0.0-rc.108", "4.0.0-rc.109"]
const languageServiceVersion = "0.87.2"
const typescriptVersion = "6.0.3"
const results = []

for (const effectVersion of effectVersions) {
  const root = await mkdtemp(join(tmpdir(), "ts-release-ls-matrix-"))
  try {
    await cp(fixture, join(root, "fixture"), { recursive: true })
    await writeFile(join(root, "package.json"), '{"private":true,"type":"module"}\n')
    const install = run("bun", ["add", "--no-save", `effect@${effectVersion}`, `@effect/language-service@${languageServiceVersion}`, `typescript@${typescriptVersion}`], root)
    const binary = join(root, "node_modules", ".bin", "effect-language-service")
    const diagnostics = install.status === 0
      ? run(binary, [
        "diagnostics",
        "--project", join(root, "fixture", "tsconfig.json"),
        "--lspconfig", JSON.stringify({ diagnosticSeverity: { floatingEffect: "error", runEffectInsideEffect: "error", tryCatchInEffectGen: "warning", asyncFunction: "warning" } })
      ], root)
      : { status: null, milliseconds: 0, stdout: "", stderr: "install failed" }
    const text = `${diagnostics.stdout}\n${diagnostics.stderr}`
    results.push({
      effectVersion,
      installStatus: install.status,
      installMilliseconds: install.milliseconds,
      diagnosticsStatus: diagnostics.status,
      diagnosticsMilliseconds: diagnostics.milliseconds,
      floatingEffect: /floatingEffect|floating effect/i.test(text),
      runEffectInsideEffect: /runEffectInsideEffect|run.*inside.*effect/i.test(text),
      boundaryMentioned: /boundary\.ts/i.test(text),
      diagnosticLines: text.split(/\r?\n/).filter(Boolean).length
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

console.log(`EFFECT_LANGUAGE_SERVICE_MATRIX_RESULT=${JSON.stringify({
  status: "observed",
  languageServiceVersion,
  typescriptVersion,
  results,
  sourceSupport: {
    beta83: "no explicit upstream harness pin found; nearest inspected pins were beta.68 and beta.94",
    rc108: "no explicit upstream harness pin found",
    rc109: "observed by this probe; current upstream package source still exercises a beta.107 harness"
  },
  limitations: [
    "successful diagnostics are observed compatibility, not an upstream support declaration",
    "the fixture covers only floating, run-inside, try/catch, and a legitimate runtime boundary",
    "the probe does not establish editor integration or patched tsc parity"
  ]
})}`)
