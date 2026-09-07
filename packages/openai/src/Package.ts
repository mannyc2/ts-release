import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Semver from "semver"
import { ReleaseError } from "@mannyc1/ts-release"
import {
  Content,
  Tree,
  finalize,
  type ReadContent,
} from "@mannyc1/ts-release/bundle"
import { decodeJson } from "@mannyc1/ts-release/http"

export class SkillFile extends Schema.Class<SkillFile>("OpenAi.SkillFile")({
  path: Schema.String,
  content: Content,
  mode: Schema.Literals([0o644, 0o755]),
}) {}
export class Skill extends Schema.Class<Skill>("OpenAi.Skill")({
  name: Schema.String,
  description: Schema.String,
  instructions: Schema.String,
  files: Schema.Array(SkillFile),
}) {}
export class Manifest extends Schema.Class<Manifest>("OpenAi.Manifest")({
  name: Schema.String,
  version: Schema.String,
  description: Schema.String,
  skills: Schema.Literal("./skills/"),
}) {}
export class PluginInput extends Schema.Class<PluginInput>("OpenAi.PluginInput")({
  manifest: Manifest,
  skill: Skill,
}) {}
export interface RenderedFile {
  readonly path: string
  readonly bytes: Uint8Array
  readonly mode: 0o644 | 0o755
}

const secret =
  /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abps]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|npm_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY)/u
export const containsSecret = (value: string | Uint8Array): boolean =>
  secret.test(typeof value === "string" ? value : new TextDecoder().decode(value))
export const publicText = (value: string, maximum = 8192): boolean =>
  value.length > 0 &&
  value === value.normalize("NFC") &&
  value.trim() === value &&
  [...value].length <= maximum &&
  !/[\u0000-\u001f\u007f]/u.test(value) &&
  !containsSecret(value)
export const name = (value: string): boolean =>
  value.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)
export const safePath = (value: string): boolean =>
  value.length <= 1024 &&
  value === value.normalize("NFC") &&
  !value.startsWith("/") &&
  !value.includes("\\") &&
  !/[\u0000-\u001f\u007f]/u.test(value) &&
  !value.split("/").some((part) => part === "" || part === "." || part === "..")
