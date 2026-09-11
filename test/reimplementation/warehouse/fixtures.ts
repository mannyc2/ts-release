import { Effect, Schema } from "effect"
import { File, Content, Bundle, type ArtifactAccess } from "@mannyc1/ts-release/bundle"
import * as PyPi from "@mannyc1/ts-release-pypi"
import { join } from "node:path"
import { createHash } from "node:crypto"

export const fixture = async (
  endpoint: PyPi.Endpoint = new PyPi.PyPi({
    uploadUrl: "https://upload.pypi.org/legacy/",
    simpleUrl: "https://pypi.org/simple/",
  }),
) => {
  const build = await Bun.file(join(import.meta.dir, "fixtures/build.json")).json()
  const contents = new Map<string, Uint8Array>(),
    artifacts: File[] = []
  for (const entry of build.files as { filename: string; sha256: string }[]) {
    const bytes = new Uint8Array(
      await Bun.file(join(import.meta.dir, "fixtures/distributions", entry.filename)).arrayBuffer(),
    )
    if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256)
      throw new Error("Native fixture changed")
    const file = Schema.decodeUnknownSync(File)({
      _tag: "OwnedFile",
      logicalName: entry.filename,
      content: new Content({ bytes: bytes.length, sha256: entry.sha256 }),
      deliveryMode: 420,
      executable: null,
      producedBy: { name: "native-python-build-fixture", version: "fixture" },
    })
    contents.set(entry.sha256, bytes)
    artifacts.push(file)
  }
  const access: ArtifactAccess = {
    bundle: new Bundle({ format: "ts-release/bundle/2", artifacts }),
    readContent: (content) => Effect.succeed(new Uint8Array(contents.get(content.sha256)!)),
  }
  const authorization = new PyPi.TokenAuthorization({
    principal: "fixture",
    username: endpoint._tag === "Compatible" ? "fixture" : "__token__",
  })
  const intents = await Promise.all(
    artifacts.map(async (distribution) => {
      const { kind, ...metadata } = await Effect.runPromise(
        PyPi.inspectDistribution(distribution, distribution.logicalName, access),
      )
      const fields = { ...metadata, distribution, endpoint, authorization }
      return kind === "wheel"
        ? new PyPi.WheelUpload(fields)
        : new PyPi.SdistUpload({ ...fields, pythonTag: "source" })
    }),
  )
  return { access, intents, contents, artifacts, endpoint }
}
