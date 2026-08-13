import * as Schema from "effect/Schema"
import { capabilityModules } from "../../src/capabilities/registry.js"
import { validateFieldOwnership } from "../../src/capabilities/field-ownership.js"
import { encodeCanonicalJson } from "../../src/model/canonical.js"
import { sha256Digest } from "../../src/model/digest.js"
import { NonEmptyName, SafeRelativePath, Version, WorkspaceRoot } from "../../src/model/primitives.js"
import { compileReleaseGraph } from "../../src/release/compiler.js"
import { VerifiedPackage, VerifiedReleaseContext, VerifiedSource } from "../../src/release/context.js"
import { ReleaseGraph } from "../../src/release/graph.js"
import { AuthoredConfig } from "../../src/resolve/authored.js"
import { ObservedFacts } from "../../src/resolve/facts.js"
import { resolveConfig } from "../../src/resolve/resolve.js"
import { authoredConfigPropertyPaths } from "./config-fields.js"

export interface FieldEffectWitnessReport {
  readonly fields: number
  readonly witnesses: number
  readonly invariantGroups: number
  readonly resolvedDeltas: number
  readonly graphDeltas: number
  readonly preparedBasisDeltas: number
  readonly failures: ReadonlyArray<string>
}

type JsonObject = Record<string, unknown>
interface MutationWitness {
  readonly id: string
  readonly fields: ReadonlyArray<string>
  readonly valid: unknown
  readonly mutated: unknown
  /** Required only when a discriminant or mutually exclusive shape changes. */
  readonly invalid?: unknown
  readonly authoringOnly?: true
  readonly literalOnly?: true
  readonly expectedFailure?: "resolve" | "graph"
}

const clone = <A>(value: A): A => structuredClone(value)
const set = (input: unknown, path: string, value: unknown): unknown => {
  const result = clone(input) as JsonObject
  const parts = path.replaceAll("[]", ".0").split(".")
  let owner: unknown = result
  for (const part of parts.slice(0, -1)) owner = Array.isArray(owner)
    ? owner[Number(part)]
    : (owner as JsonObject)[part]
  const key = parts.at(-1)!
  if (Array.isArray(owner)) owner[Number(key)] = value
  else (owner as JsonObject)[key] = value
  return result
}
const mutate = (id: string, field: string, valid: unknown, value: unknown): MutationWitness => ({
  id, fields: [field], valid, mutated: set(valid, field, value)
})
const refusal = (
  id: string,
  field: string,
  valid: unknown,
  value: unknown,
  expectedFailure: "resolve" | "graph"
): MutationWitness => ({ id, fields: [field], valid, mutated: set(valid, field, value), expectedFailure })
const presence = (id: string, field: string, valid: unknown, mutated: unknown): MutationWitness => ({
  id, fields: [field], valid, mutated
})
const invariant = (
  id: string,
  fields: ReadonlyArray<string>,
  valid: unknown,
  mutated: unknown,
  invalid: unknown
): MutationWitness => ({ id, fields, valid, mutated, invalid })
const literalInvariant = (id: string, field: string, valid: unknown, invalid: unknown): MutationWitness => ({
  id, fields: [field], valid, mutated: valid, invalid, literalOnly: true
})

