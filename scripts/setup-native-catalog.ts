import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { chmod, mkdir, stat } from "node:fs/promises"
import { join } from "node:path"

// Reproducible Linux native-format controls. Native Windows/macOS installation
// remains a separate host qualification; no protocol/selector simulation closes it.
assert.equal(process.platform, "linux", "This portable acceptance setup is Linux-specific")
assert.equal(process.arch, "x64", "Use the native host setup for another architecture")
const pins = await Bun.file(
  new URL("../test/reimplementation/catalog/native-tools.json", import.meta.url),
).json()
const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  )
async function run(argv: string[], env: Record<string, string> = {}) {
  const child = Bun.spawn(argv, {
    env: { ...process.env, ...env },
    stdout: "inherit",
    stderr: "inherit",
  })
  assert.equal(await child.exited, 0, `Native catalog setup failed: ${argv[0]}`)
}
for (const source of [pins.homebrew, pins.scoop]) {
  if (!(await exists(join(source.directory, ".git")))) {
    await run([
      "git",
      "clone",
      "--no-checkout",
      "--depth",
      "1",
      source.repository,
      source.directory,
    ])
    await run(["git", "-C", source.directory, "fetch", "--depth", "1", "origin", source.commit])
    await run(["git", "-C", source.directory, "checkout", "--detach", source.commit])
  }
  const child = Bun.spawn(["git", "-C", source.directory, "rev-parse", "HEAD"], {
    stdout: "pipe",
    stderr: "inherit",
  })
  const head = (await new Response(child.stdout).text()).trim()
  assert.equal(await child.exited, 0)
  assert.equal(
    head,
    source.commit,
    "Existing native tool checkout differs; preserve it and select an isolated destination",
  )
}
const ps = pins.powershell
for (const binding of pins.sourceBindings)
  assert.equal(
    createHash("sha256").update(await Bun.file(join(pins[binding.owner].directory, binding.path)).bytes()).digest("hex"),
    binding.sha256,
    `Native source changed: ${binding.owner}/${binding.path}`,
  )
await mkdir(ps.directory, { recursive: true })
const archive = join(ps.directory, ps.filename)
if (!(await exists(archive))) {
  const response = await fetch(ps.url)
  assert.equal(response.status, 200)
  await Bun.write(archive, response)
}
assert.equal(
  createHash("sha256")
    .update(await Bun.file(archive).bytes())
    .digest("hex"),
  ps.sha256,
)
if (!(await exists(join(ps.directory, "pwsh"))))
  await run(["tar", "-xzf", archive, "-C", ps.directory])
await chmod(join(ps.directory, "pwsh"), 0o755)
await run([join(pins.homebrew.directory, "bin/brew"), "ruby", "--", "--version"], {
  HOMEBREW_NO_AUTO_UPDATE: "1",
  HOMEBREW_NO_ANALYTICS: "1",
})
await run(
  [
    join(ps.directory, "pwsh"),
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "$PSVersionTable.PSVersion.ToString()",
  ],
  { POWERSHELL_TELEMETRY_OPTOUT: "1" },
)
