import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { GitHubApi, GitHubApiLiveLayer } from "../src/github/github.js"
import type { HttpHeader, HttpRequestSpec } from "../src/host/http.js"
import { makeTestCommandRunnerLayer, makeTestReleaseHttpLayer } from "./host-fakes.js"
import { minimalConfig, releaseConfig, releaseIdentity, runEffect } from "./helpers.js"
import { createTestPlan, renderTestPlanText, validateTestPlan } from "./plan-helpers.js"

const TestLayer = makeTestCommandRunnerLayer({
    directories: new Set(["."]),
    files: new Map([
      ["artifacts/release-0.1.0.tgz", "fake archive"]
    ]),
    env: new Map([
      ["NPM_TOKEN", "npm_secret"],
      ["GH_TOKEN", "gh_secret"]
    ])
  })

const createPlan = (config: string = minimalConfig) =>
  createTestPlan(config)

const releaseResponse = (input: {
  readonly id: number
  readonly tag: string
  readonly name?: string | undefined
}) => ({
  id: input.id,
  tag_name: input.tag,
  name: input.name ?? `release ${input.tag}`,
  draft: false,
  prerelease: false,
  upload_url: `https://uploads.github.com/repos/owner/repo/releases/${input.id}/assets{?name,label}`,
  assets: []
})
const githubConfig = ({
  identity,
  format = "tarball",
  draft = true,
  prerelease = false
}: {
  readonly identity?: Record<string, unknown>
  readonly format?: string
  readonly draft?: boolean
  readonly prerelease?: boolean | "auto"
} = {}) => releaseConfig({
  ...(identity === undefined ? {} : { identity }),
  artifacts: [{
    id: "github-asset",
    path: format === "directory" ? "." : "artifacts/release-0.1.0.tgz",
    format
  }],
  publish: {
    github: { repository: "owner/repo", tokenEnv: "GH_TOKEN", draft, prerelease }
  }
})
const fallbackFixture = (tag: string, requests: Array<HttpRequestSpec>) => {
  const inspectUrl = `https://api.github.com/repos/owner/repo/releases/tags/${tag}`
  const listUrl = "https://api.github.com/repos/owner/repo/releases?per_page=100"
  const nextUrl = `${listUrl}&page=2`
  const httpLayer = makeTestReleaseHttpLayer({
    onRequest: (request) => { requests.push(request) },
    responses: new Map([
      [`GET\u0000${inspectUrl}`, { status: 404, json: { message: "Not Found" } }],
      [`GET\u0000${listUrl}`, {
        status: 200,
        responseHeaders: [{ name: "Link", value: `<${nextUrl}>; rel="next"` }],
        json: [releaseResponse({ id: 1, tag: "v1.0.0" })]
      }],
      [`GET\u0000${nextUrl}`, {
        status: 200,
        json: [releaseResponse({ id: 2, tag: "v2.0.0" })]
      }]
    ])
  })
  return { httpLayer, urls: [inspectUrl, listUrl, nextUrl] }
}

const expectValidationRecord = (
  records: ReadonlyArray<{ readonly operationId: string; readonly status: string }>,
  id: string,
  expected: { readonly status: string; readonly severity: string; readonly skipped: boolean }
) => {
  const record = records.find((item) => item.operationId === id)
  expect(record?.status).toBe(expected.status)
}

