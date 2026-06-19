import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import {
  checkReleaseEligibility,
  decideReleaseEligibility,
  releaseEligibilityRemoteCheckFromIntent,
  ReleasePackageManifest,
  ReleaseEligibilityRemoteCheck
} from "../src/planner/release-eligibility.js"
import { GitHubReleaseAvailability, NpmRemoteState } from "../src/domain/remote-state.js"
import { CommandSpec } from "../src/domain/operation.js"
import { commandKey, makeTestCommandRunnerLayer } from "../src/host/test.js"
import { releaseConfig, runEffect } from "./helpers.js"

interface EligibilityCase {
  readonly name: string
  readonly expectedGithubDraft: boolean
  readonly npm: NpmRemoteState
  readonly github: GitHubReleaseAvailability
  readonly status: "ready" | "complete" | "partial"
  readonly shouldRelease: boolean
}

const cases: ReadonlyArray<EligibilityCase> = [
  {
    name: "missing npm and missing GitHub release is ready",
    expectedGithubDraft: false,
    npm: "missing",
    github: "missing",
    status: "ready",
    shouldRelease: true
  },
  {
    name: "published npm and public GitHub release is complete for public target",
    expectedGithubDraft: false,
    npm: "published",
    github: "published",
    status: "complete",
    shouldRelease: false
  },
  {
    name: "published npm and draft GitHub release is partial for public target",
    expectedGithubDraft: false,
    npm: "published",
    github: "draft",
    status: "partial",
    shouldRelease: false
  },
  {
    name: "missing npm and draft GitHub release is partial",
    expectedGithubDraft: false,
    npm: "missing",
    github: "draft",
    status: "partial",
    shouldRelease: false
  },
  {
    name: "missing npm and public GitHub release is partial",
    expectedGithubDraft: false,
    npm: "missing",
    github: "published",
    status: "partial",
    shouldRelease: false
  },
  {
    name: "draft target with draft GitHub release is complete",
    expectedGithubDraft: true,
    npm: "published",
    github: "draft",
    status: "complete",
    shouldRelease: false
  },
  {
    name: "draft target with public GitHub release is partial",
    expectedGithubDraft: true,
    npm: "published",
    github: "published",
    status: "partial",
    shouldRelease: false
  }
]

