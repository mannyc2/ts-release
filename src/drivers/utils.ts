import { createHash } from "node:crypto"
import { DriverError } from "../model/run.js"

export const failure = (
  reason: string,
  commitment: "before-commit" | "unknown" = "before-commit"
) => DriverError.make({ reason, commitment })

export const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex")
