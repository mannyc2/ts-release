import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const node = process.env.TS_RELEASE_NODE_BIN
const npmCli = process.env.TS_RELEASE_NPM_CLI
const hasPinnedNpm = node !== undefined && npmCli !== undefined &&
  existsSync(node) && existsSync(npmCli)

const github = {
  GITHUB_ACTIONS: "true",
  GITHUB_REPOSITORY: "owner/repository",
  GITHUB_WORKFLOW_REF: "owner/repository/.github/workflows/release.yml@refs/heads/main",
  GITHUB_SERVER_URL: "https://github.com",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REPOSITORY_ID: "123456789",
  GITHUB_REPOSITORY_OWNER_ID: "1234567",
  GITHUB_REF: "refs/heads/main",
  GITHUB_SHA: "c".repeat(40),
  RUNNER_ENVIRONMENT: "github-hosted",
  GITHUB_RUN_ID: "987654321",
  GITHUB_RUN_ATTEMPT: "2"
} as const

describe("installed npm provenance source contract", () => {
  test.skipIf(!hasPinnedNpm)(
    "npm 11 serializes every admitted GitHub provenance fact offline",
    () => {
      const npmRoot = dirname(dirname(npmCli!))
      const packageJson = JSON.parse(readFileSync(join(npmRoot, "package.json"), "utf8")) as {
        readonly version?: unknown
      }
      expect(typeof packageJson.version).toBe("string")
      expect(Bun.semver.satisfies(String(packageJson.version), ">=11.5.1 <12")).toBe(true)

      const provenance = join(npmRoot, "node_modules", "libnpmpublish", "lib", "provenance.js")
      expect(existsSync(provenance)).toBe(true)
      const fixture = fileURLToPath(new URL("../../fixtures/npm-provenance-contract.cjs", import.meta.url))
      const result = Bun.spawnSync([node!, fixture, provenance], {
        env: github,
        stdout: "pipe",
        stderr: "pipe"
      })
      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString()) as {
        readonly payload?: unknown
        readonly payloadType?: unknown
      }
      expect(output).toEqual({
        payloadType: "application/vnd.in-toto+json",
        payload: {
          _type: "https://in-toto.io/Statement/v1",
          subject: [{
            name: "pkg:npm/%40fixture/protocol@1.2.3",
            digest: { sha512: "fixture-sha512" }
          }],
          predicateType: "https://slsa.dev/provenance/v1",
          predicate: {
            buildDefinition: {
              buildType: "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
              externalParameters: {
                workflow: {
                  ref: "refs/heads/main",
                  repository: "https://github.com/owner/repository",
                  path: ".github/workflows/release.yml"
                }
              },
              internalParameters: {
                github: {
                  event_name: "workflow_dispatch",
                  repository_id: "123456789",
                  repository_owner_id: "1234567"
                }
              },
              resolvedDependencies: [{
                uri: "git+https://github.com/owner/repository@refs/heads/main",
                digest: { gitCommit: "c".repeat(40) }
              }]
            },
            runDetails: {
              builder: { id: "https://github.com/actions/runner/github-hosted" },
              metadata: {
                invocationId: "https://github.com/owner/repository/actions/runs/987654321/attempts/2"
              }
            }
          }
        }
      })
    }
  )
})
