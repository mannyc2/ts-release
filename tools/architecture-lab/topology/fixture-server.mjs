import { createServer } from "node:http"
import { createHash } from "node:crypto"

const npm = new Map()
const python = new Map()
const external = new Map()
const catalogs = new Map()
const tags = new Map()
const calls = []
const digest = (body, algorithm = "sha256", encoding = "hex") => createHash(algorithm).update(body).digest(encoding)
let rejectNext = false
let loseNext = false
let holdNext = false
const held = []
const server = createServer(async (request, response) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const bytes = Buffer.concat(chunks)
  const path = new URL(request.url, "http://fixture").pathname
  const json = (status, value, headers = {}) => {
    response.writeHead(status, { "content-type": "application/json", ...headers })
    response.end(JSON.stringify(value))
  }
  if (path === "/__state") return json(200, { calls, held, npm: [...npm.keys()], python: [...python.keys()], external: [...external.entries()], catalogs: [...catalogs.entries()], tags: [...tags.entries()] })
  if (path === "/__reject-next") { rejectNext = true; return json(200, {}) }
  if (path === "/__lose-next") { loseNext = true; return json(200, {}) }
  if (path === "/__hold-next") { holdNext = true; return json(200, {}) }
  try {
    if (request.method === "PUT" || request.method === "POST") {
      calls.push({ method: request.method, path, bodySha256: digest(bytes), byteLength: bytes.length })
      if (rejectNext) { rejectNext = false; return json(422, { error: "rejected before commit" }, { "x-fixture-no-commit": "true" }) }
      if (path.endsWith("/legacy/")) {
        const req = new Request("http://fixture/legacy/", { method: "POST", headers: request.headers, body: bytes })
        const form = await req.formData()
        const file = form.get("content")
        if (!(file instanceof File) || form.get(":action") !== "file_upload" || form.get("protocol_version") !== "1") throw Error("invalid Warehouse multipart request")
        const fileBytes = Buffer.from(await file.arrayBuffer())
        const sha256 = digest(fileBytes)
        if (sha256 !== form.get("sha256_digest")) throw Error("wrong Warehouse digest")
        const key = `${form.get("name")}/${form.get("version")}`
        const entries = python.get(key) ?? []
        if (entries.some(({ filename }) => filename === file.name)) return json(400, { error: "file already exists" })
        entries.push({ filename: file.name, digests: { sha256 }, size: fileBytes.length })
        python.set(key, entries)
      } else if (path.startsWith("/catalog/")) {
        const value = JSON.parse(bytes)
        if (!/^[0-9a-f]{64}$/.test(value.digest)) throw Error("invalid catalog digest")
        catalogs.set(path, value)
      } else if (path.startsWith("/-/package/")) {
        const segments = path.split("/")
        const name = decodeURIComponent(segments[3])
        const tag = decodeURIComponent(segments[5])
        const version = JSON.parse(bytes)
        if (!npm.has(`|${name}/${version}`)) throw Error("tag target version absent")
        tags.set(name, { ...(tags.get(name) ?? {}), [tag]: version })
      } else if (path.includes("/external/")) {
        const value = JSON.parse(bytes)
        if (value.instanceId !== decodeURIComponent(path.split("/").at(-1))) throw Error("wrong external instance")
        external.set(value.instanceId, value.value)
      } else {
        const body = JSON.parse(bytes)
        const versions = Object.keys(body.versions ?? {})
        const attachments = Object.entries(body._attachments ?? {})
        if (versions.length !== 1 || attachments.length !== 1 || request.method !== "PUT") throw Error("invalid npm publish shape")
        const version = versions[0]
        const metadata = body.versions[version]
        const [filename, attachment] = attachments[0]
        const tarball = Buffer.from(attachment.data, "base64")
        if (attachment.length !== tarball.length || metadata.dist.integrity !== `sha512-${digest(tarball, "sha512", "base64")}` || !metadata.dist.tarball.endsWith(filename)) throw Error("wrong npm bytes/integrity")
        if (!Object.values(body["dist-tags"]).includes(version)) throw Error("initial tag missing")
        const registryPrefix=path.slice(0,path.lastIndexOf("/"))
        const key = `${registryPrefix}|${body.name}/${version}`
        if (npm.has(key)) return json(409, { error: "version already exists" })
        npm.set(key, metadata)
        tags.set(body.name, { ...(tags.get(body.name) ?? {}), ...body["dist-tags"] })
      }
      if (loseNext) { loseNext = false; request.socket.destroy(); return }
      if (holdNext) { holdNext=false;const record={path,closed:false};held.push(record);request.socket.once("close",()=>{record.closed=true});return }
      return json(201, { ok: true, id: calls.length })
    }
    if (path.startsWith("/catalog/")) return catalogs.has(path) ? json(200, catalogs.get(path)) : json(404, {})
    if (path.startsWith("/-/package/")) {
      const name = decodeURIComponent(path.split("/")[3])
      return tags.has(name) ? json(200, tags.get(name)) : json(404, {})
    }
    if (path.includes("/pypi/") && path.endsWith("/json")) {
      const key = path.split("/pypi/")[1].replace(/\/json$/, "")
      return python.has(key) ? json(200, { urls: python.get(key) }) : json(404, { error: "absent" })
    }
    const parts = path.split("/").filter(Boolean)
    const registryPrefix=parts.length>2?`/${parts.slice(0,-2).join("/")}`:""
    const key = `${registryPrefix}|${decodeURIComponent(parts.at(-2))}/${parts.at(-1)}`
    return npm.has(key) ? json(200, npm.get(key)) : json(404, { error: "absent" })
  } catch (error) {
    return json(422, { error: String(error) }, { "x-fixture-no-commit": "true" })
  }
})
server.listen(0, "127.0.0.1", () => process.stdout.write(`${JSON.stringify({ port: server.address().port })}\n`))
process.on("SIGTERM", () => server.close(() => process.exit(0)))