const token = (credential = "NPM_TOKEN") => ({ strategy: "token", credential })
const project = (overrides: JsonObject = {}) => ({
  name: "@scope/fixture",
  packageName: "@scope/fixture",
  version: "1.0.0",
  tag: "v1.0.0",
  repository: "owner/fixture",
  ...overrides
})
const base = (overrides: JsonObject = {}) => ({ project: project(), ...overrides })
const artifact = (id = "asset-a", path = "asset-a.txt", format = "file") => ({ id, path, format })
const github = (overrides: JsonObject = {}) => ({ repository: "owner/fixture", ...overrides })
const npm = (overrides: JsonObject = {}) => ({ authentication: token(), ...overrides })
const npmConfig = (overrides: JsonObject = {}) => base({
  npmPackage: { path: "." },
  publish: { npm: npm(overrides) }
})
const pypiToken = (overrides: JsonObject = {}) => ({
  strategy: "token", credential: "PYPI_TOKEN", scope: "project", ...overrides
})
const pypiExternalAuth = (overrides: JsonObject = {}) => ({
  strategy: "trusted-publishing", owner: "external",
  action: "pypa/gh-action-pypi-publish@release/v1",
  repository: "owner/fixture", workflow: "release.yml", workflowRef: "refs/heads/main",
  environment: "pypi", projects: ["fixture"], ...overrides
})
const pypiConfig = (overrides: JsonObject = {}) => base({
  project: project({ name: "fixture", packageName: "fixture" }),
  artifacts: [artifact("pypi-wheel", "dist/fixture-1.0.0-py3-none-any.whl", "file")],
  publish: { pypi: { artifacts: ["pypi-wheel"], authentication: pypiToken(), ...overrides } }
})
const pypiExternal = (overrides: JsonObject = {}) => base({
  project: project({ name: "fixture", packageName: "fixture" }),
  artifacts: [artifact("pypi-wheel", "dist/fixture-1.0.0-py3-none-any.whl", "file")],
  publish: { pypi: { artifacts: ["pypi-wheel"], authentication: pypiExternalAuth(overrides) } }
})
const catalogSource = (artifactId: string, architecture: "x64" | "arm64") => ({ artifact: artifactId, architecture })
const homebrewCatalog = (overrides: JsonObject = {}) => ({
  id: "homebrew-a",
  formulaName: "fixture",
  description: "Fixture command",
  homepage: "https://example.test/fixture",
  license: "MIT",
  installPath: "fixture",
  sources: [catalogSource("darwin-a", "arm64")],
  ...overrides
})
const scoopCatalog = (overrides: JsonObject = {}) => ({
  id: "scoop-a",
  manifestName: "fixture",
  description: "Fixture command",
  homepage: "https://example.test/fixture",
  license: "MIT",
  bin: "fixture.exe",
  sources: [catalogSource("windows-a", "x64")],
  ...overrides
})
const catalogArtifacts = [
  artifact("darwin-a", "dist/fixture-darwin-arm64.tar.gz", "tarball"),
  artifact("darwin-b", "dist/fixture-darwin-x64.tar.gz", "tarball"),
  artifact("windows-a", "dist/fixture-windows-x64.zip", "zip"),
  artifact("windows-b", "dist/fixture-windows-arm64.zip", "zip")
]
const homebrewConfig = (overrides: JsonObject = {}) => base({
  artifacts: catalogArtifacts,
  catalogs: { homebrew: [homebrewCatalog(overrides)] }
})
const scoopConfig = (overrides: JsonObject = {}) => base({
  artifacts: catalogArtifacts,
  catalogs: { scoop: [scoopCatalog(overrides)] }
})
const bothCatalogs = () => base({
  artifacts: catalogArtifacts,
  catalogs: { homebrew: [homebrewCatalog()], scoop: [scoopCatalog()] }
})
const catalogDestination = (overrides: JsonObject = {}) => ({
  catalog: "homebrew-a",
  repository: "owner/homebrew-tap",
  branch: "main",
  targetPath: "Formula/fixture.rb",
  statePath: ".ts-release/fixture.json",
  tokenEnv: "GITHUB_TOKEN",
  ...overrides
})
const catalogPublish = (overrides: JsonObject = {}) => base({
  artifacts: catalogArtifacts,
  catalogs: { homebrew: [homebrewCatalog()], scoop: [scoopCatalog()] },
  publish: {
    github: github({ ids: catalogArtifacts.map((item) => item.id) }),
    catalogGit: [catalogDestination(overrides)]
  }
})
const outputPreparation = (overrides: JsonObject = {}) => ({
  kind: "artifact",
  id: "generate-a",
  run: ["tool-a", "{output:generated-a}"],
  outputs: [{ id: "generated-a", path: ".release/generated-a.txt", kind: "file", mediaType: "text/plain" }],
  ...overrides
})
const cardinality = (minimum = 1, maximum = 3) => ({ kind: "bounded", minimum, maximum })
const collection = (id = "collection-a", overrides: JsonObject = {}) => ({
  kind: "artifact",
  id,
  run: ["collection-tool", `{collection:${id}}`],
  collection: {
    root: `.release/${id}`,
    artifactKind: "file",
    pathSuffix: ".txt",
    mediaType: "text/plain",
    cardinality: cardinality(),
    ...overrides
  }
})
const selector = (id = "collection-a", overrides: JsonObject = {}) => ({
  collection: id,
  artifactKind: "file",
  pathSuffix: ".txt",
  mediaType: "text/plain",
  cardinality: cardinality(1, 2),
  ...overrides
})
const collectionPublish = (selectorOverrides: JsonObject = {}, producerOverrides: JsonObject = {}) => base({
  preparations: [collection("collection-a", producerOverrides)],
  publish: { github: github({ ids: [], collections: [selector("collection-a", selectorOverrides)] }) }
})
const twoTextBodies = () => base({
  preparations: [
    outputPreparation({ id: "body-a", run: ["body-a", "{output:body-a}"], outputs: [{ id: "body-a", path: "body-a.md", mediaType: "text/markdown" }] }),
    outputPreparation({ id: "body-b", run: ["body-b", "{output:body-b}"], outputs: [{ id: "body-b", path: "body-b.md", mediaType: "text/markdown" }] })
  ],
  publish: { github: github({ bodyArtifact: "body-a" }) }
})