export const compare = (left: string, right: string): number => {
  const a = [...left], b = [...right]
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const selected = a[index]!.codePointAt(0)! - b[index]!.codePointAt(0)!
    if (selected) return selected
  }
  return a.length - b.length
}
export const canonical = (input: unknown): string => {
  const active = new Set<object>()
  const visit = (value: unknown): string => {
    if (value === null || typeof value === "boolean") return JSON.stringify(value)
    if (typeof value === "string") {
      if (value !== value.normalize("NFC")) throw new Error("String is not NFC")
      return JSON.stringify(value)
    }
    if (typeof value === "number" && Number.isSafeInteger(value) && !Object.is(value, -0))
      return String(value)
    if (typeof value !== "object") throw new Error("Value is not canonical JSON")
    if (active.has(value)) throw new Error("Value is cyclic")
    active.add(value)
    const array = Array.isArray(value)
    const keys = Reflect.ownKeys(value).filter((key) => !(array && key === "length"))
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!
      if (typeof key !== "string" || !descriptor.enumerable || !("value" in descriptor))
        throw new Error("Value contains hidden data or an accessor")
    }
    let output: string
    if (array) {
      if (keys.length !== value.length || keys.some((key, index) => key !== String(index)))
        throw new Error("Array is sparse or has extra fields")
      output = `[${value.map(visit).join(",")}]`
    }
    else {
      output = `{${(keys as string[]).sort(compare).map((key) =>
        `${visit(key)}:${visit(Object.getOwnPropertyDescriptor(value, key)!.value)}`).join(",")}}`
    }
    active.delete(value)
    return output
  }
  return visit(input)
}
export const freeze = <A>(value: A): A => {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
export const own = <A, I>(codec: Schema.Codec<A, I>, input: unknown): A =>
  freeze(
    Schema.decodeUnknownSync(codec, { onExcessProperty: "error" })(
      JSON.parse(canonical(input)) as unknown,
    ),
  )
export const attempt = <A>(code: string, body: () => A): Effect.Effect<A, ReleaseError> =>
  Effect.try({
    try: body,
    catch: (cause) =>
      cause instanceof ReleaseError
        ? cause
        : new ReleaseError({
            code,
            message: cause instanceof Error ? cause.message : "OpenAI value could not be admitted",
          }),
  })
const sha256 = Effect.fn("openai.sha256")(function* (bytes: Uint8Array) {
  const digest = yield* Effect.tryPromise({
    try: () => globalThis.crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
    catch: () =>
      new ReleaseError({ code: "openai-digest", message: "SHA-256 verification failed" }),
  })
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
})
const readVerified = Effect.fn("openai.readContent")(function* (
  content: Content,
  readContent: ReadContent,
) {
  const selected = yield* attempt("openai-content", () => own(Content, content))
  if (BigInt(selected.bytes) > 32n * 1024n * 1024n)
    return yield* new ReleaseError({
      code: "openai-content",
      message: "OpenAI plugin file exceeds the byte limit",
    })
  const bytes = new Uint8Array(yield* readContent(selected))
  if (String(bytes.length) !== selected.bytes || (yield* sha256(bytes)) !== selected.sha256)
    return yield* new ReleaseError({
      code: "openai-content",
      message: "OpenAI plugin file differs from its owned content identity",
    })
  return bytes
})

const validateManifest = (value: Manifest): void => {
  if (
    !name(value.name) ||
    Semver.valid(value.version) !== value.version ||
    !publicText(value.description, 1024)
  )
    throw new Error("OpenAI plugin manifest is invalid")
}
const validateSkill = (value: Skill): void => {
  const instructions = value.instructions.replace(/\r\n?/gu, "\n")
  if (
    !name(value.name) ||
    !publicText(value.description, 1024) ||
    !instructions.trim() ||
    instructions !== instructions.normalize("NFC") ||
    [...instructions].length > 64 * 1024 ||
    /[\u0000\u007f]/u.test(instructions) ||
    containsSecret(instructions)
  )
    throw new Error("OpenAI skill metadata is invalid")
}
const skillMarkdown = (skill: Skill): Uint8Array => {
  const instructions = skill.instructions.replace(/\r\n?/gu, "\n").normalize("NFC").trim()
  if (!instructions) throw new Error("OpenAI skill instructions are empty")
  return new TextEncoder().encode(
    [
      "---",
      `name: ${JSON.stringify(skill.name)}`,
      `description: ${JSON.stringify(skill.description)}`,
      "---",
      "",
      instructions,
      "",
    ].join("\n"),
  )
}
const manifestBytes = (value: Manifest): Uint8Array =>
  new TextEncoder().encode(`${canonical(Schema.encodeSync(Manifest)(value))}\n`)

export const files = Effect.fn("openai.files")(function* (
  input: PluginInput,
  readContent: ReadContent,
) {
  const selected = yield* attempt("openai-package", () => {
    if (typeof readContent !== "function") throw new Error("OpenAI content reader is unavailable")
    const value = own(PluginInput, input)
    validateManifest(value.manifest)
    validateSkill(value.skill)
    const paths = value.skill.files.map((file) => file.path.toLocaleLowerCase("en-US"))
    if (new Set(paths).size !== paths.length) throw new Error("OpenAI supporting file paths collide")
    for (const file of value.skill.files)
      if (!safePath(file.path) || file.path.toLocaleLowerCase("en-US") === "skill.md")
        throw new Error("OpenAI supporting file path is invalid")
    return value
  })
  const rendered: RenderedFile[] = [
    {
      path: ".codex-plugin/plugin.json",
      bytes: manifestBytes(selected.manifest),
      mode: 0o644,
    },
    {
      path: `skills/${selected.skill.name}/SKILL.md`,
      bytes: skillMarkdown(selected.skill),
      mode: 0o644,
    },
  ]
  for (const file of selected.skill.files) {
    const bytes = yield* readVerified(file.content, readContent)
    if (containsSecret(bytes))
      return yield* new ReleaseError({
        code: "openai-secret",
        message: "OpenAI plugin content contains token-shaped material",
      })
    rendered.push({
      path: `skills/${selected.skill.name}/${file.path}`,
      bytes,
      mode: file.mode,
    })
  }
  const folded = rendered.map((file) => file.path.toLocaleLowerCase("en-US"))
  if (new Set(folded).size !== rendered.length)
    return yield* new ReleaseError({
      code: "openai-package",
      message: "OpenAI rendered paths collide",
    })
  return Object.freeze(
    rendered
      .sort((left, right) => compare(left.path, right.path))
      .map((file) => Object.freeze({ ...file, bytes: new Uint8Array(file.bytes) })),
  )
})

const parseFrontmatter = (path: string, bytes: Uint8Array): string => {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  if (text !== text.normalize("NFC") || text.includes("\r") || !text.startsWith("---\n"))
    throw new Error("OpenAI SKILL.md encoding or frontmatter is invalid")
  const closing = text.indexOf("\n---\n", 4)
  if (closing < 0 || !text.slice(closing + 5).trim())
    throw new Error("OpenAI SKILL.md has no instructions")
  const fields = new Map<string, string>()
  for (const line of text.slice(4, closing).split("\n")) {
    const separator = line.indexOf(":")
    if (separator <= 0) throw new Error("OpenAI SKILL.md frontmatter is malformed")
    const key = line.slice(0, separator).trim(), source = line.slice(separator + 1).trim()
    if (fields.has(key)) throw new Error("OpenAI SKILL.md repeats a frontmatter field")
    let value = source
    if (source.startsWith('"') && source.endsWith('"')) {
      const parsed: unknown = JSON.parse(source)
      if (typeof parsed !== "string") throw new Error("OpenAI frontmatter value is not text")
      value = parsed
    }
    fields.set(key, value)
  }
  if (
    fields.size !== 2 ||
    [...fields.keys()].some((key) => key !== "name" && key !== "description") ||
    !name(fields.get("name") ?? "") ||
    !publicText(fields.get("description") ?? "", 1024)
  )
    throw new Error("OpenAI SKILL.md frontmatter is invalid")
  const directory = path.split("/")[1]
  if (fields.get("name") !== directory) throw new Error("OpenAI skill name differs from its directory")
  return fields.get("name")!
}

export const inspectPackage = Effect.fn("openai.inspectPackage")(function* (
  input: Tree,
  readContent: ReadContent,
) {
  const decoded = yield* attempt("openai-tree", () => own(Tree, input))
  const finalized = yield* finalize([decoded]).pipe(
    Effect.mapError(
      (cause) => new ReleaseError({ code: "openai-tree", message: cause.reason }),
    ),
  )
  const tree = finalized.artifacts[0]
  if (tree?._tag !== "OwnedTree")
    return yield* new ReleaseError({ code: "openai-tree", message: "OpenAI package is not a tree" })
  if (tree.rootMode !== 0o755 || tree.entries.some((entry) => entry._tag === "TreeLink"))
    return yield* new ReleaseError({
      code: "openai-tree",
      message: "OpenAI package must be a regular directory tree without links",
    })
  const paths = new Set<string>(), folded = new Set<string>(), contents = new Map<string, Uint8Array>()
  for (const entry of tree.entries) {
    const path = entry.relativePath
    if (!safePath(path) || paths.has(path) || folded.has(path.toLocaleLowerCase("en-US")))
      return yield* new ReleaseError({ code: "openai-tree", message: "OpenAI tree paths are ambiguous" })
    paths.add(path)
    folded.add(path.toLocaleLowerCase("en-US"))
    if (entry._tag === "TreeDirectory") {
      if (entry.mode !== 0o755)
        return yield* new ReleaseError({ code: "openai-tree", message: "OpenAI directory mode is invalid" })
    } else if (entry._tag === "TreeFile") {
      if (![0o644, 0o755].includes(entry.mode))
        return yield* new ReleaseError({ code: "openai-tree", message: "OpenAI file mode is invalid" })
      const bytes = yield* readVerified(entry.content, readContent)
      if (containsSecret(bytes))
        return yield* new ReleaseError({
          code: "openai-secret",
          message: "OpenAI plugin content contains token-shaped material",
        })
      contents.set(path, bytes)
    } else {
      return yield* new ReleaseError({ code: "openai-tree", message: "OpenAI tree links are forbidden" })
    }
  }
  const bytes = contents.get(".codex-plugin/plugin.json")
  if (!bytes) return yield* new ReleaseError({ code: "openai-tree", message: "plugin.json is missing" })
  const plugin = yield* attempt("openai-manifest", () => {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes), value = own(Manifest, decodeJson(bytes))
    validateManifest(value)
    if (text !== new TextDecoder().decode(manifestBytes(value)))
      throw new Error("plugin.json is not canonical")
    return value
  })
  const skillRoots = new Set<string>(), skillDocuments: string[] = []
  for (const path of contents.keys()) {
    if (path === ".codex-plugin/plugin.json") continue
    if (path.startsWith(".codex-plugin/") || !path.startsWith("skills/"))
      return yield* new ReleaseError({
        code: "openai-tree",
        message: "Only plugin.json and skills may appear in a skills-only plugin",
      })
    const parts = path.split("/")
    if (parts.length < 3 || !name(parts[1]!))
      return yield* new ReleaseError({ code: "openai-tree", message: "OpenAI skill path is invalid" })
    skillRoots.add(parts[1]!)
    if (parts.length === 3 && parts[2] === "SKILL.md") skillDocuments.push(path)
  }
  if (skillRoots.size !== 1 || skillDocuments.length !== 1)
    return yield* new ReleaseError({
      code: "openai-tree",
      message: "OpenAI plugin must contain exactly one complete skill tree",
    })
  const skillName = yield* attempt("openai-skill", () =>
    parseFrontmatter(skillDocuments[0]!, contents.get(skillDocuments[0]!)!),
  )
  if (skillName !== [...skillRoots][0])
    return yield* new ReleaseError({ code: "openai-skill", message: "OpenAI skill root differs" })
  const root = `skills/${skillName}`
  if (
    !paths.has(".codex-plugin") ||
    !paths.has("skills") ||
    !paths.has(root) ||
    tree.entries.some(
      (entry) =>
        entry._tag === "TreeDirectory" &&
        ![".codex-plugin", "skills", root].includes(entry.relativePath) &&
        !entry.relativePath.startsWith(`${root}/`),
    )
  )
    return yield* new ReleaseError({
      code: "openai-tree",
      message: "OpenAI tree contains an unowned or incomplete directory",
    })
  return Object.freeze({ tree, manifest: plugin, skillName, contents })
})

export const validatePackage = Effect.fn("openai.validatePackage")(function* (
  tree: Tree,
  readContent: ReadContent,
) {
  return (yield* inspectPackage(tree, readContent)).tree
})
