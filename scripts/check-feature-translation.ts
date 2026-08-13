import { validateFeatureTranslation } from "./lib/feature-translation.js"
import { validateFieldEffectWitnesses } from "./lib/field-effect-witnesses.js"

const report = validateFeatureTranslation(process.cwd())
const witnesses = validateFieldEffectWitnesses()
const failures = [...report.failures, ...witnesses.failures]
if (failures.length > 0) {
  for (const failure of failures) console.error(failure)
  process.exitCode = 1
} else {
  console.log(`feature translation: ${report.paths} historical paths owned by ${report.families} exact families; ${witnesses.fields} accepted fields covered by ${witnesses.witnesses} executable witnesses (${witnesses.invariantGroups} paired invariants, ${witnesses.resolvedDeltas} resolved, ${witnesses.graphDeltas} graph, ${witnesses.preparedBasisDeltas} prepared-basis deltas)`)
}