const bare = base()
const githubBase = base({ publish: { github: github() } })
const artifactBase = base({ artifacts: [artifact()] })
const twoArtifacts = base({ artifacts: [artifact("asset-a", "asset-a.txt"), artifact("asset-b", "asset-b.txt")] })
const bunBuild = base({ builds: [{ builder: "bun", id: "cli-a", binary: "fixture-a", entry: "src/a.ts", targets: ["linux-x64"], output: ".release/{binary}-{targetTriple}" }] })
const commandBuild = base({ builds: [{ builder: "command", id: "cli-a", binary: "fixture-a", targets: ["linux-x64"], output: ".release/a-{targetTriple}", run: ["tool-a"] }] })
const preparationBase = base({ artifacts: [artifact("input-a", "input-a.txt"), artifact("input-b", "input-b.txt")], preparations: [outputPreparation({ cwd: "tools-a", inputs: ["input-a"] })] })
const producerCollection = base({ preparations: [collection()] })
const archiveBase = base({ artifacts: [artifact()], archives: [{ id: "archive-a", ids: ["asset-a"], nameTemplate: "fixture-a-{version}", formats: ["tar.gz"] }] })
const trusted = base({ npmPackage: { path: "." }, publish: { npm: npm({
  authentication: {
    strategy: "trusted-publishing",
    attestation: {
      provider: "github-actions",
      runner: "github-hosted",
      repository: "owner/fixture",
      workflow: "release.yml",
      workflowRef: "refs/heads/main",
      allowedAction: "npm-publish-direct"
    }
  }
}) } })

