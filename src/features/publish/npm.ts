// Invariant: the resolved npm section owns defaults/auth mode; the planner only emits the frozen operation sequence.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { SafeRelativePath } from "../../grammar/artifact.js"
import { PlanError } from "../../grammar/errors.js"
import { CommandAction, CommandSpec, RetryPolicy } from "../../grammar/operation.js"
import { featureOperation, featurePlanner, type UnboundOperation } from "../../grammar/planner.js"
import type { ReleaseIdentity } from "../../grammar/state.js"
import {
  publishingAuthEnvNames,
  trustedPublishingConfigFields
} from "./trusted-publishing.js"
import { readOnlyCommandValidationOperation, trustedPublishingMessage, validationNoteOperation } from "./operations.js"
import { defaulted } from "../../grammar/defaulted.js"

export const NpmAccess = Schema.Literals(["public", "restricted"])
export type NpmAccess = typeof NpmAccess.Type

export class ReleaseConfigNpmTrustedPublishing extends Schema.Class<ReleaseConfigNpmTrustedPublishing>(
  "ReleaseConfigNpmTrustedPublishing"
)({
  ...trustedPublishingConfigFields,
  verifyPackageExists: Schema.optionalKey(Schema.Boolean)
}) {}

export class ReleaseConfigNpmPublish extends Schema.Class<ReleaseConfigNpmPublish>("ReleaseConfigNpmPublish")({
  registry: defaulted(Schema.String, "https://registry.npmjs.org"),
  packageName: Schema.optionalKey(Schema.NonEmptyString),
  packagePath: Schema.optionalKey(SafeRelativePath),
  tokenEnv: Schema.optionalKey(Schema.String),
  trustedPublishing: Schema.optionalKey(ReleaseConfigNpmTrustedPublishing),
  access: Schema.optionalKey(NpmAccess),
  provenance: Schema.optionalKey(Schema.Boolean)
}) {}

export const resolveNpmPublish = (config: {
  readonly project: { readonly packageName?: string; readonly packagePath?: string }
  readonly publish: { readonly npm?: ReleaseConfigNpmPublish }
}, identity: ReleaseIdentity) => {
  const section = config.publish.npm
  if (section === undefined) return undefined
  return {
    registry: section.registry,
    packageName: section.packageName ?? config.project.packageName ?? identity.name,
    packagePath: section.packagePath ?? config.project.packagePath ?? ".",
    tokenEnv: section.tokenEnv,
    trustedPublishing: section.trustedPublishing,
    access: section.access,
    provenance: section.provenance
  }
}
export type NpmPublishSection = NonNullable<ReturnType<typeof resolveNpmPublish>>

const npmCommand = (
  section: NpmPublishSection,
  args: ReadonlyArray<string>,
  authenticated: boolean = false
): CommandSpec => {
  const env = authenticated ? publishingAuthEnvNames(section.trustedPublishing !== undefined, [section.tokenEnv]) : []
  return CommandSpec.make({ executable: "npm", args: [...args], requiredEnv: env, redactedEnv: env })
}

const npmCheck = (id: string, description: string, section: NpmPublishSection, args: ReadonlyArray<string>) =>
  readOnlyCommandValidationOperation({ id, description, command: npmCommand(section, args) })

const publishArgs = (section: NpmPublishSection): ReadonlyArray<string> => {
  const args = ["publish", section.packagePath, "--registry", section.registry]
  if (section.access !== undefined) args.push("--access", section.access)
  if (section.provenance === true) args.push("--provenance")
  return args
}

export const publishNpmPlanner = featurePlanner<NpmPublishSection>("publish:npm", (section, state) => {
    if (section.trustedPublishing !== undefined && section.tokenEnv !== undefined) return Effect.fail(PlanError.make({
      pipeId: "publish:npm",
      field: "publish.npm.tokenEnv",
      reason: "NPM trusted publishing uses CI OIDC and must not also declare tokenEnv."
    }))
    const auth = section.trustedPublishing === undefined
      ? readOnlyCommandValidationOperation({
        id: "npm:npm-whoami",
        description: "Validate npm CLI authentication.",
        command: npmCommand(section, ["whoami", "--registry", section.registry], true)
      })
      : validationNoteOperation({
        id: "npm:npm-trusted-publishing-auth",
        description: "Record npm trusted publishing authentication mode.",
        message: trustedPublishingMessage({
          target: "NPM", publishCommand: "npm publish", validationCommand: "npm whoami",
          provider: section.trustedPublishing.provider, workflow: section.trustedPublishing.workflow,
          expectation: `package ${section.packageName} to already exist on the registry`
        })
      })
    const operations: Array<UnboundOperation> = [auth]
    if (section.trustedPublishing?.verifyPackageExists === true) operations.push(npmCheck(
      "npm:npm-package-exists",
      "Verify npm package exists before trusted publishing.",
      section,
      ["view", section.packageName, "name", "--registry", section.registry]
    ))
    operations.push(
      npmCheck(
        "npm:npm-pack-dry-run",
        "Validate npm package contents with npm pack dry-run.",
        section,
        ["pack", "--dry-run", "--json", section.packagePath]
      ),
      featureOperation({
        id: "npm:npm-publish",
        phase: "publish",
        risk: "irreversible",
        description: `Publish ${section.packageName}@${state.identity.version} to npm.`,
        action: CommandAction.make({ command: npmCommand(section, publishArgs(section), true) })
      }),
      featureOperation({
        id: "npm:npm-version-verify",
        phase: "verify",
        risk: "read-only",
        description: `Verify ${section.packageName}@${state.identity.version} exists on npm.`,
        action: CommandAction.make({ command: npmCommand(
          section,
          ["view", `${section.packageName}@${state.identity.version}`, "version", "--registry", section.registry]
        ) }),
        retry: RetryPolicy.make({ attempts: 11, delayMillis: 500 })
      })
    )
    return Effect.succeed({ operations })
  })
