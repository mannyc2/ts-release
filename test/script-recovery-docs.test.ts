import { describe, expect, test } from "bun:test"
import { installedPublicationProfiles } from "../src/publication/profiles.js"
import {
  checkProviderRecoveryOutput,
  renderProviderRecovery
} from "../scripts/lib/recovery-docs.js"

describe("generated provider recovery documentation", () => {
  test("is current and includes exactly the installed profile registry", () => {
    const report = checkProviderRecoveryOutput(process.cwd())
    expect(report.failures).toEqual([])
    expect(report.profiles).toBe(Object.keys(installedPublicationProfiles).length)
    const rendered = renderProviderRecovery()
    expect(rendered).toContain("`publish.npm`")
    expect(rendered).toContain("`publish.pypi`")
    expect(rendered).toContain("`publish.catalog-git`")
    expect(rendered).toContain("`publish.github`")
    expect(rendered).toContain("`PreparedPyPiPublication`")
    expect(rendered).toContain("`PreparedCatalogPublication`")
  })

  test("changes when a registered profile value changes", () => {
    const profiles = Object.values(installedPublicationProfiles)
    const changed = profiles.map((profile, index) => index === 0
      ? { ...profile, recovery: { ...profile.recovery, replay: "unsafe" as const } }
      : profile)
    expect(renderProviderRecovery(changed)).not.toBe(renderProviderRecovery(profiles))
  })
})
