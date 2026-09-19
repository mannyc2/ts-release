import { readTar, readZip } from "./Archive.js"
import { invalid, own, MAX_BYTES } from "./Native.js"
import * as Model from "./Model.js"

import { uploadFields } from "./MetadataFields.js"

/** RFC822-style core metadata, including folded headers and description payload.
 * Required coordinates and every upload field come from these owned archive bytes. */
const headers = (bytes: Uint8Array) => {
  if (bytes.length > 1024 * 1024) return invalid("metadata-bound")
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replaceAll("\r\n", "\n")
  if (/[\u0000\r]/u.test(text)) invalid("metadata-text")
  const split = text.indexOf("\n\n"),
    fields = new Map<string, string[]>()
  let key: string | undefined
  for (const line of (split < 0 ? text : text.slice(0, split)).trimEnd().split("\n")) {
    if (/^[ \t]/u.test(line)) {
      if (key === undefined) invalid("metadata-fold")
      const values = fields.get(key!)!
      values[values.length - 1] += "\n" + line
      continue
    }
    const colon = line.indexOf(":"),
      name = line.slice(0, colon).toLowerCase()
    if (colon <= 0 || !/^[a-z][a-z0-9-]*$/u.test(name)) invalid("metadata-field")
    key = name
    const values = fields.get(key) ?? []
    values.push(line.slice(colon + 1).replace(/^[ \t]*/u, ""))
    fields.set(key, values)
  }
  if (split >= 0 && text.slice(split + 2)) {
    if (fields.has("description")) invalid("metadata-description")
    fields.set("description", [text.slice(split + 2)])
  }
  return fields
}
export const inspect = (filename: string, bytes: Uint8Array) => {
  own(Model.filename, filename)
  if (!bytes.length || bytes.length > MAX_BYTES) invalid("distribution-bound")
  const wheel = filename.endsWith(".whl"),
    files = filename.endsWith(".tar.gz") ? readTar(bytes) : readZip(bytes)
  const candidates = [...files].filter(([name]) =>
    wheel ? /^[^/]+\.dist-info\/METADATA$/u.test(name) : /^[^/]+\/PKG-INFO$/u.test(name),
  )
  if (candidates.length !== 1) return invalid("metadata-member")
  const [member, raw] = candidates[0]!,
    fields = headers(raw)
  const required = (key: string) => {
    const values = fields.get(key)
    if (values?.length !== 1) return invalid("metadata-required")
    return values[0]!
  }
  const name = required("name")
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/u.test(name)) invalid("metadata-name")
  const project = own(Model.project, Model.normalizeProject(name)),
    version = own(Model.version, required("version"))
  const metadataVersion = own(Model.metadataVersion, required("metadata-version"))
  let pythonTag = "source"
  if (wheel) {
    const parts = filename.slice(0, -4).split("-")
    if (
      ![5, 6].includes(parts.length) ||
      Model.normalizeProject(parts[0]!) !== project ||
      parts[1] !== version ||
      (parts.length === 6 && !/^[0-9][A-Za-z0-9_]*$/u.test(parts[2]!))
    )
      invalid("wheel-filename")
    const [py, abi, platform] = parts.slice(-3)
    if (![py, abi, platform].every((tag) => /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/u.test(tag!)))
      invalid("wheel-tag")
    pythonTag = py!
    const directory = member.slice(0, -"METADATA".length)
    if (directory !== `${parts[0]}-${version}.dist-info/`) invalid("wheel-metadata-directory")
    const wheelBytes = files.get(`${directory}WHEEL`)
    if (!wheelBytes) return invalid("wheel-description")
    const info = headers(wheelBytes),
      tags = info.get("tag") ?? []
    const expected = py!
      .split(".")
      .flatMap((p) =>
        abi!.split(".").flatMap((a) => platform!.split(".").map((s) => `${p}-${a}-${s}`)),
      )
    if (
      info.get("wheel-version")?.length !== 1 ||
      !/^1\.[0-9]+$/u.test(info.get("wheel-version")![0]!) ||
      tags.length !== expected.length ||
      new Set(tags).size !== tags.length ||
      expected.some((tag) => !tags.includes(tag))
    )
      invalid("wheel-description-tags")
  } else {
    const root = member.split("/")[0]!,
      stem = filename.replace(/\.(?:tar\.gz|zip)$/u, "")
    if (
      root !== stem ||
      !stem.endsWith(`-${version}`) ||
      Model.normalizeProject(stem.slice(0, -version.length - 1)) !== project ||
      [...files.keys()].some((path) => !path.startsWith(`${root}/`))
    )
      invalid("sdist-filename")
  }
  fields.set("name", [project])
  const entries = uploadFields(fields, metadataVersion)
  return {
    metadata: own(Model.DistributionMetadata, {
      kind: wheel ? "wheel" : "sdist",
      project,
      version,
      metadataVersion,
      pythonTag,
      filename,
    }),
    fields: entries,
  }
}
