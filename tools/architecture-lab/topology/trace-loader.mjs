import { appendFileSync } from "node:fs"
export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context)
  appendFileSync(process.env.LAB_TRACE, `${JSON.stringify({ specifier, parent: context.parentURL ?? null, resolved: result.url, conditions: [...context.conditions] })}\n`)
  return result
}
