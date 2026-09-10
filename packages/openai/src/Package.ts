import { Effect, Schema } from "effect"
import * as Semver from "semver"
import {
  Content,
  Tree,
  finalize,
  readVerifiedContent,
  type ReadContent,
} from "@mannyc1/ts-release/bundle"
import { canonical, compareText as compare, containsSecret } from "@mannyc1/ts-release/http"
import { decodeJson, isSafePath, makeDataBoundary } from "@mannyc1/ts-release/http"
import { PublicText } from "@mannyc1/ts-release/http"

export { canonical, compare }

export const name = (value: string): boolean =>
  value.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)
export const safePath = (value: string): boolean =>
  isSafePath(value) && value === value.normalize("NFC") && !/[\u0000-\u001f\u007f]/u.test(value)
const Name = Schema.String.check(Schema.makeFilter(name))
const Description = PublicText(1024)
const SupportingPath = Schema.String.check(
  Schema.makeFilter((value) => safePath(value) && value.toLocaleLowerCase("en-US") !== "skill.md"),
)
const Instructions = Schema.String.check(
  Schema.makeFilter((value) => {
    const normalized = value.replace(/\r\n?/gu, "\n")
    return (
      normalized.trim().length > 0 &&
      normalized === normalized.normalize("NFC") &&
      [...normalized].length <= 64 * 1024 &&
      !/[\u0000\u007f]/u.test(normalized) &&
      !containsSecret(normalized)
    )
  }),
)
export class SkillFile extends Schema.Class<SkillFile>("OpenAi.SkillFile")({
  path: SupportingPath,
  content: Content,
  mode: Schema.Literals([0o644, 0o755]),
}) {}
export class Skill extends Schema.Class<Skill>("OpenAi.Skill")({
  name: Name,
  description: Description,
  instructions: Instructions,
  files: Schema.Array(SkillFile),
}) {}
export class Manifest extends Schema.Class<Manifest>("OpenAi.Manifest")({
  name: Name,
  version: Schema.String.check(Schema.makeFilter((value) => Semver.valid(value) === value)),
  description: Description,
  skills: Schema.Literal("./skills/"),
}) {}
export class PluginInput extends Schema.Class<PluginInput>("OpenAi.PluginInput")({
  manifest: Manifest,
  skill: Skill,
}) {}
const PluginInputCodec = PluginInput.check(
  Schema.makeFilter((value) => {
    const paths = value.skill.files.map((file) => file.path.toLocaleLowerCase("en-US"))
    return new Set(paths).size === paths.length
  }),
)
export type RenderedFile = Readonly<{ path: string; bytes: Uint8Array; mode: 0o644 | 0o755 }>

export const { failure, reject, admit: attempt, own } = makeDataBoundary("openai", "OpenAI")
const readVerified = Effect.fn("openai.readContent")((content: Content, readContent: ReadContent) =>
  readVerifiedContent(readContent, content, 32 * 1024 * 1024).pipe(
    Effect.mapError(() => failure("openai-content", "OpenAI plugin content could not be read")),
  ),
)
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
    return own(PluginInputCodec, input)
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
      return yield* reject("openai-secret", "OpenAI plugin content contains token-shaped material")
    rendered.push({
      path: `skills/${selected.skill.name}/${file.path}`,
      bytes,
      mode: file.mode,
    })
  }
  const folded = rendered.map((file) => file.path.toLocaleLowerCase("en-US"))
  if (new Set(folded).size !== rendered.length)
    return yield* reject("openai-package", "OpenAI rendered paths collide")
  return Object.freeze(
    rendered
      .sort((left, right) => compare(left.path, right.path))
      .map((file) => Object.freeze({ ...file, bytes: new Uint8Array(file.bytes) })),
  )
})

// Distribution validates identity and referenced paths, preserving the source
// document and all other JSON fields. It is not a portal or skill authoring validator.
export const PluginManifest = Schema.StructWithRest(
  Schema.Struct({
    name: Name,
    version: Schema.optional(
      Schema.String.check(Schema.makeFilter((value) => Semver.valid(value) === value)),
    ),
    description: Schema.optional(Schema.String),
    skills: Schema.optional(Schema.String),
    hooks: Schema.optional(Schema.String),
    mcpServers: Schema.optional(
      Schema.Union([Schema.String, Schema.Record(Schema.String, Schema.Json)]),
    ),
    apps: Schema.optional(Schema.Union([Schema.String, Schema.Record(Schema.String, Schema.Json)])),
  }),
  [Schema.Record(Schema.String, Schema.UndefinedOr(Schema.Json))],
)
export type PluginManifest = typeof PluginManifest.Type

