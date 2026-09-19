import { createHash } from "node:crypto"
import { chmod, mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import policy from "./producer-tools.json" with { type: "json" }

if (`${process.platform}-${process.arch}` !== policy.platform)
  throw new Error("This exact native producer bootstrap qualifies Linux x64 only")
await Bun.$`mkdir -p ${import.meta.dir + "/../.release/checks"}`

const root = resolve(import.meta.dir, "..")
const directory = resolve(
  process.env.TS_RELEASE_PRODUCER_TOOLS ?? "/tmp/ts-release-native-producers",
)
await mkdir(directory, { recursive: true })
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const records = []
for (const tool of policy.tools) {
  const archive = resolve(directory, `${tool.name}-${tool.version}.${tool.archive}`)
  if (!(await Bun.file(archive).exists())) {
    const response = await fetch(tool.url)
    if (!response.ok) throw new Error(`${tool.name} download HTTP${response.status}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (sha256(bytes) !== tool.sha256) throw new Error(`${tool.name} archive integrity mismatch`)
    await Bun.write(archive, bytes)
  }
  if (sha256(new Uint8Array(await Bun.file(archive).arrayBuffer())) !== tool.sha256)
    throw new Error(`${tool.name} retained archive integrity mismatch`)
  const extract = Bun.spawnSync(
    tool.archive === "zip"
      ? ["unzip", "-p", archive, tool.member]
      : ["tar", tool.archive === "tar.xz" ? "-xOJf" : "-xOzf", archive, "--", tool.member],
    { stdout: "pipe", stderr: "pipe", maxBuffer: 256 * 1024 * 1024 },
  )
  if (extract.exitCode !== 0) throw new Error(`${tool.name} extraction failed`)
  const executable = resolve(directory, tool.name)
  await Bun.write(executable, extract.stdout)
  await chmod(executable, 0o755)
  const probe = Bun.spawnSync([executable, ...tool.probe], { stdout: "pipe", stderr: "pipe" })
  const version = probe.stdout.toString() + probe.stderr.toString()
  if (probe.exitCode !== 0 || !version.includes(tool.version))
    throw new Error(`${tool.name} exact native version probe failed`)
  records.push({
    ...tool,
    executable,
    executableSha256: sha256(extract.stdout),
    executableBytes: extract.stdout.length,
    probeOutput: version.trim(),
  })
  console.log(JSON.stringify({ tool: tool.name, version: tool.version, executable }))
}
await Bun.write(
  resolve(root, ".release/checks/native-tools.json"),
  JSON.stringify(
    {
      format: "ts-release/native-producer-tools/1",
      observedAt: new Date().toISOString(),
      platform: policy.platform,
      policySha256: sha256(
        new Uint8Array(
          await Bun.file(resolve(import.meta.dir, "producer-tools.json")).arrayBuffer(),
        ),
      ),
      tools: records,
      limits: "Exact native Linux tools only. Windows/macOS/hosted acceptance remains separate.",
    },
    null,
    2,
  ) + "\n",
)
