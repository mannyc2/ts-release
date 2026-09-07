import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import * as Schema from "/tmp/ts-release-implementation/node_modules/effect/dist/Schema.js"
import { Bundle, encodeBundle } from "/tmp/ts-release-implementation/packages/ts-release/dist/Bundle.js"
const root="/tmp/ts-release-implementation"
const executable=JSON.parse(await readFile(join(root,"docs/refactor/execution/W08-executables-initial.json"),"utf8"))
const bytes=await readFile(join(executable.work,"bundle.json"))
const inputBundle=Schema.decodeUnknownSync(Bundle)(JSON.parse(bytes.toString()))
const hash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex")
const receipt=JSON.parse(JSON.stringify({input:{executableWork:executable.work,bundleSha256:hash(encodeBundle(inputBundle))}}))
assert.equal(receipt.input.bundleSha256,hash(bytes))
assert.match(receipt.input.bundleSha256,/^[a-f0-9]{64}$/)
console.log(JSON.stringify({inputBundleSha256:receipt.input.bundleSha256,exactRetainedCanonicalInputBytes:true,receiptJsonPreservesHash:true,artifacts:inputBundle.artifacts.length},null,2))
