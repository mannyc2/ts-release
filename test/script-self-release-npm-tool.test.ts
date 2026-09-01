import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "bun:test"
import {
  assertSelectedPinnedNpm,
  assertNoNpmConfigurationFiles,
  npmConfigHasActiveContent
} from "../apps/release-ts/scripts/check-self-release-dispatch.js"
import {
  pinnedNpmReleaseTool,
  runExactExecutable,
  verifyArchiveDigest
} from "../apps/release-ts/scripts/install-self-release-npm.js"

describe("audited self-release npm tool", () => {
  test("binds both registry digests and rejects any changed archive", () => {
    const bytes = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0x01, 0x02, 0x03, 0x04])
    const expected = {
      integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
      shasum: createHash("sha1").update(bytes).digest("hex")
    }
    expect(() => verifyArchiveDigest(bytes, expected)).not.toThrow()
    expect(() => verifyArchiveDigest(new Uint8Array([...bytes, 0x05]), expected)).toThrow()
    expect(() => verifyArchiveDigest(bytes, pinnedNpmReleaseTool)).toThrow()
    expect(pinnedNpmReleaseTool).toEqual({
      version: "11.11.0",
      tarballUrl: "https://registry.npmjs.org/npm/-/npm-11.11.0.tgz",
      integrity: "sha512-82gRxKrh/eY5UnNorkTFcdBQAGpgjWehkfGVqAGlJjejEtJZGGJUqjo3mbBTNbc5BTnPKGVtGPBZGhElujX5cw==",
      shasum: "db5ad0ed255e1a29cf241c4112ee81d2220a4edb"
    })
  })

  test("admits only absent or comment-only untrusted npm configuration", () => {
    expect(npmConfigHasActiveContent("\n# comment\n; another\n")).toBe(false)
    for (const content of [
      "registry=https://registry.npmjs.org/\n",
      "userconfig=/tmp/foreign\n",
      "prefix=/tmp/foreign\n",
      "//registry.npmjs.org/:_authToken=private\n"
    ]) expect(npmConfigHasActiveContent(content)).toBe(true)

    const directory = mkdtempSync(join(tmpdir(), "ts-release-npm-config-"))
    try {
      const path = join(directory, "npmrc")
      writeFileSync(path, "# no host configuration\n")
      expect(() => assertNoNpmConfigurationFiles([path])).not.toThrow()
      writeFileSync(path, "globalconfig=/tmp/foreign\n")
      expect(() => assertNoNpmConfigurationFiles([path])).toThrow("release-host npm configuration")
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("absolute tool bindings never invoke hostile PATH git or npm shims", () => {
    const directory = mkdtempSync(join(tmpdir(), "ts-release-path-shim-"))
    try {
      const shims = join(directory, "shims")
      mkdirSync(shims)
      const marker = join(directory, "shim-ran")
      for (const name of ["git", "npm"]) {
        const path = join(shims, name)
        writeFileSync(path, `#!/bin/sh\n/usr/bin/touch '${marker}'\nprintf 'forged\\n'\n`)
        chmodSync(path, 0o700)
      }
      const direct = join(directory, "direct")
      writeFileSync(direct, "#!/bin/sh\nprintf 'direct\\n'\n")
      chmodSync(direct, 0o700)
      const environment = { HOME: directory, LANG: "C", PATH: shims }
      expect(runExactExecutable(direct, [], environment)).toBe("direct")
      expect(runExactExecutable("/usr/bin/git", ["--version"], environment)).toMatch(/^git version /u)
      expect(existsSync(marker)).toBe(false)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("admits the bootstrap's second symlink only when it resolves to the audited npm launcher", () => {
    const directory = mkdtempSync(join(tmpdir(), "ts-release-npm-symlink-topology-"))
    try {
      const packageBin = join(directory, "package", "bin")
      const pinnedBin = join(directory, "workspace", ".release", "tools", "npm-11.11.0", "bin")
      const releaseBin = join(directory, "exact-tools", "bin")
      mkdirSync(packageBin, { recursive: true })
      mkdirSync(pinnedBin, { recursive: true })
      mkdirSync(releaseBin, { recursive: true })
      const npmCli = join(packageBin, "npm-cli.js")
      writeFileSync(npmCli, "#!/bin/sh\nexit 0\n")
      chmodSync(npmCli, 0o700)
      const pinned = join(pinnedBin, "npm")
      const selected = join(releaseBin, "npm")
      symlinkSync(npmCli, pinned)
      symlinkSync(pinned, selected)
      expect(() => assertSelectedPinnedNpm(selected, pinned)).not.toThrow()

      const hostile = join(directory, "hostile-npm")
      writeFileSync(hostile, "#!/bin/sh\nexit 0\n")
      chmodSync(hostile, 0o700)
      expect(() => assertSelectedPinnedNpm(hostile, pinned)).toThrow("PATH does not select")
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
