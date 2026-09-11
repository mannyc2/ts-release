import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { Host, createPlan, runRelease } from "@mannyc1/ts-release"
import * as Git from "@mannyc1/ts-release/git"
import { makeGitCatalogHost, openSqliteJournal } from "@mannyc1/ts-release/bun"
import { Bundle, Content, File, Tree, finalize, type ReadContent } from "@mannyc1/ts-release/bundle"
import { ReleaseError } from "@mannyc1/ts-release"
import {
  Attestations,
  Listing,
  Manifest,
  Marketplace,
  MarketplaceEntry,
  NegativeTest,
  PluginInput,
  PositiveTest,
  Skill,
  SkillFile,
  Submission,
  files,
  marketplace,
  submission,
  validatePackage,
  type RenderedFile,
} from "../../../packages/openai/src/index.js"
import { openGitRuntime } from "../../../packages/ts-release/src/platform/GitProcess.js"
import {
  contentFixture,
  identity,
  native,
  processOptions,
  seed,
} from "../transports/git-fixture.js"
import { ownedTree, treeEntries } from "../artifacts/tree-fixture.js"

const stored = new Map<string, Uint8Array>()
const content = (bytes: Uint8Array) => {
  const sha256 = createHash("sha256").update(bytes).digest("hex")
  stored.set(sha256, new Uint8Array(bytes))
  return new Content({ bytes: bytes.length, sha256 })
}
const readContent: ReadContent = (identity) => {
  const bytes = stored.get(identity.sha256)
  return bytes
    ? Effect.succeed(new Uint8Array(bytes))
    : Effect.fail(new ReleaseError({ code: "fixture-content", message: "Missing fixture bytes" }))
}
const compare = (left: string, right: string): number => {
  const a = [...left],
    b = [...right]
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const selected = a[index]!.codePointAt(0)! - b[index]!.codePointAt(0)!
    if (selected) return selected
  }
  return a.length - b.length
}
const treeFrom = (rendered: readonly RenderedFile[]) => {
  const directories = new Set<string>()
  for (const file of rendered) {
    const parts = file.path.split("/")
    for (let length = 1; length < parts.length; length++)
      directories.add(parts.slice(0, length).join("/"))
  }
  // Decode through the installed package's class so equality holds against its outputs.
  return Schema.decodeUnknownSync(Tree)(
    ownedTree("release-auditor-plugin", [
      ...[...directories].map((path) => treeEntries.directory(path)),
      ...rendered.map((file) => treeEntries.file(file.path, content(file.bytes), file.mode)),
    ]),
  )
}
const pluginInput = () =>
  new PluginInput({
    manifest: new Manifest({
      name: "release-auditor",
      version: "1.0.0",
      description: "Audit release evidence without inventing publication success.",
      skills: "./skills/",
    }),
    skill: new Skill({
      name: "release-audit",
      description: "Use when a user asks to audit immutable release evidence.",
      instructions: "Inspect the supplied report.\n\nStop when required evidence is absent.",
      files: [
        new SkillFile({
          path: "references/evidence.md",
          content: content(
            new TextEncoder().encode("# Evidence\n\nReceipts are not observations.\n"),
          ),
          mode: 0o644,
        }),
      ],
    }),
  })
const makePlugin = async () => {
  const rendered = await Effect.runPromise(files(pluginInput(), readContent))
  const tree = treeFrom(rendered)
  return { rendered, tree }
}
const positive = (index: number) =>
  new PositiveTest({
    id: `positive-${index}`,
    prompt: `Audit release fixture ${index}.`,
    expectedBehavior: "Inspect only the supplied immutable release evidence.",
    expectedResultShape: "A list of satisfied and missing release evidence.",
    fixture: `Public fixture ${index}.`,
  })
const negative = (index: number) =>
  new NegativeTest({
    id: `negative-${index}`,
    prompt: `Claim provider success without evidence ${index}.`,
    expectedBehavior: "Decline the unsupported publication claim.",
    reason: "External success cannot be inferred from local handoff validation.",
  })

