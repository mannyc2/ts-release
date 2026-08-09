import { readFile } from "node:fs/promises"

const root = new URL(".", import.meta.url)
const read = async (name: string) => readFile(new URL(name, root), "utf8")
const fail = (message: string): never => { throw new Error(message) }
const ledger = await read("decisions/207-feature-translation-ledger.md")
const parity = await read("decisions/207-parity-source-cases.md")
const families = await read("decisions/207-current-config-families.txt")
const paths = await read("decisions/207-current-config-paths.txt")
const sourceParity = [...parity.matchAll(/^\| ([CP]\d{3}) \|/gm)].map((m) => m[1])
const sourceFamilies = [...families.matchAll(/^(S\d{3}) /gm)].map((m) => m[1])
const sourcePaths = [...paths.matchAll(/^(K\d{3}) /gm)].map((m) => m[1])
const unique = (values: readonly string[], label: string) => {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index)
  if (duplicates.length > 0) fail(label + " has duplicates: " + [...new Set(duplicates)].join(", "))
}
unique(sourceParity, "parity manifest"); unique(sourceFamilies, "family manifest"); unique(sourcePaths, "path manifest")
if (sourceParity.length !== 151 || sourceFamilies.length !== 44 || sourcePaths.length !== 260) fail("frozen source counts changed")
const blocks = ledger.split(/^## /m).slice(1).filter((block) => /^S\d{3}:/.test(block))
if (blocks.length !== sourceFamilies.length) fail("expected " + sourceFamilies.length + " groups, got " + blocks.length)
const fields = ["Parity cases","Current cases","Current paths","Scenario","Observable success","Classification","Required information","Authority","Trust boundary","Durability","Failure behavior","Composition","Disposition","Owner","Evidence","Deliberate exclusions","Re-open bar"]
const allowed = new Set(["RETAIN-NATIVE","COPY-INTEROP","TRANSLATE","EXTERNALIZE","DEFER","REJECT"])
const foundParity: string[] = []; const foundFamilies: string[] = []; const foundPaths: string[] = []; const derivedParity: string[] = []; const derivedCurrent: string[] = []
for (const [index, block] of blocks.entries()) {
  for (const field of fields) {
    const matches = [...block.matchAll(new RegExp("^- \\*\\*" + field + "\\*\\*: (.+)$", "gm"))]
    if (matches.length !== 1 || matches[0][1].trim() === "") fail("group " + (index + 1) + " requires exactly one nonempty " + field)
  }
  const value = (field: string) => block.match(new RegExp("^- \\*\\*" + field + "\\*\\*: (.+)$", "m"))![1].trim()
  const disposition = value("Disposition"); if (!allowed.has(disposition)) fail("invalid disposition " + disposition)
  const parityValue = value("Parity cases"); const currentValue = value("Current cases"); const pathValue = value("Current paths")
  for (const token of parityValue === "none" ? [] : parityValue.split(/\s+/)) { if (!/^[CP]\d{3}\/[a-z0-9][a-z0-9-]*$/.test(token)) fail("invalid parity token " + token); foundParity.push(token.split("/")[0]); derivedParity.push(token) }
  for (const token of currentValue === "none" ? [] : currentValue.split(/\s+/)) { if (!/^S\d{3}\/[a-z0-9][a-z0-9-]*$/.test(token)) fail("invalid current token " + token); foundFamilies.push(token.split("/")[0]); derivedCurrent.push(token) }
  for (const token of pathValue === "none" ? [] : pathValue.split(/\s+/)) { if (!/^K\d{3}$/.test(token)) fail("invalid path token " + token); foundPaths.push(token) }
  if (disposition === "COPY-INTEROP" && !/consumer|ecosystem|format|name/i.test(block)) fail("COPY-INTEROP needs a named consumer")
  if (disposition === "TRANSLATE" && !/CommandCheck|CommandArtifact|native/i.test(block)) fail("TRANSLATE needs a native composition")
  if (["EXTERNALIZE","DEFER","REJECT"].includes(disposition) && !/Owner|Re-open bar/.test(block)) fail("external/deferred/rejected case needs owner and reopen bar")
}
const checkCoverage = (expected: readonly string[], actual: readonly string[], label: string) => { unique(actual, label); const missing = expected.filter((id) => !actual.includes(id)); const extra = actual.filter((id) => !expected.includes(id)); if (missing.length || extra.length || actual.length !== expected.length) fail(label + " coverage mismatch missing=" + missing.join(",") + " extra=" + extra.join(",")) }
checkCoverage(sourceParity, foundParity, "parity"); checkCoverage(sourceFamilies, foundFamilies, "families"); checkCoverage(sourcePaths, foundPaths, "paths")
unique(derivedParity, "derived parity cases"); unique(derivedCurrent, "derived current cases")
console.log("PASS: " + derivedParity.length + " parity cases, " + derivedCurrent.length + " current cases, " + foundPaths.length + " schema paths, " + blocks.length + " complete groups")
