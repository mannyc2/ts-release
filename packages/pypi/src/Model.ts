import * as Schema from "effect/Schema"
import { File } from "@mannyc1/ts-release/bundle"

export const text = Schema.NonEmptyString.check(
  Schema.makeFilter(
    (s) =>
      s.length <= 2048 &&
      s === s.normalize("NFC") &&
      s.trim() === s &&
      !/[\u0000-\u001f\u007f]/u.test(s) &&
      !/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abps]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|npm_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY)/u.test(
        s,
      ),
  ),
)
export const project = text.check(
  Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  Schema.isMaxLength(200),
)
export const normalizeProject = (name: string) =>
  Schema.decodeUnknownSync(project)(name.toLowerCase().replace(/[-_.]+/gu, "-"))
export const version = text.check(
  Schema.isPattern(
    /^(?:[0-9]+!)?[0-9]+(?:\.[0-9]+)*(?:(?:a|b|rc)[0-9]+)?(?:\.post[0-9]+)?(?:\.dev[0-9]+)?(?:\+[a-z0-9]+(?:\.[a-z0-9]+)*)?$/u,
  ),
)
export const metadataVersion = Schema.Literals([
  "1.0",
  "1.1",
  "1.2",
  "2.1",
  "2.2",
  "2.3",
  "2.4",
  "2.5",
  "2.6",
])
export const filename = text.check(
  Schema.isMaxLength(255),
  Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9_.+!-]*\.(?:whl|tar\.gz|zip)$/u),
)
const https = text.check(
  Schema.makeFilter((value) => {
    try {
      const url = new URL(value)
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        url.href === value &&
        value.endsWith("/")
      )
    } catch {
      return false
    }
  }),
)
export class PyPi extends Schema.TaggedClass<PyPi>()("PyPi", {
  uploadUrl: Schema.Literal("https://upload.pypi.org/legacy/"),
  simpleUrl: Schema.Literal("https://pypi.org/simple/"),
}) {}
export class TestPyPi extends Schema.TaggedClass<TestPyPi>()("TestPyPi", {
  uploadUrl: Schema.Literal("https://test.pypi.org/legacy/"),
  simpleUrl: Schema.Literal("https://test.pypi.org/simple/"),
}) {}
export class Compatible extends Schema.TaggedClass<Compatible>()("Compatible", {
  implementation: Schema.Literals(["pypiserver", "devpi-server"]),
  version: text,
  uploadUrl: https,
  simpleUrl: https,
  duplicateLaw: Schema.Literal("not-inherited"),
}) {}
export const Endpoint = Schema.Union([PyPi, TestPyPi, Compatible]).check(
  Schema.makeFilter(
    (e) =>
      e._tag !== "Compatible" ||
      (new URL(e.uploadUrl).origin === new URL(e.simpleUrl).origin &&
        !/(?:^|\.)(?:pypi\.org|pythonhosted\.org)$/u.test(new URL(e.uploadUrl).hostname)),
  ),
)
export type Endpoint = typeof Endpoint.Type
const principal = text.check(Schema.isMaxLength(512))
export class TokenAuthorization extends Schema.TaggedClass<TokenAuthorization>()(
  "TokenAuthorization",
  {
    principal,
    username: text.check(Schema.isPattern(/^[A-Za-z0-9_.-]+$/u)),
  },
) {}
export class TrustedAuthorization extends Schema.TaggedClass<TrustedAuthorization>()(
  "TrustedAuthorization",
  {
    principal,
    projects: Schema.Array(project).check(
      Schema.makeFilter(
        (projects) => projects.length > 0 && new Set(projects).size === projects.length,
      ),
    ),
    repository: text.check(Schema.isPattern(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u)),
    workflow: text.check(
      Schema.makeFilter(
        (s) =>
          !s.startsWith("/") &&
          !s.includes("\\") &&
          !s.split("/").some((x) => ["", ".", ".."].includes(x)),
      ),
    ),
    workflowRef: text.check(
      Schema.makeFilter(
        (s) => /^refs\/(?:heads|tags)\/[A-Za-z0-9._/-]+$/u.test(s) && !s.includes(".."),
      ),
    ),
    issuer: Schema.Literal("https://token.actions.githubusercontent.com"),
    audience: Schema.Literals(["pypi", "testpypi"]),
  },
) {}
export const Authorization = Schema.Union([TokenAuthorization, TrustedAuthorization])
export type Authorization = typeof Authorization.Type
const common = {
  endpoint: Endpoint,
  project,
  version,
  metadataVersion,
  distribution: File,
  filename,
  authorization: Authorization,
}
export class WheelUpload extends Schema.TaggedClass<WheelUpload>()("WheelUpload", {
  ...common,
  pythonTag: text.check(Schema.isPattern(/^[a-z0-9]+(?:\.[a-z0-9]+)*$/u)),
}) {}
export class SdistUpload extends Schema.TaggedClass<SdistUpload>()("SdistUpload", {
  ...common,
  pythonTag: Schema.Literal("source"),
}) {}
export const UploadIntent = Schema.Union([WheelUpload, SdistUpload]).check(
  Schema.makeFilter((intent) => {
    if ((intent._tag === "WheelUpload") !== intent.filename.endsWith(".whl")) return false
    const auth = intent.authorization
    return auth._tag === "TokenAuthorization"
      ? intent.endpoint._tag === "Compatible" || auth.username === "__token__"
      : auth.projects.includes(intent.project) &&
          intent.endpoint._tag !== "Compatible" &&
          auth.audience === (intent.endpoint._tag === "PyPi" ? "pypi" : "testpypi")
  }),
)
export type UploadIntent = typeof UploadIntent.Type
export class DistributionMetadata extends Schema.Class<DistributionMetadata>(
  "PythonDistributionMetadata",
)({
  kind: Schema.Literals(["wheel", "sdist"]),
  project,
  version,
  metadataVersion,
  pythonTag: text,
  filename,
}) {}
