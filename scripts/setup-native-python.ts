import { join, dirname } from "node:path"
import { mkdir } from "node:fs/promises"

const bin = process.env.TS_RELEASE_PYTHON_NATIVE_BIN ?? "/tmp/ts-release-warehouse-native-venv/bin"
const root = dirname(bin)
const run = async (argv: string[]) => {
  const child = Bun.spawn(argv, {
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, PIP_DISABLE_PIP_VERSION_CHECK: "1", PIP_NO_CACHE_DIR: "1" },
  })
  if (await child.exited) throw new Error("Native Python fixture setup failed")
}
await mkdir(root, { recursive: true })
if (!(await Bun.file(join(bin, "python")).exists()))
  await run([process.env.TS_RELEASE_PYTHON ?? "python3", "-m", "venv", root])
await run([
  join(bin, "python"),
  "-m",
  "pip",
  "install",
  "-r",
  join(import.meta.dir, "../test/reimplementation/warehouse/requirements.txt"),
])
await run([join(bin, "python"), "-m", "pip", "check"])
