import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

interface InertJournalWorkflow {
  readonly on?: Readonly<Record<string, {
    readonly inputs?: Readonly<Record<string, {
      readonly description?: string
      readonly required?: boolean
      readonly type?: string
    }>>
  } | null>>
  readonly permissions?: Readonly<Record<string, string>>
  readonly jobs?: Readonly<Record<string, {
    readonly permissions?: Readonly<Record<string, string>>
    readonly env?: Readonly<Record<string, unknown>>
    readonly steps?: ReadonlyArray<{
      readonly name?: string
      readonly shell?: string
      readonly run?: string
      readonly uses?: string
    }>
  }>>
}

const source = readFileSync(".github/workflows/operational-journal.yml", "utf8")
const workflow = Bun.YAML.parse(source) as InertJournalWorkflow

describe("inert operational journal workflow", () => {
  test("exposes only the exact reusable coordinate interface", () => {
    expect(Object.keys(workflow.on ?? {})).toEqual(["workflow_call"])
    const inputs = workflow.on?.workflow_call?.inputs
    expect(Object.keys(inputs ?? {})).toEqual(["release_point", "operation_key"])
    expect(inputs?.release_point).toMatchObject({ required: true, type: "string" })
    expect(inputs?.operation_key).toMatchObject({ required: true, type: "string" })
    expect(workflow.permissions).toEqual({})
    expect(Object.keys(workflow.jobs ?? {})).toEqual(["unavailable"])
    expect(workflow.jobs?.unavailable?.permissions).toEqual({})
  })

  test("cannot acquire authority, execute product code, or report success", () => {
    const job = workflow.jobs?.unavailable
    expect(job?.env).toEqual({
      RELEASE_POINT: "${{ inputs.release_point }}",
      OPERATION_KEY: "${{ inputs.operation_key }}"
    })
    expect(job?.steps).toHaveLength(1)
    expect(job?.steps?.[0]?.shell).toBe("bash")
    expect(job?.steps?.[0]?.run).toContain("^[a-f0-9]{40}$")
    expect(job?.steps?.[0]?.run).toContain("^[a-f0-9]{64}$")
    expect(job?.steps?.[0]?.run).toContain("Operational journal unavailable")
    expect(job?.steps?.[0]?.run?.trimEnd()).toEndWith("exit 1")
    expect(source).not.toMatch(/\bid-token\b|\bsecrets\s*:|aws-actions|AWS_(?:ACCESS|SECRET|SESSION|ROLE)|actions\/checkout|setup-(?:node|bun)|(?:upload|download)-artifact/iu)
    expect(source).not.toMatch(/\b(?:bucket|role)(?:Name|Arn)?\s*:/u)
    expect(job?.steps?.some((step) => step.uses !== undefined)).toBe(false)
  })
})
