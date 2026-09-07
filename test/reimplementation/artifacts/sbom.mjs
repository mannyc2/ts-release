import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { promisify } from "node:util"
import { Effect, FileSystem, Schema } from "effect"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Artifact from "effect-build/Artifact"
import * as File from "effect-build/Author/File"
import * as Tree from "effect-build/Author/Tree"
import * as Sbom from "effect-build-sbom/Generate"
import { adoptFile, adoptTree } from "@mannyc1/ts-release/effect-build"
import { encodeBundle, finalize, loadBundle } from "@mannyc1/ts-release/bundle"
import { fileContentOwner, nodeDirectoryReader } from "@mannyc1/ts-release/node"

const work = await mkdtemp("/tmp/ts-release-producer-sbom-")
const producer = join(work, "producer"),
  delivery = join(work, "delivery")
await mkdir(producer)
await mkdir(delivery)
const tools = process.env.TS_RELEASE_PRODUCER_TOOLS ?? "/tmp/ts-release-native-producers"
const node = process.env.TS_RELEASE_HTTP_PEER_NODE
assert(node, "Explicit native Node bounded directory reader is required")
const owner = fileContentOwner(join(work, "owned"), nodeDirectoryReader(node))
const run = (effect) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(Sbom.layer({ executable: join(tools, "syft") })),
      Effect.provide(NodeServices.layer),
    ),
  )
const records = [],
  checks = []
const check = (name, actual, expected) => {
  assert.deepEqual(actual, expected, name)
  checks.push(name)
}
const snapshot = await run(
  Tree.publish(
    {
      outdir: join(producer, "subject"),
      observation: "hashed",
      provenance: Artifact.intrinsicProvenance("effect-build-pinned-sbom-fixture"),
    },
    (candidate) =>
      Effect.tryPromise(async () => {
        for (const file of ["package.json", "package-lock.json"])
          await copyFile(
            join(import.meta.dirname, "fixtures/sbom-subject", file),
            join(candidate, file),
          )
      }),
  ),
)
const source = await run(adoptTree(owner, "subject", snapshot))
const lockfile = await run(
  File.publish(
    {
      destination: join(producer, "package-lock.json"),
      observation: "hashed",
      provenance: snapshot.provenance,
    },
    (candidate) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        yield* fs.copyFile(join(snapshot.root, "package-lock.json"), candidate)
      }),
  ),
)
for (const [name, subject, generate, schema] of [
  [
    "directory.spdx.json",
    new Sbom.DirectorySubject({ snapshot }),
    Sbom.generateSpdxJson,
    Sbom.SpdxJsonDocument,
  ],
  [
    "directory.cdx.json",
    new Sbom.DirectorySubject({ snapshot }),
    Sbom.generateCycloneDxJson,
    Sbom.CycloneDxJsonDocument,
  ],
  [
    "file.spdx.json",
    new Sbom.FileSubject({ artifact: lockfile }),
    Sbom.generateSpdxJson,
    Sbom.SpdxJsonDocument,
  ],
]) {
  const native = await run(
    generate(new Sbom.GenerateInput({ subject, outfile: join(producer, name) })),
  )
  check(
    `${name} exact Syft version`,
    native.provenance.participants.map(({ name, version }) => ({ name, version })),
    [{ name: "syft", version: "1.50.0" }],
  )
  const file = await run(adoptFile(owner, name, native))
  const bytes = await run(owner.read(file.content))
  const raw = JSON.parse(new TextDecoder().decode(bytes))
  const document = Schema.decodeUnknownSync(schema)(raw)
  const cdx = name.includes("cdx")
  check(
    `${name} native schema version`,
    cdx ? document.specVersion : document.spdxVersion,
    cdx ? "1.6" : "SPDX-2.3",
  )
  check(
    `${name} exact fixture dependency`,
    cdx
      ? document.components.some(
          (component) => component.name === "left-pad" && component.version === "1.3.0",
        )
      : document.packages.some(
          (component) => component.name === "left-pad" && component.versionInfo === "1.3.0",
        ),
    true,
  )
  check(
    `${name} independent document identity`,
    cdx
      ? raw.bomFormat === "CycloneDX" && typeof raw.version === "number"
      : raw.dataLicense === "CC0-1.0" && raw.SPDXID === "SPDXRef-DOCUMENT",
    true,
  )
  if (name.startsWith("file"))
    check("file subject retains extension-sensitive cataloging", document.name, "package-lock.json")
  records.push({ name, native, file })
}
const bundle = await run(finalize([source, ...records.map((record) => record.file)]))
await writeFile(join(work, "bundle.json"), encodeBundle(bundle))
await rm(producer, { recursive: true })
const reopened = fileContentOwner(join(work, "owned"))
check(
  "SBOM files and source tree survive producer deletion",
  (await run(loadBundle(reopened, await readFile(join(work, "bundle.json"))))).artifacts,
  bundle.artifacts,
)
for (const { file } of records)
  await writeFile(join(delivery, file.logicalName), await run(reopened.read(file.content)))
