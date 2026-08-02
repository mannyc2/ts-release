import { satisfies } from "semver"

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
export const compactLocalToolProfile = (
  id: string, hosts: ReadonlyArray<PackageHost>, executable: LocalToolProfileInput["executable"],
  argv: ReadonlyArray<string>, inputs: ReadonlyArray<string>,
  output: LocalToolProfileInput["outputs"][number], validationOperation: string
) => localToolProfile({
  profileId: `package.${id}.v1`, contractFixtureId: `contract.package.${id}.v1`,
  hosts, executable, argv, inputSelectors: inputs, outputs: [output], validationOperation
})

// Real semver with default options: prereleases are EXCLUDED from stable
// ranges, so 10.0.0-rc.1 can never pass as a supported 10.x.
const extractVersion = (value: string): string | undefined => {
  const found = value.match(/[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?|[0-9]+\.[0-9]+/u)?.[0]
  if (found === undefined) return undefined
  return /^[0-9]+\.[0-9]+$/u.test(found) ? `${found}.0` : found
}
export const preflightTool = (
  profile: LocalToolProfile, host: PackageHost, observed: string
): "ready" | "unsupported-host" | "unsupported-version" => {
  if (!profile.contract.hosts.includes(host)) return "unsupported-host"
  const [minimum, maximum] = profile.contract.executable.supportedRange
    .match(/[0-9]+(?:\.[0-9]+){1,2}/gu) ?? []
  const actual = extractVersion(observed)
  return actual !== undefined && minimum !== undefined && maximum !== undefined &&
    satisfies(actual, `>=${minimum} <${maximum}`) ? "ready" : "unsupported-version"
}
export const localToolOutcome = (
  exitCode: number, declared: number, observed: number, valid: boolean
): "materialized" | "exit-failure" | "output-mismatch" | "validation-failure" =>
  exitCode !== 0 ? "exit-failure" : declared !== observed ? "output-mismatch"
    : valid ? "materialized" : "validation-failure"
