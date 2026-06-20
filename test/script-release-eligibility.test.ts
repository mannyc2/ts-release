import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import {
  checkReleaseDecision,
  checkReleaseEligibility,
  checkReleaseIntentRequirement,
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
  readonly status: "ready" | "complete" | "partial" | "skipped"
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

const packageManifest = JSON.stringify({
  name: "@scope/pkg",
  version: "1.2.3"
})

const eligibilityConfig = (releaseDecision: Record<string, unknown>) =>
  releaseConfig({
    identity: {
      name: "@scope/pkg",
      version: "1.2.3",
      commit: "abc123",
      tag: "v1.2.3"
    },
    artifacts: [],
    targets: [
      {
        _tag: "NpmRegistryTarget",
        id: "npm",
        registry: "https://registry.npmjs.org",
        packageName: "@scope/pkg",
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
        draft: false,
        dryRunSupport: "simulated",
        mutability: "mutable-release",
        recovery: "delete-and-recreate"
      }
    ],
    strict: true,
    evidenceDirectory: ".release/evidence",
    releaseDecision
  })

const gitHeadCommand = CommandSpec.make({
  executable: "git",
  args: ["rev-parse", "--short", "HEAD"],
  requiredEnv: [],
  redactedEnv: []
})

const gitTagsAtHeadCommand = CommandSpec.make({
  executable: "git",
  args: ["tag", "--points-at", "HEAD"],
  requiredEnv: [],
  redactedEnv: []
})

const gitListTagsCommand = CommandSpec.make({
  executable: "git",
  args: ["tag", "--list", "--merged", "HEAD"],
  requiredEnv: [],
  redactedEnv: []
})

const gitLogCommand = (sinceTag: string | undefined): CommandSpec =>
  CommandSpec.make({
    executable: "git",
    args: sinceTag === undefined
      ? ["log", "--format=%B%x1e"]
      : ["log", `${sinceTag}..HEAD`, "--format=%B%x1e"],
    requiredEnv: [],
    redactedEnv: []
  })

const npmViewCommand = (version: string): CommandSpec =>
  CommandSpec.make({
    executable: "npm",
    args: ["view", `@scope/pkg@${version}`, "version", "--registry", "https://registry.npmjs.org"],
    requiredEnv: [],
    redactedEnv: []
  })

const ghReleaseViewCommand = (tag: string): CommandSpec =>
  CommandSpec.make({
    executable: "gh",
    args: [
      "release",
      "view",
      tag,
      "--repo",
      "owner/repo",
      "--json",
      "isDraft,tagName,publishedAt"
    ],
    requiredEnv: ["GH_TOKEN"],
    redactedEnv: ["GH_TOKEN"]
  })

const missingRemoteCommands = (version: string, tag: string): ReadonlyArray<readonly [string, {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}]> => [
  [commandKey(npmViewCommand(version)), {
    exitCode: 1,
    stdout: "",
    stderr: "E404 Not Found"
  }],
  [commandKey(ghReleaseViewCommand(tag)), {
    exitCode: 1,
    stdout: "",
    stderr: "not found"
  }]
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

  test("git tag strategy skips when HEAD has no matching tag", async () => {
    const intent = await Effect.runPromise(parseReleaseIntent(eligibilityConfig({
      _tag: "GitTagReleaseDecision",
      tagTemplate: "v{version}",
      packagePath: "package.json",
      requireCurrentRef: true
    })))

    const decision = await runEffect(
      checkReleaseDecision(intent),
      makeTestCommandRunnerLayer({
        files: new Map([["package.json", packageManifest]]),
        env: new Map([["GH_TOKEN", "gh_secret"]]),
        commands: new Map([
          [commandKey(gitTagsAtHeadCommand), {
            exitCode: 0,
            stdout: "",
            stderr: ""
          }]
        ])
      })
    )

    expect(decision.status).toBe("skipped")
    expect(decision.shouldRelease).toBe(false)
  })

  test("git tag strategy checks remotes for one matching tag", async () => {
    const intent = await Effect.runPromise(parseReleaseIntent(eligibilityConfig({
      _tag: "GitTagReleaseDecision",
      tagTemplate: "v{version}",
      packagePath: "package.json",
      requireCurrentRef: true
    })))

    const decision = await runEffect(
      checkReleaseDecision(intent),
      makeTestCommandRunnerLayer({
        files: new Map([["package.json", packageManifest]]),
        env: new Map([["GH_TOKEN", "gh_secret"]]),
        commands: new Map([
          [commandKey(gitTagsAtHeadCommand), {
            exitCode: 0,
            stdout: "v1.2.3\n",
            stderr: ""
          }],
          [commandKey(gitHeadCommand), {
            exitCode: 0,
            stdout: "abc123\n",
            stderr: ""
          }],
          ...missingRemoteCommands("1.2.3", "v1.2.3")
        ])
      })
    )

    expect(decision.status).toBe("ready")
    expect(decision.strategy).toBe("GitTagReleaseDecision")
    expect(decision.githubTag).toBe("v1.2.3")
  })

  test("git tag strategy skips a provided tag when current ref is required and HEAD differs", async () => {
    const intent = await Effect.runPromise(parseReleaseIntent(eligibilityConfig({
      _tag: "GitTagReleaseDecision",
      tag: "v1.2.3",
      tagTemplate: "v{version}",
      packagePath: "package.json",
      requireCurrentRef: true
    })))

    const decision = await runEffect(
      checkReleaseDecision(intent),
      makeTestCommandRunnerLayer({
        files: new Map([["package.json", packageManifest]]),
        commands: new Map([
          [commandKey(gitTagsAtHeadCommand), {
            exitCode: 0,
            stdout: "v1.2.2\n",
            stderr: ""
          }]
        ])
      })
    )

    expect(decision.status).toBe("skipped")
    expect(decision.shouldRelease).toBe(false)
    expect(decision.reason).toContain("does not point at HEAD")
  })

  test("git tag strategy fails on multiple matching tags", async () => {
    const intent = await Effect.runPromise(parseReleaseIntent(eligibilityConfig({
      _tag: "GitTagReleaseDecision",
      tagTemplate: "v{version}",
      packagePath: "package.json",
      requireCurrentRef: true
    })))

    const error = await runEffect(
      checkReleaseDecision(intent).pipe(Effect.flip),
      makeTestCommandRunnerLayer({
        files: new Map([["package.json", packageManifest]]),
        commands: new Map([
          [commandKey(gitTagsAtHeadCommand), {
            exitCode: 0,
            stdout: "v1.2.3\nv1.2.4\n",
            stderr: ""
          }]
        ])
      })
    )

    expect(error._tag).toBe("ReleaseEligibilityCheckError")
    if (error._tag === "ReleaseEligibilityCheckError") {
      expect(error.reason).toContain("Multiple release tags")
    }
  })

  test("conventional commits strategy computes semver bumps", async () => {
    const cases: ReadonlyArray<{
      readonly name: string
      readonly commits: string
      readonly version: string
      readonly tag: string
    }> = [
      {
        name: "patch",
        commits: "fix: repair bug\x1e",
        version: "1.2.4",
        tag: "v1.2.4"
      },
      {
        name: "minor",
        commits: "feat: add command\x1e",
        version: "1.3.0",
        tag: "v1.3.0"
      },
      {
        name: "major",
        commits: "feat!: change api\x1e",
        version: "2.0.0",
        tag: "v2.0.0"
      }
    ]

    for (const item of cases) {
      const intent = await Effect.runPromise(parseReleaseIntent(eligibilityConfig({
        _tag: "ConventionalCommitsReleaseDecision",
        packagePath: "package.json",
        tagTemplate: "v{version}",
        base: "latest-tag",
        preset: "conventionalcommits"
      })))

      const decision = await runEffect(
        checkReleaseDecision(intent),
        makeTestCommandRunnerLayer({
          files: new Map([["package.json", packageManifest]]),
          env: new Map([["GH_TOKEN", "gh_secret"]]),
          commands: new Map([
            [commandKey(gitListTagsCommand), {
              exitCode: 0,
              stdout: "v1.2.3\nnot-a-release\n",
              stderr: ""
            }],
            [commandKey(gitLogCommand("v1.2.3")), {
              exitCode: 0,
              stdout: item.commits,
              stderr: ""
            }],
            [commandKey(gitHeadCommand), {
              exitCode: 0,
              stdout: "abc123\n",
              stderr: ""
            }],
            ...missingRemoteCommands(item.version, item.tag)
          ])
        })
      )

      expect(decision.status, item.name).toBe("ready")
      expect(decision.packageVersion, item.name).toBe(item.version)
      expect(decision.githubTag, item.name).toBe(item.tag)
    }
  })

  test("conventional commits strategy skips non-releasable commits", async () => {
    const intent = await Effect.runPromise(parseReleaseIntent(eligibilityConfig({
      _tag: "ConventionalCommitsReleaseDecision",
      packagePath: "package.json",
      tagTemplate: "v{version}"
    })))

    const decision = await runEffect(
      checkReleaseDecision(intent),
      makeTestCommandRunnerLayer({
        files: new Map([["package.json", packageManifest]]),
        commands: new Map([
          [commandKey(gitListTagsCommand), {
            exitCode: 0,
            stdout: "",
            stderr: ""
          }],
          [commandKey(gitLogCommand(undefined)), {
            exitCode: 0,
            stdout: "docs: update readme\x1e",
            stderr: ""
          }]
        ])
      })
    )

    expect(decision.status).toBe("skipped")
  })

  test("intent files strategy chooses the highest requested bump", async () => {
    const intent = await Effect.runPromise(parseReleaseIntent(eligibilityConfig({
      _tag: "IntentFilesReleaseDecision",
      directory: ".release/intents",
      packagePath: "package.json",
      tagTemplate: "v{version}",
      requireIntent: true
    })))

    const decision = await runEffect(
      checkReleaseDecision(intent),
      makeTestCommandRunnerLayer({
        directories: new Set([".release/intents"]),
        files: new Map([
          ["package.json", packageManifest],
          [".release/intents/fix.json", JSON.stringify({
            package: "@scope/pkg",
            release: "patch",
            summary: "Fix a bug"
          })],
          [".release/intents/feature.json", JSON.stringify({
            package: "@scope/pkg",
            release: "minor",
            summary: "Add a feature"
          })]
        ]),
        env: new Map([["GH_TOKEN", "gh_secret"]]),
        commands: new Map([
          [commandKey(gitHeadCommand), {
            exitCode: 0,
            stdout: "abc123\n",
            stderr: ""
          }],
          ...missingRemoteCommands("1.3.0", "v1.3.0")
        ])
      })
    )

    expect(decision.status).toBe("ready")
    expect(decision.packageVersion).toBe("1.3.0")
  })

  test("intent check accepts explicit empty intent and fails missing required intent", async () => {
    const intent = await Effect.runPromise(parseReleaseIntent(eligibilityConfig({
      _tag: "IntentFilesReleaseDecision",
      directory: ".release/intents",
      packagePath: "package.json",
      tagTemplate: "v{version}",
      requireIntent: true
    })))

    const emptyDecision = await runEffect(
      checkReleaseIntentRequirement(intent),
      makeTestCommandRunnerLayer({
        directories: new Set([".release/intents"]),
        files: new Map([
          ["package.json", packageManifest],
          [".release/intents/empty.json", JSON.stringify({
            package: "@scope/pkg",
            release: "none",
            summary: "No release needed",
            empty: true
          })]
        ])
      })
    )
    expect(emptyDecision.status).toBe("skipped")

    const missingError = await runEffect(
      checkReleaseIntentRequirement(intent).pipe(Effect.flip),
      makeTestCommandRunnerLayer({
        directories: new Set([".release/intents"]),
        files: new Map([["package.json", packageManifest]])
      })
    )
    expect(missingError._tag).toBe("ReleaseEligibilityCheckError")
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
