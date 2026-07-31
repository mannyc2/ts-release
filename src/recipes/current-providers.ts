import { OutputDeclaration, Write } from "../model/operation.js"
import { CandidateProvider, type CandidateConfig } from "./config.js"
import { operationId, outputId, path, recordOutput, selectedOutputs, type CurrentRows } from "./current-shared.js"
import { lowerNpm, lowerProvider } from "./current-publish.js"
import { applyCatalogCheckboxPolicy } from "./providers/catalog-policy.js"

type Named = Extract<typeof CandidateProvider.Type, { readonly credential: string; readonly destination: object }>
const lowerWrapper = (config: CandidateConfig, rows: CurrentRows, action: Named): void => {
  const inputs = selectedOutputs(rows, action.ids, () => false)
  const output = recordOutput(rows, OutputDeclaration.make({ id: outputId("npm-package"),
    path: path(`.release/npm/${config.project.name}-wrapper.json`), kind: "package", provenance: "process" }))
  rows.process.push(Write.make({ id: operationId(`provider:${action.id}:wrapper`),
    inputs: inputs.map((input) => input.id), outputs: [output], path: output.path,
    content: `${JSON.stringify({ name: action.destination.packageName, version: config.project.version,
      artifacts: inputs.map((input) => input.path).sort() })}\n` }))
  rows.publish.push(lowerNpm(config, rows, { registry: action.destination.registryUrl ??
    "https://registry.npmjs.org", packageName: action.destination.packageName ?? config.project.name,
    packagePath: output.path, tokenEnv: action.credential, access: action.options.access ?? "public",
    provenance: action.options.provenance ?? false })!) }
export const lowerCurrentProviders = (config: CandidateConfig, rows: CurrentRows): void => {
  for (const action of config.publish.providers ?? []) {
    if (action.profileId === "registry.npm-publish/v1") { lowerWrapper(config, rows, action); continue }
    if (action.profileId !== "policy.catalog-checkbox/v1") { lowerProvider(rows, action); continue }
    const index = rows.catalog.findIndex((item) => item._tag === "Write" && item.path === action.destination.file)
    const operation = rows.catalog[index]
    if (operation?._tag !== "Write" || typeof operation.content !== "string")
      throw new Error("Catalog policy target is absent.")
    rows.catalog[index] = Write.make({ ...operation,
      content: applyCatalogCheckboxPolicy(operation.content, action.options.checkboxPolicy) })
  } }
