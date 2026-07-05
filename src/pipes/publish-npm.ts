import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { SafeRelativePath, WorkflowFileName } from "../pipeline/artifact.js"
import { PlanError } from "../pipeline/errors.js"
import {
  CommandAction,
  CommandSpec,
  Operation,
  RetryPolicy
} from "../pipeline/operation.js"
import {
  dryRunValidationOperation,
  readOnlyCommandValidationOperation,
  validationNoteOperation
} from "../pipeline/operation-helpers.js"
import { optionalField } from "../pipeline/optional-field.js"
import type { Pipe } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
import type { ReleaseIdentity } from "../pipeline/state.js"

export const NpmAccess = Schema.Literals(["public", "restricted"])
export type NpmAccess = typeof NpmAccess.Type

const TrustedPublishingProvider = Schema.Literals(["github-actions"])

export class ReleaseConfigNpmTrustedPublishing extends Schema.Class<ReleaseConfigNpmTrustedPublishing>(
  "ReleaseConfigNpmTrustedPublishing"
)({
  provider: Schema.optionalKey(TrustedPublishingProvider),
  workflow: Schema.optionalKey(WorkflowFileName),
  packageExists: Schema.optionalKey(Schema.Literal(true)),
  verifyPackageExists: Schema.optionalKey(Schema.Boolean)
}) {}

export class ReleaseConfigNpmPublish extends Schema.Class<ReleaseConfigNpmPublish>("ReleaseConfigNpmPublish")({
  registry: Schema.optionalKey(Schema.String),
  packageName: Schema.optionalKey(Schema.NonEmptyString),
  packagePath: Schema.optionalKey(SafeRelativePath),
  tokenEnv: Schema.optionalKey(Schema.String),
  trustedPublishing: Schema.optionalKey(Schema.Union([Schema.Boolean, ReleaseConfigNpmTrustedPublishing])),
  access: Schema.optionalKey(NpmAccess),
  provenance: Schema.optionalKey(Schema.Boolean)
}) {}

interface NpmTrustedPublishingSection {
  readonly provider: "github-actions"
  readonly workflow: string
  readonly verifyPackageExists?: boolean | undefined
}

interface NpmPublishSection {
  readonly registry: string
  readonly packageName?: string | undefined
  readonly packagePath: string
  readonly tokenEnv?: string | undefined
  readonly trustedPublishing?: NpmTrustedPublishingSection | undefined
  readonly access?: NpmAccess | undefined
  readonly provenance?: boolean | undefined
}

const trustedPublishingAuthEnvNames = [
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
]

const compactTrustedPublishing = (
  config: boolean | ReleaseConfigNpmTrustedPublishing | undefined
): NpmTrustedPublishingSection | undefined => {
  if (config === undefined || config === false) {
    return undefined
  }
  if (config === true) {
    return {
      provider: "github-actions",
      workflow: "release.yml"
    }
  }
  return {
    provider: config.provider ?? "github-actions",
    workflow: config.workflow ?? "release.yml",
    ...optionalField(config.verifyPackageExists, (verifyPackageExists) => ({ verifyPackageExists }))
  }
}

const packageNameFromConfig = (config: {
  readonly project: {
    readonly name?: string | undefined
    readonly package?: string | undefined
    readonly packageName?: string | undefined
  }
  readonly publish: {
    readonly npm?: boolean | ReleaseConfigNpmPublish | undefined
  }
}): string | undefined => {
  const publish = config.publish.npm
  const object = publish === true || publish === false ? undefined : publish
  return object?.packageName ?? config.project.packageName ?? config.project.package ?? config.project.name
}

const sectionFromConfig = (config: {
  readonly project: {
    readonly name?: string | undefined
    readonly package?: string | undefined
    readonly packageName?: string | undefined
    readonly packagePath?: string | undefined
  }
  readonly publish: {
    readonly npm?: boolean | ReleaseConfigNpmPublish | undefined
  }
}): NpmPublishSection | undefined => {
  const publish = config.publish.npm
  if (publish === undefined || publish === false) {
    return undefined
  }
  const object = publish === true ? undefined : publish
  return {
    registry: object?.registry ?? "https://registry.npmjs.org",
    packageName: packageNameFromConfig(config),
    packagePath: object?.packagePath ?? config.project.packagePath ?? ".",
    ...optionalField(object?.tokenEnv, (tokenEnv) => ({ tokenEnv })),
    ...optionalField(object?.trustedPublishing, (trustedPublishing) => ({
      trustedPublishing: compactTrustedPublishing(trustedPublishing)
    })),
    ...optionalField(object?.access, (access) => ({ access })),
    ...optionalField(object?.provenance, (provenance) => ({ provenance }))
  }
}

const authEnvNames = (section: NpmPublishSection): ReadonlyArray<string> =>
  section.trustedPublishing !== undefined
    ? trustedPublishingAuthEnvNames
    : section.tokenEnv === undefined ? [] : [section.tokenEnv]

const npmCommand = (
  section: NpmPublishSection,
  args: ReadonlyArray<string>,
  includeAuth: boolean
): CommandSpec =>
  CommandSpec.make({
    executable: "npm",
    args: [...args],
    requiredEnv: includeAuth ? authEnvNames(section) : [],
    redactedEnv: includeAuth ? authEnvNames(section) : []
  })

