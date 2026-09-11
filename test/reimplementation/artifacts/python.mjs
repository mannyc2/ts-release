import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { Effect } from "effect"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Artifact from "effect-build/Artifact"
import * as Python from "effect-build-python"
import { adoptFile, adoptTree } from "@mannyc1/ts-release/effect-build"
import { encodeBundle, finalize, loadBundle } from "@mannyc1/ts-release/bundle"
import { fileContentOwner } from "@mannyc1/ts-release/node"

const work = await mkdtemp("/tmp/ts-release-producer-python-")
const producer = join(work, "producer"),
  delivery = join(work, "delivery")
await mkdir(producer)
await mkdir(delivery)
const fixtures = fileURLToPath(new URL("./fixtures/python/", import.meta.url))
const python =
  process.env.TS_RELEASE_PRODUCER_PYTHON ?? "/tmp/ts-release-warehouse-native-venv/bin/python"
const uv = join(process.env.TS_RELEASE_PRODUCER_TOOLS ?? "/tmp/ts-release-native-producers", "uv")
const owner = fileContentOwner(join(work, "owned"))
const producedBy = { name: "effect-build-pinned-python-fixture", version: "fixture" }
const run = (effect) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(Python.layer({ executable: uv })),
      Effect.provide(NodeServices.layer),
    ),
  )
const execute = promisify(execFile),
  records = [],
  checks = [],
  sources = []
const check = (label, actual, expected) => {
  assert.deepEqual(actual, expected, label)
  checks.push(label)
}
for (const [fixture, module, backend, distribution] of [
  ["uv-build", "effect_build_uv_fixture", "uv_build", "effect-build-uv-fixture"],
  ["poetry-core", "effect_build_poetry_fixture", "poetry-core", "effect-build-poetry-fixture"],
]) {
  const project = join(producer, fixture + "-source")
  await cp(join(fixtures, fixture), project, { recursive: true, force: false })
  const source = await run(Artifact.directory(project, producedBy))
  sources.push(await run(adoptTree(owner, fixture + "-source", source)))
  const artifacts = await run(Python.build({ project, outdir: join(producer, fixture) }))
  check(
    `${fixture} exact native uv`,
    [artifacts.wheel.producedBy.name, artifacts.wheel.producedBy.version],
    ["uv", "0.12.0"],
  )
  check(`${fixture} wheel/sdist producer`, artifacts.sdist.producedBy, artifacts.wheel.producedBy)
  for (const [kind, native] of Object.entries(artifacts)) {
    const file = await run(adoptFile(owner, basename(native.path), native))
    check(
      `${fixture}/${kind} exact owned size and digest`,
      { ...file.content },
      { bytes: native.bytes, sha256: native.sha256 },
    )
    records.push({ fixture, module, backend, distribution, kind, native, file })
  }
}
const bundle = await run(finalize([...sources, ...records.map((row) => row.file)]))
await writeFile(join(work, "bundle.json"), encodeBundle(bundle))
await rm(producer, { recursive: true })
const reopened = fileContentOwner(join(work, "owned"))
check(
  "all owned Python files and exact source trees survive producer deletion",
  (await run(loadBundle(reopened, await readFile(join(work, "bundle.json"))))).artifacts,
  bundle.artifacts,
)
for (const row of records)
  await writeFile(join(delivery, row.file.logicalName), await run(reopened.read(row.file.content)))
const consumers = []
for (const fixture of ["uv-build", "poetry-core"]) {
  const rows = records.filter((row) => row.fixture === fixture),
    row = rows[0]
  const result = await execute(
    python,
    [
      join(fixtures, "assert-python-artifacts.py"),
      "--wheel",
      join(delivery, rows.find((item) => item.kind === "wheel").file.logicalName),
      "--sdist",
      join(delivery, rows.find((item) => item.kind === "sdist").file.logicalName),
      "--module",
      row.module,
      "--backend",
      row.backend,
      "--distribution",
      row.distribution,
      "--version",
      "1.0.0",
      "--workdir",
      join(work, `${fixture}-consumers`),
    ],
    {
      timeout: 180_000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, PYTHONUTF8: "1", PYTHONPATH: "", PYTHONNOUSERSITE: "1" },
    },
  )
  for (const kind of ["wheel", "sdist"])
    check(
      `${fixture} clean ${kind} install/import/metadata`,
      result.stdout.includes(`${row.module}:${row.backend}:${kind}:ok`),
      true,
    )
  await writeFile(join(work, fixture + "-consumer.log"), result.stdout + result.stderr)
  consumers.push({ fixture, log: fixture + "-consumer.log", wheel: "passed", sdist: "passed" })
}
await writeFile(
  join(work, "evidence.json"),
  JSON.stringify(
    {
      format: "ts-release/native-producer-python/2",
      work,
      runtime: process.version,
      bun: process.versions.bun ?? null,
      checks,
      records,
      consumers,
      producerDeleted: true,
      limits: [
        "Two pure-Python backends; this is not native extension or fresh packed acceptance.",
      ],
    },
    null,
    2,
  ) + "\n",
)
console.log(
  JSON.stringify({
    work,
    checks: checks.length,
    artifacts: records.length,
    sourceTrees: sources.length,
    consumers: 4,
  }),
)