const witnesses: ReadonlyArray<MutationWitness> = [
  { id: "schema", fields: ["$schema"], valid: set(bare, "$schema", "https://example.test/a.json"), mutated: set(bare, "$schema", "https://example.test/b.json"), authoringOnly: true },
  invariant("project-required", ["project"], bare, base({ project: project({ name: "fixture-b" }) }), {}),
  mutate("project-name", "project.name", githubBase, "fixture-b"),
  mutate("project-package-name", "project.packageName", npmConfig(), "@scope/package-b"),
  mutate("project-repository", "project.repository", githubBase, "owner/other"),
  mutate("project-tag", "project.tag", githubBase, "release-1.0.0"),
  mutate("project-tag-template", "project.tagTemplate", { project: { name: "fixture", version: "1.0.0", repository: "owner/fixture", tagTemplate: "v{version}" }, publish: { github: github() } }, "release-{version}"),
  mutate("project-version", "project.version", { project: { name: "fixture", version: "1.0.0", tagTemplate: "v{version}", repository: "owner/fixture" }, publish: { github: github() } }, "1.0.1"),
  mutate("version-source", "versionFrom", { project: { name: "fixture", tagTemplate: "v{version}", repository: "owner/fixture" }, versionFrom: "manifest", publish: { github: github() } }, "git-tag"),

  presence("artifacts", "artifacts", bare, artifactBase),
  mutate("artifact-format", "artifacts[].format", artifactBase, "executable"),
  mutate("artifact-id", "artifacts[].id", artifactBase, "asset-b"),
  mutate("artifact-path", "artifacts[].path", artifactBase, "asset-b.txt"),

  presence("builds", "builds", bare, bunBuild),
  mutate("build-binary", "builds[].binary", bunBuild, "fixture-b"),
  invariant("build-builder", ["builds[].builder"], bunBuild, commandBuild, base({ builds: [{ builder: "command", id: "cli-a", targets: ["linux-x64"], output: ".release/a" }] })),
  mutate("build-entry", "builds[].entry", bunBuild, "src/b.ts"),
  mutate("build-id", "builds[].id", bunBuild, "cli-b"),
  mutate("build-minify", "builds[].minify", bunBuild, true),
  mutate("build-output", "builds[].output", bunBuild, ".release/b-{targetTriple}"),
  mutate("build-run", "builds[].run", commandBuild, ["tool-b"]),
  mutate("build-targets", "builds[].targets", bunBuild, ["darwin-arm64"]),

  presence("npm-package", "npmPackage", bare, base({ npmPackage: { path: "." } })),
  mutate("npm-package-path", "npmPackage.path", base({ npmPackage: { path: "." } }), "package"),
  presence("npm-package-build", "npmPackage.build", base({ npmPackage: { path: "." } }), base({ npmPackage: { path: ".", build: { run: ["build-a"], outputRoots: ["dist"] } } })),
  mutate("npm-package-build-roots", "npmPackage.build.outputRoots", base({ npmPackage: { path: ".", build: { run: ["build-a"], outputRoots: ["dist-a"] } } }), ["dist-b"]),
  mutate("npm-package-build-run", "npmPackage.build.run", base({ npmPackage: { path: ".", build: { run: ["build-a"], outputRoots: ["dist"] } } }), ["build-b"]),

  presence("preparations", "preparations", bare, base({ preparations: [{ kind: "check", id: "check-a", run: ["check-a"] }] })),
  mutate("preparation-cwd", "preparations[].cwd", preparationBase, "tools-b"),
  mutate("preparation-id", "preparations[].id", preparationBase, "generate-b"),
  mutate("preparation-inputs", "preparations[].inputs", preparationBase, ["input-b"]),
  invariant("preparation-kind", ["preparations[].kind"], base({ preparations: [{ kind: "check", id: "check-a", run: ["check-a"] }] }), base({ preparations: [outputPreparation()] }), base({ preparations: [{ kind: "artifact", id: "invalid", run: ["invalid"] }] })),
  invariant("preparation-output-or-collection", ["preparations[].outputs", "preparations[].collection"], base({ preparations: [outputPreparation()] }), producerCollection, base({ preparations: [{ kind: "artifact", id: "invalid", run: ["invalid"] }] })),
  mutate("preparation-output-id", "preparations[].outputs[].id", base({ preparations: [outputPreparation({ run: ["tool-a"] })] }), "generated-b"),
  mutate("preparation-output-kind", "preparations[].outputs[].kind", preparationBase, "executable"),
  mutate("preparation-output-media", "preparations[].outputs[].mediaType", preparationBase, "application/octet-stream"),
  mutate("preparation-output-path", "preparations[].outputs[].path", preparationBase, ".release/generated-b.txt"),
  mutate("preparation-run", "preparations[].run", preparationBase, ["tool-b", "{output:generated-a}"]),

  refusal("collection-artifact-kind", "preparations[].collection.artifactKind", producerCollection, "digest", "graph"),
  invariant("collection-cardinality", ["preparations[].collection.cardinality"], producerCollection, set(producerCollection, "preparations[].collection.cardinality", { kind: "one" }), set(producerCollection, "preparations[].collection.cardinality", { kind: "one", minimum: 1, maximum: 2 })),
  invariant("collection-cardinality-kind", ["preparations[].collection.cardinality.kind"], producerCollection, set(producerCollection, "preparations[].collection.cardinality", { kind: "one-or-more" }), set(producerCollection, "preparations[].collection.cardinality", { kind: "one-or-more", minimum: 1, maximum: 2 })),
  mutate("collection-cardinality-max", "preparations[].collection.cardinality.maximum", producerCollection, 4),
  mutate("collection-cardinality-min", "preparations[].collection.cardinality.minimum", producerCollection, 2),
  mutate("collection-media", "preparations[].collection.mediaType", producerCollection, "application/octet-stream"),
  mutate("collection-suffix", "preparations[].collection.pathSuffix", producerCollection, ".bin"),
  mutate("collection-root", "preparations[].collection.root", producerCollection, ".release/collection-b"),

  presence("archives", "archives", artifactBase, archiveBase),
  mutate("archive-formats", "archives[].formats", archiveBase, ["zip"]),
  mutate("archive-id", "archives[].id", archiveBase, "archive-b"),
  mutate("archive-ids", "archives[].ids", { ...twoArtifacts, archives: [{ id: "archive-a", ids: ["asset-a"], formats: ["tar.gz"] }] }, ["asset-b"]),
  mutate("archive-name", "archives[].nameTemplate", archiveBase, "fixture-b-{version}"),
  presence("checksum", "checksum", artifactBase, base({ artifacts: [artifact()], checksum: { algorithm: "sha256" } })),
  mutate("checksum-algorithm", "checksum.algorithm", base({ artifacts: [artifact()], checksum: { algorithm: "sha256" } }), "sha512"),

  presence("catalogs", "catalogs", bare, homebrewConfig()),
  presence("catalogs-homebrew", "catalogs.homebrew", scoopConfig(), bothCatalogs()),
  mutate("homebrew-description", "catalogs.homebrew[].description", homebrewConfig(), "Other command"),
  mutate("homebrew-formula", "catalogs.homebrew[].formulaName", homebrewConfig(), "fixture-other"),
  mutate("homebrew-homepage", "catalogs.homebrew[].homepage", homebrewConfig(), "https://example.test/other"),
  mutate("homebrew-id", "catalogs.homebrew[].id", homebrewConfig(), "homebrew-b"),
  mutate("homebrew-install", "catalogs.homebrew[].installPath", homebrewConfig(), "fixture-real"),
  mutate("homebrew-license", "catalogs.homebrew[].license", homebrewConfig(), "Apache-2.0"),
  mutate("homebrew-sources", "catalogs.homebrew[].sources", homebrewConfig(), [catalogSource("darwin-b", "x64")]),
  mutate("homebrew-source-arch", "catalogs.homebrew[].sources[].architecture", homebrewConfig(), "x64"),
  mutate("homebrew-source-artifact", "catalogs.homebrew[].sources[].artifact", homebrewConfig(), "darwin-b"),

  presence("catalogs-scoop", "catalogs.scoop", homebrewConfig(), bothCatalogs()),
  mutate("scoop-bin", "catalogs.scoop[].bin", scoopConfig(), "fixture-real.exe"),
  mutate("scoop-description", "catalogs.scoop[].description", scoopConfig(), "Other command"),
  mutate("scoop-homepage", "catalogs.scoop[].homepage", scoopConfig(), "https://example.test/other"),
  mutate("scoop-id", "catalogs.scoop[].id", scoopConfig(), "scoop-b"),
  mutate("scoop-license", "catalogs.scoop[].license", scoopConfig(), "Apache-2.0"),
  mutate("scoop-manifest", "catalogs.scoop[].manifestName", scoopConfig(), "fixture-other"),
  mutate("scoop-sources", "catalogs.scoop[].sources", scoopConfig(), [catalogSource("windows-b", "arm64")]),
  mutate("scoop-source-arch", "catalogs.scoop[].sources[].architecture", scoopConfig(), "arm64"),
  mutate("scoop-source-artifact", "catalogs.scoop[].sources[].artifact", scoopConfig(), "windows-b"),

  presence("publish", "publish", bare, githubBase),
  presence("publish-github", "publish.github", base({ publish: {} }), githubBase),
  mutate("github-body", "publish.github.body", githubBase, "body-b"),
  mutate("github-body-artifact", "publish.github.bodyArtifact", twoTextBodies(), "body-b"),
  presence("github-collections", "publish.github.collections", producerCollection, collectionPublish()),
  refusal("github-collection-kind", "publish.github.collections[].artifactKind", collectionPublish(), "digest", "graph"),
  invariant("github-collection-cardinality", ["publish.github.collections[].cardinality"], collectionPublish(), set(collectionPublish(), "publish.github.collections[].cardinality", { kind: "one" }), set(collectionPublish(), "publish.github.collections[].cardinality", { kind: "one", minimum: 1, maximum: 2 })),
  invariant("github-collection-cardinality-kind", ["publish.github.collections[].cardinality.kind"], collectionPublish(), set(collectionPublish(), "publish.github.collections[].cardinality", { kind: "one-or-more" }), set(collectionPublish(), "publish.github.collections[].cardinality", { kind: "one-or-more", minimum: 1, maximum: 2 })),
  mutate("github-collection-cardinality-max", "publish.github.collections[].cardinality.maximum", collectionPublish(), 3),
  mutate("github-collection-cardinality-min", "publish.github.collections[].cardinality.minimum", collectionPublish(), 0),
  mutate("github-collection-id", "publish.github.collections[].collection", base({ preparations: [collection("collection-a"), collection("collection-b")], publish: { github: github({ ids: [], collections: [selector()] }) } }), "collection-b"),
  refusal("github-collection-media", "publish.github.collections[].mediaType", collectionPublish(), "application/octet-stream", "graph"),
  refusal("github-collection-suffix", "publish.github.collections[].pathSuffix", collectionPublish(), ".bin", "graph"),
  mutate("github-draft", "publish.github.draft", set(githubBase, "publish.github.draft", true), false),
  mutate("github-ids", "publish.github.ids", { ...twoArtifacts, publish: { github: github({ ids: ["asset-a"] }) } }, ["asset-b"]),
  mutate("github-prerelease", "publish.github.prerelease", githubBase, true),
  mutate("github-repository", "publish.github.repository", githubBase, "owner/other"),
  mutate("github-token", "publish.github.tokenEnv", githubBase, "OTHER_GITHUB_TOKEN"),

  presence("publish-catalog-git", "publish.catalogGit", base({
    ...bothCatalogs(),
    publish: { github: github({ ids: catalogArtifacts.map((item) => item.id) }) }
  }), catalogPublish()),
  mutate("catalog-git-branch", "publish.catalogGit[].branch", catalogPublish(), "release"),
  mutate("catalog-git-catalog", "publish.catalogGit[].catalog", catalogPublish(), "scoop-a"),
  mutate("catalog-git-repository", "publish.catalogGit[].repository", catalogPublish(), "owner/other-tap"),
  mutate("catalog-git-state", "publish.catalogGit[].statePath", catalogPublish(), ".ts-release/other.json"),
  mutate("catalog-git-target", "publish.catalogGit[].targetPath", catalogPublish(), "Formula/other.rb"),
  mutate("catalog-git-token", "publish.catalogGit[].tokenEnv", catalogPublish(), "OTHER_GITHUB_TOKEN"),

  presence("publish-npm", "publish.npm", base({ npmPackage: { path: "." }, publish: {} }), npmConfig()),
  mutate("npm-access", "publish.npm.access", npmConfig({ access: "public" }), "restricted"),
  invariant("npm-authentication", ["publish.npm.authentication"], npmConfig(), trusted, base({ npmPackage: { path: "." }, publish: { npm: {} } })),
  invariant("npm-auth-attestation", ["publish.npm.authentication.attestation"], trusted, npmConfig(), set(trusted, "publish.npm.authentication", { strategy: "trusted-publishing" })),
  invariant("npm-auth-strategy", ["publish.npm.authentication.strategy"], npmConfig(), trusted, set(npmConfig(), "publish.npm.authentication.strategy", "trusted-publishing")),
  mutate("npm-auth-credential", "publish.npm.authentication.credential", npmConfig(), "OTHER_NPM_TOKEN"),
  literalInvariant("npm-attestation-action", "publish.npm.authentication.attestation.allowedAction", trusted, set(trusted, "publish.npm.authentication.attestation.allowedAction", "other-action")),
  literalInvariant("npm-attestation-provider", "publish.npm.authentication.attestation.provider", trusted, set(trusted, "publish.npm.authentication.attestation.provider", "other-provider")),
  refusal("npm-attestation-repository", "publish.npm.authentication.attestation.repository", trusted, "owner/other", "resolve"),
  literalInvariant("npm-attestation-runner", "publish.npm.authentication.attestation.runner", trusted, set(trusted, "publish.npm.authentication.attestation.runner", "self-hosted")),
  mutate("npm-attestation-workflow", "publish.npm.authentication.attestation.workflow", trusted, "publish.yml"),
  mutate("npm-attestation-workflow-ref", "publish.npm.authentication.attestation.workflowRef", trusted, "refs/tags/v1.0.0"),
  mutate("npm-dist-tag", "publish.npm.distTag", npmConfig({ distTag: "latest" }), "next"),
  mutate("npm-provenance", "publish.npm.provenance", npmConfig({ provenance: "disabled" }), "required"),
  mutate("npm-registry", "publish.npm.registry", npmConfig({ registry: "https://registry.npmjs.org/" }), "https://registry.example.test/custom/")

  , presence("publish-pypi", "publish.pypi", base({ publish: {} }), pypiConfig())
  , mutate("pypi-artifacts", "publish.pypi.artifacts", base({
    project: project({ name: "fixture", packageName: "fixture" }),
    artifacts: [artifact("pypi-a", "dist/fixture-1.0.0-py3-none-any.whl"), artifact("pypi-b", "dist/fixture-1.0.0.tar.gz")],
    publish: { pypi: { artifacts: ["pypi-a"], authentication: pypiToken() } }
  }), ["pypi-b"])
  , invariant("pypi-authentication", ["publish.pypi.authentication"], pypiConfig(), pypiExternal(),
    set(pypiConfig(), "publish.pypi.authentication", {}))
  , invariant("pypi-auth-strategy", ["publish.pypi.authentication.strategy"], pypiConfig(), pypiExternal(),
    set(pypiConfig(), "publish.pypi.authentication.strategy", "trusted-publishing"))
  , mutate("pypi-auth-credential", "publish.pypi.authentication.credential", pypiConfig(), "OTHER_PYPI_TOKEN")
  , literalInvariant("pypi-auth-scope", "publish.pypi.authentication.scope", pypiConfig(),
    set(pypiConfig(), "publish.pypi.authentication.scope", "account"))
  , literalInvariant("pypi-external-owner", "publish.pypi.authentication.owner", pypiExternal(),
    set(pypiExternal(), "publish.pypi.authentication.owner", "stock"))
  , literalInvariant("pypi-external-action", "publish.pypi.authentication.action", pypiExternal(),
    set(pypiExternal(), "publish.pypi.authentication.action", "owner/custom@v1"))
  , refusal("pypi-external-repository", "publish.pypi.authentication.repository", pypiExternal(), "owner/other", "resolve")
  , mutate("pypi-external-workflow", "publish.pypi.authentication.workflow", pypiExternal(), "publish.yml")
  , mutate("pypi-external-workflow-ref", "publish.pypi.authentication.workflowRef", pypiExternal(), "refs/tags/v1.0.0")
  , mutate("pypi-external-environment", "publish.pypi.authentication.environment", pypiExternal(), "testpypi")
  , mutate("pypi-external-projects", "publish.pypi.authentication.projects", pypiExternal(), ["fixture", "other"])
  , mutate("pypi-repository", "publish.pypi.repository", pypiConfig({ repository: "pypi" }), "testpypi")
]

