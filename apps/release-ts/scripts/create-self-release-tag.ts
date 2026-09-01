import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { parseStrictJson } from "../../../scripts/lib/strict-json.js"
import { assertNoForbiddenNpmEnvironment } from "./check-self-release-dispatch.js"
import { assertNoToolTransportEnvironment } from "./install-self-release-npm.js"

const exactRepository = "mannyc2/ts-release"
const exactTag = "v0.3.0"
const exactRef = `refs/tags/${exactTag}`
const apiRoot = `https://api.github.com/repos/${exactRepository}`
const refUrl = `${apiRoot}/git/ref/tags/${encodeURIComponent(exactTag)}`
const createUrl = `${apiRoot}/git/refs`
const gitSha = /^[a-f0-9]{40}$/u
const maximumResponseBytes = 1024 * 1024
const rereadAttempts = 6

export interface GitHubTagResponse {
  readonly status: number
  readonly body: unknown
}

export interface GitHubTagBoundary {
  readonly read: () => Promise<GitHubTagResponse>
  readonly create: (ref: string, sha: string) => Promise<GitHubTagResponse>
  readonly wait: () => Promise<void>
}

export interface SelfReleaseTagInput {
  readonly tag: string
  readonly candidateSha: string
}

export interface SelfReleaseTagReport {
  readonly schemaVersion: "ts-release/tag-convergence/v1"
  readonly status: "complete" | "conflict" | "uncertain"
  readonly result:
    | "already-equivalent"
    | "created-and-observed"
    | "converged-after-conflict"
    | "present-different"
    | "provider-rejected"
    | "outcome-unknown"
    | "observation-inconclusive"
  readonly tag: string
  readonly candidateSha: string
  readonly mutationAttempts: 0 | 1
}

type TagObservation =
  | { readonly _tag: "Absent" }
  | { readonly _tag: "Equivalent" }
  | { readonly _tag: "Different" }
  | { readonly _tag: "Inconclusive" }

const object = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined

const observe = (response: GitHubTagResponse, input: SelfReleaseTagInput): TagObservation => {
  if (response.status === 404) return { _tag: "Absent" }
  if (response.status !== 200) return { _tag: "Inconclusive" }
  const body = object(response.body)
  const target = object(body?.object)
  if (body?.ref !== `refs/tags/${input.tag}` || target === undefined ||
      (target.type !== "commit" && target.type !== "tag") ||
      typeof target.sha !== "string" || !gitSha.test(target.sha)) {
    return { _tag: "Inconclusive" }
  }
  return target.type === "commit" && target.sha === input.candidateSha
    ? { _tag: "Equivalent" }
    : { _tag: "Different" }
}

const readObservation = async (
  boundary: GitHubTagBoundary,
  input: SelfReleaseTagInput
): Promise<TagObservation> => {
  try {
    return observe(await boundary.read(), input)
  } catch {
    return { _tag: "Inconclusive" }
  }
}

const report = (
  input: SelfReleaseTagInput,
  status: SelfReleaseTagReport["status"],
  result: SelfReleaseTagReport["result"],
  mutationAttempts: 0 | 1
): SelfReleaseTagReport => ({
  schemaVersion: "ts-release/tag-convergence/v1",
  status,
  result,
  tag: input.tag,
  candidateSha: input.candidateSha,
  mutationAttempts
})

/**
 * Converges one lightweight release tag with at most one mutation dispatch.
 * Any ambiguous mutation response is resolved only by bounded provider rereads;
 * the function never blindly resubmits a create request.
 */
export const convergeSelfReleaseTag = async (
  input: SelfReleaseTagInput,
  boundary: GitHubTagBoundary
): Promise<SelfReleaseTagReport> => {
  if (input.tag !== exactTag || !gitSha.test(input.candidateSha)) {
    throw new Error("Tag convergence requires exact v0.3.0 and one lowercase 40-hex candidate commit.")
  }
  const before = await readObservation(boundary, input)
  if (before._tag === "Equivalent") return report(input, "complete", "already-equivalent", 0)
  if (before._tag === "Different") return report(input, "conflict", "present-different", 0)
  if (before._tag === "Inconclusive") return report(input, "uncertain", "observation-inconclusive", 0)

  let response: GitHubTagResponse | undefined
  try {
    response = await boundary.create(`refs/tags/${input.tag}`, input.candidateSha)
  } catch {
    // A transport failure after dispatch is commitment-unknown. Reread only.
  }

  for (let attempt = 1; attempt <= rereadAttempts; attempt += 1) {
    const after = await readObservation(boundary, input)
    if (after._tag === "Equivalent") {
      return report(
        input,
        "complete",
        response?.status === 422 ? "converged-after-conflict" : "created-and-observed",
        1
      )
    }
    if (after._tag === "Different") return report(input, "conflict", "present-different", 1)
    if (attempt < rereadAttempts) await boundary.wait()
  }

  const definitelyRejected = response !== undefined && response.status >= 400 && response.status < 500
  return definitelyRejected
    ? report(input, "conflict", "provider-rejected", 1)
    : report(input, "uncertain", "outcome-unknown", 1)
}

const readBody = async (response: Response): Promise<unknown> => {
  const declared = response.headers.get("content-length")
  if (declared !== null) {
    const size = Number(declared)
    if (!Number.isSafeInteger(size) || size < 0 || size > maximumResponseBytes) {
      throw new Error("GitHub tag response length is invalid.")
    }
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length > maximumResponseBytes || (declared !== null && bytes.length !== Number(declared))) {
    throw new Error("GitHub tag response is truncated or oversized.")
  }
  return bytes.length === 0
    ? {}
    : parseStrictJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
}

const request = async (
  token: string,
  url: string,
  init: RequestInit = {}
): Promise<GitHubTagResponse> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      ...(init.headers ?? {})
    },
    redirect: "error",
    signal: AbortSignal.timeout(30_000)
  })
  if (response.url !== url || response.headers.has("location")) {
    throw new Error("GitHub tag boundary redirected away from its exact API coordinate.")
  }
  return { status: response.status, body: await readBody(response) }
}

const main = async (): Promise<void> => {
  assertNoForbiddenNpmEnvironment(process.env)
  assertNoToolTransportEnvironment(process.env)
  const token = process.env.GITHUB_TOKEN?.trim() ?? ""
  const candidateSha = process.env.CANDIDATE_SHA ?? ""
  if (token.length === 0 || process.env.GITHUB_REPOSITORY !== exactRepository ||
      process.env.GITHUB_REF !== "refs/heads/main") {
    throw new Error("Guarded tag creation requires the exact repository/ref and one step-scoped GitHub token.")
  }
  const result = await convergeSelfReleaseTag({ tag: exactTag, candidateSha }, {
    read: () => request(token, refUrl),
    create: (ref, sha) => request(token, createUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ref, sha })
    }),
    wait: () => Bun.sleep(2_000)
  })
  const path = join(process.cwd(), ".release", "ts-release", "tag-report.json")
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 })
  console.log(JSON.stringify(result))
  if (result.status !== "complete") {
    throw new Error(`Guarded tag convergence is ${result.status}; no tag success is claimed.`)
  }
}

if (import.meta.main) await main()
