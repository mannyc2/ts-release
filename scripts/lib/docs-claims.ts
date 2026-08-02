// The docs ratchet. Every comparative, quantitative, or coverage sentence in
// the user-facing docs carries a machine-checkable annotation on the line above
// it, and this predicate resolves each one against the code. A claim whose
// annotation stops resolving fails the build — which is the only way a
// coverage table stays true after the code moves.
//
// The annotations are HTML comments, so they are invisible when rendered:
//
//   <!-- claim section:publish.homebrew -->   the config schema declares it
//   <!-- claim absent:nfpm -->                the term appears nowhere in src/
//   <!-- claim command:check:release -->      package.json declares the script
//   <!-- claim test:test/core/resolve.test.ts --> the test file exists
//   <!-- claim docs-derived:121 -->           a GoReleaser statement taken from
//                                             its documentation at a named pin
//
// GoReleaser has never been EXECUTED by this project, so no observational claim
// about it is permitted — only statements attributed to its documentation at a
// stated version. The banned phrases below are the ones that would smuggle an
// observation back in.
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

export interface DocsClaimsReport {
  readonly failures: ReadonlyArray<string>
  readonly claims: number
  readonly files: number
}

export const claimFiles = [
  "README.md",
  "docs/comparison.md",
  "docs/recovery.md"
]

const bannedPhrases = [
  "superior to goreleaser",
  "better than goreleaser",
  "goreleaser lacks",
  "goreleaser cannot",
  "goreleaser fails",
  "goreleaser doesn't",
  "goreleaser does not"
]
const bannedReason = "E5 never ran: this project has never executed GoReleaser, so only documentation-attributed phrasing is permitted"

// The pin every docs-derived GoReleaser statement must name, so a re-pin of the
// research makes stale cells visible instead of silently wrong.
const goReleaserPin = /v2\.1[0-9]\b/u
const attribution = ["documentation", "documented", "per goreleaser"]

const claimPattern = /<!--\s*claim\s+([a-z-]+):([^\s]+)\s*-->/gu

const configSchema = (root: string): string =>
  readFileSync(join(root, "src", "recipes", "config.ts"), "utf8")

// ALL of src/, not a chosen subset: a term that appears anywhere in the product
// is covered somewhere, and a narrower scan would let a false "not supported"
// row survive. (Verified during authoring: nfpm, msi, dmg, and chocolatey all
// live under src/recipes/packages — exactly the rows a from-memory list gets
// wrong.)
const sourceTerms = (root: string): string => {
  const collect = (directory: string): Array<string> =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return collect(path)
      return entry.name.endsWith(".ts") ? [readFileSync(path, "utf8")] : []
    })
  return collect(join(root, "src")).join("\n").toLowerCase()
}

const resolvers: Readonly<Record<string, (root: string, value: string, sentence: string) => string | undefined>> = {
  // The last segment of a dotted path must be a declared schema field. This
  // proves the surface EXISTS; the prose around it still has to be true.
  section: (root, value) => {
    const field = value.split(".").at(-1)!
    // Fields are declared several to a line in the schema classes, so a
    // start-of-line anchor would miss most of them.
    return new RegExp(`(?:^|[{,\\s])(?:"|')?${field}(?:"|')?\\s*:`, "mu").test(configSchema(root))
      ? undefined
      : `section:${value} names no field the config schema declares`
  },
  // The honest-subset rows. A term that turns up in the product's own
  // vocabulary is COVERED, and claiming its absence is the exact error this
  // resolver exists to make impossible.
  absent: (root, value) =>
    sourceTerms(root).includes(value.toLowerCase())
      ? `absent:${value} is claimed absent but the term appears in src/`
      : undefined,
  command: (root, value) => {
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, unknown>
    }
    return manifest.scripts !== undefined && value in manifest.scripts
      ? undefined
      : `command:${value} is not a declared package script`
  },
  test: (root, value) =>
    existsSync(join(root, value)) ? undefined : `test:${value} does not exist`,
  "docs-derived": (_root, value, sentence) => {
    const lower = sentence.toLowerCase()
    if (!goReleaserPin.test(sentence)) {
      return `docs-derived:${value} must name the documentation version it was read from (v2.1x)`
    }
    return attribution.some((phrase) => lower.includes(phrase))
      ? undefined
      : `docs-derived:${value} must attribute the statement (say "per GoReleaser's documentation")`
  }
}

export const checkDocsClaims = (root: string): DocsClaimsReport => {
  const failures: Array<string> = []
  let claims = 0
  let files = 0
  for (const file of claimFiles) {
    const path = join(root, file)
    if (!existsSync(path)) continue
    files += 1
    const text = readFileSync(path, "utf8")
    const lines = text.split("\n")
    const lower = text.toLowerCase()
    for (const phrase of bannedPhrases) {
      if (lower.includes(phrase)) {
        failures.push(`${file}: contains ${JSON.stringify(phrase)} — ${bannedReason}`)
      }
    }
    for (const [index, line] of lines.entries()) {
      for (const match of line.matchAll(claimPattern)) {
        claims += 1
        const [, kind, value] = match
        const resolve = resolvers[kind!]
        // The claimed sentence is the rest of this line, or the next non-empty
        // one when the annotation stands alone.
        const rest = line.slice(match.index + match[0].length).trim()
        const sentence = rest.length > 0
          ? rest
          : lines.slice(index + 1).find((candidate) => candidate.trim().length > 0) ?? ""
        if (resolve === undefined) {
          failures.push(`${file}:${index + 1}: unknown claim kind ${JSON.stringify(kind)}`)
          continue
        }
        const failure = resolve(root, value!, sentence)
        if (failure !== undefined) failures.push(`${file}:${index + 1}: ${failure}`)
      }
    }
  }
  return { failures, claims, files }
}
