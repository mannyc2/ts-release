import { expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { Effect, Schema } from "effect"
import { Plan } from "@mannyc1/ts-release"
import { FinalizedReport, openGitJournal } from "@mannyc1/ts-release/node"
import { prepareRelease } from "../../../apps/self-release/src/prepare.js"
import { npmBrowserChallenge, startNativeReleasePeer } from "./native-peer.js"

const root = resolve(import.meta.dir, "../../..")
const node =
  process.env.TS_RELEASE_ACCEPTANCE_NODE ?? process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node"
const loginToken = "native-browser-fixture-login-token"
const oneTimePassword = "native-browser-fixture-opaque-one-time-password"
const githubToken = "native-browser-fixture-github-token"
const packageName = "@browser-fixture/native-authentication"
const environment = {
  PATH: process.env.PATH ?? "",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
}
const run = async (command: string[], cwd: string, env: Record<string, string>) => {
  const child = Bun.spawn(command, {
    cwd,
    env,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 300000,
  })
  const [exit, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  return { exit, stdout, stderr }
}

test("native CLI completes journaled npm browser authentication and resumes without replay", async () => {
  const work = await mkdtemp(join(tmpdir(), "ts-release-native-authentication-"))
  let peer: Awaited<ReturnType<typeof startNativeReleasePeer>> | undefined
  try {
    const packageDirectory = join(work, "package")
    await mkdir(packageDirectory)
    await writeFile(
      join(packageDirectory, "package.json"),
      JSON.stringify({ name: packageName, version: "3.2.1", type: "module", files: ["index.js"] }),
    )
    await writeFile(join(packageDirectory, "index.js"), "export const fixture = true\n")
    const npmConfigFile = join(work, "fixture.npmrc")
    await writeFile(npmConfigFile, `//registry.npmjs.org/:_authToken=${loginToken}\n`, {
      mode: 0o600,
    })
    const archiveFile = join(work, "package.tgz")
    const packed = await run(
      [process.execPath, "pm", "pack", "--ignore-scripts", "--filename", archiveFile],
      packageDirectory,
      { ...environment, NPM_CONFIG_USERCONFIG: npmConfigFile },
    )
    expect(packed.exit, packed.stderr).toBe(0)
    const notesFile = join(work, "notes.md")
    await writeFile(notesFile, "Native browser authentication fixture\n")
    const candidateDirectory = join(work, "candidate")
    const identity = await Effect.runPromise(
      prepareRelease({
        candidateDirectory,
        repository: { owner: "browser-fixture", name: "native-authentication" },
        source: { commit: "a".repeat(40), tree: "b".repeat(40) },
        version: "3.2.1",
        title: "Browser fixture 3.2.1",
        notesFile,
        packages: [{ archiveFile, publicName: "package.tgz" }],
        npm: { authorization: { _tag: "TokenAuthorization", principal: "npm-publisher" } },
      }),
    )
    const planBytes = await readFile(join(candidateDirectory, "plan.json"), "utf8")
    const plan = Schema.decodeUnknownSync(Plan)(JSON.parse(planBytes))
    const publication = plan.operations.find(
      (operation) => operation.definitionId === "npm.publish",
    )!
    const gitExecutable = Bun.which("git")!
    const journal = join(work, "journal.git")
    const initialized = await run(
      [gitExecutable, "init", "--bare", "--quiet", journal],
      work,
      environment,
    )
    expect(initialized.exit, initialized.stderr).toBe(0)
    const journalOptions = {
      remote: pathToFileURL(journal).href,
      gitExecutable,
      principal: "github-publisher",
      scope: "release-journal",
      timeoutMilliseconds: 15000,
      maximumOutputBytes: 8 * 1024 * 1024,
    }
    let inspection = 0
    const readJournal = () =>
      Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const store = yield* openGitJournal({
              ...journalOptions,
              cacheDirectory: join(work, `inspection-${++inspection}`),
              credentials: () => Effect.succeed({ _tag: "Anonymous" as const }),
            })
            return yield* store.read(plan.journalId)
          }),
        ),
      )
    const phases: string[] = []
    peer = await startNativeReleasePeer({
      npmBrowserAuthentication: {
        packageName,
        loginToken,
        oneTimePassword,
        async beforeAuthenticatedRequest(phase) {
          const snapshot = await readJournal()
          const rejected = snapshot.events.filter(
            (event) => event.body._tag === "DispatchRejectedBeforeCommit",
          )
          expect(rejected).toHaveLength(1)
          expect(rejected[0]!.body).toMatchObject({
            proofVersion: "npm-authentication-rejection/1",
            proof: { status: 401, challenge: "otp" },
          })
          const starts = snapshot.events.filter(
            (event) =>
              event.body._tag === "DispatchStarted" &&
              event.body.operationId === publication.operationId,
          )
          expect(starts).toHaveLength(phase === "poll" ? 1 : 2)
          if (phase === "publish")
            expect(starts[1]!.body).toMatchObject({ basis: { _tag: "NonCommit" } })
          phases.push(phase)
        },
      },
    })
    let invocation = 0
    const invoke = async (observe = false) => {
      const inputFile = join(work, `input-${++invocation}.json`)
      await writeFile(
        inputFile,
        JSON.stringify({
          ...identity,
          authorize: true,
          authentication: {
            mode: "Local",
            npmConfigFile,
            githubTokenEnvironment: "FIXTURE_GITHUB_TOKEN",
          },
          journal: { ...journalOptions, cacheDirectory: join(work, `fresh-cache-${invocation}`) },
        }),
      )
      return run(
        [
          node,
          join(root, "packages/ts-release/dist/bin/ts-release.js"),
          ...(observe ? ["--observe"] : []),
          join(root, "apps/self-release/dist/application.js"),
          inputFile,
        ],
        work,
        { ...environment, ...peer!.environment, FIXTURE_GITHUB_TOKEN: githubToken },
      )
    }
    const before = await invoke(true)
    expect(before.exit, before.stderr).toBe(2)
    expect(peer.mutations).toHaveLength(0)
    expect(phases).toEqual([])
    expect(
      peer.requests
        .filter((request) => request.host === "registry.npmjs.org")
        .every((request) => request.method === "GET" && !request.authenticated),
    ).toBe(true)
    const completed = await invoke()
    expect(completed.exit, completed.stderr).toBe(0)
    const report = Schema.decodeUnknownSync(FinalizedReport)(JSON.parse(completed.stdout))
    expect(report.operations.every((operation) => operation.status === "Satisfied")).toBe(true)
    expect(
      report.operations.find((operation) => operation.operationId === publication.operationId),
    ).toMatchObject({ dispatches: 2, receipts: 1 })
    expect(phases).toEqual(["poll", "poll", "publish"])
    expect(completed.stderr).toContain(
      `Complete npm authentication: ${npmBrowserChallenge.authUrl}\n`,
    )
    const puts = peer.mutations.filter(
      (request) => request.host === "registry.npmjs.org" && request.method === "PUT",
    )
    expect(puts.map((request) => request.status)).toEqual([401, 200])
    expect(puts[0]!.body).toEqual(puts[1]!.body)
    const attachment = Object.values(
      JSON.parse(new TextDecoder().decode(puts[1]!.body))._attachments,
    )[0] as { data: string }
    expect(Buffer.from(attachment.data, "base64")).toEqual(await readFile(archiveFile))
    expect(
      peer.requests.every(
        (request) => !("authorization" in request.headers) && !("npm-otp" in request.headers),
      ),
    ).toBe(true)
    const pollRequests = peer.requests.filter(
      (request) => request.path === new URL(npmBrowserChallenge.doneUrl).pathname,
    )
    expect(pollRequests).toHaveLength(2)
    expect(pollRequests.every((request) => request.method === "GET" && request.authenticated)).toBe(
      true,
    )
    const completedMutations = peer.mutations.length
    const completedRequests = peer.requests.length
    const repeated = await invoke()
    expect(repeated.exit, repeated.stderr).toBe(0)
    const observed = await invoke(true)
    expect(observed.exit, observed.stderr).toBe(0)
    expect(peer.mutations).toHaveLength(completedMutations)
    expect(phases).toEqual(["poll", "poll", "publish"])
    expect(
      peer.requests
        .slice(completedRequests)
        .filter((request) => request.host === "registry.npmjs.org")
        .every((request) => request.method === "GET" && !request.authenticated),
    ).toBe(true)
    expect(repeated.stderr).not.toContain("Complete npm authentication:")
    expect(observed.stderr).not.toContain("Complete npm authentication:")
    const retained = [
      await readFile(join(candidateDirectory, "bundle.json"), "utf8"),
      planBytes,
      JSON.stringify(await readJournal()),
      before.stdout,
      completed.stdout,
      repeated.stdout,
      observed.stdout,
    ]
    for (const file of await readdir(join(candidateDirectory, "content")))
      retained.push(await readFile(join(candidateDirectory, "content", file), "utf8"))
    for (const secret of [
      loginToken,
      oneTimePassword,
      githubToken,
      ...Object.values(npmBrowserChallenge),
    ]) {
      for (const text of retained) expect(text).not.toContain(secret)
      if (secret !== npmBrowserChallenge.authUrl) expect(completed.stderr).not.toContain(secret)
    }
    expect(peer.failures).toEqual([])
  } finally {
    await peer?.close()
    await rm(work, { recursive: true, force: true })
  }
}, 300000)
