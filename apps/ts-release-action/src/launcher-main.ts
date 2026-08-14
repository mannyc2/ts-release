import { dirname, join } from "node:path"
import { runActionLauncher } from "./launcher.js"

try {
  process.exitCode = runActionLauncher({
    actionDirectory: join(dirname(process.argv[1] ?? ""), ".."),
    environment: process.env
  })
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : String(cause))
  process.exitCode = 1
}
