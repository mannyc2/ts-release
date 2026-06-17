import { describe, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const scriptPath = resolve(import.meta.dir, "..", "scripts", "check-self-release-config.ts")

const streamText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> =>
  stream === null ? "" : await new Response(stream).text()

const run = async (args: ReadonlyArray<string>, cwd: string): Promise<{
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}> => {
  const subprocess = Bun.spawn([...args], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe"
  })
  const stdout = streamText(subprocess.stdout)
  const stderr = streamText(subprocess.stderr)
  const exitCode = await subprocess.exited
  return {
    exitCode,
    stdout: await stdout,
    stderr: await stderr
  }
}

const writeJson = (path: string, value: unknown): Promise<void> =>
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`)

const baseManifest = {
  name: "@mannyc1/ts-release",
  version: "0.0.0"
}

const baseConfig = {
  identity: {
    name: "@mannyc1/ts-release",
    version: "0.0.0",
    commit: "HEAD",
    tag: "v0.0.0"
  },
  artifacts: [],
  targets: [
    {
      _tag: "NpmRegistryTarget",
      id: "npm",
      registry: "https://registry.npmjs.org",
      packagePath: ".",
      tokenEnv: "NPM_TOKEN",
      access: "public",
      dryRunSupport: "native",
      mutability: "immutable",
      recovery: "publish-new-version"
    }
  ],
  strict: true,
  evidenceDirectory: ".release/evidence"
}

const prepareWorkspace = async (
  options: { readonly envExample?: string | undefined; readonly dirty?: boolean } = {}
): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "ts-release-self-config-"))
  await writeJson(join(root, "package.json"), baseManifest)
  await writeJson(join(root, "release.config.json"), baseConfig)
  await writeFile(join(root, "README.md"), "clean\n")
  if (options.envExample !== undefined) {
    await writeFile(join(root, ".env.example"), options.envExample)
  }

  await run(["git", "init"], root)
  await run(["git", "config", "user.email", "release@example.com"], root)
  await run(["git", "config", "user.name", "Release Test"], root)
  await run(["git", "add", "."], root)
  await run(["git", "commit", "-m", "initial"], root)

  if (options.dirty === true) {
    await writeFile(join(root, "README.md"), "dirty\n")
  }

  return root
}

describe("self-release config script", () => {
  test("passes when configured token env is documented", async () => {
    const root = await prepareWorkspace({ envExample: "NPM_TOKEN=\n" })
    try {
      const result = await run(["bun", scriptPath], root)

      expect(result.exitCode).toBe(0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("fails when token env is missing from .env.example", async () => {
    const root = await prepareWorkspace()
    try {
      const result = await run(["bun", scriptPath], root)

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain(".env.example must document")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("fails when HEAD release uses dirty tracked files", async () => {
    const root = await prepareWorkspace({ envExample: "NPM_TOKEN=\n", dirty: true })
    try {
      const result = await run(["bun", scriptPath], root)

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain("release identity commit HEAD requires a clean tracked working tree")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
