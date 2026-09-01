import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"

const root = join(import.meta.dir, "..")

export const selfReleaseToolEntries = {
  dispatch: join(root, "apps/release-ts/scripts/check-self-release-dispatch.ts"),
  tag: join(root, "apps/release-ts/scripts/create-self-release-tag.ts"),
  "npm-verifier": join(root, "apps/release-ts/scripts/verify-self-release-npm.ts")
} as const

export const selfReleaseToolOutputs = {
  dispatch: join(root, "apps/release-ts/release-tools/dispatch.js"),
  tag: join(root, "apps/release-ts/release-tools/tag.js"),
  "npm-verifier": join(root, "apps/release-ts/release-tools/npm-verifier.js")
} as const

export type SelfReleaseTool = keyof typeof selfReleaseToolEntries

export const buildSelfReleaseTool = async (
  tool: SelfReleaseTool,
  outputPath: string = selfReleaseToolOutputs[tool]
): Promise<void> => {
  const built = await Bun.build({
    entrypoints: [selfReleaseToolEntries[tool]],
    target: "bun",
    format: "esm",
    minify: true
  })
  if (!built.success || built.outputs[0] === undefined) {
    throw new Error([
      `Self-release ${tool} bundle failed.`,
      ...built.logs.map((entry) => String(entry))
    ].join("\n"))
  }
  const canonical = (await built.outputs[0].text()).replace(/[ \t]+$/gmu, "")
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, canonical)
}

export const buildSelfReleaseTools = async (): Promise<void> => {
  for (const tool of Object.keys(selfReleaseToolEntries) as ReadonlyArray<SelfReleaseTool>) {
    await buildSelfReleaseTool(tool)
  }
}

if (import.meta.main) {
  await buildSelfReleaseTools()
  for (const tool of Object.keys(selfReleaseToolEntries) as ReadonlyArray<SelfReleaseTool>) {
    console.log(`Built ${relative(root, selfReleaseToolOutputs[tool])} from ${relative(root, selfReleaseToolEntries[tool])}.`)
  }
}
