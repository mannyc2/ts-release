import { createHash } from "node:crypto"

interface ReplayRow {
  readonly provider: "npm" | "github"
  readonly method: "GET"
  readonly url: string
  readonly status: number
  readonly redirect: "manual"
  readonly bodySha256: string
  readonly bodyLength: number
  readonly classification: "visible" | "hidden-or-absent" | "inconclusive"
}

const enabled = process.env.TS_RELEASE_PROVIDER_REPLAY === "read-only"
if (!enabled) {
  console.error("Provider replay is disabled. Set TS_RELEASE_PROVIDER_REPLAY=read-only explicitly.")
  process.exit(2)
}

const npmPackage = process.env.TS_RELEASE_REPLAY_NPM_PACKAGE
const githubRepository = process.env.TS_RELEASE_REPLAY_GITHUB_REPOSITORY
const githubTag = process.env.TS_RELEASE_REPLAY_GITHUB_TAG
if (npmPackage === undefined && (githubRepository === undefined || githubTag === undefined)) {
  console.error("Provide TS_RELEASE_REPLAY_NPM_PACKAGE or both GitHub repository and tag coordinates.")
  process.exit(2)
}
if (githubRepository !== undefined && !/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u.test(githubRepository)) {
  console.error("The GitHub replay repository must use owner/name syntax.")
  process.exit(2)
}

const requests: Array<{ readonly provider: ReplayRow["provider"], readonly url: string, readonly headers: Record<string, string> }> = []
if (npmPackage !== undefined) {
  requests.push({
    provider: "npm",
    url: `https://registry.npmjs.org/${encodeURIComponent(npmPackage).replace(/^%40/u, "@")}`,
    headers: { accept: "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8" }
  })
}
if (githubRepository !== undefined && githubTag !== undefined) {
  requests.push(
    {
      provider: "github",
      url: `https://api.github.com/repos/${githubRepository}`,
      headers: { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" }
    },
    {
      provider: "github",
      url: `https://api.github.com/repos/${githubRepository}/git/ref/tags/${encodeURIComponent(githubTag)}`,
      headers: { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" }
    },
    {
      provider: "github",
      url: `https://api.github.com/repos/${githubRepository}/releases/tags/${encodeURIComponent(githubTag)}`,
      headers: { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" }
    }
  )
}

const rows: Array<ReplayRow> = []
for (const request of requests) {
  // This harness deliberately has no token input and never follows redirects.
  const response = await fetch(request.url, {
    method: "GET",
    headers: request.headers,
    redirect: "manual"
  })
  const bytes = new Uint8Array(await response.arrayBuffer())
  rows.push({
    provider: request.provider,
    method: "GET",
    url: request.url,
    status: response.status,
    redirect: "manual",
    bodySha256: createHash("sha256").update(bytes).digest("hex"),
    bodyLength: bytes.length,
    classification: response.status >= 200 && response.status < 300
      ? "visible"
      : response.status === 404
      ? "hidden-or-absent"
      : "inconclusive"
  })
}

console.log(JSON.stringify({
  schemaVersion: "provider-read-replay/v1",
  authority: "anonymous-read-only",
  mutationRequests: 0,
  rows
}))
