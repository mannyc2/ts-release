import { PublishIntent } from "./Model.js"
import { encode, invalid, object, readManifest, digest } from "./Native.js"
import { type NativeScope, parseJson } from "./Native.js"
import { statement, validateProvenance } from "./Auth.js"

export const tarballDigests = (bytes: Uint8Array) => ({
  sha256: digest("sha256", bytes),
  integrity: `sha512-${Buffer.from(digest("sha512", bytes), "hex").toString("base64")}`,
  shasum: digest("sha1", bytes),
})
/** Native npm package PUT encoding, including npm's historical HTTP tarball URL. */
export const publishBody = (
  intent: PublishIntent,
  tarball: Uint8Array,
  provenance?: Uint8Array,
) => {
  const manifest = readManifest(tarball)
  if (manifest.name !== intent.name || manifest.version !== intent.version)
    invalid("manifest-coordinate")
  if (
    (manifest.private !== undefined && manifest.private !== false) ||
    manifest.packageExtensions !== undefined
  )
    invalid("manifest-publication-policy")
  const dist = manifest.dist === undefined ? {} : object(manifest.dist)
  if (manifest.publishConfig !== undefined) {
    const policy = object(manifest.publishConfig)
    const expected: Record<string, unknown> = {
      registry: intent.registry,
      access: intent.access,
      tag: intent.initialTag,
      provenance: intent.provenance._tag === "GitHubActionsProvenance",
    }
    for (const key of Object.keys(policy))
      if (!Object.hasOwn(expected, key) || policy[key] !== expected[key]) invalid("publish-config")
  }
  const attachmentName = `${intent.name}-${intent.version}.tgz`
  const { integrity, shasum } = tarballDigests(tarball)
  if (integrity !== intent.integrity || shasum !== intent.shasum) invalid("native-digests")
  const attachments: Record<string, unknown> = {
    [attachmentName]: {
      content_type: "application/octet-stream",
      data: Buffer.from(tarball).toString("base64"),
      length: tarball.byteLength,
    },
  }
  if (provenance !== undefined)
    attachments[`${intent.name}-${intent.version}.sigstore`] = {
      content_type: "application/vnd.dev.sigstore.bundle.v0.3+json",
      data: new TextDecoder("utf-8", { fatal: true }).decode(provenance),
      length: provenance.byteLength,
    }
  const document: Record<string, unknown> = {
    _id: intent.name,
    name: intent.name,
    "dist-tags": { [intent.initialTag]: intent.version },
    versions: {
      [intent.version]: {
        ...manifest,
        _id: `${intent.name}@${intent.version}`,
        dist: {
          ...dist,
          integrity,
          shasum,
          tarball: `http://registry.npmjs.org/${intent.name}/-/${attachmentName}`,
        },
      },
    },
    access: intent.access,
    _attachments: attachments,
  }
  if (manifest.description !== undefined) document.description = manifest.description
  return encode(document)
}

/** Full body admission is independent of a preparation cache. Reconstruct the
 * exact native document from admitted attachment bytes and immutable intent. */
export const admitBody = (scope: NativeScope, body: Uint8Array): void => {
  if (body.byteLength > 180 * 1024 * 1024) invalid("request-bound")
  const intent = scope.intent
  if (!("tarball" in intent)) {
    if (!Buffer.from(encode(intent.version)).equals(body)) invalid("tag-body")
    return
  }
  const attachments = object(object(parseJson(body))._attachments)
  const attachment = object(attachments[`${intent.name}-${intent.version}.tgz`])
  if (typeof attachment.data !== "string") return invalid("tarball-attachment")
  const tarball = Buffer.from(attachment.data, "base64")
  if (
    tarball.toString("base64") !== attachment.data ||
    String(tarball.length) !== intent.tarball.content.bytes ||
    digest("sha256", tarball) !== intent.tarball.content.sha256
  )
    invalid("tarball-attachment")
  let provenance: Uint8Array | undefined
  if (intent.provenance._tag === "GitHubActionsProvenance") {
    const data = object(attachments[`${intent.name}-${intent.version}.sigstore`]).data
    if (typeof data !== "string") return invalid("provenance-attachment")
    provenance = new TextEncoder().encode(data)
    if (
      String(provenance.length) !== intent.provenance.bundle.content.bytes ||
      digest("sha256", provenance) !== intent.provenance.bundle.content.sha256
    )
      invalid("provenance-attachment")
    validateProvenance(
      provenance,
      statement({ ...intent, source: intent.provenance.source }, tarball),
    )
  }
  if (!Buffer.from(publishBody(intent, tarball, provenance)).equals(body))
    invalid("native-request-body")
}
