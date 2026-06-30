import { describe, expect, test } from "@effect/bun-test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const scriptPath = resolve(
  import.meta.dir,
  "..",
  "apps",
  "release-ts",
  "scripts",
  "check-self-release-live-readiness.ts"
)

const streamText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> =>
  stream === null ? "" : await new Response(stream).text()

const run = async (
  cwd: string,
  apiBase: string
): Promise<{
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}> => {
  const subprocess = Bun.spawn(["bun", scriptPath], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      SELF_RELEASE_GITHUB_API_BASE: apiBase,
      SELF_RELEASE_NPM_REGISTRY: apiBase,
      SELF_RELEASE_PYPI_API_BASE: apiBase,
      SELF_RELEASE_SKIP_GITHUB_SECRET_CHECK: "1"
    }
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

const releaseConfig = () => ({
  build: {
    pypiWheel: [
      {
        id: "pypi-wheel-linux-x64",
        packageName: "ts-release"
      }
    ]
  },
  publish: {
    github: {
      repository: "mannyc2/ts-release"
    },
    homebrew: {
      repository: "mannyc2/homebrew-ts-release"
    },
    scoop: {
      repository: "mannyc2/scoop-ts-release"
    },
    pypi: {
      trustedPublishing: {
        provider: "github-actions",
        workflow: "release.yml",
        publisherConfigured: true
      }
    }
  }
})

const workflow = `name: Release
jobs:
  execute:
    environment: release
    permissions:
      id-token: write
    env:
      GH_TOKEN: \${{ github.token }}
    steps:
      - run: python3 -m pip install --upgrade "twine>=6.2.0"
      - run: bun run release:catalogs
      - run: bun run check:self-release-artifacts
      - uses: actions/checkout@v4
        with:
          token: \${{ secrets.TS_RELEASE_CATALOG_TOKEN }}
	      - uses: ./apps/ts-release-action
	`

const installSmokeWorkflow = `name: Install Smoke
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  npm-package:
    steps:
      - run: npm install "@mannyc1/ts-release@$VERSION"
  github-release-assets:
    steps:
      - run: curl -fsSLO "https://github.com/mannyc2/ts-release/releases/download/$RELEASE_TAG/ts-release-$VERSION-linux-x64"
      - run: curl -fsSLO "https://github.com/mannyc2/ts-release/releases/download/$RELEASE_TAG/ts-release-$VERSION-linux-arm64"
      - run: curl -fsSLO "https://github.com/mannyc2/ts-release/releases/download/$RELEASE_TAG/ts-release-$VERSION-darwin-x64"
      - run: curl -fsSLO "https://github.com/mannyc2/ts-release/releases/download/$RELEASE_TAG/ts-release-$VERSION-darwin-arm64"
      - run: curl -fsSLO "https://github.com/mannyc2/ts-release/releases/download/$RELEASE_TAG/ts-release-$VERSION-windows-x64.exe"
      - run: grep -F "v$VERSION" version.txt
  pypi:
    steps:
      - run: python -m pip install "ts-release==$VERSION"
  homebrew:
    steps:
      - run: brew tap mannyc2/ts-release https://github.com/mannyc2/homebrew-ts-release
      - run: brew trust mannyc2/ts-release
  scoop:
    steps:
      - run: scoop bucket add ts-release https://github.com/mannyc2/scoop-ts-release
`

const prepareWorkspace = async (
  options: { readonly installSmokeWorkflow?: boolean } = {}
): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "ts-release-live-readiness-"))
  await mkdir(join(root, "apps", "release-ts"), { recursive: true })
  await mkdir(join(root, ".github", "workflows"), { recursive: true })
  await writeJson(join(root, "package.json"), {
    name: "@mannyc1/ts-release",
    version: "1.2.3"
  })
  await writeJson(join(root, "apps", "release-ts", "release.config.json"), releaseConfig())
  await writeFile(join(root, ".github", "workflows", "release.yml"), workflow)
  if (options.installSmokeWorkflow !== false) {
    await writeFile(join(root, ".github", "workflows", "install-smoke.yml"), installSmokeWorkflow)
  }
  return root
}

const makeServer = (options: { readonly emptyHomebrew?: boolean; readonly missingHomebrew?: boolean } = {}) =>
  Bun.serve({
    port: 0,
    fetch: (request) => {
      const path = decodeURIComponent(new URL(request.url).pathname)
      if (path === "/repos/mannyc2/homebrew-ts-release" && options.emptyHomebrew === true) {
        return Response.json({ default_branch: "" })
      }
      const okPaths = new Set([
        "/repos/mannyc2/ts-release",
        "/repos/mannyc2/scoop-ts-release"
      ])
      if (options.missingHomebrew !== true) {
        okPaths.add("/repos/mannyc2/homebrew-ts-release")
      }
      if (okPaths.has(path)) {
        return Response.json({ default_branch: "main" })
      }
      return new Response("not found", { status: 404 })
    }
  })

describe("self-release live readiness script", () => {
  test("passes when live release prerequisites are reachable and versions are unused", async () => {
    const root = await prepareWorkspace()
    const server = makeServer()
    try {
      const result = await run(root, server.url.origin)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("ok   npm:version-available")
      expect(result.stdout).toContain("ok   github:release-tag-available")
      expect(result.stdout).toContain("ok   smoke:workflow-file")
      expect(result.stdout).toContain("ok   smoke:github-asset-windows-x64")
      expect(result.stdout).toContain("ok   smoke:scoop-bucket")
      expect(result.stdout).toContain("ok   pypi:trusted-publisher-configured")
      expect(result.stdout).toContain("ok   pypi:version-available")
    } finally {
      server.stop(true)
      await rm(root, { recursive: true, force: true })
    }
  })

  test("fails when the post-release install smoke workflow is missing", async () => {
    const root = await prepareWorkspace({ installSmokeWorkflow: false })
    const server = makeServer()
    try {
      const result = await run(root, server.url.origin)

      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toContain("fail smoke:workflow-file")
    } finally {
      server.stop(true)
      await rm(root, { recursive: true, force: true })
    }
  })

  test("fails when a catalog repository is not reachable", async () => {
    const root = await prepareWorkspace()
    const server = makeServer({ missingHomebrew: true })
    try {
      const result = await run(root, server.url.origin)

      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toContain("fail homebrew:tap:public")
    } finally {
      server.stop(true)
      await rm(root, { recursive: true, force: true })
    }
  })

  test("fails when a catalog repository has no default branch", async () => {
    const root = await prepareWorkspace()
    const server = makeServer({ emptyHomebrew: true })
    try {
      const result = await run(root, server.url.origin)

      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).toContain("fail homebrew:tap:default-branch")
    } finally {
      server.stop(true)
      await rm(root, { recursive: true, force: true })
    }
  })
})