for (const [name, field] of [
  ["spdx", "packages"],
  ["cdx", "version"],
]) {
  const document = JSON.parse(await readFile(join(delivery, `directory.${name}.json`), "utf8"))
  await writeFile(
    join(delivery, `invalid.${name}.json`),
    JSON.stringify({ ...document, [field]: "invalid" }),
  )
}
const image = "debian@sha256:88200866dfff7ea7f5cbcb6ec7c8a701889efe6fe859fe64d6990e4b07ea4171"
const oracle = `set -eu
utility=/sbom-utility
test "$($utility version --quiet)" = 'sbom-utility version v0.19.2'
for file in directory.spdx.json directory.cdx.json file.spdx.json; do
  $utility validate --quiet --input-file "/documents/$file"
  printf '%s:valid\\n' "$file"
done
for file in invalid.spdx.json invalid.cdx.json; do
  set +e
  $utility validate --quiet --input-file "/documents/$file" > /tmp/invalid.log 2>&1
  status=$?
  set -e
  test "$status" -eq 2
  test -s /tmp/invalid.log
  cat /tmp/invalid.log
  printf '%s:rejected-exit-2\\n' "$file"
done`
const { stdout, stderr } = await promisify(execFile)(
  "/usr/bin/docker",
  [
    "run",
    "--rm",
    "--network",
    "none",
    "--mount",
    `type=bind,src=${join(tools, "sbom-utility")},dst=/sbom-utility,readonly`,
    "--mount",
    `type=bind,src=${delivery},dst=/documents,readonly`,
    image,
    "sh",
    "-ec",
    oracle,
  ],
  { encoding: "utf8", timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
)
for (const file of ["directory.spdx.json", "directory.cdx.json", "file.spdx.json"])
  check(`${file} independent native full schema validation`, stdout.includes(file + ":valid"), true)
for (const file of ["invalid.spdx.json", "invalid.cdx.json"])
  check(
    `${file} independent negative schema rejection`,
    stdout.includes(file + ":rejected-exit-2"),
    true,
  )
await writeFile(join(work, "schema-consumer.log"), stdout + stderr)
await writeFile(
  join(work, "evidence.json"),
  JSON.stringify(
    {
      format: "ts-release/native-producer-sbom/1",
      work,
      runtime: process.version,
      bun: process.versions.bun ?? null,
      records,
      checks,
      nativeSchemaConsumer: { image, network: "none", utility: "0.19.2" },
      producerDeleted: true,
      limits: [
        "Exact fixture dependency documents; this does not certify the final release SBOM or fresh packed consumers.",
      ],
    },
    null,
    2,
  ) + "\n",
)
console.log(
  JSON.stringify({ work, checks: checks.length, documents: records.length, nativeSchemaChecks: 5 }),
)
