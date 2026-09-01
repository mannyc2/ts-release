"use strict"

const fs = require("node:fs")
const crypto = require("node:crypto")
const path = require("node:path")

const refuse = () => {
  process.stderr.write(
    "Private self-release report handoff failed closed [bootstrap]; no handoff success is claimed.\n"
  )
  process.exitCode = 1
}

try {
  const kind = process.env.INPUT_KIND
  const relativeReport = kind === "npm-oidc-certification"
    ? ".release/ts-release/npm-oidc-certification.json"
    : kind === "npm-publish"
      ? ".release/ts-release/action-report.json"
      : undefined
  const workspace = process.env.GITHUB_WORKSPACE
  let requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL
  let requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  if (relativeReport === undefined || workspace === undefined || !path.isAbsolute(workspace) ||
      requestUrl === undefined || requestToken === undefined || requestUrl.length === 0 ||
      requestToken.length < 8 || requestUrl.length > 16384 || requestToken.length > 131072) {
    throw new Error("handoff bootstrap identity is absent")
  }
  let parsedUrl = new URL(requestUrl)
  if (parsedUrl.protocol !== "https:" || parsedUrl.username !== "" || parsedUrl.password !== "" ||
      parsedUrl.hash !== "" || (!parsedUrl.hostname.endsWith(".actions.githubusercontent.com") &&
        parsedUrl.hostname !== "actions.githubusercontent.com")) {
    throw new Error("handoff bootstrap OIDC endpoint is not canonical")
  }
  for (const [name, value] of Object.entries(process.env)) {
    if ((value || "").length === 0) continue
    const normalized = name.toLowerCase()
    if (/^(?:github_token|gh_token|npm_token|npm_id_token|node_auth_token|npm_config_.*|prefix|destdir|node_options|node_path|node_extra_ca_certs|node_debug|node_debug_native|node_redirect_warnings|node_v8_coverage|node_tls_reject_unauthorized|node_use_env_proxy|ssl_cert_file|ssl_cert_dir|sslkeylogfile|openssl_.*|http_proxy|https_proxy|all_proxy|no_proxy|curl_ca_bundle|bun_options|bun_config_.*|ld_.*|dyld_.*|git_.*)$/u.test(normalized)) {
      throw new Error("handoff bootstrap received extra authority or process injection")
    }
  }
  const root = fs.realpathSync(workspace)
  const reportPath = path.resolve(root, relativeReport)
  const relative = path.relative(root, reportPath)
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("handoff bootstrap report escapes workspace")
  }
  let current = root
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment)
    const metadata = fs.lstatSync(current)
    if (metadata.isSymbolicLink() || (current !== reportPath && !metadata.isDirectory())) {
      throw new Error("handoff bootstrap report path is linked")
    }
  }
  if (fs.realpathSync(reportPath) !== reportPath) {
    throw new Error("handoff bootstrap report path is not canonical")
  }
  const admitted = fs.lstatSync(reportPath)
  if (!admitted.isFile() || admitted.nlink !== 1 || admitted.size <= 0 ||
      admitted.size > 1024 * 1024 || (admitted.mode & 0o077) !== 0) {
    throw new Error("handoff bootstrap report is not one bounded private file")
  }
  const descriptor = fs.openSync(reportPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
  let reportBytes
  try {
    const before = fs.fstatSync(descriptor)
    if (!before.isFile() || before.nlink !== 1 || before.size <= 0 || before.size > 1024 * 1024 ||
        (before.mode & 0o077) !== 0 || admitted.dev !== before.dev || admitted.ino !== before.ino ||
        admitted.size !== before.size || admitted.mtimeMs !== before.mtimeMs) {
      throw new Error("handoff bootstrap opened a different report file")
    }
    reportBytes = Buffer.alloc(before.size)
    let offset = 0
    while (offset < reportBytes.length) {
      const read = fs.readSync(descriptor, reportBytes, offset, reportBytes.length - offset, null)
      if (read === 0) throw new Error("handoff bootstrap report ended early")
      offset += read
    }
    const extra = Buffer.alloc(1)
    const extraBytes = fs.readSync(descriptor, extra, 0, 1, null)
    extra.fill(0)
    const after = fs.fstatSync(descriptor)
    if (extraBytes !== 0 || before.dev !== after.dev || before.ino !== after.ino ||
        before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
      throw new Error("handoff bootstrap report is not one stable private file")
    }
  } finally {
    fs.closeSync(descriptor)
  }
  let requestUrlBytes = Buffer.from(requestUrl)
  let requestTokenBytes = Buffer.from(requestToken)
  const containsAuthority = reportBytes.includes(requestUrlBytes) || reportBytes.includes(requestTokenBytes)
  requestUrlBytes.fill(0)
  requestTokenBytes.fill(0)
  requestUrlBytes = Buffer.alloc(0)
  requestTokenBytes = Buffer.alloc(0)
  const sourceProof = containsAuthority ? undefined : Object.freeze({
    reportBytes: String(reportBytes.length),
    reportSha256: crypto.createHash("sha256").update(reportBytes).digest("hex")
  })
  delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL
  delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  requestUrl = ""
  requestToken = ""
  parsedUrl = null
  reportBytes.fill(0)
  reportBytes = Buffer.alloc(0)
  if (sourceProof === undefined) throw new Error("handoff bootstrap report contains OIDC authority")
  const loaded = require("./dist/index.cjs")
  if (typeof loaded.main !== "function") throw new Error("handoff bundle has no main function")
  void loaded.main(sourceProof)
} catch {
  refuse()
}
