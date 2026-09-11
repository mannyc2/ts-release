import { expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { Bundle, File } from "@mannyc1/ts-release/bundle"
import * as Homebrew from "../../../packages/catalog/src/homebrew/index.js"
import * as Scoop from "../../../packages/catalog/src/scoop/index.js"
import { fixture } from "./fixtures.js"

test("Homebrew has all four exact owned cells; Scoop has native x64/arm64 selectors and required metadata", async () => {
  const f = fixture()
  const ruby = new TextDecoder().decode(
    await Effect.runPromise(Homebrew.render(f.formula, f.bundle)),
  )
  for (const [cell, download] of Object.entries(f.formula.archives)) {
    expect(ruby).toContain(download.url)
    expect(ruby).toContain(download.file.content.sha256)
    expect(ruby.split(download.url)).toHaveLength(2)
    expect(cell).toMatch(/^(darwin|linux)-(x64|arm64)$/u)
  }
  const json = JSON.parse(
    new TextDecoder().decode(await Effect.runPromise(Scoop.render(f.manifest, f.bundle))),
  )
  expect(json).toEqual({
    version: "1.2.3",
    homepage: f.manifest.homepage,
    license: "MIT",
    bin: "bin/tool.exe",
    architecture: {
      "64bit": { url: f.archives["windows-x64"].url, hash: f.files[4]!.content.sha256 },
      arm64: { url: f.archives["windows-arm64"].url, hash: f.files[5]!.content.sha256 },
    },
  })
  expect(ruby).toContain('bin.install "bin/tool"')
  expect(ruby).toContain('assert_predicate bin/"tool", :executable?')
})

test("renderers refuse absent, substituted or ambiguously named owned files and contradictory URL identities", async () => {
  const f = fixture()
  for (const artifacts of [[], f.files.slice(1), [...f.files, f.files[0]!]])
    await expect(
      Effect.runPromise(
        Homebrew.render(f.formula, new Bundle({ format: "ts-release/bundle/2", artifacts })),
      ),
    ).rejects.toThrow("could not be admitted")
  for (const change of [
    { content: { ...f.files[0]!.content, sha256: "0".repeat(64) } },
    { deliveryMode: 493 },
    { producedBy: { name: "other", version: "fixture" } },
  ]) {
    const changed = Schema.decodeUnknownSync(File)({ ...f.files[0]!, ...change })
    await expect(
      Effect.runPromise(
        Homebrew.render(
          {
            ...f.formula,
            archives: {
              ...f.formula.archives,
              "darwin-x64": { ...f.archives["darwin-x64"], file: changed },
            },
          },
          f.bundle,
        ),
      ),
    ).rejects.toThrow("could not be admitted")
  }
  await expect(
    Effect.runPromise(
      Scoop.render(
        {
          ...f.manifest,
          archives: {
            ...f.manifest.archives,
            "windows-arm64": { ...f.archives["windows-arm64"], url: f.archives["windows-x64"].url },
          },
        },
        f.bundle,
      ),
    ),
  ).rejects.toThrow("could not be admitted")
})

test("native input boundaries reject invalid selectors, URLs, identifiers, paths and Scoop versions without leaking input", async () => {
  const f = fixture()
  for (const url of [
    "http://example.com/tool.zip",
    "https://secret@example.com/tool.zip",
    "https://example.com/tool.zip#fragment",
    "https://EXAMPLE.com/tool.zip",
  ])
    await expect(
      Effect.runPromise(
        Scoop.render(
          {
            ...f.manifest,
            archives: {
              ...f.manifest.archives,
              "windows-x64": { ...f.archives["windows-x64"], url },
            },
          },
          f.bundle,
        ),
      ),
    ).rejects.toThrow("Catalog metadata or exact owned download could not be admitted")
  for (const className of ["Tool;raise", "lower", "Tool\nOther", "Tool::Other", "BEGIN", "END"])
    await expect(
      Effect.runPromise(Homebrew.render({ ...f.formula, className }, f.bundle)),
    ).rejects.toThrow("could not be admitted")
  for (const executable of [
    "../tool",
    "/tool",
    "bin//tool",
    "bin\\tool",
    "con.exe",
    "bin/$(Set-Variable CatalogProbe TRIPPED -Scope Global).ps1",
    "bin/tool[12].exe",
    "bin/tool`name.ps1",
    "bin/%PATH%.cmd",
    "bin/tool'quote",
    "bin/tool.\u0000secret",
  ])
    await expect(
      Effect.runPromise(Scoop.render({ ...f.manifest, executable }, f.bundle)),
    ).rejects.toThrow("could not be admitted")
  for (const version of ["1.0 beta", "1/2", "", "nightly", "NIGHTLY", "Nightly"])
    await expect(
      Effect.runPromise(Scoop.render({ ...f.manifest, version }, f.bundle)),
    ).rejects.toThrow("could not be admitted")
  const { "linux-arm64": _, ...missing } = f.formula.archives
  await expect(
    Effect.runPromise(
      Homebrew.render({ ...f.formula, archives: missing } as Homebrew.Formula, f.bundle),
    ),
  ).rejects.toThrow("could not be admitted")
  await expect(
    Effect.runPromise(
      Scoop.render(
        {
          ...f.manifest,
          archives: { ...f.manifest.archives, "windows-ia32": f.archives["windows-x64"] },
        } as Scoop.Manifest,
        f.bundle,
      ),
    ),
  ).rejects.toThrow("could not be admitted")
})
