import {
  Exec, ForgeRelease, OpaquePublish, PackageRegistryRelease, PackageStorePublish, ProviderPublish,
  PackageStoreTarget, PublishCredential, ReadCredential, type OutputDeclaration
} from "../model/operation.js"
import { CheckpointId, ProfileId } from "../model/primitives.js"
import { CandidateProvider, type CandidateConfig, type CandidateRiskHook } from "./config.js"
import {
  basename, credentialName, nonEmptyCommand, operationId, path, render, selectedOutputs, type CurrentRows
} from "./current-shared.js"
import { providerProfiles } from "./providers/index.js"

const publishCredential = (name: string) => PublishCredential.make({ name: credentialName(name) })
const readCredential = (name: string) => ReadCredential.make({ name: credentialName(name) })
const trusted = (value: { readonly workflow?: string | undefined } | undefined) =>
  value === undefined ? {} : { trustedProvider: "github-actions" as const,
    trustedWorkflow: value.workflow ?? "release.yml" }
type RemoteProvider = Extract<typeof CandidateProvider.Type, { readonly credential: string }>

export const lowerNpm = (config: CandidateConfig, rows: CurrentRows, section = config.publish.npm) => {
  if (section === undefined) return undefined
  const packageName = section.packageName ?? config.project.packageName ?? config.project.name
  const packagePath = section.packagePath ?? config.project.packagePath ?? "."
  const oidc = section.trustedPublishing !== undefined
  const environmentNames = oidc ? ["ACTIONS_ID_TOKEN_REQUEST_URL", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"]
    : [section.tokenEnv ?? "NPM_TOKEN"]
  const packageOutput = rows.outputs.get("npm-package")
  const registryUrl = assertRegistryUrl(section.registry ?? "https://registry.npmjs.org")
  const publishArgv = ["npm", "publish", packagePath, "--registry", registryUrl,
    ...(section.access === undefined ? [] : ["--access", section.access]),
    ...(section.provenance === true ? ["--provenance"] : [])] as [string, ...Array<string>]
  return PackageRegistryRelease.make({
    id: operationId("npm:npm-release"), inputs: packageOutput === undefined ? [] : [packageOutput.id],
    outputs: [], description: `Publish ${packageName}@${config.project.version} to npm.`,
    registryKind: "npm", packageName, version: config.project.version, registryUrl,
    packagePath: path(packagePath), artifactPaths: [], clientExecutable: "npm",
    publishArgv,
    probeUrl: `${registryUrl.replace(/\/+$/u, "")}/${encodeURIComponent(packageName)}/${config.project.version}`,
    trustedPublishing: oidc, ...trusted(section.trustedPublishing),
    verifyPackageExists: section.trustedPublishing?.verifyPackageExists === true,
    verifyPublished: true, ...(section.access === undefined ? {} : { access: section.access }),
    ...(section.provenance === undefined ? {} : { provenance: section.provenance }),
    environmentNames, credential: publishCredential(environmentNames.at(-1)!),
    readCredential: readCredential("NPM_REGISTRY_READ"),
    contractFixtureId: "registry.npm-publish/v1" })
}
// npm and PyPI registry URLs pass the SAME closed HTTPS/DNS policy as
// provider endpoints. The row keeps the caller's exact spelling: the policy's
// canonical form would rewrite both shipped defaults (adding npm's root
// slash, stripping PyPI's /legacy/ slash) and shipped plan bytes are frozen.
export const assertRegistryUrl = (value: string): string => {
  normalizeProviderEndpoint(value)
  return value
}
export const normalizeProviderEndpoint = (value: string): string => {
  const url = new URL(value), host = url.hostname
  if (/(?:^|\/)(?:\.\.|%2e%2e)(?:\/|$)/iu.test(value) || url.protocol !== "https:" ||
    url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "" ||
    ["localhost", "::", "::1", "0.0.0.0"].includes(host) ||
    ["127.", "169.254.", "224.", "255."].some((prefix) => host.startsWith(prefix)))
    throw new Error("Provider URL violates the closed HTTPS/DNS policy.")
  return `${url.origin}${url.pathname.replace(/\/+$/u, "") || "/"}` }
export const lowerProvider = (rows: CurrentRows, action: RemoteProvider): void => {
  const profile = providerProfiles.find((item) => item.profileId === action.profileId)
  if (profile === undefined) throw new Error(`Unknown provider profile ${action.profileId}.`)
  const inputs = selectedOutputs(rows, action.ids, () => false)
  const target = "endpoint" in action ? { endpoint: normalizeProviderEndpoint(action.endpoint) } : action.destination
  const options: Record<string, string | boolean> = "endpoint" in action
    ? { method: action.method, headerNames: [...action.headerNames].sort().join(","),
        bodyMapping: action.bodyMapping }
    : Object.fromEntries(Object.entries(action.options).filter(([, value]) => value !== undefined))
  if (Object.keys(target).sort().join() !== [...profile.contract.targetCoordinates].sort().join() ||
    Object.keys(options).some((key) => !profile.contract.allowedOptions.includes(key)))
    throw new Error("Provider data does not match its immutable profile.")
  if (typeof options.baseUrl === "string") options.baseUrl = normalizeProviderEndpoint(options.baseUrl)
  const checkpoints = profile.checkpoints.flatMap((id) =>
    id === "assets" ? inputs.map((input) => `asset:${input.id}`) : [id])
  rows.publish.push(ProviderPublish.make({
    id: operationId(`provider:${action.id}`), inputs: inputs.map((input) => input.id), outputs: [],
    profileId: ProfileId.make(profile.profileId), variant: profile.contract.variant, target, options,
    dnsScope: "endpoint" in action ? action.dnsScope : action.options.dnsScope ?? "PublicOnly",
    checkpoints: [CheckpointId.make(checkpoints[0]!), ...checkpoints.slice(1).map((id) => CheckpointId.make(id))],
    credential: publishCredential(action.credential), contractFixtureId: profile.contractFixtureId })) }
const lowerPyPi = (config: CandidateConfig, rows: CurrentRows) => {
  const section = config.publish.pypi
  if (section === undefined) return undefined
  const artifacts = selectedOutputs(rows, section.ids, (item) => item.kind === "wheel")
  if (artifacts.length === 0) throw new Error("PyPI requires at least one distribution artifact.")
  const oidc = section.trustedPublishing !== undefined
  const environmentNames = oidc ? ["ACTIONS_ID_TOKEN_REQUEST_URL", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"]
    : ["TWINE_USERNAME", "TWINE_PASSWORD"]
  const registryUrl = assertRegistryUrl(section.repositoryUrl ?? "https://upload.pypi.org/legacy/")
  const python = section.pythonExecutable ?? "python"
  const artifactPaths = artifacts.map((item) => item.path)
  return PackageRegistryRelease.make({
    id: operationId("pypi:pypi-release"), inputs: artifacts.map((item) => item.id), outputs: [],
    description: `Publish ${config.project.name}@${config.project.version} to PyPI-compatible registry.`,
    registryKind: "pypi", packageName: config.project.name, version: config.project.version,
    registryUrl, packagePath: path("."), artifactPaths, clientExecutable: python,
    publishArgv: [python, "-m", "twine", "upload", "--non-interactive",
      "--repository-url", registryUrl, ...artifactPaths],
    probeUrl: `https://pypi.org/pypi/${encodeURIComponent(config.project.name)}/${
      encodeURIComponent(config.project.version)}/json`,
    trustedPublishing: oidc, ...trusted(section.trustedPublishing),
    verifyPackageExists: oidc, verifyPublished: true, environmentNames,
    credential: publishCredential(environmentNames.at(-1)!),
    readCredential: readCredential("PYPI_REGISTRY_READ"),
    contractFixtureId: "registry.pypi-publish/v1" })
}
const lowerGitHub = (config: CandidateConfig, rows: CurrentRows) => {
  const section = config.publish.github
  if (section === undefined) return undefined
  const repository = section.repository ?? config.project.repository
  if (repository === undefined) throw new Error("GitHub publishing requires a repository.")
  const assets = [...rows.outputs.values()].filter((item) => ![
    "package", "wheel", "catalog-file", "directory", "internal", "digest"].includes(item.kind))
  const credential = section.tokenEnv ?? "NO_CREDENTIAL"
  return ForgeRelease.make({
    id: operationId("github:github-release"), inputs: assets.map((item) => item.id), outputs: [],
    description: `Create GitHub release for ${config.project.name}@${config.project.version}.`,
    repository, tag: config.project.tag, title: `${config.project.name} ${config.project.version}`,
    draft: section.draft ?? true,
    prerelease: section.prerelease === "auto" ? config.project.version.includes("-")
      : section.prerelease ?? false,
    assets: assets.map((item) => ({ outputId: item.id, path: item.path, name: basename(item.path),
      contentType: "application/octet-stream" })),
    credential: publishCredential(credential), readCredential: readCredential(credential),
    contractFixtureId: "forge.github-release/v1" })
}
const opaque = (config: CandidateConfig, hook: CandidateRiskHook, prefix: string,
  description: string, output?: OutputDeclaration): OpaquePublish => {
  const environmentNames = hook.env ?? []
  return OpaquePublish.make({
    id: operationId(`${prefix}:${hook.id}${output === undefined ? "" : `:${output.id}`}`),
    inputs: output === undefined ? [] : [output.id], outputs: [], description,
    argv: nonEmptyCommand(hook.run.map((part) => render(part, config))),
    cwd: path(hook.cwd ?? "."), environmentNames,
    credential: publishCredential(environmentNames[0] ?? "OPAQUE_PUBLISH"),
    contractFixtureId: "opaque.publish-command/v1", reconciliation: "manual-only",
    irreversible: hook.risk === "irreversible" })
}
const after = (config: CandidateConfig, hook: CandidateRiskHook): Exec | OpaquePublish =>
  (hook.risk ?? "writes-local") !== "writes-local"
    ? opaque(config, hook, "hook:after", `Run ${hook.id} post-release hook.`)
    : Exec.make({
        id: operationId(`hook:after:${hook.id}`), inputs: [], outputs: [],
        description: `Run ${hook.id} post-release hook.`, contractFixtureId: "process.hook/v1",
        argv: nonEmptyCommand(hook.run.map((part) => render(part, config))),
        cwd: path(hook.cwd ?? "."), environmentNames: hook.env ?? [] })

export const lowerCurrentPublish = (config: CandidateConfig, rows: CurrentRows): void => {
  for (const [index, hook] of (config.hooks?.beforePublish ?? []).entries()) {
    rows.validate.push(Exec.make({
      id: operationId(`hook:before-publish:${index}`), inputs: [], outputs: [],
      description: `${hook.kind} before publish review.`, contractFixtureId: "process.before-publish/v1",
      argv: nonEmptyCommand(hook.run), cwd: path("."), environmentNames: [] }))
  }
  const prefix = [
    lowerNpm(config, rows), lowerPyPi(config, rows), lowerGitHub(config, rows),
    ...(config.publish.custom ?? []).flatMap((hook) => hook.ids === undefined
      ? [opaque(config, hook, "publish:custom", `Run custom publisher ${hook.id}.`)]
      : selectedOutputs(rows, hook.ids, () => false).map((output) =>
          opaque(config, hook, "publish:custom", `Publish ${output.id} with ${hook.id}.`, output)))
  ].filter((item): item is PackageRegistryRelease | ForgeRelease | OpaquePublish => item !== undefined)
  rows.publish.splice(0, 0, ...prefix)
  for (const item of config.publish.packageStores ?? []) {
    const input = rows.outputs.get(item.input)
    if (input === undefined) throw new Error(`Package store input ${item.input} is absent.`)
    rows.publish.push(PackageStorePublish.make({
      id: operationId(`package-store:${item.profileId}:${item.input}`),
      inputs: [input.id], outputs: [], profileId: item.profileId,
      target: PackageStoreTarget.make(item.target), contractFixtureId: `contract.${item.profileId}`,
      credential: publishCredential(item.profileId.endsWith("snap.v1") ? "SNAP_STORE" : "CHOCOLATEY_STORE"),
    }))
  }
  rows.publish.push(...(config.hooks?.after ?? []).map((hook) => after(config, hook)))
}
