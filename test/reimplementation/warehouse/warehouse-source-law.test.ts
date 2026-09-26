import { fail } from "node:assert"
import * as Schema from "effect/Schema"
import expected from "./fixtures/warehouse-source-law.json" with { type: "json" }
import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { join } from "node:path"
import { command, pythonBin } from "./native-server.js"

test("pinned Warehouse source acknowledges exact duplicates but rejects conflicting/deleted filenames", async () => {
  const record = Schema.decodeUnknownSync(
    Schema.StructWithRest(
      Schema.Struct({
        sourceSha256: Schema.String,
        cases: Schema.Array(
          Schema.StructWithRest(
            Schema.Struct({
              status: Schema.Union([Schema.Finite, Schema.String]),
              doomed: Schema.Boolean,
              message: Schema.NullOr(Schema.String),
            }),
            [Schema.Record(Schema.String, Schema.Unknown)],
          ),
        ),
      }),
      [Schema.Record(Schema.String, Schema.Unknown)],
    ),
  )(
    JSON.parse(
      await command([join(pythonBin, "python"), join(import.meta.dir, "warehouse-source-law.py")]),
    ),
  )
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
  expect(record.cases.map((row) => row.status)).toEqual([
    "continue-native-validation",
    200,
    400,
    400,
    400,
  ])
  expect((record.cases[1] ?? fail("Missing exact case")).doomed).toBe(true)
  expect((record.cases[2] ?? fail("Missing changed-hash case")).message).toStartWith(
    "File already exists",
  )
  expect((record.cases[4] ?? fail("Missing deleted-filename case")).message).toStartWith(
    "This filename was previously used",
  )
})