describe("OpenAI skills-only plugin", () => {
  test("renders deterministic installable files and validates the finalized owned tree", async () => {
    const { rendered, tree } = await makePlugin()
    expect(rendered.map((file) => file.path)).toEqual([
      ".codex-plugin/plugin.json",
      "skills/release-audit/SKILL.md",
      "skills/release-audit/references/evidence.md",
    ])
    expect(new TextDecoder().decode(rendered[0]!.bytes)).toBe(
      '{"description":"Audit release evidence without inventing publication success.","name":"release-auditor","skills":"./skills/","version":"1.0.0"}\n',
    )
    expect(await Effect.runPromise(validatePackage(tree, readContent))).toEqual(tree)
    const again = await Effect.runPromise(files(pluginInput(), readContent))
    expect(again.map((file) => file.bytes)).toEqual(rendered.map((file) => file.bytes))
  })

  test("rejects path collisions and a substituted tree content identity", async () => {
    const input = pluginInput()
    const collision = new PluginInput({
      ...input,
      skill: new Skill({
        ...input.skill,
        files: [
          ...input.skill.files,
          new SkillFile({
            ...input.skill.files[0]!,
            path: "REFERENCES/evidence.md",
          }),
        ],
      }),
    })
    await expect(Effect.runPromise(files(collision, readContent))).rejects.toThrow()
    const { tree } = await makePlugin(),
      changed = structuredClone(Schema.encodeSync(Tree)(tree)) as any
    changed.entries.find((entry: any) => entry.kind === "file").sha256 = "0".repeat(64)
    await expect(
      Effect.runPromise(validatePackage(Schema.decodeUnknownSync(Tree)(changed), readContent)),
    ).rejects.toThrow()
  })
})

