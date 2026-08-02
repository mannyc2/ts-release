import { describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runApply } from "../apps/release-ts/src/cli/commands.js"
import { runAction } from "../apps/ts-release-action/src/commands.js"
import { apply, plan, reviewExecution } from "../src/index.js"

// Neither front door may be weaker than the other again: the SAME malformed
// value must refuse through both apps, with the SAME message — because both
// now hand the value to the one validator instead of checking it themselves.
// (Absence is NOT comparable: the Action reads a missing input as "", the GitHub
// Actions convention, where the CLI sees undefined. The parity claim is about
// values that ARE present and malformed.)
const api = { plan, reviewExecution, apply }
const io = {
  read: (path: string) => readFileSync(path, "utf8"),
  write: () => {},
  log: () => {}
}
const malformedResolutions =
  "[{\"operationId\":\"x\",\"outcome\":\"maybe\",\"operator\":\"o\",\"reason\":\"r\"}]"

const refusal = async (invoke: () => Promise<unknown>): Promise<string> => {
  try {
    await invoke()
  } catch (cause) {
    return String(cause)
  }
  throw new Error("expected a refusal")
}

describe("front-door input parity", () => {
  for (
    const [label, extra, expected] of [
      [
        "a resolution outcome outside the committed/absent pair",
        { resolutions: malformedResolutions },
        /"committed" \| "absent", got "maybe"/
      ],
      ["a stage nobody ships", { through: "sideways" }, /got "sideways"/]
    ] as const
  ) {
    test(`${label} refuses identically through the CLI and the Action`, async () => {
      const directory = mkdtempSync(join(tmpdir(), "ts-release-parity-"))
      try {
        // The plan bytes are deliberately unacceptable: a door that reached
        // plan acceptance instead of refusing the input would report the plan
        // error, and the message match below would catch that.
        writeFileSync(join(directory, "plan.json"), "{}")
        const viaCli = await refusal(() =>
          runApply(api, {
            plan: "plan.json",
            planId: "p".repeat(64),
            root: ".",
            reviewer: "reviewer",
            resume: "runs/run.json",
            ...extra
          }, directory, io)
        )
        const inputs: Record<string, string> = {
          command: "apply",
          "plan-path": "plan.json",
          "plan-id": "p".repeat(64),
          reviewer: "reviewer",
          resume: "runs/run.json",
          ...extra
        }
        const viaAction = await refusal(() =>
          runAction(api, {
            workspace: directory,
            input: (name) => inputs[name] ?? "",
            output: () => {},
            read: io.read,
            write: () => {}
          })
        )
        expect(viaCli).toMatch(expected)
        expect(viaAction).toBe(viaCli)
      } finally {
        rmSync(directory, { recursive: true, force: true })
      }
    })
  }

  test("an empty execution review id refuses at both doors", async () => {
    // Absence differs by convention, so this one asserts only that neither
    // door mints a receipt from an empty id — the drift that motivated 200.
    const directory = mkdtempSync(join(tmpdir(), "ts-release-parity-"))
    try {
      writeFileSync(join(directory, "plan.json"), "{}")
      expect(await refusal(() =>
        runApply(api, {
          plan: "plan.json",
          planId: "p".repeat(64),
          root: ".",
          reviewer: "reviewer",
          newRun: "runs/run.json",
          confirmExecution: "",
          scope: "all"
        }, directory, io)
      )).toMatch(/length of at least 1/)
      const inputs: Record<string, string> = {
        command: "apply",
        "plan-path": "plan.json",
        "plan-id": "p".repeat(64),
        reviewer: "reviewer",
        "new-run": "runs/run.json",
        "confirm-execution": "",
        scope: "all"
      }
      expect(await refusal(() =>
        runAction(api, {
          workspace: directory,
          input: (name) => inputs[name] ?? "",
          output: () => {},
          read: io.read,
          write: () => {}
        })
      )).toMatch(/confirm-execution is required/)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
