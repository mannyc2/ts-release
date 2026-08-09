import {
  ForgeRelease, PackageRegistryRelease, PublishCredential, ReadCredential
} from "../model/operation.js"
import type { CandidateConfig } from "./config.js"
import {
  basename, credentialName, operationId, path, selectedOutputs, type CurrentRows
} from "./current-shared.js"
import { ConfigValueError } from "../model/errors.js"

const publishCredential = (name: string) => PublishCredential.make({ name: credentialName(name) })
const readCredential = (name: string) => ReadCredential.make({ name: credentialName(name) })
const trusted = (value: { readonly workflow?: string | undefined } | undefined) =>
  value === undefined ? {} : {
    trustedProvider: "github-actions" as const,
    trustedWorkflow: value.workflow ?? "release.yml"
  }

export const normalizeProviderEndpoint = (value: string): string => {
  const url = new URL(value)
  const host = url.hostname
  if (/(?:^|\/)(?:\.\.|%2e%2e)(?:\/|$)/iu.test(value) ||
    url.protocol !== "https:" || url.username !== "" || url.password !== "" ||
    url.search !== "" || url.hash !== "" ||
    ["localhost", "::", "::1", "0.0.0.0"].includes(host) ||
    ["127.", "169.254.", "224.", "255."].some((prefix) => host.startsWith(prefix)))
    throw ConfigValueError.make({ reason: "Registry URL violates the closed HTTPS/DNS policy." })
  return `${url.origin}${url.pathname.replace(/\/+$/u, "") || "/"}`
}

export const assertRegistryUrl = (value: string): string => {
  normalizeProviderEndpoint(value)
  return value
}

export const lowerNpm = (
  config: CandidateConfig, rows: CurrentRows
): PackageRegistryRelease | undefined => {
  const section = config.publish?.npm
  if (section === undefined) return undefined
  const packageName = section.packageName ?? config.project.packageName ?? config.project.name
  const packagePath = section.packagePath ?? config.project.packagePath ?? "."
  const oidc = section.trustedPublishing !== undefined
  const environmentNames = oidc
    ? ["ACTIONS_ID_TOKEN_REQUEST_URL", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"]
    : [section.tokenEnv ?? "NPM_TOKEN"]
  const packageOutput = rows.outputs.get("npm-package")
  const registryUrl = assertRegistryUrl(section.registry ?? "https://registry.npmjs.org")
  const publishArgv = [
    "npm", "publish", packagePath, "--registry", registryUrl,
    ...(section.access === undefined ? [] : ["--access", section.access]),
    ...(section.provenance === true ? ["--provenance"] : [])
  ] as [string, ...Array<string>]
  return PackageRegistryRelease.make({
    id: operationId("npm:npm-release"),
    inputs: packageOutput === undefined ? [] : [packageOutput.id],
    outputs: [],
    description: `Publish ${packageName}@${config.project.version} to npm.`,
    registryKind: "npm",
    packageName,
    version: config.project.version,
    registryUrl,
    packagePath: path(packagePath),
    artifactPaths: [],
    clientExecutable: "npm",
    publishArgv,
    probeUrl: `${registryUrl.replace(/\/+$/u, "")}/${encodeURIComponent(packageName)}/${config.project.version}`,
    trustedPublishing: oidc,
    ...trusted(section.trustedPublishing),
    verifyPackageExists: section.trustedPublishing?.verifyPackageExists === true,
    verifyPublished: true,
    ...(section.access === undefined ? {} : { access: section.access }),
    ...(section.provenance === undefined ? {} : { provenance: section.provenance }),
    environmentNames,
    credential: publishCredential(environmentNames.at(-1)!),
    readCredential: readCredential("NPM_REGISTRY_READ"),
    contractFixtureId: "registry.npm-publish/v1"
  })
}

const lowerPyPi = (
  config: CandidateConfig, rows: CurrentRows
): PackageRegistryRelease | undefined => {
  const section = config.publish?.pypi
  if (section === undefined) return undefined
  const artifacts = selectedOutputs(rows, section.ids, (item) => item.kind === "file")
  if (artifacts.length === 0)
    throw ConfigValueError.make({ reason: "PyPI requires imported distribution files." })
  const oidc = section.trustedPublishing !== undefined
  const environmentNames = oidc
    ? ["ACTIONS_ID_TOKEN_REQUEST_URL", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"]
    : ["TWINE_USERNAME", "TWINE_PASSWORD"]
  const registryUrl = assertRegistryUrl(section.repositoryUrl ?? "https://upload.pypi.org/legacy/")
  const python = section.pythonExecutable ?? "python"
  const artifactPaths = artifacts.map((item) => item.path)
  return PackageRegistryRelease.make({
    id: operationId("pypi:pypi-release"),
    inputs: artifacts.map((item) => item.id),
    outputs: [],
    description: `Publish ${config.project.name}@${config.project.version} to PyPI-compatible registry.`,
    registryKind: "pypi",
    packageName: config.project.name,
    version: config.project.version,
    registryUrl,
    packagePath: path("."),
    artifactPaths,
    clientExecutable: python,
    publishArgv: [
      python, "-m", "twine", "upload", "--non-interactive",
      "--repository-url", registryUrl, ...artifactPaths
    ],
    probeUrl: `https://pypi.org/pypi/${encodeURIComponent(config.project.name)}/${encodeURIComponent(config.project.version)}/json`,
    trustedPublishing: oidc,
    ...trusted(section.trustedPublishing),
    verifyPackageExists: oidc,
    verifyPublished: true,
    environmentNames,
    credential: publishCredential(environmentNames.at(-1)!),
    readCredential: readCredential("PYPI_REGISTRY_READ"),
    contractFixtureId: "registry.pypi-publish/v1"
  })
}

const lowerGitHub = (
  config: CandidateConfig, rows: CurrentRows
): ForgeRelease | undefined => {
  const section = config.publish?.github
  if (section === undefined) return undefined
  const repository = section.repository ?? config.project.repository
  if (repository === undefined)
    throw ConfigValueError.make({ reason: "GitHub publishing requires a repository." })
  const assets = [...rows.outputs.values()].filter((item) => ![
    "package", "wheel", "catalog-file", "directory", "internal", "digest"
  ].includes(item.kind))
  const credential = section.tokenEnv ?? "GH_TOKEN"
  return ForgeRelease.make({
    id: operationId("github:github-release"),
    inputs: assets.map((item) => item.id),
    outputs: [],
    description: `Create GitHub release for ${config.project.name}@${config.project.version}.`,
    repository,
    tag: config.project.tag,
    title: `${config.project.name} ${config.project.version}`,
    draft: section.draft ?? true,
    prerelease: section.prerelease === "auto"
      ? config.project.version.includes("-")
      : section.prerelease ?? false,
    assets: assets.map((item) => ({
      outputId: item.id,
      path: item.path,
      name: basename(item.path),
      contentType: "application/octet-stream"
    })),
    credential: publishCredential(credential),
    readCredential: readCredential(credential),
    contractFixtureId: "forge.github-release/v1"
  })
}

export const lowerCurrentPublish = (config: CandidateConfig, rows: CurrentRows): void => {
  const operations = [lowerNpm(config, rows), lowerPyPi(config, rows), lowerGitHub(config, rows)]
    .filter((item): item is PackageRegistryRelease | ForgeRelease => item !== undefined)
  rows.publish.push(...operations)
}
