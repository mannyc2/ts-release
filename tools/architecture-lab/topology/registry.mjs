import { createServer } from "node:http"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"

const entries = JSON.parse(readFileSync(process.argv[2], "utf8"))
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, "http://registry").pathname.slice(1))
  const entry = entries.find((item) => item.name === path || `tarball/${item.sha256}.tgz` === path)
  if (entry === undefined) { response.writeHead(404); response.end("unavailable research coordinate"); return }
  const tarball = readFileSync(entry.path)
  if (path.startsWith("tarball/")) { response.writeHead(200, { "content-type": "application/octet-stream" }); response.end(tarball); return }
  const versions = Object.fromEntries(entries.filter(item=>item.name===path).map(item=> {
    const bytes=readFileSync(item.path)
    return [item.version,{ ...item.manifest, dist: {
      tarball: `http://127.0.0.1:${server.address().port}/tarball/${item.sha256}.tgz`,
      integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
      shasum: createHash("sha1").update(bytes).digest("hex")
    } }]
  }))
  response.writeHead(200, { "content-type": "application/json" })
  response.end(JSON.stringify({ name: entry.name, "dist-tags": { latest: entry.version }, versions }))
})
server.listen(0, "127.0.0.1", () => process.stdout.write(`${server.address().port}\n`))
process.on("SIGTERM", () => server.close(() => process.exit(0)))