export const inspectPackage = Effect.fn("openai.inspectPackage")(function* (
  input: Tree,
  readContent: ReadContent,
) {
  const decoded = yield* attempt("openai-tree", () => own(Tree, input))
  const finalized = yield* finalize([decoded]).pipe(
    Effect.mapError((cause) => failure("openai-tree", cause.reason)),
  )
  const tree = finalized.artifacts[0]
  if (tree?._tag !== "OwnedTree")
    return yield* reject("openai-tree", "OpenAI package is not a tree")
  if (tree.rootMode !== 0o755 || tree.entries.some((entry) => entry._tag === "TreeLink"))
    return yield* reject("openai-tree", "OpenAI package must be a regular link-free tree")
  const contents = new Map<string, Uint8Array>()
  for (const entry of tree.entries) {
    const path = entry.relativePath
    if (entry._tag === "TreeDirectory") {
      if (entry.mode !== 0o755)
        return yield* reject("openai-tree", "OpenAI directory mode is invalid")
    } else if (entry._tag === "TreeFile") {
      if (![0o644, 0o755].includes(entry.mode))
        return yield* reject("openai-tree", "OpenAI file mode is invalid")
      const bytes = yield* readVerified(entry.content, readContent)
      if (containsSecret(bytes))
        return yield* reject("openai-secret", "OpenAI plugin contains token-shaped material")
      contents.set(path, bytes)
    }
  }
  const paths = tree.entries.map((entry) => entry.relativePath)
  if (
    paths.some((path) => !safePath(path)) ||
    new Set(paths.map((path) => path.toLowerCase())).size !== paths.length
  )
    return yield* reject("openai-tree", "OpenAI package paths are unsafe or collide")
  const manifestPath = contents.has("plugin.json") ? "plugin.json" : ".codex-plugin/plugin.json"
  const bytes = contents.get(manifestPath)
  if (!bytes) return yield* reject("openai-tree", "plugin.json is missing")
  const plugin = yield* attempt("openai-manifest", () => {
    const value = own(PluginManifest, decodeJson(bytes))
    if (
      manifestPath === "plugin.json" &&
      value.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
    )
      throw new Error("Root plugin.json must declare the Agent Plugins 1.0 schema")
    for (const field of ["skills", "mcpServers", "apps", "hooks"]) {
      const selected = value[field]
      if (typeof selected !== "string") continue
      const path = selected.replace(/^\.\//u, "").replace(/\/$/u, "")
      if (
        !selected.startsWith("./") ||
        !safePath(path) ||
        !paths.some((candidate) => candidate === path || candidate.startsWith(path + "/"))
      )
        throw new Error(`Plugin ${field} must reference bundled contents`)
    }
    return value
  })
  const skillNames = [...contents.keys()]
    .filter((path) => /(?:^|\/)SKILL\.md$/u.test(path))
    .map((path) => path.split("/").at(-2)!)
  return Object.freeze({
    tree,
    manifest: plugin,
    skillName: skillNames[0] ?? null,
    skillNames,
    contents,
  })
})

export const validatePackage = Effect.fn("openai.validatePackage")(
  (tree: Tree, read: ReadContent) => Effect.map(inspectPackage(tree, read), (value) => value.tree),
)

/** Read an existing package faithfully, including assets, multiple skills and MCP/app files. */
export const packageFiles = Effect.fn("openai.packageFiles")(function* (
  tree: Tree,
  read: ReadContent,
) {
  const inspected = yield* inspectPackage(tree, read)
  return Object.freeze(
    inspected.tree.entries.flatMap((entry): RenderedFile[] =>
      entry._tag === "TreeFile"
        ? [
            {
              path: entry.relativePath,
              mode: entry.mode as 0o644 | 0o755,
              bytes: new Uint8Array(inspected.contents.get(entry.relativePath)!),
            },
          ]
        : [],
    ),
  )
})