const npmAuthOperation = (section: NpmPublishSection): Operation =>
  section.trustedPublishing !== undefined
    ? validationNoteOperation({
      id: "npm:npm-trusted-publishing-auth",
      pipeId: "publish:npm",
      dryRunSupport: "simulated",
      simulatedDescription: "Record npm trusted publishing authentication mode.",
      skippedDescription: "Record skipped npm trusted publishing authentication mode.",
      simulatedMessage:
        `NPM trusted publishing authenticates during npm publish with CI OIDC; npm whoami does not validate this mode. This target expects provider ${section.trustedPublishing.provider}, workflow ${section.trustedPublishing.workflow}, GitHub Actions permission id-token: write, and package ${section.packageName} to already exist on the registry.`,
      skippedMessage: "NPM trusted publishing authentication validation was skipped."
    })
    : readOnlyCommandValidationOperation({
      id: "npm:npm-whoami",
      pipeId: "publish:npm",
      description: "Validate npm CLI authentication.",
      command: npmCommand(section, ["whoami", "--registry", section.registry], true)
    })

const npmPackageExistsOperation = (section: NpmPublishSection): Operation =>
  readOnlyCommandValidationOperation({
    id: "npm:npm-package-exists",
    pipeId: "publish:npm",
    description: "Verify npm package exists before trusted publishing.",
    command: npmCommand(section, ["view", section.packageName ?? "", "name", "--registry", section.registry], false)
  })

const npmPublishArgs = (section: NpmPublishSection): ReadonlyArray<string> => {
  const args = ["publish", section.packagePath, "--registry", section.registry]
  if (section.access !== undefined) {
    args.push("--access", section.access)
  }
  if (section.provenance === true) {
    args.push("--provenance")
  }
  return args
}

const requirePackageName = (
  section: NpmPublishSection,
  identity: ReleaseIdentity
): Effect.Effect<NpmPublishSection & { readonly packageName: string }, PlanError> => {
  const packageName = section.packageName ?? identity.name
  if (packageName.trim().length === 0) {
    return Effect.fail(PlanError.make({
      pipeId: "publish:npm",
      field: "publish.npm.packageName",
      reason: "NPM publishing requires a package name."
    }))
  }
  if (section.trustedPublishing !== undefined && section.tokenEnv !== undefined) {
    return Effect.fail(PlanError.make({
      pipeId: "publish:npm",
      field: "publish.npm.tokenEnv",
      reason: "NPM trusted publishing uses CI OIDC and must not also declare tokenEnv."
    }))
  }
  if (section.trustedPublishing !== undefined) {
    const workflow = section.trustedPublishing.workflow
    const hasPathSeparator = workflow.includes("/") || workflow.includes("\\")
    const hasWorkflowExtension = workflow.endsWith(".yml") || workflow.endsWith(".yaml")
    if (hasPathSeparator || !hasWorkflowExtension) {
      return Effect.fail(PlanError.make({
        pipeId: "publish:npm",
        field: "publish.npm.trustedPublishing.workflow",
        reason: "Workflow must be a .yml or .yaml filename without path separators."
      }))
    }
  }
  return Effect.succeed({ ...section, packageName })
}

export const publishNpmPipe: Pipe<NpmPublishSection> = {
  id: "publish:npm",
  phase: "publish",
  section: sectionFromConfig,
  defaults: (section, identity) => ({
    ...section,
    packageName: section.packageName ?? identity.name
  }),
  plan: (rawSection, state) =>
    Effect.gen(function*() {
      const section = yield* requirePackageName(rawSection, state.identity)
      return {
        ...emptyContribution,
        operations: [
          readOnlyCommandValidationOperation({
            id: "npm:npm-version",
            pipeId: "publish:npm",
            description: "Check npm CLI availability.",
            command: npmCommand(section, ["--version"], false)
          }),
          npmAuthOperation(section),
          ...(section.trustedPublishing?.verifyPackageExists === true ? [npmPackageExistsOperation(section)] : []),
          dryRunValidationOperation({
            id: "npm:npm-pack-dry-run",
            pipeId: "publish:npm",
            dryRunSupport: "native",
            nativeDescription: "Validate npm package contents with npm pack dry-run.",
            command: npmCommand(section, ["pack", "--dry-run", "--json", section.packagePath], false),
            simulatedDescription: "Record simulated npm dry-run validation.",
            skippedDescription: "Record skipped npm dry-run validation.",
            simulatedMessage:
              "npm dry-run validation is marked as simulated by target configuration; no npm pack --dry-run command was planned.",
            skippedMessage: "npm dry-run validation was skipped because this target declares no dry-run support."
          }),
          Operation.make({
            id: "npm:npm-publish",
            pipeId: "publish:npm",
            phase: "publish",
            risk: "irreversible",
            description: `Publish ${section.packageName}@${state.identity.version} to npm.`,
            action: CommandAction.make({ command: npmCommand(section, npmPublishArgs(section), true) })
          }),
          Operation.make({
            id: "npm:npm-version-verify",
            pipeId: "publish:npm",
            phase: "verify",
            risk: "read-only",
            description: `Verify ${section.packageName}@${state.identity.version} exists on npm.`,
            action: CommandAction.make({
              command: npmCommand(
                section,
                ["view", `${section.packageName}@${state.identity.version}`, "version", "--registry", section.registry],
                false
              )
            }),
            retry: RetryPolicy.make({ attempts: 11, delayMillis: 500 })
          })
        ]
      }
    })
}
