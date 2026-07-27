import {
  Exec, ForgeRelease, OpaquePublish, PackageRegistryRelease, PublishCredential, ReadCredential
} from "../model/operation.js"
import type { CandidateConfig, CandidateRiskHook } from "./config.js"
import {
  basename, credentialName, nonEmptyCommand, operationId, path, render, selectedOutputs,
  type CurrentRows
} from "./current-shared.js"

const publishCredential = (name: string) => PublishCredential.make({ name: credentialName(name) })
const readCredential = (name: string) => ReadCredential.make({ name: credentialName(name) })
const trusted = (value: { readonly workflow?: string | undefined } | undefined) => value === undefined
  ? {}
  : { trustedProvider: "github-actions" as const, trustedWorkflow: value.workflow ?? "release.yml" }

const lowerNpm = (config: CandidateConfig, rows: CurrentRows) => {
  const section = config.publish.npm
  if (section === undefined) return undefined
  const packageName = section.packageName ?? config.project.packageName ?? config.project.name
  const packagePath = section.packagePath ?? config.project.packagePath ?? "."
  const oidc = section.trustedPublishing !== undefined
  const environmentNames = oidc
    ? ["ACTIONS_ID_TOKEN_REQUEST_URL", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"]
    : [section.tokenEnv ?? "NPM_TOKEN"]
  const packageOutput = rows.outputs.get("npm-package")
  const registryUrl = section.registry ?? "https://registry.npmjs.org"
  const publishArgv = [
    "npm", "publish", packagePath, "--registry", registryUrl,
    ...(section.access === undefined ? [] : ["--access", section.access]),
    ...(section.provenance === true ? ["--provenance"] : [])
  ] as [string, ...Array<string>]
  return PackageRegistryRelease.make({
    id: operationId("npm:npm-release"), inputs: packageOutput === undefined ? [] : [packageOutput.id],
    outputs: [], description: `Publish ${packageName}@${config.project.version} to npm.`,
    registryKind: "npm", packageName, version: config.project.version,
    registryUrl,
    packagePath: path(packagePath), artifactPaths: [], clientExecutable: "npm",
    publishArgv,
    probeUrl: `${registryUrl.replace(/\/+$/u, "")}/${
      encodeURIComponent(packageName)
    }/${config.project.version}`,
    trustedPublishing: oidc, ...trusted(section.trustedPublishing),
    verifyPackageExists: section.trustedPublishing?.verifyPackageExists === true,
    verifyPublished: true, ...(section.access === undefined ? {} : { access: section.access }),
    ...(section.provenance === undefined ? {} : { provenance: section.provenance }),
    environmentNames, credential: publishCredential(environmentNames.at(-1)!),
    readCredential: readCredential("NPM_REGISTRY_READ"),
    contractFixtureId: "registry.npm-publish/v1"
  })
}
const lowerPyPi = (config: CandidateConfig, rows: CurrentRows) => {
  const section = config.publish.pypi
  if (section === undefined) return undefined
  const artifacts = selectedOutputs(rows, section.ids, (item) => item.kind === "wheel")
  if (artifacts.length === 0) throw new Error("PyPI requires at least one distribution artifact.")
  const oidc = section.trustedPublishing !== undefined
  const environmentNames = oidc
    ? ["ACTIONS_ID_TOKEN_REQUEST_URL", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"]
    : ["TWINE_USERNAME", "TWINE_PASSWORD"]
  const registryUrl = section.repositoryUrl ?? "https://upload.pypi.org/legacy/"
  const python = section.pythonExecutable ?? "python"
  const artifactPaths = artifacts.map((item) => item.path)
  return PackageRegistryRelease.make({
    id: operationId("pypi:pypi-release"), inputs: artifacts.map((item) => item.id), outputs: [],
    description: `Publish ${config.project.name}@${config.project.version} to PyPI-compatible registry.`,
    registryKind: "pypi", packageName: config.project.name, version: config.project.version,
    registryUrl, packagePath: path("."), artifactPaths, clientExecutable: python,
    publishArgv: [
      python, "-m", "twine", "upload", "--non-interactive",
      "--repository-url", registryUrl, ...artifactPaths
    ],
    probeUrl: `https://pypi.org/pypi/${encodeURIComponent(config.project.name)}/${
      encodeURIComponent(config.project.version)
    }/json`,
    trustedPublishing: oidc, ...trusted(section.trustedPublishing),
    verifyPackageExists: oidc, verifyPublished: true, environmentNames,
    credential: publishCredential(environmentNames.at(-1)!),
    readCredential: readCredential("PYPI_REGISTRY_READ"),
    contractFixtureId: "registry.pypi-publish/v1"
  })
}
const lowerGitHub = (config: CandidateConfig, rows: CurrentRows) => {
  const section = config.publish.github
  if (section === undefined) return undefined
  const repository = section.repository ?? config.project.repository
  if (repository === undefined) throw new Error("GitHub publishing requires a repository.")
  const assets = [...rows.outputs.values()].filter((item) =>
    !["package", "wheel", "catalog-file", "directory", "internal", "digest"].includes(item.kind))
  const credential = section.tokenEnv ?? "NO_CREDENTIAL"
  return ForgeRelease.make({
    id: operationId("github:github-release"), inputs: assets.map((item) => item.id), outputs: [],
    description: `Create GitHub release for ${config.project.name}@${config.project.version}.`,
    repository, tag: config.project.tag, title: `${config.project.name} ${config.project.version}`,
    draft: section.draft ?? true,
    prerelease: section.prerelease === "auto"
      ? config.project.version.includes("-")
      : section.prerelease ?? false,
    assets: assets.map((item) => ({
      outputId: item.id, path: item.path, name: basename(item.path),
      contentType: "application/octet-stream"
    })),
    credential: publishCredential(credential), readCredential: readCredential(credential),
    contractFixtureId: "forge.github-release/v1"
  })
}
const opaque = (
  config: CandidateConfig, hook: CandidateRiskHook, prefix: string, description: string
): OpaquePublish => {
  const environmentNames = hook.env ?? []
  return OpaquePublish.make({
    id: operationId(`${prefix}:${hook.id}`), inputs: [], outputs: [], description,
    argv: nonEmptyCommand(hook.run.map((part) => render(part, config))),
    cwd: path(hook.cwd ?? "."), environmentNames,
    credential: publishCredential(environmentNames[0] ?? "OPAQUE_PUBLISH"),
    contractFixtureId: "opaque.publish-command/v1", reconciliation: "manual-only",
    irreversible: hook.risk === "irreversible"
  })
}
const after = (config: CandidateConfig, hook: CandidateRiskHook): Exec | OpaquePublish =>
  (hook.risk ?? "writes-local") !== "writes-local"
    ? opaque(config, hook, "hook:after", `Run ${hook.id} post-release hook.`)
    : Exec.make({
        id: operationId(`hook:after:${hook.id}`), inputs: [], outputs: [],
        description: `Run ${hook.id} post-release hook.`, contractFixtureId: "process.hook/v1",
        argv: nonEmptyCommand(hook.run.map((part) => render(part, config))),
        cwd: path(hook.cwd ?? "."), environmentNames: hook.env ?? []
      })

export const lowerCurrentPublish = (config: CandidateConfig, rows: CurrentRows): void => {
  for (const [index, hook] of (config.hooks?.beforePublish ?? []).entries()) {
    rows.validate.push(Exec.make({
      id: operationId(`hook:before-publish:${index}`), inputs: [], outputs: [],
      description: `${hook.kind} before publish review.`, contractFixtureId: "process.before-publish/v1",
      argv: nonEmptyCommand(hook.run), cwd: path("."), environmentNames: []
    }))
  }
  const prefix = [
    lowerNpm(config, rows), lowerPyPi(config, rows), lowerGitHub(config, rows),
    ...(config.publish.custom ?? []).map((hook) =>
      opaque(config, hook, "publish:custom", `Run custom publisher ${hook.id}.`))
  ].filter((item): item is PackageRegistryRelease | ForgeRelease | OpaquePublish =>
    item !== undefined)
  rows.publish.splice(0, 0, ...prefix)
  rows.publish.push(...(config.hooks?.after ?? []).map((hook) => after(config, hook)))
}
