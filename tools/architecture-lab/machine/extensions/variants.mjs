import { readFile } from "node:fs/promises"

const replace = (sources, file, before, after) => {
  if (!sources[file]?.includes(before)) throw Error(`Variant drift: ${file}: ${before.slice(0,70)}`)
  sources[file] = sources[file].replace(before, after)
}

/** Counterfactual pre-extension sources are compiled and executed, not switches. */
export async function machineVariant(id, phase, canonicalSources) {
  const sources = { ...canonicalSources }
  if (id === "P04" && phase === "before") {
    replace(sources,"contracts.ts",'  status: Schema.Literals(["Satisfied", "Pending"]),\n',"")
    replace(sources,"contracts.ts",'  readonly classifyReceipt: (operation: Operation, request: RequestFacts, receipt: unknown) => "Satisfied" | "Pending"\n',"")
    replace(sources,"identity.ts",' || typeof provider.classifyReceipt !== "function"',"")
    replace(sources,"identity.ts",'      if (provider.classifyReceipt(operation, start.request, receipt) !== body.status) fail("receipt-classification", "Stored completion differs from native acceptance")\n',"")
    replace(sources,"run.ts",'        const status = yield* attempt(() => provider.classifyReceipt(operation, request.facts, nativeEvidence(provider.receiptCodec, result.receipt)))\n',"")
    replace(sources,"run.ts",'receiptVersion: provider.receiptVersion, status, receipt:', 'receiptVersion: provider.receiptVersion, receipt:')
    replace(sources,"m1-history.ts",'    if (facts.receipts.some((event) => event.body._tag === "ReceiptAccepted" && event.body.status === "Satisfied")) return "Satisfied"\n    if (facts.receipts.length > 0) return "Pending"','    if (facts.receipts.length > 0) return "Satisfied"')
    replace(sources,"m2-transition.ts",'; readonly status: "Satisfied" | "Pending"',"")
    replace(sources,"m2-transition.ts",'        if (operation.attempts.entries.some((attempt) => attempt._tag === "Accepted" && attempt.status === "Satisfied")) return "Satisfied"\n        if (operation.attempts.entries.some((attempt) => attempt._tag === "Accepted")) return "Pending"','        if (operation.attempts.entries.some((attempt) => attempt._tag === "Accepted")) return "Satisfied"')
    replace(sources,"m2-transition.ts",', status: body.status',"")
  } else if (id === "P09" && phase === "before") {
    replace(sources,"m1-history.ts",'    const body = event.body\n','    const body = event.body\n    if (this.events.some((prior) => prior.body._tag === "PlanSuperseded")) fail("closed-recovery", "Legacy supersession closes the entire history")\n')
    replace(sources,"m2-transition.ts",'    const body = event.body\n','    const body = event.body\n    if (this.report().superseded) fail("closed-recovery", "Legacy supersession closes the entire history")\n')
  } else if (id === "P09" && phase === "after") {
    for (const [file, text] of Object.entries(sources)) sources[file] = text.replaceAll('architecture-lab/event/1','architecture-lab/event/2')
    sources["recovery-migration.ts"] = await readFile(new URL("./recovery-migration.ts", import.meta.url),"utf8")
    sources["index.ts"] += '\nexport { migrateRecoveryHistory } from "./recovery-migration.js"\n'
  } else if (!(id === "P04" && phase === "after")) throw Error(`Unknown machine variant ${id}/${phase}`)
  return sources
}
