export type PackageHost =
  | "darwin-arm64" | "darwin-x64"
  | "linux-arm64" | "linux-x64"
  | "windows-x64"

export interface LocalToolProfileInput {
  readonly profileId: string
  readonly contractFixtureId: string
  readonly hosts: ReadonlyArray<PackageHost>
  readonly executable: {
    readonly name: string, readonly versionProbe: ReadonlyArray<string>,
    readonly versionOutput: string, readonly supportedRange: string
  }
  readonly argv: ReadonlyArray<string>
  readonly inputSelectors: ReadonlyArray<string>
  readonly outputs: ReadonlyArray<{ readonly pathTemplate: string, readonly type: string }>
  readonly validationOperation: string
}

export const localToolProfile = (input: LocalToolProfileInput) => Object.freeze({
  id: input.contractFixtureId,
  profileId: input.profileId,
  contract: Object.freeze({
    kind: "local-tool" as const,
    hosts: input.hosts,
    executable: input.executable,
    invocation: Object.freeze({
      argv: input.argv, cwd: "workspace-root" as const, stdin: "none" as const,
      environmentNames: [] as const, authenticationClass: "none" as const,
      authorityClass: "local-only" as const
    }),
    inputSelectors: input.inputSelectors,
    outputs: input.outputs,
    validationOperation: input.validationOperation,
    success: "exit-zero-and-all-declared-outputs-valid" as const,
    failureDecoding: "typed-local-tool-evidence/v1" as const,
    remoteMutation: false as const
  })
})
export type LocalToolProfile = ReturnType<typeof localToolProfile>

const triple = (value: string): ReadonlyArray<number> =>
  (value.match(/[0-9]+(?:\.[0-9]+){1,2}/u)?.[0] ?? "").split(".").map(Number)
const order = (left: ReadonlyArray<number>, right: ReadonlyArray<number>): number =>
  (left[0] ?? 0) - (right[0] ?? 0) ||
  (left[1] ?? 0) - (right[1] ?? 0) ||
  (left[2] ?? 0) - (right[2] ?? 0)
export const preflightTool = (
  profile: LocalToolProfile, host: PackageHost, observed: string
): "ready" | "unsupported-host" | "unsupported-version" => {
  if (!profile.contract.hosts.includes(host)) return "unsupported-host"
  const [minimum = "", maximum = ""] = profile.contract.executable.supportedRange
    .match(/[0-9]+(?:\.[0-9]+){1,2}/gu) ?? []
  const actual = triple(observed)
  return actual.length > 1 && order(actual, triple(minimum)) >= 0 &&
    order(actual, triple(maximum)) < 0 ? "ready" : "unsupported-version"
}
export const localToolOutcome = (
  exitCode: number, declared: number, observed: number, valid: boolean
): "materialized" | "exit-failure" | "output-mismatch" | "validation-failure" =>
  exitCode !== 0 ? "exit-failure" : declared !== observed ? "output-mismatch"
    : valid ? "materialized" : "validation-failure"
