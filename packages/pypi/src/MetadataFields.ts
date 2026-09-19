import { parse as contentType } from "content-type"
import catalog from "./SpdxCatalog.json" with { type: "json" }
import { invalid } from "./Native.js"
import { requirement, specifiers } from "./Requirement.js"

// Core metadata field introduction and multiplicity, checked before upload.
const groups = [
  [
    1.0,
    false,
    "metadata-version name version summary description keywords home-page author author-email license",
  ],
  [1.0, true, "platform"],
  [1.1, false, "download-url"],
  [1.1, true, "supported-platform classifier requires provides obsoletes"],
  [1.2, false, "maintainer maintainer-email requires-python"],
  [1.2, true, "requires-dist provides-dist obsoletes-dist requires-external project-url"],
  [2.1, false, "description-content-type"],
  [2.1, true, "provides-extra"],
  [2.2, true, "dynamic"],
  [2.4, false, "license-expression"],
  [2.4, true, "license-file"],
  [2.5, true, "import-name import-namespace"],
] as const
const fields = new Map(
  groups.flatMap(([age, multiple, names]) =>
    names.split(" ").map((name) => [name, { age, multiple }] as const),
  ),
)
const licenseIds = new Set(catalog.licenses)
const exceptionIds = new Set(catalog.exceptions)
// SPDX admission with catalog membership; no evaluation or rewriting of the
// archive's expression. Separate catalogs prevent exceptions used as licenses.
const licenseExpression = (value: string) => {
  const tokens = value.replaceAll("(", " ( ").replaceAll(")", " ) ").trim().split(/\s+/u)
  let at = 0
  const expression = (depth: number) => {
    if (depth > 64) invalid("metadata-license-bound")
    const atom = () => {
      const token = tokens[at++] ?? ""
      if (token === "(") {
        expression(depth + 1)
        if (tokens[at++] !== ")") invalid("metadata-license-expression")
      } else {
        if (
          !licenseIds.has(token.toLowerCase().replace(/\+$/u, "")) &&
          !/^LicenseRef-[A-Za-z0-9.-]+$/iu.test(token)
        )
          invalid("metadata-license-expression")
        if (tokens[at]?.toUpperCase() === "WITH") {
          at++
          if (!exceptionIds.has((tokens[at++] ?? "").toLowerCase()))
            invalid("metadata-license-exception")
        }
      }
    }
    atom()
    while (["AND", "OR"].includes(tokens[at]?.toUpperCase() ?? "")) {
      at++
      atom()
    }
  }
  expression(0)
  if (at !== tokens.length) invalid("metadata-license-expression")
}
const projectName = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/u
const keywords = new Set(
  "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(
    " ",
  ),
)

export const uploadFields = (input: Map<string, string[]>, metadataVersion: string) => {
  const entries: Array<readonly [string, string]> = [],
    labels = new Set<string>()
  for (const [key, values] of input) {
    const field = fields.get(key)
    if (!field) return invalid("metadata-unsupported-field")
    if (!field.multiple && values.length !== 1) invalid("metadata-duplicate-field")
    // Twine's explicit compatibility exception for historical setuptools.
    if (key === "license-file" && Number(metadataVersion) < 2.4) continue
    if (field.age > Number(metadataVersion)) invalid("metadata-field-version")
    for (const value of values) {
      if (value.length > 16384 && !["description", "license"].includes(key))
        invalid("metadata-value-bound")
      switch (key) {
        case "summary":
          if (/[\n\r\v\f\u001c-\u001e\u0085\u2028\u2029]/u.test(value)) invalid("metadata-summary")
          break
        case "dynamic":
          if (
            !fields.has(value.toLowerCase()) ||
            ["name", "version", "metadata-version"].includes(value.toLowerCase())
          )
            invalid("metadata-dynamic")
          break
        case "requires-python":
          specifiers(value)
          break
        case "requires-dist":
          requirement(value)
          break
        case "provides-extra":
          if (!projectName.test(value)) invalid("metadata-extra")
          break
        case "description-content-type": {
          const { type, parameters } = contentType(value)
          const names = value.matchAll(/;\s*([^\s=;]+)\s*=\s*(?:"(?:[^"\\]|\\.)*"|[^;]*)/gu)
          const seen = new Set<string>()
          for (const match of names) {
            const name = match[1]!.toLowerCase()
            if (seen.has(name)) invalid("metadata-description-parameter")
            seen.add(name)
          }
          for (const [name, encoded] of Object.entries(parameters)) {
            if (!name.includes("*")) continue
            const field = name.replace(/\*.*$/u, "")
            if (field !== "charset" && field !== "variant") continue
            if (name !== `${field}*` || parameters[field] !== undefined)
              invalid("metadata-description-parameter")
            const parts = /^([^']*)'[^']*'(.*)$/u.exec(encoded)
            if (!parts) invalid("metadata-description-parameter")
            parameters[field] = decodeURIComponent(parts![2]!)
          }
          if (
            !["text/plain", "text/x-rst", "text/markdown"].includes(type) ||
            (parameters.charset ?? "utf-8").toLowerCase() !== "utf-8" ||
            (type === "text/markdown" &&
              !["GFM", "CommonMark"].includes(parameters.variant ?? "GFM"))
          )
            invalid("metadata-description-type")
          break
        }
        case "license-expression":
          licenseExpression(value)
          break
        case "license-file":
          if (!value || value.includes("..") || /[\\*]|^(?:\/|[a-z]:\/)/iu.test(value))
            invalid("metadata-license-path")
          break
        case "project-url": {
          const comma = value.indexOf(","),
            label = (comma < 0 ? value : value.slice(0, comma)).trim()
          if (labels.has(label)) invalid("metadata-project-url-duplicate")
          labels.add(label)
          break
        }
        case "import-name":
        case "import-namespace": {
          if (key === "import-name" && values.length === 1 && value === "") break
          const [name, option, ...extra] = value.split(";")
          if (
            extra.length ||
            (option !== undefined && option.trimStart() !== "private") ||
            name!
              .trimEnd()
              .split(".")
              .some(
                (part) =>
                  !/^(?:[_\p{XID_Start}])(?:[_\p{XID_Continue}])*$/u.test(part) ||
                  /[\u200c\u200d]/u.test(part) ||
                  keywords.has(part),
              )
          )
            invalid("metadata-import-name")
          break
        }
      }
      // Twine 7 validates 2.5+ metadata but these remain archive-only; its
      // legacy upload mapping has no import-name/import-namespace fields.
      if (key.startsWith("import-")) continue
      const name =
        key === "classifier"
          ? "classifiers"
          : key === "project-url"
            ? "project_urls"
            : key.replaceAll("-", "_")
      const normalized =
        key === "keywords"
          ? value
              .split(",")
              .map((word) => word.trim())
              .join(", ")
          : key === "project-url"
            ? (() => {
                const at = value.indexOf(",")
                return `${(at < 0 ? value : value.slice(0, at)).trim()}, ${at < 0 ? "" : value.slice(at + 1).trim()}`
              })()
            : value
      entries.push([name, normalized])
    }
  }
  return entries
}