const decode = Schema.decodeUnknownSync(AuthoredConfig, { onExcessProperty: "error" })
const facts = ObservedFacts.make({
  commit: NonEmptyName.make("c".repeat(40)),
  manifestVersion: Version.make("1.0.0"),
  headTagVersion: Version.make("2.0.0")
})
const manifestDigest = sha256Digest(new TextEncoder().encode("field witness manifest"))
const context = VerifiedReleaseContext.make({
  workspace: WorkspaceRoot.make(process.cwd()),
  source: VerifiedSource.make({
    commit: facts.commit!, tree: NonEmptyName.make("d".repeat(40)), clean: true,
    packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: manifestDigest,
    repository: "owner/fixture", headTags: []
  }),
  package: VerifiedPackage.make({
    name: NonEmptyName.make("@scope/fixture"), version: Version.make("1.0.0"),
    path: SafeRelativePath.make("package.json"), digest: manifestDigest, repository: "owner/fixture"
  })
})

interface Evaluation {
  readonly decoded?: string
  readonly resolved?: string
  readonly graph?: string
  readonly basis?: string
  readonly failure?: "decode" | "resolve" | "graph"
}
const evaluate = (input: unknown): Evaluation => {
  let decoded: unknown
  try { decoded = decode(input) } catch { return { failure: "decode" } }
  let resolved: unknown
  try { resolved = resolveConfig(decoded, facts) } catch { return { decoded: encodeCanonicalJson(input), failure: "resolve" } }
  let graph: ReleaseGraph
  try { graph = compileReleaseGraph(resolved as never, context) } catch {
    return { decoded: encodeCanonicalJson(input), resolved: encodeCanonicalJson(resolved), failure: "graph" }
  }
  const graphBytes = encodeCanonicalJson(Schema.encodeSync(ReleaseGraph)(graph))
  return {
    decoded: encodeCanonicalJson(input),
    resolved: encodeCanonicalJson(resolved),
    graph: graphBytes,
    // prepareRelease stores this exact canonical graph digest in execution
    // provenance, so a graph delta is mechanically a prepared-basis delta.
    basis: sha256Digest(new TextEncoder().encode(graphBytes)).hex
  }
}

