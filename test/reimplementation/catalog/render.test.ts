import { fail } from "node:assert"
import { expect, test } from "bun:test"
import { Cause, Effect, Exit, Result, Schema } from "effect"
import { ReleaseError } from "@mannyc1/ts-release"
import { Bundle, File } from "@mannyc1/ts-release/bundle"
import * as Homebrew from "../../../packages/catalog/src/homebrew/index.js"
import * as Scoop from "../../../packages/catalog/src/scoop/index.js"
import { renderBytes } from "../../../packages/catalog/src/Shared.js"
import { fixture } from "./fixtures.js"

const expectCatalogInput = async (operation: Effect.Effect<Uint8Array, ReleaseError>) => {
  const exit = await Effect.runPromiseExit(operation)
  if (!Exit.isFailure(exit)) throw new Error("Expected catalog input refusal")
  const found = Cause.findError(exit.cause)
  expect(Result.isSuccess(found) && found.success).toMatchObject({
    code: "catalog-input",
    message: "Catalog metadata or exact owned download could not be admitted",
  })
  expect(Cause.hasDies(exit.cause)).toBe(false)
}

test("renderer defects remain defects and declared failures retain their contract", async () => {
  const f = fixture()
  const defect = new TypeError("Metadata getter implementation failed")
  const exit = await Effect.runPromiseExit(
    Scoop.render(
      {
        ...f.manifest,
        get version(): string {
          throw defect
        },
      },
      f.bundle,
    ),
  )
  if (!Exit.isFailure(exit)) throw new Error("Expected renderer defect")
  expect(Cause.hasDies(exit.cause)).toBe(true)
  expect(Cause.hasFails(exit.cause)).toBe(false)

  // Schema's sync adapter wraps getter throws. Qualify declared callback
  // failures at their Catalog owner, without unwrapping arbitrary causes.
  const refusal = new ReleaseError({
    code: "metadata-unavailable",
    message: "Metadata unavailable",
  })
  const localExit = await Effect.runPromiseExit(
    renderBytes(() => {
      throw refusal
    }),
  )
  if (!Exit.isFailure(localExit)) throw new Error("Expected declared renderer refusal")
  const local = Cause.findError(localExit.cause)
  expect(Result.isSuccess(local) && local.success).toBe(refusal)
  expect(Cause.hasDies(localExit.cause)).toBe(false)
  class ForeignReleaseError extends Schema.TaggedError<ForeignReleaseError>()("ReleaseError", {
    code: Schema.String,
    message: Schema.String,
  }) {}
  const foreignExit = await Effect.runPromiseExit(
    renderBytes(() => {
      throw new ForeignReleaseError(refusal)
    }),
  )
  if (!Exit.isFailure(foreignExit)) throw new Error("Expected foreign declared renderer refusal")
  const foreign = Cause.findError(foreignExit.cause)
  expect(Result.isSuccess(foreign) && foreign.success).toMatchObject({
    code: refusal.code,
    message: refusal.message,
  })
  expect(Cause.hasDies(foreignExit.cause)).toBe(false)
})

test("Homebrew has all four exact owned cells; Scoop has native x64/arm64 selectors and required metadata", async () => {
  const f = fixture()
  const ruby = new TextDecoder().decode(
    await Effect.runPromise(Homebrew.render(f.formula, f.bundle)),
  )
  for (const download of Object.values(f.formula.archives)) {
    expect(ruby).toContain(download.url)
    expect(ruby).toContain(download.file.content.sha256)
    expect(ruby.split(download.url)).toHaveLength(2)
  }
  const json: unknown = JSON.parse(
    new TextDecoder().decode(await Effect.runPromise(Scoop.render(f.manifest, f.bundle))),
  )
  expect(json).toEqual({
    version: "1.2.3",
    homepage: f.manifest.homepage,
    license: "MIT",
    bin: "bin/tool.exe",
    architecture: {
      "64bit": {
        url: f.archives["windows-x64"].url,
        hash: (f.files[4] ?? fail("Missing fixture f.files[4]")).content.sha256,
      },
      arm64: {
        url: f.archives["windows-arm64"].url,
        hash: (f.files[5] ?? fail("Missing fixture f.files[5]")).content.sha256,
      },
    },
  })
  expect(ruby).toContain('bin.install "bin/tool"')
  expect(ruby).toContain('assert_predicate bin/"tool", :executable?')
})

test("renderers refuse absent, substituted or ambiguously named owned files and contradictory URL identities", async () => {
  const f = fixture()
  for (const artifacts of [
    [],
    f.files.slice(1),
    [...f.files, f.files[0] ?? fail("Missing fixture f.files[0]")],
  ])
    await expectCatalogInput(
      Homebrew.render(f.formula, new Bundle({ format: "ts-release/bundle/2", artifacts })),
    )
  for (const change of [
    {
      content: {
        ...(f.files[0] ?? fail("Missing fixture f.files[0]")).content,
        sha256: "0".repeat(64),
      },
    },
    { deliveryMode: 493 },
    { producedBy: { name: "other", version: "fixture" } },
  ]) {
    const changed = Schema.decodeSync(File)({
      ...(f.files[0] ?? fail("Missing fixture f.files[0]")),
      ...change,
    })
    await expectCatalogInput(
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
    )
  }
  await expectCatalogInput(
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
  )
})

test("native input boundaries reject invalid selectors, URLs, identifiers, paths and Scoop versions without leaking input", async () => {
  const f = fixture()
  for (const url of [
    "http://example.com/tool.zip",
    "https://secret@example.com/tool.zip",
    "https://example.com/tool.zip#fragment",
    "https://EXAMPLE.com/tool.zip",
  ])
    await expectCatalogInput(
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
    )
  for (const className of ["Tool;raise", "lower", "Tool\nOther", "Tool::Other", "BEGIN", "END"])
    await expectCatalogInput(Homebrew.render({ ...f.formula, className }, f.bundle))
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
    await expectCatalogInput(Scoop.render({ ...f.manifest, executable }, f.bundle))
  for (const version of ["1.0 beta", "1/2", "", "nightly", "NIGHTLY", "Nightly"])
    await expectCatalogInput(Scoop.render({ ...f.manifest, version }, f.bundle))
  const { "linux-arm64": _, ...missing } = f.formula.archives
  await expectCatalogInput(
    // @ts-expect-error Deliberately omit a required cell to exercise runtime admission.
    Homebrew.render({ ...f.formula, archives: missing }, f.bundle),
  )
  await expectCatalogInput(
    Scoop.render(
      {
        ...f.manifest,
        // @ts-expect-error Deliberately pass an unsupported cell to runtime admission.
        archives: { ...f.manifest.archives, "windows-ia32": f.archives["windows-x64"] },
      },
      f.bundle,
    ),
  )
})
