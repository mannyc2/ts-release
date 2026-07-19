// Invariant: the resolved npm section owns defaults/auth mode; the planner only emits the frozen operation sequence.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { SafeRelativePath } from "../grammar/artifact.js"
import { CommandAction, CommandSpec, Operation, RetryPolicy } from "../grammar/operation.js"
import { featurePlanner } from "../grammar/pipe.js"
import type { ReleaseIdentity } from "../grammar/state.js"
import {
  compactTrustedPublishing,
  publishingAuthEnvNames,
  trustedPublishingConfigFields
} from "./trusted-publishing.js"
import { readOnlyCommandValidationOperation, validationNoteOperation } from "./operations.js"
import { defaulted } from "../grammar/defaulted.js"

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
  trustedPublishing: Schema.optionalKey(Schema.Union([Schema.Boolean, ReleaseConfigNpmTrustedPublishing])),
  access: Schema.optionalKey(NpmAccess),
  provenance: Schema.optionalKey(Schema.Boolean)
}) {}

export const resolveNpmPublish = (config: {
  readonly project: { readonly packageName?: string; readonly packagePath?: string }
  readonly publish: { readonly npm?: boolean | ReleaseConfigNpmPublish }
}, identity: ReleaseIdentity) => {
  const publish = config.publish.npm
  if (publish === undefined || publish === false) return undefined
  const section = publish === true ? undefined : publish
  const trusted = compactTrustedPublishing(section?.trustedPublishing)
  return {
    registry: section?.registry ?? "https://registry.npmjs.org",
    packageName: section?.packageName ?? config.project.packageName ?? identity.name,
    packagePath: section?.packagePath ?? config.project.packagePath ?? ".",
    tokenEnv: section?.tokenEnv,
    trustedPublishing: trusted === undefined || typeof section?.trustedPublishing !== "object"
      ? trusted
      : { ...trusted, verifyPackageExists: section.trustedPublishing.verifyPackageExists },
    access: section?.access,
    provenance: section?.provenance
  }
}
export type NpmPublishSection = NonNullable<ReturnType<typeof resolveNpmPublish>>

const npmCommand = (
  section: NpmPublishSection,
  args: ReadonlyArray<string>,
  authenticated: boolean = false
): CommandSpec => {
  const env = authenticated ? publishingAuthEnvNames(section.trustedPublishing, [section.tokenEnv]) : []
  return CommandSpec.make({ executable: "npm", args: [...args], requiredEnv: env, redactedEnv: env })
}

const npmCheck = (id: string, description: string, section: NpmPublishSection, args: ReadonlyArray<string>) =>
  readOnlyCommandValidationOperation({ id, pipeId: "publish:npm", description, command: npmCommand(section, args) })

const publishArgs = (section: NpmPublishSection): ReadonlyArray<string> => {
  const args = ["publish", section.packagePath, "--registry", section.registry]
  if (section.access !== undefined) args.push("--access", section.access)
  if (section.provenance === true) args.push("--provenance")
  return args
}

export const publishNpmPlanner = featurePlanner<NpmPublishSection>("publish:npm", (section, state) => {
    const auth = section.trustedPublishing === undefined
      ? readOnlyCommandValidationOperation({
        id: "npm:npm-whoami",
        pipeId: "publish:npm",
        description: "Validate npm CLI authentication.",
        command: npmCommand(section, ["whoami", "--registry", section.registry], true)
      })
      : validationNoteOperation({
        id: "npm:npm-trusted-publishing-auth",
        pipeId: "publish:npm",
        description: "Record npm trusted publishing authentication mode.",
        message:
          `NPM trusted publishing authenticates during npm publish with CI OIDC; npm whoami does not validate this mode. This target expects provider ${section.trustedPublishing.provider}, workflow ${section.trustedPublishing.workflow}, GitHub Actions permission id-token: write, and package ${section.packageName} to already exist on the registry.`
      })
    const operations: Array<Operation> = [
      npmCheck("npm:npm-version", "Check npm CLI availability.", section, ["--version"]),
      auth
    ]
    if (section.trustedPublishing !== undefined && "verifyPackageExists" in section.trustedPublishing
      && section.trustedPublishing.verifyPackageExists === true) operations.push(npmCheck(
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
      Operation.make({
        id: "npm:npm-publish",
        pipeId: "publish:npm",
        phase: "publish",
        risk: "irreversible",
        description: `Publish ${section.packageName}@${state.identity.version} to npm.`,
        action: CommandAction.make({ command: npmCommand(section, publishArgs(section), true) })
      }),
      Operation.make({
        id: "npm:npm-version-verify",
        pipeId: "publish:npm",
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