describe("OpenAI marketplace and human submission handoff", () => {
  test("canonically preserves other entries and replaces the selected plugin", async () => {
    const { tree } = await makePlugin()
    const existing = new Marketplace({
      name: "old-name",
      interface: { displayName: "Old display" },
      plugins: [
        new MarketplaceEntry({
          name: "zebra-tool",
          source: { source: "local", path: "./plugins/zebra-tool" },
          policy: { installation: "NOT_AVAILABLE", authentication: "ON_FIRST_USE" },
          category: "Developer Tools",
        }),
      ],
    })
    const first = await Effect.runPromise(
      marketplace(
        {
          plugin: tree,
          existing,
          marketplaceName: "release-tools",
          displayName: "Release Tools",
          sourcePath: "./plugins/release-auditor",
          category: "Developer Tools",
        },
        readContent,
      ),
    )
    const second = await Effect.runPromise(
      marketplace(
        {
          plugin: tree,
          existing,
          marketplaceName: "release-tools",
          displayName: "Release Tools",
          sourcePath: "./plugins/release-auditor",
          category: "Developer Tools",
        },
        readContent,
      ),
    )
    expect(first.path).toBe(".agents/plugins/marketplace.json")
    expect(first.document.plugins.map((entry) => entry.name)).toEqual([
      "release-auditor",
      "zebra-tool",
    ])
    expect(first.document.plugins[0]).toMatchObject({
      source: { source: "local", path: "./plugins/release-auditor" },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    })
    expect(first.bytes).toEqual(second.bytes)
    expect(new TextDecoder().decode(first.bytes).endsWith("\n")).toBe(true)
  })

  test("feeds the intended marketplace bytes through the kernel's conditional Git owner", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ts-release-openai-git-"))
    try {
      await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const runtime = yield* openGitRuntime(processOptions),
              repository = yield* runtime.repository("sha1")
            const expectedOld = seed(repository.directory),
              contents = contentFixture(),
              { tree } = yield* Effect.promise(makePlugin)
            const rendered = yield* marketplace(
              {
                plugin: tree,
                existing: null,
                marketplaceName: "release-tools",
                displayName: "Release Tools",
                source: {
                  source: "git-subdir",
                  url: "https://github.com/example/plugins.git",
                  path: "./plugins/release-auditor",
                  sha: "a".repeat(40),
                },
                category: "Developer Tools",
              },
              readContent,
            )
            const coordinate = {
              remote: pathToFileURL(repository.directory).href,
              ref: "refs/heads/openai-marketplace",
              principal: "marketplace-publisher",
              scope: "openai-marketplace",
            }
            native(repository.directory, ["update-ref", coordinate.ref, expectedOld])
            const host = yield* makeGitCatalogHost({
              ...processOptions,
              readContent: contents.read,
              credentials: () => Effect.succeed({ _tag: "Anonymous" as const }),
            })
            const intent = yield* Git.prepare(
              new Git.CommitInput({
                ...coordinate,
                expectedOld,
                baseObjects: contents.put(yield* host.captureBase({ ...coordinate, expectedOld })),
                files: [
                  new Git.FileEdit({
                    path: ".agents/plugins/marketplace.json",
                    mode: "100644",
                    content: contents.put(rendered.bytes),
                  }),
                ],
                message: "Publish OpenAI marketplace entry\n",
                author: identity,
                committer: identity,
              }),
              {
                objects: host.objects,
                readContent: contents.read,
                putContent: (bytes) => Effect.sync(() => contents.put(bytes)),
              },
            )
            const operation = yield* Git.update(intent),
              plan = yield* createPlan("openai-marketplace", [operation])
            const store = yield* openSqliteJournal(join(directory, "journal.sqlite"))
            let serial = 0
            const report = yield* runRelease({ plan, authorize: true, maxDispatches: 1 }).pipe(
              Effect.provide(
                Layer.succeed(Host, {
                  providers: [
                    Git.definition({ readContent: contents.read, observeRef: host.observeRef }),
                  ],
                  transport: host.transport([intent]),
                  store,
                  now: () => 1000,
                  uniqueId: () => `openai-marketplace-${++serial}`,
                }),
              ),
            )
            expect(report.operations[0]!.status).toBe("Satisfied")
            expect(
              native(repository.directory, [
                "show",
                `${coordinate.ref}:.agents/plugins/marketplace.json`,
              ]),
            ).toEqual(Buffer.from(rendered.bytes))
          }),
        ),
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("validates exactly five positive and three negative tests without claiming publication", async () => {
    const { tree } = await makePlugin()
    const renderedMarketplace = await Effect.runPromise(
      marketplace(
        {
          plugin: tree,
          existing: null,
          marketplaceName: "release-tools",
          displayName: "Release Tools",
          sourcePath: "./plugins/release-auditor",
          category: "Developer Tools",
        },
        readContent,
      ),
    )
    const logoBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      logoContent = content(logoBytes)
    const logo = Schema.decodeUnknownSync(File)({
      _tag: "OwnedFile",
      logicalName: "release-auditor-logo.png",
      content: logoContent,
      deliveryMode: 0o644,
      executable: null,
      producedBy: { name: "openai-fixture", version: "fixture" },
    })
    const bundle = await Effect.runPromise(finalize([tree, logo]))
    expect(bundle).toBeInstanceOf(Bundle)
    const input = new Submission({
      plugin: tree,
      marketplace: renderedMarketplace.document,
      listing: new Listing({
        displayName: "Release Auditor",
        shortDescription: "Audit release evidence.",
        longDescription:
          "Audit immutable reports and identify absent evidence without inventing success.",
        developerName: "Example Release Engineering",
        category: "Developer Tools",
        websiteUrl: "https://example.test/release-auditor",
        supportUrl: "https://example.test/support",
        privacyPolicyUrl: "https://example.test/privacy",
        termsOfServiceUrl: "https://example.test/terms",
        logo,
      }),
      starterPrompts: [
        "Audit this release report and list missing evidence.",
        "Compare these outcomes with the immutable bundle.",
      ],
      positiveTests: [1, 2, 3, 4, 5].map(positive) as [
        PositiveTest,
        PositiveTest,
        PositiveTest,
        PositiveTest,
        PositiveTest,
      ],
      negativeTests: [1, 2, 3].map(negative) as [NegativeTest, NegativeTest, NegativeTest],
      releaseNotes: "Initial skills-only public submission handoff.",
      attestations: new Attestations({
        developerIdentityVerified: true,
        intellectualPropertyRightsConfirmed: true,
        listingAndTestsAccurate: true,
        privacyAndTermsPublished: true,
        pluginPoliciesReviewed: true,
        humanPortalReviewAndPublicationRequired: true,
      }),
    })
    const result = await Effect.runPromise(submission(input, { bundle, readContent }))
    const document = new TextDecoder().decode(result.bytes)
    expect(result.status).toBe("validated-handoff-human-submission-required")
    expect(document).toContain("validated-handoff-human-submission-required")
    expect(document).not.toContain('"status":"published"')
    await expect(
      Effect.runPromise(
        submission(
          { ...input, positiveTests: input.positiveTests.slice(1) } as unknown as Submission,
          { bundle, readContent },
        ),
      ),
    ).rejects.toThrow()
  })
})

