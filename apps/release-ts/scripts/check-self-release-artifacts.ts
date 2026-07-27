import { plan } from "@mannyc1/ts-release"
import {
  readJson, releaseConfigPath, report, root
} from "./self-release-facts.js"

const failures: Array<string> = []
const planned = await plan({ config: readJson(releaseConfigPath), workspace: root })
const stages = planned.plan.stages
const operations = [
  ...stages.build, ...stages.process, ...stages.catalog, ...stages.validate,
  ...stages.publish, ...stages.announce, ...stages.verify
]
const outputs = operations.flatMap((operation) => operation.outputs)
const outputIds = outputs.map((output) => output.id)
const outputPaths = outputs.map((output) => output.path)
const tags = new Set(operations.map((operation) => operation._tag))
const registryKinds = new Set(stages.publish.flatMap((operation) =>
  operation._tag === "PackageRegistryRelease" ? [operation.registryKind] : []))

if (outputs.length === 0) failures.push("The self-release plan declares no materialized outputs.")
if (new Set(outputIds).size !== outputIds.length) failures.push("The self-release plan declares duplicate output ids.")
if (!tags.has("ForgeRelease")) failures.push("The self-release plan has no forge release operation.")
if (!registryKinds.has("npm")) failures.push("The self-release plan has no npm registry operation.")
if (!registryKinds.has("pypi")) failures.push("The self-release plan has no PyPI registry operation.")
if (stages.catalog.length === 0) failures.push("The self-release plan has no product-owned catalog operations.")
if (outputPaths.some((path) => path.startsWith("/") || path.includes("../"))) {
  failures.push("The self-release plan contains a non-contained output path.")
}

report("self-release-artifacts-report/v2", failures, {
  planId: planned.planId,
  operations: operations.length,
  outputs: outputs.length
})
