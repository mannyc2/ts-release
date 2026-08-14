import { describe, expect, test } from "bun:test"
import { parseSha256Hex } from "../../src/model/digest.js"
import { NonEmptyName, OperationId, OutputId, SafeRelativePath, Version, WorkspaceRoot } from "../../src/model/primitives.js"
import { VerifiedPackage, VerifiedReleaseContext, VerifiedSource } from "../../src/release/context.js"
import { compileReleaseGraph } from "../../src/release/compiler.js"
import {
  CapabilityContribution,
  GraphCommandArtifact,
  GraphGitHubPublication,
  GraphLinkError,
  linkContributions,
  makeGitHubPublicationAuthorityIntent
} from "../../src/release/graph.js"
import {
  CandidateArtifactPreparation,
  CandidateBunBuild,
  CandidateCheckPreparation,
  CandidateConfig,
  CandidateNpmPublish,
  CandidatePreparation,
  CanonicalNpmRegistryEndpoint,
  NpmDistTag,
  NpmTokenAuthentication,
  NpmTrustedPublishingAuthentication,
  NpmTrustedPublisherAttestation
} from "../../src/recipes/config.js"
import { CredentialRef } from "../../src/model/authority.js"
import { decodeReleaseIntent } from "../../src/release/config.js"
import { inspectRelease } from "../../src/release/inspect.js"
import { capabilityModules } from "../../src/capabilities/registry.js"

const context = VerifiedReleaseContext.make({
  workspace: WorkspaceRoot.make(process.cwd()),
  source: VerifiedSource.make({ commit: NonEmptyName.make("c".repeat(40)), tree: NonEmptyName.make("tree123"), clean: true,
    packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: parseSha256Hex("a".repeat(64)), headTags: [] }),
  package: VerifiedPackage.make({ name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"),
    path: SafeRelativePath.make("package.json"), digest: parseSha256Hex("a".repeat(64)) })
})
const artifact = (id: string, path: string) => ({
  id: OutputId.make(id), path: SafeRelativePath.make(path), kind: "file" as const
})
const command = (id: string, input: string, output: string) => GraphCommandArtifact.make({
  id: OperationId.make(id), argv: ["tool", `{input:${input}}`, `{output:${output}}`], cwd: SafeRelativePath.make("."),
  inputs: [OutputId.make(input)], outputs: [artifact(output, `${output}.txt`)]
})

