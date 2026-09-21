import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { once } from "node:events"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { createServer } from "node:https"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

export interface NativeRequest {
  readonly host: string
  readonly method: string
  readonly path: string
  readonly body: Uint8Array
  /** Credential values are deliberately omitted from the captured request. */
  readonly headers: Readonly<Record<string, string | string[] | undefined>>
  readonly authenticated: boolean
}
export interface NativeMutation extends NativeRequest {
  readonly subject: string
  readonly status: number
}
type Document = Record<string, unknown>
interface PackageState {
  name: string
  versions: Record<string, Document>
  tags: Record<string, string>
}
interface ReleaseState {
  document: Document
  assets: Map<string, { document: Document; bytes: Uint8Array }>
}
interface RepositoryState {
  refs: Map<string, Document>
  tags: Map<string, Document>
  releases: Map<number, ReleaseState>
}
interface Reply {
  status: number
  document?: unknown
  bytes?: Uint8Array
  subject?: string
  contentType?: string
}
const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex")
const object = (value: unknown): Document => {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected native object")
  return value as Document
}
const string = (value: unknown): string => {
  assert.equal(typeof value, "string", "Expected native string")
  return value as string
}
const json = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder().decode(bytes))

/** Native HTTPS protocol peer, not a replacement provider or transport. */
export async function startNativeReleasePeer() {
  const root = await mkdtemp(join(tmpdir(), "ts-release-native-peer-"))
  const certificate = join(root, "certificate.pem")
  const key = join(root, "key.pem")
  const preload = fileURLToPath(new URL("./native-routing.cjs", import.meta.url))
  const generated = Bun.spawn(
    [
      "openssl",
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-sha256",
      "-days",
      "1",
      "-keyout",
      key,
      "-out",
      certificate,
      "-subj",
      "/CN=ts-release fixture",
      "-addext",
      "subjectAltName=DNS:registry.npmjs.org,DNS:api.github.com,DNS:uploads.github.com",
    ],
    { stdout: "pipe", stderr: "pipe" },
  )
  const generatedError = new Response(generated.stderr).text()
  if ((await generated.exited) !== 0) {
    await rm(root, { recursive: true, force: true })
    throw new Error(`Fixture certificate generation failed: ${await generatedError}`)
  }
  const requests: NativeRequest[] = [],
    mutations: NativeMutation[] = [],
    failures: string[] = []
  const hidden = new Set<string>()
  const packages = new Map<string, PackageState>(),
    repositories = new Map<string, RepositoryState>()
  let nextRelease = 731,
    nextAsset = 1001
  let pause:
    | {
        predicate: (mutation: NativeMutation) => boolean
        notify: (mutation: NativeMutation) => void
        gate: Promise<void>
        resume: () => void
        used: boolean
      }
    | undefined
  const visible = (subject: string) => !hidden.has(subject)

  const npm = (request: NativeRequest, url: URL): Reply => {
    const tagRoute = /^\/-\/package\/(.+)\/dist-tags\/([^/]+)$/u.exec(url.pathname)
    if (tagRoute) {
      const name = decodeURIComponent(tagRoute[1]!),
        tag = decodeURIComponent(tagRoute[2]!)
      const state = packages.get(name)
      if (request.method === "GET")
        return state?.tags[tag] ? { status: 200, document: state.tags[tag] } : { status: 404 }
      assert.equal(request.method, "PUT")
      assert.ok(request.authenticated, "npm mutation requires authentication")
      const version = string(json(request.body))
      assert.ok(state?.versions[version], "dist-tag target must exist")
      state.tags[tag] = version
      return { status: 201, document: {}, subject: `npm:${name}@${version}:tag:${tag}` }
    }
    const name = decodeURIComponent(url.pathname.slice(1))
    if (request.method === "GET") {
      const state = packages.get(name)
      if (!state) return { status: 404 }
      const versions = Object.fromEntries(
        Object.entries(state.versions).filter(([version]) => visible(`npm:${name}@${version}`)),
      )
      if (Object.keys(versions).length === 0) return { status: 404 }
      return {
        status: 200,
        document: {
          name,
          versions,
          "dist-tags": Object.fromEntries(
            Object.entries(state.tags).filter(([, version]) => version in versions),
          ),
        },
      }
    }
    assert.equal(request.method, "PUT")
    assert.ok(request.authenticated, "npm mutation requires authentication")
    const document = object(json(request.body))
    assert.equal(document.name, name)
    const versions = object(document.versions),
      attachments = object(document._attachments)
    assert.equal(Object.keys(versions).length, 1)
    const [version, metadata] = Object.entries(versions)[0]!
    const native = object(metadata),
      dist = object(native.dist)
    const attachment = object(Object.values(attachments)[0])
    const bytes = Buffer.from(string(attachment.data), "base64")
    assert.equal(attachment.length, bytes.length)
    assert.equal(native.name, name)
    assert.equal(native.version, version)
    assert.equal(dist.integrity, `sha512-${createHash("sha512").update(bytes).digest("base64")}`)
    assert.equal(dist.shasum, createHash("sha1").update(bytes).digest("hex"))
    const state = packages.get(name) ?? { name, versions: {}, tags: {} }
    if (state.versions[version])
      return {
        status: 409,
        document: { error: "version exists" },
        subject: `npm:${name}@${version}`,
      }
    state.versions[version] = native
    for (const [tag, selected] of Object.entries(object(document["dist-tags"])))
      state.tags[tag] = string(selected)
    packages.set(name, state)
    return { status: 201, document: { ok: true }, subject: `npm:${name}@${version}` }
  }

  const github = (request: NativeRequest, url: URL): Reply => {
    assert.ok(request.authenticated, "GitHub routes require authentication")
    assert.equal(request.headers["user-agent"], "ts-release")
    assert.equal(request.headers["x-github-api-version"], "2022-11-28")
    const route = /^\/repos\/([^/]+)\/([^/]+)(.*)$/u.exec(url.pathname)
    assert.ok(route, "Unknown GitHub route")
    const repository = `${route[1]}/${route[2]}`,
      path = route[3]!
    const base = `https://api.github.com/repos/${repository}`
    const state = repositories.get(repository) ?? {
      refs: new Map<string, Document>(),
      tags: new Map<string, Document>(),
      releases: new Map<number, ReleaseState>(),
    }
    repositories.set(repository, state)
    const releaseSubject = (tag: string) => `github:${repository}:release:${tag}`
    const assetSubject = (tag: string, name: string) => `github:${repository}:asset:${tag}:${name}`
    const rendered = (release: ReleaseState) => ({
      ...release.document,
      assets: [...release.assets.values()]
        .filter((asset) =>
          visible(assetSubject(string(release.document.tag_name), string(asset.document.name))),
        )
        .map((asset) => asset.document),
    })
    const releaseRoute = /^\/releases\/(\d+)(\/assets)?$/u.exec(path)
    const release = releaseRoute ? state.releases.get(Number(releaseRoute[1])) : undefined
    if (request.method === "GET") {
      assert.equal(request.host, "api.github.com")
      if (path === "")
        return {
          status: 200,
          document: { full_name: repository, url: base, permissions: { push: true } },
        }
      if (path.startsWith("/git/ref/tags/")) {
        const tag = decodeURIComponent(path.slice("/git/ref/tags/".length))
        const ref = state.refs.get(tag)
        return ref && visible(`github:${repository}:tag:${tag}`)
          ? { status: 200, document: ref }
          : { status: 404 }
      }
      if (path.startsWith("/git/tags/")) {
        const tag = state.tags.get(path.slice("/git/tags/".length))
        return tag ? { status: 200, document: tag } : { status: 404 }
      }
      if (path === "/releases")
        return {
          status: 200,
          document: [...state.releases.values()]
            .filter((entry) => visible(releaseSubject(string(entry.document.tag_name))))
            .map(rendered),
        }
      if (release && visible(releaseSubject(string(release.document.tag_name))))
        return {
          status: 200,
          document: releaseRoute![2] ? rendered(release).assets : rendered(release),
        }
      const assetRoute = /^\/releases\/assets\/(\d+)$/u.exec(path)
      if (assetRoute)
        for (const candidate of state.releases.values())
          for (const asset of candidate.assets.values())
            if (
              asset.document.id === Number(assetRoute[1]) &&
              visible(
                assetSubject(string(candidate.document.tag_name), string(asset.document.name)),
              )
            )
              return { status: 200, bytes: asset.bytes, contentType: "application/octet-stream" }
      return { status: 404 }
    }
    if (request.host === "uploads.github.com") {
      assert.equal(request.method, "POST")
      assert.ok(release && releaseRoute![2], "Asset parent must exist")
      assert.equal(release.document.draft, true, "Asset parent must still be a draft")
      const name = url.searchParams.get("name")
      assert.ok(name, "Asset name is required")
      if (release.assets.has(name))
        return {
          status: 422,
          document: { message: "asset exists" },
          subject: assetSubject(string(release.document.tag_name), name),
        }
      const id = nextAsset++,
        tag = string(release.document.tag_name)
      const document = {
        id,
        name,
        state: "uploaded",
        content_type: request.headers["content-type"],
        size: request.body.length,
        digest: `sha256:${sha256(request.body)}`,
        url: `${base}/releases/assets/${id}`,
        browser_download_url: `https://github.com/${repository}/releases/download/${tag}/${encodeURIComponent(name)}`,
      }
      release.assets.set(name, { document, bytes: request.body.slice() })
      return { status: 201, document, subject: assetSubject(tag, name) }
    }
    assert.equal(request.host, "api.github.com")
    const input = object(json(request.body))
    if (path === "/git/tags" && request.method === "POST") {
      const sha = createHash("sha1").update(request.body).digest("hex")
      const document = {
        sha,
        tag: input.tag,
        message: input.message,
        tagger: input.tagger,
        url: `${base}/git/tags/${sha}`,
        object: { sha: input.object, type: "commit", url: `${base}/git/commits/${input.object}` },
      }
      state.tags.set(sha, document)
      return { status: 201, document, subject: `github:${repository}:tag-object:${input.tag}` }
    }
    if (path === "/git/refs" && request.method === "POST") {
      const ref = string(input.ref)
      assert.ok(ref.startsWith("refs/tags/"))
      const tag = ref.slice("refs/tags/".length),
        sha = string(input.sha)
      if (state.refs.has(tag))
        return {
          status: 422,
          document: { message: "ref exists" },
          subject: `github:${repository}:tag:${tag}`,
        }
      const type = state.tags.has(sha) ? "tag" : "commit"
      const document = {
        ref,
        url: `${base}/git/${ref}`,
        object: { sha, type, url: `${base}/git/${type === "tag" ? "tags" : "commits"}/${sha}` },
      }
      state.refs.set(tag, document)
      return { status: 201, document, subject: `github:${repository}:tag:${tag}` }
    }
    if (path === "/releases" && request.method === "POST") {
      const tag = string(input.tag_name)
      assert.ok(state.refs.has(tag), "Release tag must exist")
      assert.equal(input.draft, true)
      const id = nextRelease++
      const document = {
        id,
        ...input,
        url: `${base}/releases/${id}`,
        assets_url: `${base}/releases/${id}/assets`,
        upload_url: `https://uploads.github.com/repos/${repository}/releases/${id}/assets{?name,label}`,
      }
      state.releases.set(id, { document, assets: new Map() })
      return { status: 201, document, subject: releaseSubject(tag) }
    }
    if (release && !releaseRoute![2] && request.method === "PATCH") {
      assert.deepEqual(input, { draft: false })
      release.document.draft = false
      return {
        status: 200,
        document: rendered(release),
        subject: `${releaseSubject(string(release.document.tag_name))}:publish`,
      }
    }
    throw new Error("Unexpected native GitHub mutation")
  }

  const server = createServer(
    { key: await readFile(key), cert: await readFile(certificate) },
    async (incoming, response) => {
      try {
        const chunks: Buffer[] = []
        for await (const chunk of incoming) chunks.push(Buffer.from(chunk))
        const host = incoming.headers.host ?? ""
        assert.ok(["registry.npmjs.org", "api.github.com", "uploads.github.com"].includes(host))
        const authorization = incoming.headers.authorization
        const headers = Object.fromEntries(
          Object.entries(incoming.headers).filter(
            ([name]) => !/^(authorization|cookie|x-api-key|x-auth-token)$/u.test(name),
          ),
        )
        const request: NativeRequest = {
          host,
          method: incoming.method ?? "",
          path: incoming.url ?? "",
          headers,
          body: new Uint8Array(Buffer.concat(chunks)),
          authenticated: typeof authorization === "string" && authorization.length > 0,
        }
        requests.push(request)
        const url = new URL(request.path, `https://${host}`)
        const reply = host === "registry.npmjs.org" ? npm(request, url) : github(request, url)
        if (reply.subject) {
          const mutation = Object.freeze({
            ...request,
            subject: reply.subject,
            status: reply.status,
          })
          mutations.push(mutation)
          if (
            pause &&
            !pause.used &&
            reply.status >= 200 &&
            reply.status < 300 &&
            pause.predicate(mutation)
          ) {
            pause.used = true
            pause.notify(mutation)
            await pause.gate
          }
        }
        response.writeHead(reply.status, {
          "content-type": reply.contentType ?? "application/json",
        })
        response.end(reply.bytes ?? JSON.stringify(reply.document ?? {}))
      } catch (cause) {
        // Fixed diagnostics never retain credentials or provider body contents.
        failures.push(cause instanceof Error ? cause.name : "unknown")
        if (!response.headersSent) response.writeHead(500, { "content-type": "application/json" })
        response.end('{"error":"native fixture request rejected"}')
      }
    },
  )
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  assert.ok(address && typeof address !== "string")
  return {
    root,
    preload,
    certificate,
    requests,
    mutations,
    failures,
    environment: {
      NODE_OPTIONS: `--require=${preload}`,
      NODE_EXTRA_CA_CERTS: certificate,
      TS_RELEASE_NATIVE_PEER_PORT: String(address.port),
    },
    hide(subject: string) {
      hidden.add(subject)
    },
    reveal(subject: string) {
      hidden.delete(subject)
    },
    pauseAfterCommit(predicate: (mutation: NativeMutation) => boolean) {
      assert.ok(!pause, "Resume the existing pause before arming another")
      let notify!: (mutation: NativeMutation) => void, resume!: () => void
      const committed = new Promise<NativeMutation>((resolve) => {
        notify = resolve
      })
      const gate = new Promise<void>((resolve) => {
        resume = resolve
      })
      const release = () => {
        resume()
        if (pause?.resume === release) pause = undefined
      }
      pause = { predicate, notify, gate, resume: release, used: false }
      return { committed, resume: release }
    },
    async close() {
      pause?.resume()
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((cause) =>
          cause && (cause as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING"
            ? reject(cause)
            : resolve(),
        ),
      )
      await rm(root, { recursive: true, force: true })
    },
  }
}
