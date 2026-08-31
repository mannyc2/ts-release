import { readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import { canonicalJsonBytes } from "./canonical-document.js"
import {
  decodeResearchTraceability,
  encodeResearchTraceability
} from "./schema/research-traceability.js"
import { buildResearchTraceabilityDocument } from "./traceability-normalization.js"

export const researchTraceabilityInputPath =
  "docs/refactor/architecture-program/inputs/research-traceability.json"

const moduleDirectory = typeof import.meta.dir === "string"
  ? import.meta.dir
  : dirname(fileURLToPath(import.meta.url))
const defaultRepositoryRoot = resolve(moduleDirectory, "../../..")

export const generateResearchTraceability = Effect.fn("ResearchTraceabilityV1.generate")(
  function* (repositoryRoot: string = defaultRepositoryRoot) {
    const scorecard = yield* Effect.tryPromise(() => readFile(
      resolve(repositoryRoot, "docs/refactor/research/launch-scorecard.md"),
      "utf8"
    ))
    const document = yield* decodeResearchTraceability(buildResearchTraceabilityDocument(scorecard))
    const bytes = canonicalJsonBytes(encodeResearchTraceability(document))
    yield* Effect.tryPromise(() => writeFile(resolve(repositoryRoot, researchTraceabilityInputPath), bytes))
    return { bytes: bytes.length, propositions: document.propositions.length }
  }
)

if (import.meta.main) {
  Effect.runPromise(generateResearchTraceability()).then(
    ({ bytes, propositions }) => {
      console.log(`generated research traceability (${propositions} propositions, ${bytes} bytes)`)
    },
    (cause: unknown) => {
      const rendered = cause instanceof Error ? cause.message : String(cause)
      console.error(`research traceability generation failed: ${rendered.split("\n", 1)[0]}`)
      process.exitCode = 1
    }
  )
}
