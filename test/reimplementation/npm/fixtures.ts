import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createHash } from "node:crypto"
import { Schema } from "effect"
import { File, Content, Bundle, type ArtifactAccess } from "@mannyc1/ts-release/bundle"
import { Effect } from "effect"
import { tarballDigests } from "../../../packages/npm/src/Wire.js"
import { encode } from "../../../packages/npm/src/Native.js"
import { PublishIntent, TokenAuthorization, NoProvenance } from "../../../packages/npm/src/index.js"

// Structural witness only: these bytes deliberately have no signature trust.
export const structuralBundle = (payload: Uint8Array) =>
  encode({
    mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json",
    dsseEnvelope: {
      payloadType: "application/vnd.in-toto+json",
      payload: Buffer.from(payload).toString("base64"),
      signatures: [{ sig: "AA==" }],
    },
    verificationMaterial: {
      certificate: { rawBytes: "AA==" },
      tlogEntries: [
        {
          canonicalizedBody: "AA==",
          logId: { keyId: "AA==" },
          integratedTime: "1",
          logIndex: "0",
          kindVersion: { kind: "dsse", version: "0.0.1" },
          inclusionProof: {
            logIndex: "0",
            treeSize: "1",
            hashes: [],
            rootHash: Buffer.alloc(32).toString("base64"),
            checkpoint: {
              envelope: `untrusted-fixture\n1\n${Buffer.alloc(32).toString("base64")}\n\n`,
            },
          },
        },
      ],
    },
  })

export const pack = (manifest: Record<string, unknown>) => {
  const directory = mkdtempSync(join(tmpdir(), "npm-native-pack-"))
  try {
    writeFileSync(join(directory, "package.json"), JSON.stringify(manifest))
    writeFileSync(join(directory, "index.js"), "export const native = true\n")
    const result = Bun.spawnSync(
      [
        process.execPath,
        "pm",
        "pack",
        "--ignore-scripts",
        "--filename",
        join(directory, "artifact.tgz"),
      ],
      { cwd: directory, stdout: "pipe", stderr: "pipe" },
    )
    if (result.exitCode !== 0) throw new Error(result.stderr.toString())
    return new Uint8Array(readFileSync(join(directory, "artifact.tgz")))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}
export const artifact = (name: string, bytes: Uint8Array) =>
  Schema.decodeSync(File)({
    _tag: "OwnedFile",
    logicalName: name,
    content: new Content({
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }),
    deliveryMode: 0o644,
    executable: null,
    producedBy: { name: "fixture/native-bun-pack", version: "fixture" },
  })
export const intent = (name = "@fixture/example", version = "1.2.3", initialTag = "latest") => {
  const bytes = pack({ name, version }),
    { integrity, shasum } = tarballDigests(bytes)
  return new PublishIntent({
    registry: "https://registry.npmjs.org/",
    name,
    version,
    initialTag,
    access: "public",
    tarball: artifact("example.tgz", bytes),
    integrity,
    shasum,
    authorization: new TokenAuthorization({ principal: "fixture-publisher" }),
    provenance: new NoProvenance({}),
  })
}

export const accessFor = (bytes: Uint8Array, name = "@fixture/example", version = "1.2.3") => {
  const file = artifact("package.tgz", bytes)
  const publication = new PublishIntent({
    registry: "https://registry.npmjs.org/",
    name,
    version,
    initialTag: "latest",
    access: "public",
    tarball: file,
    integrity: tarballDigests(bytes).integrity,
    shasum: tarballDigests(bytes).shasum,
    authorization: new TokenAuthorization({ principal: "fixture-publisher" }),
    provenance: new NoProvenance({}),
  })
  const access: ArtifactAccess = {
    bundle: new Bundle({ format: "ts-release/bundle/2", artifacts: [file] }),
    readContent: () => Effect.succeed(bytes.slice()),
  }
  return { publication, access }
}
