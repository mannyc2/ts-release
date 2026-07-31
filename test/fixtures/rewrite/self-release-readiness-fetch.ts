const missingHomebrew = process.env.SELF_RELEASE_TEST_MISSING_HOMEBREW === "1"
const emptyHomebrew = process.env.SELF_RELEASE_TEST_EMPTY_HOMEBREW === "1"
const originalFetch = globalThis.fetch

globalThis.fetch = Object.assign(async (input: RequestInfo | URL) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  const path = decodeURIComponent(url.pathname)
  if (path === "/repos/mannyc2/homebrew-ts-release" && emptyHomebrew) {
    return Response.json({ default_branch: "" })
  }
  const repositories = new Set([
    "/repos/mannyc2/ts-release",
    "/repos/mannyc2/scoop-ts-release"
  ])
  if (!missingHomebrew) repositories.add("/repos/mannyc2/homebrew-ts-release")
  return repositories.has(path)
    ? Response.json({ default_branch: "main" })
    : new Response("not found", { status: 404 })
}, { preconnect: originalFetch.preconnect })
