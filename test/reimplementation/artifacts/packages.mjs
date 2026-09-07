import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { promisify } from "node:util"
import { deflateSync } from "node:zlib"
import { Effect, FileSystem } from "effect"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Artifact from "effect-build/Artifact"
import * as File from "effect-build/Author/File"
import * as Nfpm from "effect-build-nfpm/Package"
import { adoptFile } from "@mannyc1/ts-release/effect-build"
import { encodeBundle, finalize, loadBundle } from "@mannyc1/ts-release/bundle"
import { fileContentOwner } from "@mannyc1/ts-release/node"

const work = await mkdtemp("/tmp/ts-release-producer-packages-")
const producer = join(work, "producer"),
  delivery = join(work, "delivery")
await mkdir(producer)
await mkdir(delivery)
const tools = process.env.TS_RELEASE_PRODUCER_TOOLS ?? "/tmp/ts-release-native-producers"
const executableWork = process.env.TS_RELEASE_EXECUTABLE_WITNESS
assert(executableWork, "Select the retained actual executable witness explicitly")
const dependencyDirectory = process.env.TS_RELEASE_ALPINE_DEPENDENCIES
assert(dependencyDirectory, "Select retained Alpine runtime dependency archives explicitly")
const execute = promisify(execFile)
const native = async (tool, args, timeout = 180_000) =>
  execute(tool, args, {
    encoding: "utf8",
    timeout,
    maxBuffer: 16 * 1024 * 1024,
    env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", TZ: "UTC" },
  })
const run = (effect) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(Nfpm.layer({ executable: join(tools, "nfpm") })),
      Effect.provide(NodeServices.layer),
    ),
  )
const checks = [],
  records = [],
  consumers = []
const check = (name, actual, expected) => {
  assert.deepEqual(actual, expected, name)
  checks.push(name)
}
const owner = fileContentOwner(join(work, "owned"))
const inputOwner = fileContentOwner(join(executableWork, "owned"))
const inputBundle = await run(
  loadBundle(inputOwner, await readFile(join(executableWork, "bundle.json"))),
)
const publish = (name, bytes) =>
  run(
    File.publish(
      {
        destination: join(producer, name),
        observation: "hashed",
        provenance: Artifact.intrinsicProvenance("ts-release/owned-package-input"),
      },
      (candidate) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem
          yield* fs.writeFile(candidate, bytes)
        }),
    ),
  )
const payloads = {}
for (const [cell, logicalName] of Object.entries({
  gnu: "bun-linux-x64-gnu",
  musl: "bun-linux-x64-musl",
  windows: "bun-windows-x64.exe",
})) {
  const owned = inputBundle.artifacts.find((file) => file.logicalName === logicalName)
  assert(owned && owned._tag === "OwnedFile")
  const artifact = await publish(cell, await run(inputOwner.read(owned.content)))
  check(`${cell} exact restored executable bytes`, artifact.bytes, owned.content.bytes)
  check(`${cell} exact restored executable digest`, artifact.digest.value, owned.content.sha256)
  payloads[cell] = artifact
}
// Valid PNG fixture bytes; native Windows SDK validation remains a separate gate.
const crc32 = (bytes) => {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}
const chunk = (name, bytes) => {
  const type = Buffer.from(name),
    length = Buffer.alloc(4),
    checksum = Buffer.alloc(4)
  length.writeUInt32BE(bytes.length)
  checksum.writeUInt32BE(crc32(Buffer.concat([type, bytes])))
  return Buffer.concat([length, type, bytes, checksum])
}
const png = (size) => {
  const header = Buffer.alloc(13),
    rows = Buffer.alloc((size * 4 + 1) * size)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const pixel = y * (size * 4 + 1) + 1 + x * 4
      rows.set([32, 96, 192, 255], pixel)
    }
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}
const icons = []
for (const [name, size] of [
  ["logo.png", 50],
  ["logo150.png", 150],
  ["logo44.png", 44],
])
  icons.push(
    new Nfpm.PackageContent({ artifact: await publish(name, png(size)), dst: `/Assets/${name}` }),
  )
