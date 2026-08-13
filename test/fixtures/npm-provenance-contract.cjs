#!/usr/bin/env node

// Runs the installed npm/libnpmpublish provenance builder while replacing
// only Sigstore's network/signing boundary. The real npm code still reads and
// serializes the closed GitHub Actions environment.
const Module = require("node:module")

const provenancePath = process.argv[2]
if (provenancePath === undefined) {
  throw new Error("usage: npm-provenance-contract.cjs <libnpmpublish-provenance.js>")
}

const load = Module._load
Module._load = function(request, parent, isMain) {
  if (request === "sigstore") {
    return {
      attest: async (payload, payloadType) => ({
        payload: JSON.parse(Buffer.from(payload).toString("utf8")),
        payloadType
      })
    }
  }
  return load.call(this, request, parent, isMain)
}

const main = async () => {
  const { generateProvenance } = require(provenancePath)
  const result = await generateProvenance([{
    name: "pkg:npm/%40fixture/protocol@1.2.3",
    digest: { sha512: "fixture-sha512" }
  }], {})
  process.stdout.write(JSON.stringify(result))
}

main().catch((cause) => {
  process.stderr.write(`${cause instanceof Error ? cause.stack : String(cause)}\n`)
  process.exitCode = 1
})
