import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { decodeConfig } from "../../src/config/config.js"
import { NodeDriverLayer } from "../../src/drivers/node.js"
import { CatalogStructuredRequest, DriverCatalog } from "../../src/drivers/services.js"
import { hashCanonical } from "../../src/model/canonical.js"
import {
  Operation,
  OutputDeclaration,
  Pack
} from "../../src/model/operation.js"
import {
  NonEmptyName,
  OperationId,
  OutputId,
  SafeArchivePattern,
  SafeRelativePath,
  WorkspaceRoot
} from "../../src/model/primitives.js"
import {
  Invocation,
  compilePlan
} from "../../src/plan/compiler.js"

const withWorkspace = async <A>(use: (root: string) => Promise<A>): Promise<A> => {
  const directory = mkdtempSync(join(tmpdir(), "ts-release-archive-files-"))
  try {
    return await use(realpathSync(directory))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}
const write = (root: string, path: string, content: string): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}
const pluginWorkspace = (root: string): void => {
  write(root, "ts-release-plugin/.codex-plugin/plugin.json", "{\"name\":\"codex\"}\n")
  write(root, "ts-release-plugin/.claude-plugin/plugin.json", "{\"name\":\"claude\"}\n")
  write(root, "ts-release-plugin/skills/release/SKILL.md", "# skill\n")
  write(root, "unrelated.txt", "outside\n")
}
const archiveOutput = (path: string) => OutputDeclaration.make({
  id: OutputId.make("archive"),
  path: SafeRelativePath.make(path),
  kind: "archive"
})
const pack = (files: ReadonlyArray<string>, options: {
  readonly output?: string
  readonly inputs?: ReadonlyArray<string>
  readonly format?: "tar.gz" | "zip"
} = {}) => Pack.make({
  id: OperationId.make("archive:plugin"),
  inputs: (options.inputs ?? []).map((id) => OutputId.make(id)),
  outputs: [archiveOutput(options.output ?? ".release/artifacts/plugin.zip")],
  format: options.format ?? "zip",
  ...(files.length === 0
    ? {}
    : { files: files.map((item) => SafeArchivePattern.make(item)) as unknown as readonly [
        SafeArchivePattern,
        ...Array<SafeArchivePattern>
      ] })
})
const materialize = (
  root: string,
  operation: Pack,
  availableOutputs: ReadonlyArray<OutputDeclaration> = []
) => Effect.runPromise(Effect.gen(function*() {
  const catalog = yield* DriverCatalog
  return yield* catalog.structured(CatalogStructuredRequest.make({
    operation,
    root: WorkspaceRoot.make(root),
    availableOutputs
  }))
}).pipe(Effect.provide(NodeDriverLayer)))
const materializeFailure = (
  root: string,
  operation: Pack,
  availableOutputs: ReadonlyArray<OutputDeclaration> = []
) => Effect.runPromise(Effect.gen(function*() {
  const catalog = yield* DriverCatalog
  return yield* catalog.structured(CatalogStructuredRequest.make({
    operation,
    root: WorkspaceRoot.make(root),
    availableOutputs
  }))
}).pipe(Effect.provide(NodeDriverLayer), Effect.flip))

interface ZipEntry {
  readonly path: string
  readonly data: Uint8Array
  readonly mode: number
}
const readZip = (bytes: Uint8Array): ReadonlyArray<ZipEntry> => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = bytes.length - 22
  if (view.getUint32(end, true) !== 0x06054b50) throw new Error("Missing end of central directory.")
  const count = view.getUint16(end + 10, true)
  let offset = view.getUint32(end + 16, true)
  const entries: Array<ZipEntry> = []
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("Malformed central record.")
    const size = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const mode = view.getUint32(offset + 38, true) >>> 16
    const localOffset = view.getUint32(offset + 42, true)
    const path = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    const localName = view.getUint16(localOffset + 26, true)
    const localExtra = view.getUint16(localOffset + 28, true)
    const start = localOffset + 30 + localName + localExtra
    entries.push({ path, data: bytes.slice(start, start + size), mode })
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

const minimalConfig = (archive: Record<string, unknown>): Record<string, unknown> => ({
  project: { name: "fixture", version: "1.0.0", tag: "v1.0.0", commit: "abc123" },
  archives: [archive],
  publish: {}
})
const decodeFailure = (value: unknown) =>
  Effect.runPromise(decodeConfig(value).pipe(Effect.flip))