describe("release eligibility workflow", () => {
  for (const item of cases) {
    test(item.name, () => {
      const decision = decideReleaseEligibility({
        packageName: "@scope/pkg",
        packageVersion: "1.2.3",
        expectedGithubDraft: item.expectedGithubDraft,
        npm: item.npm,
        github: item.github
      })

      expect(decision.status).toBe(item.status)
      expect(decision.shouldRelease).toBe(item.shouldRelease)
      expect(decision.reason).toContain("@scope/pkg@1.2.3")
    })
  }

  test("checks remote state through the command runner", async () => {
    const npmView = CommandSpec.make({
      executable: "npm",
      args: ["view", "@scope/pkg@1.2.3", "version", "--registry", "https://registry.npmjs.org"],
      requiredEnv: [],
      redactedEnv: []
    })
    const ghReleaseView = CommandSpec.make({
      executable: "gh",
      args: [
        "release",
        "view",
        "v1.2.3",
        "--repo",
        "owner/repo",
        "--json",
        "isDraft,tagName,publishedAt"
      ],
      requiredEnv: ["GH_TOKEN"],
      redactedEnv: ["GH_TOKEN"]
    })
    const decision = await runEffect(
      checkReleaseEligibility(
        ReleaseEligibilityRemoteCheck.make({
          packageName: "@scope/pkg",
          packageVersion: "1.2.3",
          npmTargetId: "npm",
          npmRegistry: "https://registry.npmjs.org",
          githubTargetId: "github",
          githubRepository: "owner/repo",
          githubTag: "v1.2.3",
          githubTokenEnv: "GH_TOKEN",
          expectedGithubDraft: false
        })
      ),
      makeTestCommandRunnerLayer({
        env: new Map([["GH_TOKEN", "gh_secret"]]),
        commands: new Map([
          [commandKey(npmView), {
            exitCode: 0,
            stdout: "1.2.3\n",
            stderr: ""
          }],
          [commandKey(ghReleaseView), {
            exitCode: 0,
            stdout: JSON.stringify({
              isDraft: true,
              tagName: "v1.2.3",
              publishedAt: null
            }),
            stderr: ""
          }]
        ])
      })
    )

    expect(decision.status).toBe("partial")
    expect(decision.reason).toContain("still a draft")
  })

  test("uses the configured GitHub tag in remote checks", async () => {
    const ghReleaseView = CommandSpec.make({
      executable: "gh",
      args: [
        "release",
        "view",
        "release-1.2.3",
        "--repo",
        "owner/repo",
        "--json",
        "isDraft,tagName,publishedAt"
      ],
      requiredEnv: ["GH_TOKEN"],
      redactedEnv: ["GH_TOKEN"]
    })
    const decision = await runEffect(
      checkReleaseEligibility(
        ReleaseEligibilityRemoteCheck.make({
          packageName: "@scope/pkg",
          packageVersion: "1.2.3",
          npmTargetId: "npm",
          npmRegistry: "https://registry.npmjs.org",
          githubTargetId: "github",
          githubRepository: "owner/repo",
          githubTag: "release-1.2.3",
          githubTokenEnv: "GH_TOKEN",
          expectedGithubDraft: false
        })
      ),
      makeTestCommandRunnerLayer({
        env: new Map([["GH_TOKEN", "gh_secret"]]),
        commands: new Map([
          [commandKey(ghReleaseView), {
            exitCode: 1,
            stdout: "",
            stderr: "not found"
          }]
        ])
      })
    )

    expect(decision.status).toBe("partial")
  })

  test("rejects npm target package drift even when the target id is npm", async () => {
    const intent = await Effect.runPromise(
      parseReleaseIntent(
        releaseConfig({
          artifacts: [
            {
              id: "package",
              path: ".",
              format: "directory",
              consumers: ["npm"]
            }
          ],
          targets: [
            {
              _tag: "NpmRegistryTarget",
              id: "npm",
              registry: "https://registry.npmjs.org",
              packageName: "@scope/other",
              packagePath: ".",
              tokenEnv: "NPM_TOKEN",
              dryRunSupport: "native",
              mutability: "immutable",
              recovery: "publish-new-version"
            },
            {
              _tag: "GitHubReleaseTarget",
              id: "github",
              repository: "owner/repo",
              tokenEnv: "GH_TOKEN",
              draft: true,
              dryRunSupport: "simulated",
              mutability: "mutable-release",
              recovery: "delete-and-recreate"
            }
          ]
        })
      )
    )
    const error = await runEffect(
      releaseEligibilityRemoteCheckFromIntent(
        ReleasePackageManifest.make({
          name: "@scope/pkg",
          version: "1.2.3"
        }),
        intent
      ).pipe(Effect.flip),
      makeTestCommandRunnerLayer()
    )

    expect(error._tag).toBe("ReleaseEligibilityCheckError")
    if (error._tag === "ReleaseEligibilityCheckError") {
      expect(error.targetId).toBe("npm")
      expect(error.reason).toContain("@scope/other")
      expect(error.reason).toContain("@scope/pkg")
    }
  })

  test("fails unexpected command failures instead of treating them as missing", async () => {
    const npmView = CommandSpec.make({
      executable: "npm",
      args: ["view", "@scope/pkg@1.2.3", "version", "--registry", "https://registry.npmjs.org"],
      requiredEnv: [],
      redactedEnv: []
    })
    const error = await runEffect(
      checkReleaseEligibility(
        ReleaseEligibilityRemoteCheck.make({
          packageName: "@scope/pkg",
          packageVersion: "1.2.3",
          npmTargetId: "npm",
          npmRegistry: "https://registry.npmjs.org",
          githubTargetId: "github",
          githubRepository: "owner/repo",
          githubTag: "v1.2.3",
          expectedGithubDraft: false
        })
      ).pipe(Effect.flip),
      makeTestCommandRunnerLayer({
        commands: new Map([
          [commandKey(npmView), {
            exitCode: 1,
            stdout: "",
            stderr: "network unavailable"
          }]
        ])
      })
    )

    expect(error._tag).toBe("ReleaseEligibilityCheckError")
  })
})