describe("immutable release graph", () => {
  const tokenNpm = (overrides: Partial<CandidateNpmPublish> = {}): CandidateNpmPublish => CandidateNpmPublish.make({
    packageArtifact: OutputId.make("npm-package"), packageName: NonEmptyName.make("fixture"),
    registry: CanonicalNpmRegistryEndpoint.make("https://registry.example.test/custom/"),
    distTag: NpmDistTag.make("latest"), access: "public",
    authentication: NpmTokenAuthentication.make({ strategy: "token", credential: CredentialRef.make("CUSTOM_NPM_TOKEN") }),
    provenance: "required", ...overrides
  })

  test("compiles retained build inputs and links generated outputs", () => {
    const config = CandidateConfig.make({ project: { name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0") }, builds: [CandidateBunBuild.make({
      builder: "bun", id: "cli", entry: SafeRelativePath.make("src/index.ts"), targets: ["linux-x64"]
    })] })
    const graph = compileReleaseGraph(config, context)
    expect(graph.artifacts.some((item) => item.id === "cli-linux-x64")).toBe(true)
    expect(graph.preparations.some((item) => item._tag === "GraphCommandArtifact")).toBe(true)
  })

  test("renders the resolved version into declared command artifact paths", () => {
    const config = CandidateConfig.make({
      project: { name: NonEmptyName.make("fixture"), version: Version.make("1.2.3"), tag: NonEmptyName.make("v1.2.3") },
      preparations: [CandidateArtifactPreparation.make({
        kind: "artifact",
        id: NonEmptyName.make("wheel"),
        run: ["build", "{output:wheel}"],
        outputs: [{ id: OutputId.make("wheel"), path: SafeRelativePath.make("dist/fixture-{version}.whl") }]
      })]
    })
    const graph = compileReleaseGraph(config, context)
    expect(graph.artifacts.find((item) => item.id.toString() === "wheel")?.path.toString())
      .toBe("dist/fixture-1.2.3.whl")
  })

  test("registration order does not change the linked graph", () => {
    const left = CapabilityContribution.make({ artifacts: [artifact("input", "input.txt")], preparations: [command("b", "input", "b")], publications: [] })
    const right = CapabilityContribution.make({ artifacts: [], preparations: [GraphCommandArtifact.make({
      id: OperationId.make("a"), argv: ["generate", "{output:a}"], cwd: SafeRelativePath.make("."), inputs: [],
      outputs: [artifact("a", "a.txt")]
    })], publications: [] })
    expect(linkContributions([left, right])).toEqual(linkContributions([right, left]))
  })

  test("npmPackage.build compiles into an exact package-scoped build and rejects ambiguous outputs", () => {
    const config = CandidateConfig.make({
      project: { name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0") },
      npmPackage: {
        path: SafeRelativePath.make("package"),
        build: {
          run: ["bun", "--no-env-file", "--no-install", "run", "build"],
          outputRoots: [SafeRelativePath.make("dist")]
        }
      }
    })
    const graph = compileReleaseGraph(config, context)
    expect(graph.preparations.find((item) => item._tag === "GraphNpmPackageBuild")).toMatchObject({
      id: "build:npm-package",
      argv: ["bun", "--no-env-file", "--no-install", "run", "build"],
      cwd: "package",
      outputRoots: ["package/dist"]
    })
    expect(() => decodeReleaseIntent({
      project: { name: "fixture", version: "1.0.0", tag: "v1.0.0" },
      npmPackage: { build: { run: [], outputRoots: ["dist"] } }
    })).toThrow()
    expect(() => compileReleaseGraph(CandidateConfig.make({
      project: { name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0") },
      npmPackage: { build: { run: ["build"], outputRoots: [SafeRelativePath.make("generated")] } },
      artifacts: [{ id: OutputId.make("collision"), path: SafeRelativePath.make("generated/file.js"), format: "file" }]
    }), context)).toThrow(GraphLinkError)
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

  test("resolves publication authority options into exact graph intent", () => {
    const tokenGraph = compileReleaseGraph(CandidateConfig.make({
      project: {
        name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"),
        tag: NonEmptyName.make("v1.0.0"), repository: "owner/fixture"
      },
      npmPackage: { path: SafeRelativePath.make(".") },
      publish: {
        npm: tokenNpm(),
        github: { repository: "owner/fixture", tokenEnv: "CUSTOM_GITHUB_TOKEN" }
      }
    }), context)
    const npm = tokenGraph.publications.find((item) => item._tag === "GraphNpmPublication")
    const github = tokenGraph.publications.find((item) => item._tag === "GraphGitHubPublication")
    expect(npm?.registryUrl.toString()).toBe("https://registry.example.test/custom/")
    expect(npm).toMatchObject({
      packageArtifact: "npm-package", distTag: "latest", access: "public",
      provenance: "required"
    })
    expect(npm?.authority).toMatchObject({
      subject: "npm:fixture@1.0.0",
      provider: "npm",
      audience: "https://registry.example.test/custom/",
      observationStrategies: [{ kind: "anonymous" }],
      publishStrategy: { kind: "token", credential: "CUSTOM_NPM_TOKEN" }
    })
    expect(github?.authority).toMatchObject({
      subject: "github:owner/fixture#v1.0.0",
      provider: "github",
      audience: "https://api.github.com/repos/owner/fixture",
      observationStrategies: [
        { kind: "anonymous" },
        { kind: "token", credential: "CUSTOM_GITHUB_TOKEN" }
      ],
      publishStrategy: { kind: "token", credential: "CUSTOM_GITHUB_TOKEN" }
    })
    expect(makeGitHubPublicationAuthorityIntent({
      repository: "owner/fixture", tag: "v1.0.0"
    }).publishStrategy).toMatchObject({ kind: "token", credential: "GITHUB_TOKEN" })

    const trustedGraph = compileReleaseGraph(CandidateConfig.make({
      project: { name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"),
        tag: NonEmptyName.make("v1.0.0"), repository: "owner/fixture" },
      npmPackage: { path: SafeRelativePath.make(".") },
      publish: { npm: CandidateNpmPublish.make({
        packageArtifact: OutputId.make("npm-package"), packageName: NonEmptyName.make("fixture"),
        registry: CanonicalNpmRegistryEndpoint.make("https://registry.npmjs.org/"),
        distTag: NpmDistTag.make("latest"), access: "public", provenance: "automatic",
        authentication: NpmTrustedPublishingAuthentication.make({
          strategy: "trusted-publishing", attestation: NpmTrustedPublisherAttestation.make({
            provider: "github-actions", runner: "github-hosted", repository: "owner/fixture",
            workflow: "release.yml", workflowRef: "refs/heads/main", allowedAction: "npm-publish-direct"
          })
        })
      }) }
    }), context)
    const trusted = trustedGraph.publications.find((item) => item._tag === "GraphNpmPublication")
    expect(trusted?.authority.publishStrategy).toMatchObject({
      kind: "trusted-publishing", identityProvider: "github-actions", runnerClass: "github-hosted",
      repository: "owner/fixture", workflow: ".github/workflows/release.yml",
      workflowRef: "refs/heads/main", sourceCommit: "c".repeat(40),
      provenanceEnvironmentContract: "github-actions-npm-provenance-v1",
      allowedAction: "npm-publish-direct",
      publisherSink: "certified-npm-cli"
    })
    expect(trusted?.authority.observationStrategies).toEqual([{ kind: "anonymous" }])
  })

  test("rejects ambiguous or unsafe publication authority before graph linking", () => {
    const npmConfig = (npm: CandidateNpmPublish) => CandidateConfig.make({
      project: { name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0") },
      npmPackage: { path: SafeRelativePath.make(".") }, publish: { npm }
    })
    expect(() => compileReleaseGraph(npmConfig(tokenNpm({
      packageArtifact: OutputId.make("missing-package")
    })), context)).toThrow(GraphLinkError)
    expect(() => CanonicalNpmRegistryEndpoint.make("https://user:password@registry.example.test/?tenant=other"))
      .toThrow()
    expect(() => NpmTokenAuthentication.make({
      strategy: "token", credential: CredentialRef.make("not-portable-name")
    })).toThrow()
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
      inputs: [], outputs: [artifact("bad", "bad.txt")]
    })
    expect(() => linkContributions([CapabilityContribution.make({ artifacts: [], preparations: [badPath], publications: [] })])).toThrow(GraphLinkError)
    const alias = GraphCommandArtifact.make({
      id: OperationId.make("alias"), argv: ["tool"], cwd: SafeRelativePath.make("."),
      inputs: [OutputId.make("same")], outputs: [artifact("same", "same.txt")]
    })
    expect(() => linkContributions([CapabilityContribution.make({ artifacts: [], preparations: [alias], publications: [] })])).toThrow(GraphLinkError)
    const body = GraphGitHubPublication.make({ id: OperationId.make("github"), repository: "owner/fixture", tag: NonEmptyName.make("v1"), draft: false, prerelease: false,
      title: NonEmptyName.make("fixture"), bodyArtifact: OutputId.make("plain"), assetIds: [],
      assetCollections: [],
      authority: makeGitHubPublicationAuthorityIntent({ repository: "owner/fixture", tag: "v1" }) })
    expect(() => linkContributions([CapabilityContribution.make({ artifacts: [{ ...artifact("plain", "plain.md") }], preparations: [], publications: [body] })])).toThrow(GraphLinkError)
    const duplicatePath = CapabilityContribution.make({ artifacts: [artifact("first", "same.bin"), artifact("second", "same.bin")], preparations: [], publications: [] })
    expect(() => linkContributions([duplicatePath])).toThrow(GraphLinkError)
    const packageOutputArtifact = { ...artifact("package", "package"), kind: "package" as const }
    const packageOutput = GraphCommandArtifact.make({
      id: OperationId.make("package-output"), argv: ["tool"], cwd: SafeRelativePath.make("."), inputs: [],
      outputs: [packageOutputArtifact]
    })
    expect(() => linkContributions([CapabilityContribution.make({ artifacts: [], preparations: [packageOutput], publications: [] })])).toThrow(GraphLinkError)
    const overwrite = GraphCommandArtifact.make({
      id: OperationId.make("overwrite"), argv: ["tool"], cwd: SafeRelativePath.make("."), inputs: [OutputId.make("input")],
      outputs: [artifact("output", "input.txt")]
    })
    expect(() => linkContributions([CapabilityContribution.make({ artifacts: [artifact("input", "input.txt")], preparations: [overwrite], publications: [] })])).toThrow(GraphLinkError)
  })

  test("inspection is a pure stable projection of verified context and graph", () => {
    const config = CandidateConfig.make({
      project: { name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0") },
      preparations: [CandidateCheckPreparation.make({ kind: "check", id: NonEmptyName.make("tests"), run: ["bun", "test"] })]
    })
    const graph = compileReleaseGraph(config, context)
    const projection = inspectRelease(context, graph, capabilityModules.map((item) => item.id))
    expect(projection.source.commit.toString()).toBe("c".repeat(40))
    expect(projection.requirements).toEqual(["command:bun"])
    expect(projection.capabilities.length).toBe(capabilityModules.length)
  })
})
