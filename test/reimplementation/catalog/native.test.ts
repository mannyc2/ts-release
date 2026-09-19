import { expect, test } from "bun:test"
import { Effect } from "effect"
import { execFileSync } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as Homebrew from "../../../packages/catalog/src/homebrew/index.js"
import * as Scoop from "../../../packages/catalog/src/scoop/index.js"
import { fixture } from "./fixtures.js"

const brew = process.env.TS_RELEASE_ACCEPTANCE_BREW ?? "/tmp/ts-release-native-homebrew/bin/brew"
const pwsh =
  process.env.TS_RELEASE_ACCEPTANCE_POWERSHELL ?? "/tmp/ts-release-native-powershell/pwsh"
const scoop = process.env.TS_RELEASE_ACCEPTANCE_SCOOP ?? "/tmp/ts-release-native-scoop"
const env = {
  ...process.env,
  HOMEBREW_NO_AUTO_UPDATE: "1",
  HOMEBREW_NO_ANALYTICS: "1",
  POWERSHELL_TELEMETRY_OPTOUT: "1",
}
test("actual Homebrew Formula loader selects all four cells and preserves inert Ruby interpolation text", async () => {
  const f = fixture(),
    directory = await mkdtemp(join(tmpdir(), "ts-release-catalog-ruby-"))
  try {
    const description = 'Literal #{raise "INJECTION"} #@variable #$global \\ "quoted" café 😀'
    const path = join(directory, "tool.rb")
    await writeFile(
      path,
      await Effect.runPromise(Homebrew.render({ ...f.formula, description }, f.bundle)),
    )
    const output = JSON.parse(
      execFileSync(brew, ["ruby", join(import.meta.dir, "homebrew-oracle.rb"), path], {
        env,
        timeout: 30000,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }),
    )
    expect(output.cells).toHaveLength(4)
    for (const cell of output.cells) {
      const key =
        `${cell.os === "macos" ? "darwin" : "linux"}-${cell.arch === "intel" ? "x64" : "arm64"}` as keyof Homebrew.Formula["archives"]
      expect(cell.url).toBe(f.archives[key].url)
      expect(cell.sha256).toBe(f.archives[key].file.content.sha256)
      expect(cell.description).toBe(description)
      expect(cell.version).toBe("1.2.3")
      expect(cell.homepage).toBe(f.formula.homepage)
      expect(cell.license).toBe("MIT")
      expect(cell.test_defined).toBe(true)
    }
    // Negative control proves the native interpreter executes interpolation if quoting regresses.
    const unsafe = (await Bun.file(path).text()).replaceAll("\\#", "#")
    await writeFile(path, unsafe)
    expect(() =>
      execFileSync(brew, ["ruby", join(import.meta.dir, "homebrew-oracle.rb"), path], {
        env,
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      }),
    ).toThrow()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 90000)

test("Homebrew's native version parser preserves matching inference and overrides conflicting date, release and versionless filenames", async () => {
  const f = fixture(),
    directory = await mkdtemp(join(tmpdir(), "ts-release-brew-version-")),
    path = join(directory, "tool.rb")
  try {
    for (const name of [
      "tool-1.2.3.tar.gz",
      "tool-9.8.7.tar.gz",
      "tool-2026-09-07.tar.gz",
      "tool.tar.gz",
    ]) {
      const archives = Object.fromEntries(
        Object.entries(f.formula.archives).map(([cell, download]) => [
          cell,
          { ...download, url: `https://example.com/${cell}/${name}` },
        ]),
      ) as Homebrew.Formula["archives"]
      await writeFile(
        path,
        await Effect.runPromise(Homebrew.render({ ...f.formula, archives }, f.bundle)),
      )
      const output = JSON.parse(
        execFileSync(brew, ["ruby", join(import.meta.dir, "homebrew-oracle.rb"), path], {
          env,
          encoding: "utf8",
          timeout: 30000,
          stdio: ["pipe", "pipe", "pipe"],
        }),
      )
      expect(output.cells).toHaveLength(4)
      for (const cell of output.cells) {
        expect(cell.version).toBe("1.2.3")
        expect(cell.detected).toBe(name === "tool-1.2.3.tar.gz")
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 90000)

test("actual PowerShell validates the official Scoop schema and executes its native architecture selector", async () => {
  const f = fixture(),
    directory = await mkdtemp(join(tmpdir(), "ts-release-catalog-scoop-"))
  const path = join(directory, "tool.json")
  const run = () =>
    execFileSync(
      pwsh,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-File",
        join(import.meta.dir, "scoop-oracle.ps1"),
        scoop,
        path,
      ],
      { env, timeout: 30000, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    )
  try {
    const bytes = await Effect.runPromise(Scoop.render(f.manifest, f.bundle))
    await writeFile(path, bytes)
    const output = JSON.parse(run())
    expect(output.cells).toHaveLength(2)
    for (const cell of output.cells) {
      const key = cell.architecture === "64bit" ? "windows-x64" : "windows-arm64"
      expect(cell.url).toBe(f.archives[key].url)
      expect(cell.hash).toBe(f.archives[key].file.content.sha256)
      expect(cell.bin).toBe("bin/tool.exe")
    }
    for (const change of [
      (value: any) => {
        delete value.homepage
      },
      (value: any) => {
        delete value.license
      },
      (value: any) => {
        value.architecture["64bit"].hash = "bad"
      },
      (value: any) => {
        value.architecture.x64 = value.architecture["64bit"]
        delete value.architecture["64bit"]
      },
    ]) {
      const invalid = JSON.parse(new TextDecoder().decode(bytes))
      change(invalid)
      await writeFile(path, JSON.stringify(invalid))
      expect(run).toThrow()
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 90000)

test("native Scoop installer and shim controls demonstrate why nightly, interpolation and wildcard inputs reject", async () => {
  const f = fixture(),
    directory = await mkdtemp(join(tmpdir(), "ts-release-scoop-policy-"))
  const path = join(directory, "tool.json")
  const run = (script: string, args: string[] = []) =>
    JSON.parse(
      execFileSync(
        pwsh,
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-File",
          join(import.meta.dir, script),
          scoop,
          path,
          ...args,
        ],
        { env, encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] },
      )
        .trim()
        .split("\n")
        .at(-1)!,
    )
  try {
    const value = JSON.parse(
      new TextDecoder().decode(await Effect.runPromise(Scoop.render(f.manifest, f.bundle))),
    )
    for (const version of ["1.2.3", "nightly", "NIGHTLY"]) {
      await writeFile(path, JSON.stringify({ ...value, version }))
      expect(run("scoop-install-policy.ps1").nativeCheckHash).toBe(version === "1.2.3")
      if (version !== "1.2.3")
        await expect(
          Effect.runPromise(Scoop.render({ ...f.manifest, version }, f.bundle)),
        ).rejects.toThrow("could not be admitted")
    }
    const attack = "bin/$(Set-Variable CatalogProbe TRIPPED -Scope Global).ps1"
    await writeFile(path, JSON.stringify({ ...value, bin: attack }))
    expect(run("scoop-shim-policy.ps1", [join(directory, "interpolation")]).probe).toBe("TRIPPED")
    await expect(
      Effect.runPromise(Scoop.render({ ...f.manifest, executable: attack }, f.bundle)),
    ).rejects.toThrow("could not be admitted")
    await writeFile(path, JSON.stringify({ ...value, bin: "bin/tool[12].exe" }))
    const wildcard = run("scoop-shim-policy.ps1", [join(directory, "wildcard"), "-Wildcard"])
    expect(JSON.stringify(wildcard.outputs)).toContain("tool1.exe")
    await expect(
      Effect.runPromise(Scoop.render({ ...f.manifest, executable: "bin/tool[12].exe" }, f.bundle)),
    ).rejects.toThrow("could not be admitted")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 90000)
