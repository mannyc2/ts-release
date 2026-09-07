const root = new URL("../", import.meta.url).pathname
const invoke = async (argv: string[], env: Record<string, string> = {}) => {
  const child = Bun.spawn(argv, {
    cwd: root,
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "inherit",
  })
  const [code, output] = await Promise.all([child.exited, new Response(child.stdout).text()])
  if (code !== 0)
    throw new Error(`Integration command failed (${code}): ${argv.join(" ")}\n${output}`)
  return output
}
await invoke([process.execPath, "test", "./test/reimplementation/artifacts"])
const artifacts = JSON.parse(await invoke([process.execPath, "scripts/check-packed-artifacts.ts"]))
const apple = JSON.parse(
  await invoke([process.execPath, "scripts/check-packed-apple.ts"], {
    TS_RELEASE_PACKED_ARTIFACT_WORK: artifacts.work,
  }),
)
console.log(
  JSON.stringify({
    artifacts,
    apple,
    qualification:
      "Local real producer/packed consumer gates passed; native macOS/Windows and hosted acceptance remain separate required gates.",
  }),
)
