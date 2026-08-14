import * as Effect from "effect/Effect"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { basename, dirname, join, relative, resolve } from "node:path"
import { createHash } from "node:crypto"
import { makeReleaseApi } from "../../../src/api/api.js"
import { inspectPythonDistribution } from "../../../src/model/python-distribution.js"
import { makeNodeReleaseLayer } from "../../../src/platform/node.js"
import { encodeCompletePreparedReleaseRef } from "../../../src/release/prepared-ref.js"
import { makeLocalPreparedReleaseStore } from "../../../src/release/prepared-store.js"

const root = realpathSync(process.cwd())
const configPath = resolve(root, "apps/release-ts/pypi-release.config.json")
const output = resolve(root, process.argv[2] ?? ".release/pypi-dist")
const storeDirectory = resolve(root, ".release/ts-release/pypi-prepared")
const fromRoot = relative(root, output)
if (fromRoot === "" || fromRoot === ".." || fromRoot.startsWith("../")) {
  throw new Error("PyPI distribution output must be a workspace-relative child directory.")
}
if (existsSync(output)) throw new Error(`PyPI distribution output already exists: ${output}`)

const parent = dirname(output)
mkdirSync(parent, { recursive: true })
const staging = mkdtempSync(join(parent, ".pypi-dist-"))
const store = makeLocalPreparedReleaseStore(storeDirectory)
const api = makeReleaseApi(makeNodeReleaseLayer(store))

try {
  const config = JSON.parse(readFileSync(configPath, "utf8")) as unknown
  const prepared = await api.prepare({ config, workspace: root })
  if (prepared.scheme !== "local") throw new Error("PyPI build must produce a local prepared reference.")
  const bundle = await Effect.runPromise(store.load(prepared))
  const publication = bundle.manifest.publications.find((item) => item._tag === "PreparedPyPiPublication")
  if (publication === undefined) throw new Error("Prepared bundle has no PyPI publication.")
  if (publication.authentication.strategy !== "trusted-publishing" ||
      publication.authentication.action !== "pypa/gh-action-pypi-publish@release/v1") {
    throw new Error("Prepared PyPI publication is not bound to the official external PyPA Action.")
  }
  const files = publication.files.map((file) => {
    const artifact = bundle.manifest.artifacts.find((item) => item.id.toString() === file.artifactId.toString())
    if (artifact === undefined) throw new Error(`Prepared PyPI file ${file.filename} has no artifact.`)
    const filename = file.filename.toString()
    if (basename(filename) !== filename || !filename.endsWith(".whl")) {
      throw new Error(`Prepared PyPI filename is not one exact wheel basename: ${filename}`)
    }
    const bytes = new Uint8Array(readFileSync(join(bundle.directory, "blobs", artifact.digest.hex)))
    if (bytes.length !== artifact.size || createHash("sha256").update(bytes).digest("hex") !== artifact.digest.hex) {
      throw new Error(`Prepared PyPI file ${filename} disagrees with its durable artifact digest.`)
    }
    inspectPythonDistribution(filename, bytes, publication.project.toString(), publication.version.toString())
    writeFileSync(join(staging, filename), bytes, { mode: 0o644, flag: "wx" })
    return { filename, bytes: bytes.length, sha256: artifact.digest.hex }
  })
  if (files.length !== 4 || new Set(files.map(({ filename }) => filename)).size !== 4) {
    throw new Error(`Prepared PyPI publication must contain exactly four distinct wheels, got ${files.length}.`)
  }
  renameSync(staging, output)
  console.log(JSON.stringify({
    schemaVersion: "ts-release/pypi-distribution-set/v1",
    prepared: encodeCompletePreparedReleaseRef(prepared),
    project: publication.project,
    version: publication.version,
    files
  }))
} finally {
  await api.dispose()
  if (existsSync(staging)) rmSync(staging, { recursive: true, force: true })
}
