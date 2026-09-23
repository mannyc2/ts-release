import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"

test("Node and Bun admit large npm requests without weakening native JSON policy", async () => {
  for (const executable of [process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node", process.execPath]) {
    const child = Bun.spawn(
      [
        executable,
        fileURLToPath(new URL("./large-body-consumer.mjs", import.meta.url)),
        process.execPath,
      ],
      { stdout: "pipe", stderr: "pipe" },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect({ code, stderr }).toEqual({ code: 0, stderr: "" })
    expect(JSON.parse(stdout)).toMatchObject({ admitted: true, rejectsMutation: true })
  }
}, 30_000)