describe("GitHub target", () => {
  test("records simulated validation note evidence with current adapter severities", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan()
        return yield* validateTestPlan(plan)
      }),
      TestLayer
    )

    expectValidationRecord(evidence.records, "github:github-release-dry-run", {
      status: "passed",
      skipped: false,
      severity: "info"
    })
  })

  test("covers GitHub API release operation data for flags and assets", async () => {
    const config = githubConfig({ identity: releaseIdentity({ notes: "ship it" }), prerelease: true })

    const plan = await runEffect(createPlan(config), TestLayer)
    const publish = plan.operations.find((operation) => operation.id === "github:github-release-create")
    const verify = plan.operations.find((operation) => operation.id === "github:github-release-verify-api")
    const text = renderTestPlanText(plan)

    expect(publish?.action._tag).toBe("github-release-create")
    if (publish?.action._tag === "github-release-create") {
      expect(publish.action.repository).toBe("owner/repo")
      expect(publish.action.tokenEnv).toBe("GH_TOKEN")
      expect(publish.action.tag).toBe("v0.1.0")
      expect(publish.action.title).toBe("release 0.1.0")
      expect(publish.action.draft).toBe(true)
      expect(publish.action.prerelease).toBe(true)
      expect(publish.action.notes).toBe("ship it")
      expect(publish.action.assets).toEqual([
        {
          artifactId: "github-asset",
          path: "artifacts/release-0.1.0.tgz",
          name: "release-0.1.0.tgz",
          contentType: "application/octet-stream"
        }
      ])
    }
    expect(verify?.action._tag).toBe("github-release-verify")
    if (verify?.action._tag === "github-release-verify") {
      expect(verify.action.repository).toBe("owner/repo")
      expect(verify.action.tokenEnv).toBe("GH_TOKEN")
      expect(verify.action.tag).toBe("v0.1.0")
      expect(verify.action.title).toBe("release 0.1.0")
      expect(verify.action.draft).toBe(true)
      expect(verify.action.prerelease).toBe(true)
      expect(verify.action.assetNames).toEqual(["release-0.1.0.tgz"])
    }
    expect(text).toContain("github-api: create release owner/repo v0.1.0 assets=1")
    expect(text).toContain("github-api: verify release owner/repo v0.1.0 assets=1")
    expect(text).not.toContain("argv: [\"gh\"")
  })

  test("uses API verification for non-draft GitHub releases", async () => {
    const plan = await runEffect(createPlan(githubConfig({ draft: false, prerelease: true })), TestLayer)
    const verify = plan.operations.find((operation) => operation.id === "github:github-release-verify-api")
    const text = renderTestPlanText(plan)

    expect(verify?.action._tag).toBe("github-release-verify")
    if (verify?.action._tag === "github-release-verify") {
      expect(verify.action.repository).toBe("owner/repo")
      expect(verify.action.tokenEnv).toBe("GH_TOKEN")
      expect(verify.action.tag).toBe("v0.1.0")
      expect(verify.action.title).toBe("release 0.1.0")
      expect(verify.action.draft).toBe(false)
      expect(verify.action.prerelease).toBe(true)
      expect(verify.action.assetNames).toEqual(["release-0.1.0.tgz"])
    }
    expect(text).toContain("github-api: verify release owner/repo v0.1.0 assets=1")
  })

  test("GitHub API fallback finds a release on the second list page", async () => {
    const requests: Array<HttpRequestSpec> = []
    const { httpLayer, urls } = fallbackFixture("v2.0.0", requests)

    const release = await runEffect(
      Effect.gen(function*() {
        const github = yield* GitHubApi
        return yield* github.inspectRelease({
          repository: "owner/repo",
          tokenEnv: "GH_TOKEN",
          tag: "v2.0.0"
        })
      }),
      Layer.provide(GitHubApiLiveLayer, httpLayer)
    )

    expect(release.id).toBe(2)
    expect(requests.map((request) => request.url)).toEqual(urls)
  })

  test("GitHub API fallback walks list pages before reporting a missing release", async () => {
    const requests: Array<HttpRequestSpec> = []
    const { httpLayer, urls } = fallbackFixture("v3.0.0", requests)

    const error = await runEffect(
      Effect.gen(function*() {
        const github = yield* GitHubApi
        return yield* github.inspectRelease({
          repository: "owner/repo",
          tokenEnv: "GH_TOKEN",
          tag: "v3.0.0"
        })
      }).pipe(Effect.flip),
      Layer.provide(GitHubApiLiveLayer, httpLayer)
    )

    expect(error._tag).toBe("GitHubApiError")
    if (error._tag === "GitHubApiError") {
      expect(error.status).toBe(404)
      expect(error.reason).toBe("GitHub release v3.0.0 was not found.")
    }
    expect(requests.map((request) => request.url)).toEqual(urls)
  })

  for (const [label, identity, expected] of [
    ["resolves prerelease auto from semver prerelease versions",
      releaseIdentity({ version: "0.2.0-beta.1", tag: "v0.2.0-beta.1" }), true],
    ["resolves prerelease auto to false for stable semver versions", undefined, false]
  ] as const) {
    test(label, async () => {
      const plan = await runEffect(createPlan(githubConfig({
        ...(identity === undefined ? {} : { identity }),
        prerelease: "auto"
      })), TestLayer)
      for (const operationId of ["github:github-release-create", "github:github-release-verify-api"]) {
        const action = plan.operations.find(({ id }) => id === operationId)?.action
        expect(action?._tag).toBe(operationId.endsWith("create") ? "github-release-create" : "github-release-verify")
        if (action?._tag === "github-release-create" || action?._tag === "github-release-verify") {
          expect(action.prerelease).toBe(expected)
        }
      }
    })
  }

  test("rejects directory artifacts consumed by GitHub releases", async () => {
    const error = await runEffect(createPlan(githubConfig({ format: "directory" })).pipe(Effect.flip), TestLayer)

    expect(error._tag).toBe("PlanError")
    if (error._tag === "PlanError") {
      expect(error.reason).toBe("GitHub release assets must be file-like, not directories.")
    }
  })

})
