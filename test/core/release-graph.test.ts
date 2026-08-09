import { describe, expect, test } from "bun:test"
import { NonEmptyName, OperationId, OutputId, SafeRelativePath, Version, WorkspaceRoot } from "../../src/model/primitives.js"
import { VerifiedPackage, VerifiedReleaseContext, VerifiedSource } from "../../src/release/context.js"
import { compileReleaseGraph } from "../../src/release/compiler.js"
import { CapabilityContribution, GraphCommandArtifact, GraphGitHubPublication, GraphLinkError, linkContributions } from "../../src/release/graph.js"
import { CandidateArtifactPreparation, CandidateBunBuild, CandidateCheckPreparation, CandidateConfig, CandidatePreparation } from "../../src/recipes/config.js"
import { decodeReleaseIntent } from "../../src/release/config.js"
import { inspectRelease } from "../../src/release/inspect.js"
import { executableCapabilities } from "../../src/capabilities/registry.js"

const context = VerifiedReleaseContext.make({
  workspace: WorkspaceRoot.make(process.cwd()),
  source: VerifiedSource.make({ commit: NonEmptyName.make("abc123"), tree: NonEmptyName.make("tree123"), clean: true,
    packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: NonEmptyName.make("sha256:manifest"), headTags: [] }),
  package: VerifiedPackage.make({ name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"),
    path: SafeRelativePath.make("package.json"), digest: NonEmptyName.make("sha256:manifest") })
})
const artifact = (id: string, path: string) => ({
  id: OutputId.make(id), path: SafeRelativePath.make(path), kind: "file" as const, provenance: "process" as const
})
const command = (id: string, input: string, output: string) => GraphCommandArtifact.make({
  id: OperationId.make(id), argv: ["tool", `{input:${input}}`, `{output:${output}}`], cwd: SafeRelativePath.make("."),
  environmentNames: [], inputs: [OutputId.make(input)], outputs: [artifact(output, `${output}.txt`)], sourceCommit: NonEmptyName.make("abc123")
})

