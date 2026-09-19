import { expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
import {
  Bundle,
  File,
  finalize,
  renderSha256Sums,
  verifySha256Sums,
  type ChecksumInput,
} from "../../../packages/ts-release/src/Bundle.js"
import { fileContentOwner } from "../../../packages/ts-release/src/Node.js"

test("Bundle-derived checksums match independent GNU bytes, Unicode ordering and strict native verification", async () => {
  const root = await mkdtemp(join(tmpdir(), "release-native-checksums-"))
  const owner = fileContentOwner(join(root, "objects"))
  const run = Effect.runPromise
  try {
    const files: File[] = []
    for (const [index, payload] of ["alpha\n", "beta\n", "gamma\n"].entries()) {
      files.push(
        new File({
          logicalName: `${index}.bin`,
          content: await run(owner.putOwned(new TextEncoder().encode(payload))),
          deliveryMode: 0o644,
          executable: null,
          producedBy: { name: "native-checksum/source", version: "fixture" },
        }),
      )
    }
    const [a, b, c] = files as [File, File, File]
    const bundle = await run(finalize(files))
    const entries: ChecksumInput[] = [
      { publicName: "🚀.bin", file: b },
      { publicName: "space name.bin", file: c },
      { publicName: "\ue000.bin", file: a },
    ]
    const bytes = await run(renderSha256Sums(bundle, entries))
    expect(new TextDecoder().decode(bytes)).toBe(
      `${c.content.sha256}  space name.bin\n${a.content.sha256}  \ue000.bin\n${b.content.sha256}  🚀.bin\n`,
    )
    expect(await run(renderSha256Sums(bundle, [...entries].reverse()))).toEqual(bytes)
    await run(verifySha256Sums(bundle, entries, bytes, owner.verify))
    const native = join(root, "native")
    await mkdir(native)
    for (const entry of entries)
      await writeFile(join(native, entry.publicName), await run(owner.read(entry.file.content)))
    await writeFile(join(native, "SHA256SUMS"), bytes)
    const nativeBytes = execFileSync(
      "sha256sum",
      ["--", "space name.bin", "\ue000.bin", "🚀.bin"],
      { cwd: native },
    )
    expect(new Uint8Array(nativeBytes)).toEqual(bytes)
    expect(
      execFileSync("sha256sum", ["--check", "--strict", "SHA256SUMS"], {
        cwd: native,
        encoding: "utf8",
      })
        .split("\n")
        .filter(Boolean),
    ).toHaveLength(3)
    let reads = 0
    const checkContent = () =>
      Effect.sync(() => {
        reads++
      })
    for (const name of [
      "-",
      "../escape",
      "line\nname",
      "e\u0301.bin",
      "SHA256SUMS",
      "folder/Sha256Sums",
      "\\escape",
      "x".repeat(1025),
    ])
      await expect(run(renderSha256Sums(bundle, [{ publicName: name, file: a }]))).rejects.toThrow()
    for (const inputs of [
      [
        { publicName: "same", file: a },
        { publicName: "same", file: b },
      ],
      [
        { publicName: "Same", file: a },
        { publicName: "same", file: b },
      ],
      [
        { publicName: "one", file: a },
        { publicName: "two", file: a },
      ],
      [{ publicName: "a", file: new File({ ...a, deliveryMode: 0o755 }) }],
      [{ publicName: "a", file: { ...a, _tag: "OwnedTree" } as unknown as File }],
    ])
      await expect(run(verifySha256Sums(bundle, inputs, bytes, checkContent))).rejects.toThrow()
    await expect(
      run(renderSha256Sums(await run(finalize([b])), [{ publicName: "a", file: a }])),
    ).rejects.toThrow()
    await expect(
      run(
        renderSha256Sums(new Bundle({ format: "ts-release/bundle/2", artifacts: [a, a] }), entries),
      ),
    ).rejects.toThrow()
    for (const changed of [
      new TextEncoder().encode(new TextDecoder().decode(bytes).replaceAll("\n", "\r\n")),
      bytes.slice(1),
      new Uint8Array(bytes.length),
    ])
      await expect(run(verifySha256Sums(bundle, entries, changed, checkContent))).rejects.toThrow()
    expect(reads).toBe(0)
    const privateDash = new File({ ...a, logicalName: "-" })
    const privateBundle = await run(finalize([privateDash]))
    expect(
      new TextDecoder().decode(
        await run(
          renderSha256Sums(privateBundle, [{ publicName: "artifact.txt", file: privateDash }]),
        ),
      ),
    ).toBe(`${a.content.sha256}  artifact.txt\n`)
    expect(
      new TextDecoder().decode(
        await run(renderSha256Sums(bundle, [{ publicName: "-artifact", file: a }])),
      ),
    ).toBe(`${a.content.sha256}  -artifact\n`)
    await chmod(join(root, "objects", a.content.sha256), 0o600)
    await writeFile(join(root, "objects", a.content.sha256), "corrupt")
    await expect(run(verifySha256Sums(bundle, entries, bytes, owner.verify))).rejects.toThrow()
    await writeFile(join(native, "\ue000.bin"), "corrupt")
    expect(() =>
      execFileSync("sha256sum", ["--check", "--strict", "SHA256SUMS"], {
        cwd: native,
        stdio: "pipe",
      }),
    ).toThrow()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
