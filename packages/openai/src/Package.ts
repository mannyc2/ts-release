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
import { decodeJson, isPublicText, isSafePath, makeDataBoundary } from "@mannyc1/ts-release/http"
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

const parseFrontmatter = (bytes: Uint8Array): string => {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  if (text !== text.normalize("NFC") || text.includes("\r") || !text.startsWith("---\n"))
    throw new Error("OpenAI SKILL.md encoding or frontmatter is invalid")
  const closing = text.indexOf("\n---\n", 4)
  if (closing < 0 || !text.slice(closing + 5).trim())
    throw new Error("OpenAI SKILL.md has no instructions")
  const fields = /^name: (.*)\ndescription: (.*)$/u.exec(text.slice(4, closing))
  if (!fields) throw new Error("OpenAI SKILL.md frontmatter is malformed")
  const skillName: unknown = JSON.parse(fields[1]!),
    description: unknown = JSON.parse(fields[2]!)
  if (
    typeof skillName !== "string" ||
    typeof description !== "string" ||
    !name(skillName) ||
    !isPublicText(description, 1024)
  )
    throw new Error("OpenAI SKILL.md frontmatter is invalid")
  return skillName
}

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
  const bytes = contents.get(".codex-plugin/plugin.json")
  if (!bytes) return yield* reject("openai-tree", "plugin.json is missing")
  const plugin = yield* attempt("openai-manifest", () => {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      value = own(Manifest, decodeJson(bytes))
    if (text !== new TextDecoder().decode(manifestBytes(value)))
      throw new Error("plugin.json is not canonical")
    return value
  })
  const skillDocuments = [...contents.keys()].filter((path) =>
    /^skills\/[^/]+\/SKILL\.md$/u.test(path),
  )
  if (skillDocuments.length !== 1)
    return yield* reject("openai-tree", "OpenAI plugin needs one complete skill tree")
  const root = skillDocuments[0]!.split("/")[1]!
  if (
    !name(root) ||
    [...contents.keys()].some(
      (path) => path !== ".codex-plugin/plugin.json" && !path.startsWith(`skills/${root}/`),
    )
  )
    return yield* reject("openai-tree", "Only plugin.json and one skill may appear")
  const skillName = yield* attempt("openai-skill", () =>
    parseFrontmatter(contents.get(skillDocuments[0]!)!),
  )
  if (skillName !== root) return yield* reject("openai-skill", "OpenAI skill root differs")
  const rootPath = `skills/${skillName}`
  if (
    tree.entries.some(
      (entry) =>
        entry._tag === "TreeDirectory" &&
        ![".codex-plugin", "skills", rootPath].includes(entry.relativePath) &&
        !entry.relativePath.startsWith(`${rootPath}/`),
    )
  )
    return yield* reject("openai-tree", "OpenAI tree has an unowned or incomplete directory")
  return Object.freeze({ tree, manifest: plugin, skillName, contents })
})

export const validatePackage = Effect.fn("openai.validatePackage")(
  (tree: Tree, read: ReadContent) => Effect.map(inspectPackage(tree, read), (value) => value.tree),
)
