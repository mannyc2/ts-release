import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { SafeRelativePath } from "../pipeline/artifact.js"
import { PlanError } from "../pipeline/errors.js"
import {
  CommandAction,
  CommandSpec,
  Operation,
  RetryPolicy
} from "../pipeline/operation.js"
import {
  readOnlyCommandValidationOperation,
  validationNoteOperation
} from "../pipeline/operation-helpers.js"
import type { FeaturePlanner } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
import type { ReleaseIdentity } from "../pipeline/state.js"
import {
  compactTrustedPublishing,
  publishingAuthEnvNames,
  trustedPublishingConfigFields,
  type TrustedPublishingSection
} from "./shared.js"

export const NpmAccess = Schema.Literals(["public", "restricted"])
export type NpmAccess = typeof NpmAccess.Type

export class ReleaseConfigNpmTrustedPublishing extends Schema.Class<ReleaseConfigNpmTrustedPublishing>(
  "ReleaseConfigNpmTrustedPublishing"
)({
  ...trustedPublishingConfigFields,
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

interface NpmTrustedPublishingSection extends TrustedPublishingSection {
  readonly verifyPackageExists?: boolean | undefined
}

export interface ResolvedNpmPublish {
  readonly registry: string
  readonly packageName: string
  readonly packagePath: string
  readonly tokenEnv?: string | undefined
  readonly trustedPublishing?: NpmTrustedPublishingSection | undefined
  readonly access?: NpmAccess | undefined
  readonly provenance?: boolean | undefined
}

const compactNpmTrustedPublishing = (
  config: boolean | ReleaseConfigNpmTrustedPublishing | undefined
): NpmTrustedPublishingSection | undefined => {
  const base = compactTrustedPublishing(config)
  return base === undefined || typeof config !== "object"
    ? base
    : {
      ...base,
      verifyPackageExists: config.verifyPackageExists
    }
}

export const resolveNpmPublish = (config: {
  readonly project: {
    readonly packageName?: string | undefined
    readonly packagePath?: string | undefined
  }
  readonly publish: {
    readonly npm?: boolean | ReleaseConfigNpmPublish | undefined
  }
}, identity: ReleaseIdentity): ResolvedNpmPublish | undefined => {
  const publish = config.publish.npm
  if (publish === undefined || publish === false) {
    return undefined
  }
  const object = publish === true ? undefined : publish
  return {
    registry: object?.registry ?? "https://registry.npmjs.org",
    packageName: object?.packageName ?? config.project.packageName ?? identity.name,
    packagePath: object?.packagePath ?? config.project.packagePath ?? ".",
    tokenEnv: object?.tokenEnv,
    trustedPublishing: compactNpmTrustedPublishing(object?.trustedPublishing),
    access: object?.access,
    provenance: object?.provenance
  }
}

const authEnvNames = (section: ResolvedNpmPublish): ReadonlyArray<string> =>
  publishingAuthEnvNames(section.trustedPublishing, [section.tokenEnv])

const npmCommand = (
  section: ResolvedNpmPublish,
  args: ReadonlyArray<string>,
  includeAuth: boolean
): CommandSpec =>
  CommandSpec.make({
    executable: "npm",
    args: [...args],
    requiredEnv: includeAuth ? authEnvNames(section) : [],
    redactedEnv: includeAuth ? authEnvNames(section) : []
  })

const npmAuthOperation = (section: ResolvedNpmPublish): Operation =>
  section.trustedPublishing !== undefined
    ? validationNoteOperation({
      id: "npm:npm-trusted-publishing-auth",
      pipeId: "publish:npm",
      description: "Record npm trusted publishing authentication mode.",
      message:
        `NPM trusted publishing authenticates during npm publish with CI OIDC; npm whoami does not validate this mode. This target expects provider ${section.trustedPublishing.provider}, workflow ${section.trustedPublishing.workflow}, GitHub Actions permission id-token: write, and package ${section.packageName} to already exist on the registry.`
    })
    : readOnlyCommandValidationOperation({
      id: "npm:npm-whoami",
      pipeId: "publish:npm",
      description: "Validate npm CLI authentication.",
      command: npmCommand(section, ["whoami", "--registry", section.registry], true)
    })

const npmPackageExistsOperation = (section: ResolvedNpmPublish): Operation =>
  readOnlyCommandValidationOperation({
    id: "npm:npm-package-exists",
    pipeId: "publish:npm",
    description: "Verify npm package exists before trusted publishing.",
    command: npmCommand(section, ["view", section.packageName, "name", "--registry", section.registry], false)
  })

const npmPublishArgs = (section: ResolvedNpmPublish): ReadonlyArray<string> => {
  const args = ["publish", section.packagePath, "--registry", section.registry]
  if (section.access !== undefined) {
    args.push("--access", section.access)
  }
  if (section.provenance === true) {
    args.push("--provenance")
  }
  return args
}

const validateNpmPublish = (
  section: ResolvedNpmPublish
): Effect.Effect<ResolvedNpmPublish, PlanError> => {
  if (section.packageName.trim().length === 0) {
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
  return Effect.succeed(section)
}

export const publishNpmPlanner: FeaturePlanner<ResolvedNpmPublish> = {
  id: "publish:npm",
  plan: (resolved, state) =>
    Effect.gen(function*() {
      const section = yield* validateNpmPublish(resolved)
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
          readOnlyCommandValidationOperation({
            id: "npm:npm-pack-dry-run",
            pipeId: "publish:npm",
            description: "Validate npm package contents with npm pack dry-run.",
            command: npmCommand(section, ["pack", "--dry-run", "--json", section.packagePath], false)
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