describe("immutable release graph", () => {
  test("compiles retained build inputs and links generated outputs", () => {
    const config = CandidateConfig.make({ project: { name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0") }, builds: [CandidateBunBuild.make({
      builder: "bun", id: "cli", entry: SafeRelativePath.make("src/index.ts"), targets: ["linux-x64"]
    })] })
    const graph = compileReleaseGraph(config, context)
    expect(graph.artifacts.some((item) => item.id === "cli-linux-x64")).toBe(true)
    expect(graph.preparations.some((item) => item._tag === "GraphCommandArtifact")).toBe(true)
  })

  test("registration order does not change the linked graph", () => {
    const left = CapabilityContribution.make({ artifacts: [artifact("input", "input.txt")], preparations: [command("b", "input", "b")], publications: [] })
    const right = CapabilityContribution.make({ artifacts: [], preparations: [GraphCommandArtifact.make({
      id: OperationId.make("a"), argv: ["generate", "{output:a}"], cwd: SafeRelativePath.make("."), environmentNames: [], inputs: [],
      outputs: [artifact("a", "a.txt")], sourceCommit: NonEmptyName.make("abc123")
    })], publications: [] })
    expect(linkContributions([left, right])).toEqual(linkContributions([right, left]))
  })

  test("missing references, duplicate producers, and cycles are typed failures", () => {
    expect(() => linkContributions([CapabilityContribution.make({ artifacts: [], preparations: [command("missing", "absent", "out")], publications: [] })])).toThrow(GraphLinkError)
    const duplicate = [artifact("input", "input.txt")]
    const producer = command("one", "input", "out")
    const second = command("two", "input", "out")
    expect(() => linkContributions([CapabilityContribution.make({ artifacts: duplicate, preparations: [producer, second], publications: [] })])).toThrow(GraphLinkError)
    const cycleA = command("a", "b", "a")
    const cycleB = command("b", "a", "b")
    expect(() => linkContributions([CapabilityContribution.make({ artifacts: [], preparations: [cycleA, cycleB], publications: [] })])).toThrow(GraphLinkError)
  })

  test("check, generator, transform, and GitHub body artifact share one command canon", () => {
    const config = CandidateConfig.make({
      project: { name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0"), repository: "owner/fixture" },
      artifacts: [{ id: OutputId.make("input"), path: SafeRelativePath.make("input.txt"), format: "file" }],
      preparations: [
        CandidateCheckPreparation.make({ kind: "check", id: NonEmptyName.make("tests"), run: ["bun", "test"] }),
        CandidateArtifactPreparation.make({ kind: "artifact", id: NonEmptyName.make("notes"), run: ["notes", "{output:notes}"], outputs: [{ id: OutputId.make("notes"), path: SafeRelativePath.make("notes.md"), mediaType: "text/markdown" }] }),
        CandidateArtifactPreparation.make({ kind: "artifact", id: NonEmptyName.make("transform"), run: ["transform", "{input:input}", "{output:transformed}"], inputs: [OutputId.make("input")], outputs: [{ id: OutputId.make("transformed"), path: SafeRelativePath.make("transformed.txt") }] })
      ],
      publish: { github: { repository: "owner/fixture", bodyArtifact: OutputId.make("notes") } }
    })
    const graph = compileReleaseGraph(config, context)
    expect(graph.preparations.filter((item) => item._tag === "GraphCommandArtifact")).toHaveLength(2)
    expect(graph.publications[0]?._tag).toBe("GraphGitHubPublication")
    expect(graph.preparations.map((item) => item.id.toString())).toContain("preparation:tests")
  })

  test("strict preparation decoding rejects output fields on checks", () => {
    expect(() => decodeReleaseIntent({
      project: { name: "fixture", version: "1.0.0", tag: "v1.0.0" },
      preparations: [{ kind: "check", id: "tests", run: ["bun", "test"], outputs: [] }]
    })).toThrow()
    expect(CandidatePreparation).toBeDefined()
  })

  test("linker rejects path vocabulary, input/output aliases, directories, and non-text body artifacts", () => {
    const badPath = GraphCommandArtifact.make({
      id: OperationId.make("bad-path"), argv: ["tool", "{custom:value}"], cwd: SafeRelativePath.make("."),
      environmentNames: [], inputs: [], outputs: [artifact("bad", "bad.txt")], sourceCommit: NonEmptyName.make("abc123")
    })
    expect(() => linkContributions([CapabilityContribution.make({ artifacts: [], preparations: [badPath], publications: [] })])).toThrow(GraphLinkError)
    const alias = GraphCommandArtifact.make({
      id: OperationId.make("alias"), argv: ["tool"], cwd: SafeRelativePath.make("."), environmentNames: [],
      inputs: [OutputId.make("same")], outputs: [artifact("same", "same.txt")], sourceCommit: NonEmptyName.make("abc123")
    })
    expect(() => linkContributions([CapabilityContribution.make({ artifacts: [], preparations: [alias], publications: [] })])).toThrow(GraphLinkError)
    const body = GraphGitHubPublication.make({ id: OperationId.make("github"), repository: "owner/fixture", tag: NonEmptyName.make("v1"),
      title: NonEmptyName.make("fixture"), bodyArtifact: OutputId.make("plain"), assetIds: [] })
    expect(() => linkContributions([CapabilityContribution.make({ artifacts: [{ ...artifact("plain", "plain.md") }], preparations: [], publications: [body] })])).toThrow(GraphLinkError)
    const duplicatePath = CapabilityContribution.make({ artifacts: [artifact("first", "same.bin"), artifact("second", "same.bin")], preparations: [], publications: [] })
    expect(() => linkContributions([duplicatePath])).toThrow(GraphLinkError)
    const packageOutputArtifact = { ...artifact("package", "package"), kind: "package" as const }
    const packageOutput = GraphCommandArtifact.make({
      id: OperationId.make("package-output"), argv: ["tool"], cwd: SafeRelativePath.make("."), environmentNames: [], inputs: [],
      outputs: [packageOutputArtifact], sourceCommit: NonEmptyName.make("abc123")
    })
    expect(() => linkContributions([CapabilityContribution.make({ artifacts: [], preparations: [packageOutput], publications: [] })])).toThrow(GraphLinkError)
    const overwrite = GraphCommandArtifact.make({
      id: OperationId.make("overwrite"), argv: ["tool"], cwd: SafeRelativePath.make("."), environmentNames: [], inputs: [OutputId.make("input")],
      outputs: [artifact("output", "input.txt")], sourceCommit: NonEmptyName.make("abc123")
    })
    expect(() => linkContributions([CapabilityContribution.make({ artifacts: [artifact("input", "input.txt")], preparations: [overwrite], publications: [] })])).toThrow(GraphLinkError)
  })

  test("inspection is a pure stable projection of verified context and graph", () => {
    const config = CandidateConfig.make({
      project: { name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0") },
      preparations: [CandidateCheckPreparation.make({ kind: "check", id: NonEmptyName.make("tests"), run: ["bun", "test"], environmentNames: ["CI"] })]
    })
    const graph = compileReleaseGraph(config, context)
    const projection = inspectRelease(context, graph, executableCapabilities.map((item) => item.id))
    expect(projection.source.commit.toString()).toBe("abc123")
    expect(projection.requirements).toEqual(["command:bun", "env:CI"])
    expect(projection.capabilities.length).toBe(executableCapabilities.length)
  })
})