export const validateFieldEffectWitnesses = (): FieldEffectWitnessReport => {
  const paths = authoredConfigPropertyPaths()
  const ownership = validateFieldOwnership(paths, capabilityModules)
  const failures = [...ownership.failures]
  const seen = new Map<string, string>()
  let resolvedDeltas = 0
  let graphDeltas = 0
  let preparedBasisDeltas = 0
  let invariantGroups = 0

  for (const witness of witnesses) {
    for (const field of witness.fields) {
      const previous = seen.get(field)
      if (previous !== undefined) failures.push(`${field} has witnesses ${previous} and ${witness.id}`)
      seen.set(field, witness.id)
    }
    const valid = evaluate(witness.valid)
    const mutated = evaluate(witness.mutated)
    if (valid.failure !== undefined) {
      failures.push(`${witness.id} baseline fails at ${valid.failure}`)
      continue
    }
    if (witness.authoringOnly === true) {
      if (mutated.failure !== undefined || valid.decoded === mutated.decoded || valid.resolved !== mutated.resolved || valid.graph !== mutated.graph) {
        failures.push(`${witness.id} must change only authored bytes`)
      }
      continue
    }
    if (witness.literalOnly !== true && valid.decoded === mutated.decoded) failures.push(`${witness.id} did not mutate authored bytes`)
    if (witness.invalid !== undefined) {
      invariantGroups += 1
      const invalid = evaluate(witness.invalid)
      if (invalid.failure === undefined) failures.push(`${witness.id} invalid paired/discriminant combination was accepted`)
    }
    if (mutated.failure === "decode") {
      failures.push(`${witness.id} mutation is not an accepted authored value; only its explicit invalid case may fail decode`)
      continue
    }
    if (witness.literalOnly === true) continue
    if (witness.expectedFailure !== undefined && mutated.failure !== witness.expectedFailure) {
      failures.push(`${witness.id} must refuse at ${witness.expectedFailure}, got ${mutated.failure ?? "success"}`)
      continue
    }
    if (witness.expectedFailure === undefined && mutated.failure !== undefined) {
      failures.push(`${witness.id} unexpectedly refuses at ${mutated.failure}`)
      continue
    }
    if (valid.resolved !== mutated.resolved || mutated.failure === "resolve") resolvedDeltas += 1
    else failures.push(`${witness.id} has no resolved-intent effect`)

    const effects = witness.fields.map((field) => ownership.rows.find((row) => row.path === field)?.effect)
    if (effects.includes("graph")) {
      if (mutated.failure === "graph" || valid.graph !== mutated.graph) graphDeltas += 1
      else failures.push(`${witness.id} is graph-owned but has no graph delta or link refusal`)
      if (mutated.failure === undefined && valid.basis !== mutated.basis) preparedBasisDeltas += 1
    }
  }

  for (const row of ownership.rows) if (!seen.has(row.path)) failures.push(`${row.path} has no executable behavioral witness`)
  for (const field of seen.keys()) if (!paths.includes(field)) failures.push(`${field} witness names no accepted authored field`)

  return {
    fields: paths.length,
    witnesses: witnesses.length,
    invariantGroups,
    resolvedDeltas,
    graphDeltas,
    preparedBasisDeltas,
    failures
  }
}