const msix = new Nfpm.MsixOptions({
  publisher: "CN=TS Release Acceptance",
  properties: new Nfpm.MsixProperties({
    display_name: "ts-release acceptance",
    publisher_display_name: "ts-release acceptance",
    logo: "Assets/logo.png",
  }),
  applications: [
    new Nfpm.MsixApplication({
      id: "TsReleaseAcceptance",
      executable: "ts-release-acceptance.exe",
      entry_point: "Windows.FullTrustApplication",
      visual_elements: new Nfpm.MsixVisualElements({
        display_name: "ts-release acceptance",
        description: "actual Bun executable fixture",
        background_color: "transparent",
        square150x150_logo: "Assets/logo150.png",
        square44x44_logo: "Assets/logo44.png",
      }),
    }),
  ],
  dependencies: new Nfpm.MsixDependencies({
    target_device_families: [
      new Nfpm.MsixTargetDeviceFamily({
        name: "Windows.Desktop",
        min_version: "10.0.17763.0",
        max_version_tested: "10.0.26100.0",
      }),
    ],
  }),
})
const extensions = {
  deb: ".deb",
  rpm: ".rpm",
  apk: ".apk",
  archlinux: ".pkg.tar.zst",
  msix: ".msix",
}
for (const [format, extension] of Object.entries(extensions)) {
  const windows = format === "msix"
  const payload = payloads[windows ? "windows" : format === "apk" ? "musl" : "gnu"]
  const artifact = await run(
    Nfpm.buildPackage(
      format,
      new Nfpm.PackageInput({
        metadata: new Nfpm.PackageMetadata({
          name: "ts-release-acceptance",
          version: "1.0.0",
          architecture: "amd64",
          maintainer: "ts-release acceptance <acceptance@example.test>",
          description: "actual compiled Bun fixture packaged through effect-build",
          license: "MIT",
          ...(format === "apk" ? { dependencies: ["libstdc++"] } : {}),
          contents: [
            new Nfpm.PackageContent({
              artifact: payload,
              dst: windows ? "/ts-release-acceptance.exe" : "/usr/bin/ts-release-acceptance",
              mode: Artifact.fileMode(0o755),
            }),
            ...(windows ? icons : []),
          ],
        }),
        release: windows ? "0" : "1",
        mtime: "2009-11-10T23:00:00Z",
        outfile: join(producer, "fixture" + extension),
        ...(windows ? { msix } : {}),
      }),
    ),
  )
  check(
    `${format} exact nFPM tool`,
    artifact.provenance.participants.map(({ name, version }) => ({ name, version })),
    [{ name: "nfpm", version: "2.47.0" }],
  )
  const file = await run(adoptFile(owner, "fixture" + extension, artifact))
  check(`${format} owned bytes`, file.content.bytes, artifact.bytes)
  check(`${format} owned digest`, file.content.sha256, artifact.digest.value)
  records.push({ format, native: artifact, file })
}
const bundle = await run(finalize(records.map((record) => record.file)))
await writeFile(join(work, "bundle.json"), encodeBundle(bundle))
await rm(producer, { recursive: true })
const reopened = fileContentOwner(join(work, "owned"))
check(
  "five package formats survive producer deletion",
  (await run(loadBundle(reopened, await readFile(join(work, "bundle.json"))))).artifacts,
  bundle.artifacts,
)
for (const { file } of records)
  await writeFile(join(delivery, file.logicalName), await run(reopened.read(file.content)))
const dependencies = []
for (const name of (await readdir(dependencyDirectory))
  .filter((name) => name.endsWith(".apk"))
  .sort()) {
  const bytes = await readFile(join(dependencyDirectory, name))
  dependencies.push({
    name,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  })
}
assert(dependencies.some(({ name }) => name.startsWith("libstdc++-")))
const images = {
  deb: "debian@sha256:88200866dfff7ea7f5cbcb6ec7c8a701889efe6fe859fe64d6990e4b07ea4171",
  rpm: "fedora@sha256:7c63468daf71fdc5bda3699cd483b169bb995b5137265d5ffe8f04e2ce87fbb8",
  apk: "alpine@sha256:eafc1edb577d2e9b458664a15f23ea1c370214193226069eb22921169fc7e43f",
  archlinux: "archlinux@sha256:c9dc8b5d1b06d8d50ace6d42b2c93fbb1e34c9e1332d1a2102936e497d3187ae",
}
for (const [format, image] of Object.entries(images)) {
  const { stdout, stderr } = await native("/usr/bin/docker", [
    "run",
    "--rm",
    "--network",
    "none",
    "--mount",
    `type=bind,src=${delivery},dst=/delivery,readonly`,
    "--mount",
    `type=bind,src=${dependencyDirectory},dst=/dependencies,readonly`,
    "--mount",
    `type=bind,src=${join(import.meta.dirname, "fixtures/assert-linux-package.sh")},dst=/oracle.sh,readonly`,
    image,
    "sh",
    "/oracle.sh",
    format,
  ])
  check(
    `${format} offline native metadata/install/version/remove`,
    stdout.includes(`ts-release/${format}:passed`),
    true,
  )
  await writeFile(join(work, format + "-consumer.log"), stdout + stderr)
  consumers.push({ format, image, network: "none", log: format + "-consumer.log" })
}
const msixPath = join(delivery, "fixture.msix")
const { stdout: names } = await native("/usr/bin/unzip", ["-Z1", msixPath])
check(
  "MSIX real executable and native manifest entries",
  names.trim().split("\n").sort(),
  [
    "AppxBlockMap.xml",
    "AppxManifest.xml",
    "Assets/logo.png",
    "Assets/logo150.png",
    "Assets/logo44.png",
    "[Content_Types].xml",
    "ts-release-acceptance.exe",
  ].sort(),
)
const { stdout: manifest } = await native("/usr/bin/unzip", ["-p", msixPath, "AppxManifest.xml"])
check(
  "MSIX exact application/version/architecture",
  /Version="1.0.0.0"/u.test(manifest) &&
    /ProcessorArchitecture="x64"/u.test(manifest) &&
    /Executable="ts-release-acceptance.exe"/u.test(manifest),
  true,
)
await writeFile(join(work, "AppxManifest.xml"), manifest)
await writeFile(
  join(work, "evidence.json"),
  JSON.stringify(
    {
      format: "ts-release/native-producer-packages/1",
      work,
      runtime: process.version,
      bun: process.versions.bun ?? null,
      input: {
        executableWork,
        bundleSha256: createHash("sha256").update(encodeBundle(inputBundle)).digest("hex"),
      },
      checks,
      records,
      dependencies,
      consumers,
      producerDeleted: true,
      limits: [
        "Four native Linux x64 installs; MSIX construction only, Windows SDK/signing/install remains open.",
        "Alpine declares libstdc++; exact dependency archives are installed offline before the product package.",
        "Local source consumer; fresh packed acceptance is separate.",
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
    nativeInstalls: consumers.length,
  }),
)