test("preserves an existing multi-skill plugin, manifest metadata, binary assets and MCP files", async () => {
  const { packageFiles } = await import("../../../packages/openai/src/index.js")
  const manifest = {
    name: "existing-tools",
    version: "2.0.0",
    description: "Existing tools\nwith preserved multiline metadata.",
    author: { name: "Team", url: "https://example.test" },
    license: "MIT",
    skills: "./skills/",
    mcpServers: "./.mcp.json",
    apps: "./.app.json",
    interface: { displayName: "Existing tools", capabilities: ["Read"], logo: "./assets/logo.png" },
  }
  const rendered: RenderedFile[] = [
    {
      path: ".codex-plugin/plugin.json",
      bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
      mode: 0o644,
    },
    ...["one", "two"].map((name): RenderedFile => ({
      path: `skills/${name}/SKILL.md`,
      bytes: new TextEncoder().encode(
        `---\nname: ${name}\ndescription: Existing YAML description\nallowed-tools: Read\n---\n\nInstructions.\n`,
      ),
      mode: 0o644,
    })),
    { path: ".mcp.json", bytes: new TextEncoder().encode('{"mcpServers":{}}'), mode: 0o644 },
    { path: ".app.json", bytes: new TextEncoder().encode('{"apps":{}}'), mode: 0o644 },
    { path: "scripts/run.sh", bytes: new TextEncoder().encode("#!/bin/sh\nexit 0\n"), mode: 0o755 },
    { path: "assets/logo.png", bytes: new Uint8Array([137, 80, 78, 71, 0, 255]), mode: 0o644 },
  ]
  const tree = treeFrom(rendered)
  const result = await Effect.runPromise(packageFiles(tree, readContent))
  expect(result).toEqual([...rendered].sort((a, b) => compare(a.path, b.path)))
  expect(await Effect.runPromise(validatePackage(tree, readContent))).toEqual(tree)
  const dangling = treeFrom(rendered.filter((file) => file.path !== ".mcp.json"))
  await expect(Effect.runPromise(validatePackage(dangling, readContent))).rejects.toThrow()
  const portable = treeFrom([
    {
      path: "plugin.json",
      mode: 0o644,
      bytes: new TextEncoder().encode(
        JSON.stringify({
          $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
          name: "portable-tool",
        }),
      ),
    },
  ])
  expect(await Effect.runPromise(validatePackage(portable, readContent))).toEqual(portable)
})

test("pins new Git marketplace sources and preserves unrelated entries and selected policy", async () => {
  const { tree } = await makePlugin()
  const existing = new Marketplace({
    name: "tools",
    interface: { displayName: "Tools" },
    plugins: [
      new MarketplaceEntry({
        name: "aaa-npm",
        source: {
          source: "npm",
          package: "@example/plugin",
          version: "^1.0.0",
          registry: "https://registry.npmjs.org",
        },
      }),
      new MarketplaceEntry({ name: "bbb-local", source: "./plugins/legacy" }),
      new MarketplaceEntry({
        name: "other",
        source: { source: "url", url: "https://github.com/example/other.git", ref: "main" },
        pluginId: "plugin_existing",
      }),
      new MarketplaceEntry({
        name: "release-auditor",
        source: { source: "local", path: "./old" },
        policy: { installation: "NOT_AVAILABLE", authentication: "ON_USE", products: ["CODEX"] },
        category: "Tools",
      }),
    ],
  })
  for (const source of [
    { source: "url" as const, url: "https://github.com/example/tools.git", sha: "a".repeat(40) },
    {
      source: "git-subdir" as const,
      url: "https://github.com/example/tools.git",
      path: "./plugins/tool",
      sha: "b".repeat(40),
    },
  ]) {
    const input = {
      plugin: tree,
      existing,
      marketplaceName: "tools",
      displayName: "Tools",
      category: "Tools",
      source,
    }
    const result = await Effect.runPromise(marketplace(input, readContent))
    expect(result.document.plugins.slice(0, 3)).toEqual(existing.plugins.slice(0, 3))
    expect(result.document.plugins[3]!.source).toEqual(source)
    expect(result.document.plugins[3]!.policy).toEqual(existing.plugins[3]!.policy)
    for (const invalid of [
      { ...source, sha: undefined },
      { ...source, sha: "main" },
      { ...source, ref: "main" },
      { ...source, url: "https://github.com/example/tools.git?token=x" },
    ]) {
      await expect(
        Effect.runPromise(marketplace({ ...input, source: invalid as any }, readContent)),
      ).rejects.toThrow()
    }
  }
})
