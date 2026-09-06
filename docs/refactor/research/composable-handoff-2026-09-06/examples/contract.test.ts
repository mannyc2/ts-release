import { expect, test } from "bun:test"
import { cpSync, mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { PROVIDER_CONTRACT, runRelease, reportRelease, type ProviderDefinition } from "../machine/src/index.js"
import { makeFixture, providerFor, runWithHost } from "../machine/test/fixtures.js"

test("a provider built against another contract version is rejected at Host verification before any store or provider effect", async () => {
  const fixture = await makeFixture()
  let reads = 0
  const foreign = { ...providerFor(), contract: "lab/provider/0" } as unknown as ProviderDefinition
  const host = { ...fixture.host, providers: [foreign], store: { ...fixture.store, read: (id: string) => { reads++; return fixture.store.read(id) } } }
  await expect(runWithHost(host, runRelease({ plan: fixture.plan, authorize: true }))).rejects.toThrow(`requires ${PROVIDER_CONTRACT}`)
  await expect(runWithHost(host, reportRelease({ plan: fixture.plan }))).rejects.toThrow("this kernel requires")
  expect(reads).toBe(0)
  expect(fixture.sends).toHaveLength(0)
})

test("two physical kernel copies of the same contract interoperate at the data level (the hazard is version skew, not duplication itself)", async () => {
  // Simulate the installer's nested-kernel case: the provider is authored against a second copy of the kernel modules.
  const directory = mkdtempSync(join(import.meta.dir, ".kernel-copy-")) // inside the tree so `effect` resolves like an installed sibling package
  try {
    cpSync(join(import.meta.dir, "../machine/src"), join(directory, "src"), { recursive: true })
    const copy = await import(join(directory, "src/index.ts")) as typeof import("../machine/src/index.js")
    expect(copy.PROVIDER_CONTRACT).toBe(PROVIDER_CONTRACT)
    expect(copy.NoReplay).not.toBe((await import("../machine/src/index.js")).NoReplay) // distinct module instances
    const fixture = await makeFixture()
    const authoredElsewhere: ProviderDefinition = { ...providerFor(), prepare: (operation) => copy.makeRequest({
      transport: "core.http/1", endpoint: `${(operation.intent as { endpoint: string }).endpoint}/${(operation.intent as { coordinate: string }).coordinate}`,
      method: "PUT", headers: [["content-type", "application/octet-stream"]], body: new TextEncoder().encode((operation.intent as { content: string }).content),
      principal: "fixture-user", scope: "release:write", replay: new copy.NoReplay({})
    }) }
    const result = await runWithHost({ ...fixture.host, providers: [authoredElsewhere] }, runRelease({ plan: fixture.plan, authorize: true }))
    expect(result.operations[0]).toMatchObject({ status: "Satisfied", dispatches: 1 })
    expect(fixture.sends).toHaveLength(1)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
