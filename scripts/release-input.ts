import assert from "node:assert/strict"
import { appendFile, readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

// Input projection only. The CLI/Action loads this and the original retained Plan.
const [candidate, destination, mode, approval] = process.argv.slice(2)
assert.ok(
  candidate && destination && ["Token", "Trusted", "Local"].includes(mode ?? ""),
  "Usage: bun scripts/release-input.ts <candidate> <input.json> <Token|Trusted|Local> [--execute]",
)
assert.ok(approval === undefined || approval === "--execute")
const directory = resolve(candidate)
const identity = JSON.parse(await readFile(join(directory, "identity.json"), "utf8"))
const remote = process.env.TS_RELEASE_JOURNAL_REMOTE
assert.ok(remote, "Set an explicit TS_RELEASE_JOURNAL_REMOTE shared across runners")
const gitExecutable = Bun.which("git")
assert.ok(gitExecutable)
const authentication = {
  mode,
  githubTokenEnvironment: "GH_TOKEN",
  ...(mode === "Token" ? { npmTokenEnvironment: "NPM_TOKEN" } : {}),
  ...(mode === "Local" ? { npmConfigFile: process.env.NPM_CONFIG_USERCONFIG } : {}),
}
if (mode === "Local")
  assert.ok(
    authentication.npmConfigFile,
    "Select NPM_CONFIG_USERCONFIG explicitly for local npm login",
  )
let sigstore
if (mode === "Trusted") {
  const seeds = JSON.parse(await readFile(resolve("node_modules/@sigstore/tuf/seeds.json"), "utf8"))
  const tufRootPath = resolve(`${destination}.trust-root.json`)
  await writeFile(
    tufRootPath,
    Buffer.from(seeds["https://tuf-repo-cdn.sigstore.dev"]["root.json"], "base64"),
    { flag: "wx" },
  )
  sigstore = {
    tufRootPath,
    tufCachePath: resolve(`${destination}.tuf-cache`),
    timeoutMilliseconds: 30000,
  }
}
const input = {
  candidateDirectory: directory,
  ...identity,
  authorize: approval === "--execute",
  authentication,
  journal: {
    remote,
    cacheDirectory: resolve(`${destination}.journal-cache`),
    gitExecutable,
    principal: "github-publisher",
    scope: "release-journal",
    timeoutMilliseconds: 60000,
    maximumOutputBytes: 64 * 1024 * 1024,
  },
  ...(sigstore ? { sigstore } : {}),
  ...(process.env.TS_RELEASE_SUPERSEDED_CANDIDATES
    ? {
        supersededCandidates: await Promise.all(
          (JSON.parse(process.env.TS_RELEASE_SUPERSEDED_CANDIDATES) as string[]).map(
            async (directory) => {
              assert.equal(typeof directory, "string")
              const identity = JSON.parse(
                await readFile(join(resolve(directory), "identity.json"), "utf8"),
              )
              assert.match(identity.planId, /^[a-f0-9]{64}$/u)
              assert.match(identity.bundleSha256, /^[a-f0-9]{64}$/u)
              return {
                candidateDirectory: resolve(directory),
                planId: identity.planId,
                bundleSha256: identity.bundleSha256,
              }
            },
          ),
        ),
      }
    : {}),
}
await writeFile(resolve(destination), JSON.stringify(input, null, 2) + "\n", { flag: "wx" })
if (process.env.GITHUB_OUTPUT)
  await appendFile(process.env.GITHUB_OUTPUT, `application-input=${JSON.stringify(input)}\n`)
console.log(
  JSON.stringify({
    input: resolve(destination),
    planId: identity.planId,
    authorize: input.authorize,
  }),
)
