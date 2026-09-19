import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { join } from "node:path"
import { command, pythonBin } from "./native-server.js"

test("pinned Warehouse source acknowledges exact duplicates but rejects conflicting/deleted filenames", async () => {
  const record = JSON.parse(
    await command([join(pythonBin, "python"), join(import.meta.dir, "warehouse-source-law.py")]),
  )
  const expected = await Bun.file(
    join(import.meta.dir, "fixtures/warehouse-source-law.json"),
  ).json()
  expect(record).toEqual(expected)
  expect(
    createHash("sha256")
      .update(
        new Uint8Array(
          await Bun.file(join(import.meta.dir, "fixtures/warehouse-legacy.py")).arrayBuffer(),
        ),
      )
      .digest("hex"),
  ).toBe(record.sourceSha256)
  expect(record.cases.map((row: { status: number | string }) => row.status)).toEqual([
    "continue-native-validation",
    200,
    400,
    400,
    400,
  ])
  expect(record.cases[1].doomed).toBe(true)
  expect(record.cases[2].message).toStartWith("File already exists")
  expect(record.cases[4].message).toStartWith("This filename was previously used")
})
