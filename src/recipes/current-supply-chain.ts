import {
  Check, Exec, OutputDeclaration, PublishCredential, SupplyChainPublish
} from "../model/operation.js"
import type { CandidateConfig } from "./config.js"
import { credentialName, nonEmptyCommand, operationId, outputId, path,
  recordOutput, type CurrentRows } from "./current-shared.js"
import { supplyLocalProfiles } from "./supply-chain/local-profiles.js"
import { registryProfiles } from "./supply-chain/registry-profiles.js"
import { credentialedSigningProfile } from "./supply-chain/signing-profiles.js"
import { notarizationProfiles } from "./supply-chain/notarization-profiles.js"
import { attestationProfile } from "./supply-chain/attestation-profile.js"

const kinds: Readonly<Record<string, OutputDeclaration["kind"]>> = {
  "container-metadata": "container-metadata", sbom: "sbom", signature: "signature",
  "observed-container-digest": "digest", "observed-signature-digest": "digest",
  "detached-signature": "signature", "notarized-artifact": "notarized",
  "attestation-id": "attestation"
}
const declared = (rows: CurrentRows, id: string, location: string,
  type: string): OutputDeclaration => recordOutput(rows, OutputDeclaration.make({
  id: outputId(id), path: path(location), kind: kinds[type] ?? "file", provenance: "process"
}))
export const lowerCurrentSupplyChain = (config: CandidateConfig, rows: CurrentRows): void => {
  for (const action of config.supplyChain ?? []) {
    const inputs = action.inputs.map((id) => {
      const value = rows.outputs.get(id)
      if (value === undefined) throw new Error(`Supply-chain input ${id} is absent.`)
      return value
    })
    if (action.kind === "measure-size") {
      rows.process.push(Check.make({
        id: operationId(`supply:size:${action.id}`), inputs: inputs.map((item) => item.id),
        outputs: [], path: inputs[0]!.path, description: "Observe materialized artifact size."
      }))
      continue
    }
    const local = supplyLocalProfiles.find((item) => item.profileId === action.profileId)
    const remote = [
      ...registryProfiles, credentialedSigningProfile, ...notarizationProfiles, attestationProfile
    ]
      .find((item) => item.profileId === action.profileId)
    const outputType = local?.contract.outputs[0]!.type ?? remote?.contract.outputs[0]!.type
    if (outputType === undefined) throw new Error(`Unknown supply-chain profile ${action.profileId}.`)
    const outputs = action.outputs.map((item) => declared(rows, item.id, item.path, outputType))
    if (local !== undefined) {
      const argv = local.contract.invocation.argv.map((token) => token
        .replaceAll("{input}", inputs[0]!.path).replaceAll("{output}", outputs[0]!.path))
      rows.process.push(Exec.make({
        id: operationId(`supply:local:${action.id}`), inputs: inputs.map((item) => item.id), outputs,
        contractFixtureId: local.id, argv: nonEmptyCommand(argv), cwd: path("."),
        environmentNames: [], description: `Run immutable supply profile ${local.profileId}.`
      }))
      continue
    }
    rows.publish.push(SupplyChainPublish.make({
      id: operationId(`supply:publish:${action.id}`), inputs: inputs.map((item) => item.id), outputs,
      variant: remote!.contract.variant, profileId: action.profileId, target: action.target,
      credential: PublishCredential.make({ name: credentialName(
        remote!.contract.authenticationClass.split(":").at(-1)!.toUpperCase().replaceAll("-", "_")) }),
      contractFixtureId: `contract.${action.profileId}`,
      description: `Run immutable supply publication ${action.profileId}.`
    }))
  }
}