const compile = (input: unknown, root: string) => Effect.runPromise(compilePlan(input, Invocation.make({
  workspace: WorkspaceRoot.make(root),
  commit: NonEmptyName.make("abc123"),
  snapshot: false
})))
const operationHash = (operation: Pack): string =>
  hashCanonical("ts-release/operation/v1", Schema.encodeSync(Operation)(operation))

describe("durable files-only archive contract", () => {
  test("safe archive patterns decode strictly and unsafe or empty ones fail", async () => {
    const decoded = await Effect.runPromise(decodeConfig(minimalConfig({
      id: "plugin", ids: [], files: ["ts-release-plugin/**"], formats: ["zip"]
    })))
    expect(decoded.archives?.[0]?.files as unknown as ReadonlyArray<string>)
      .toEqual(["ts-release-plugin/**"])
    for (const files of [["../x"], ["/etc/passwd"], ["C:\\windows\\system32"], [""], []]) {
      const failed = await decodeFailure(minimalConfig({ id: "plugin", ids: [], files, formats: ["zip"] }))
      expect(failed._tag).toBe("ConfigDecodeError")
    }
  })

  test("present Pack.files round-trips, changes the operation hash, and rejects empty", () => {
    const withFiles = pack(["ts-release-plugin/**"])
    const encoded = Schema.encodeSync(Operation)(withFiles) as Record<string, unknown>
    expect(encoded.files).toEqual(["ts-release-plugin/**"])
    const decoded = Schema.decodeUnknownSync(Operation, { onExcessProperty: "error" })(encoded)
    expect(decoded).toEqual(withFiles)
    expect(operationHash(withFiles)).not.toBe(operationHash(pack([])))
    expect(() => Schema.decodeUnknownSync(Operation, { onExcessProperty: "error" })({
      ...encoded, files: []
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(Operation, { onExcessProperty: "error" })({
      ...encoded, files: ["../escape"]
    })).toThrow()
  })

  test("absent files preserve the exact pre-change encoded operation shape", () => {
    const encoded = Schema.encodeSync(Operation)(pack([])) as Record<string, unknown>
    expect(Object.keys(encoded).sort()).toEqual(["_tag", "format", "id", "inputs", "outputs"])
    expect(encoded).not.toHaveProperty("files")
  })

  test("lowering carries files into the plan only when configured", () =>
    withWorkspace(async (root) => {
      const withFiles = await compile(minimalConfig({
        id: "plugin", ids: [], files: ["ts-release-plugin/**"], formats: ["zip"]
      }), root)
      const lowered = withFiles.plan.stages.process.find((item) => item._tag === "Pack")
      if (lowered?._tag !== "Pack") throw new Error("Missing Pack operation.")
      expect(lowered.files as unknown as ReadonlyArray<string>).toEqual(["ts-release-plugin/**"])
      expect(new TextDecoder().decode(withFiles.bytes)).toContain("\"files\"")
      const without = await compile(minimalConfig({ id: "plugin", ids: [], formats: ["zip"] }), root)
      const plain = without.plan.stages.process.find((item) => item._tag === "Pack")
      if (plain?._tag !== "Pack") throw new Error("Missing Pack operation.")
      expect(plain.files).toBeUndefined()
      expect(new TextDecoder().decode(without.bytes)).not.toContain("\"files\"")
      expect(withFiles.operationHashes.find((item) => item.operationId === "archive:plugin")?.hash)
        .not.toBe(without.operationHashes.find((item) => item.operationId === "archive:plugin")?.hash)
    }))
})

describe("files-only archive materialization", () => {
  test("materializes exact normalized recursive entries deterministically", () =>
    withWorkspace(async (root) => {
      pluginWorkspace(root)
      const operation = pack(["ts-release-plugin/**"])
      await materialize(root, operation)
      const first = readFileSync(join(root, ".release/artifacts/plugin.zip"))
      await materialize(root, operation)
      const second = readFileSync(join(root, ".release/artifacts/plugin.zip"))
      expect(second.equals(first)).toBe(true)
      const entries = readZip(new Uint8Array(first))
      expect(entries.map((entry) => entry.path)).toEqual([
        "ts-release-plugin/.claude-plugin/plugin.json",
        "ts-release-plugin/.codex-plugin/plugin.json",
        "ts-release-plugin/skills/release/SKILL.md"
      ])
      expect(entries.map((entry) => new TextDecoder().decode(entry.data))).toEqual([
        "{\"name\":\"claude\"}\n", "{\"name\":\"codex\"}\n", "# skill\n"
      ])
      expect(entries.every((entry) => entry.mode === 0o100644)).toBe(true)
    }))

  test("Windows-style pattern separators normalize before matching", () =>
    withWorkspace(async (root) => {
      pluginWorkspace(root)
      await materialize(root, pack(["ts-release-plugin\\**"]))
      const entries = readZip(new Uint8Array(readFileSync(join(root, ".release/artifacts/plugin.zip"))))
      expect(entries).toHaveLength(3)
      expect(entries.every((entry) => !entry.path.includes("\\"))).toBe(true)
    }))

  test("patterns matching no workspace files refuse with a typed driver error", () =>
    withWorkspace(async (root) => {
      pluginWorkspace(root)
      const failed = await materializeFailure(root, pack(["missing-directory/**"]))
      expect(failed._tag).toBe("DriverError")
      expect(failed.reason).toContain("matched no workspace files")
    }))

  test("zero-entry archives without patterns refuse instead of writing empty bytes", () =>
    withWorkspace(async (root) => {
      const failed = await materializeFailure(root, pack([]))
      expect(failed._tag).toBe("DriverError")
      expect(failed.reason).toContain("zero entries")
    }))

  test("absolute and parent-traversal patterns refuse at the request boundary", () =>
    withWorkspace(async (root) => {
      pluginWorkspace(root)
      for (const pattern of ["../outside/**", "/etc/**", "C:\\outside\\**"]) {
        const unsafe = { ...pack(["ts-release-plugin/**"]), files: [pattern] } as unknown as Pack
        expect(() => CatalogStructuredRequest.make({
          operation: unsafe,
          root: WorkspaceRoot.make(root),
          availableOutputs: []
        })).toThrow()
      }
    }))

  test("symlinks escaping the workspace refuse during enumeration", () =>
    withWorkspace(async (root) => {
      pluginWorkspace(root)
      write(root, "../outside-secret.txt", "secret\n")
      symlinkSync(join(root, "..", "outside-secret.txt"), join(root, "ts-release-plugin", "leak.txt"))
      const failed = await materializeFailure(root, pack(["ts-release-plugin/**"]))
      expect(failed._tag).toBe("DriverError")
      expect(failed.reason).toContain("symlink escaping the workspace")
    }))

  test("overlapping patterns dedupe while conflicting archive paths refuse", () =>
    withWorkspace(async (root) => {
      pluginWorkspace(root)
      const overlapping = pack(["ts-release-plugin/**", "ts-release-plugin/skills/**"])
      await materialize(root, overlapping)
      const entries = readZip(new Uint8Array(readFileSync(join(root, ".release/artifacts/plugin.zip"))))
      expect(entries).toHaveLength(3)
      write(root, "plugin.json", "root-copy\n")
      write(root, "dist/plugin.json", "declared-output\n")
      const conflicting = pack(["plugin.json"], { inputs: ["declared"] })
      const failed = await materializeFailure(root, conflicting, [OutputDeclaration.make({
        id: OutputId.make("declared"),
        path: SafeRelativePath.make("dist/plugin.json"),
        kind: "file"
      })])
      expect(failed._tag).toBe("DriverError")
      expect(failed.reason).toContain("duplicate entry")
    }))

  test("the agent-plugin example ZIP carries both manifests and the shared skill", () =>
    withWorkspace(async (root) => {
      cpSync(join(process.cwd(), "examples", "agent-plugin"), root, { recursive: true })
      const config = JSON.parse(readFileSync(join(root, "release.config.json"), "utf8")) as unknown
      const accepted = await compile(config, root)
      const operation = accepted.plan.stages.process.find((item) => item._tag === "Pack")
      if (operation?._tag !== "Pack") throw new Error("Missing example Pack.")
      await materialize(root, operation)
      const entries = readZip(new Uint8Array(readFileSync(
        join(root, ".release/artifacts/release-example-agent-plugin_0.1.0.zip")
      )))
      expect(entries.map((entry) => entry.path)).toEqual([
        "plugin/.claude-plugin/plugin.json",
        "plugin/.codex-plugin/plugin.json",
        "plugin/skills/release-notes/SKILL.md"
      ])
    }))

  test("the declared output archive can never include itself", () =>
    withWorkspace(async (root) => {
      write(root, ".release/artifacts/out.zip", "stale-previous-archive")
      write(root, ".release/notes.txt", "kept\n")
      const operation = pack([".release/**"], { output: ".release/artifacts/out.zip" })
      await materialize(root, operation)
      const entries = readZip(new Uint8Array(readFileSync(join(root, ".release/artifacts/out.zip"))))
      expect(entries.map((entry) => entry.path)).toEqual([".release/notes.txt"])
    }))
})
