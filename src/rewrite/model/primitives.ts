import * as Schema from "effect/Schema"

const identifier = <const Name extends string>(name: Name) =>
  Schema.NonEmptyString.pipe(Schema.brand(name))

export const PlanId = identifier("PlanId")
export type PlanId = typeof PlanId.Type
export const OperationId = identifier("OperationId")
export type OperationId = typeof OperationId.Type
export const OutputId = identifier("OutputId")
export type OutputId = typeof OutputId.Type
export const RecipeId = identifier("RecipeId")
export type RecipeId = typeof RecipeId.Type
export const ProfileId = identifier("ProfileId")
export type ProfileId = typeof ProfileId.Type
export const Digest = identifier("Digest")
export type Digest = typeof Digest.Type
export const CredentialName = identifier("CredentialName")
export type CredentialName = typeof CredentialName.Type
export const NonEmptyName = identifier("NonEmptyName")
export type NonEmptyName = typeof NonEmptyName.Type
export const Version = identifier("Version")
export type Version = typeof Version.Type

export const isSafeRelativePath = (value: string): boolean =>
  value.trim().length > 0 &&
  !value.startsWith("/") &&
  !value.startsWith("\\") &&
  !/^[A-Za-z]:[\\/]/u.test(value) &&
  !value.split(/[\\/]+/u).includes("..")

export const SafeRelativePath = Schema.String.check(
  Schema.makeFilter((value: string) =>
    isSafeRelativePath(value)
      ? undefined
      : "Path must be nonempty, relative, and contain no parent traversal.")
).pipe(Schema.brand("SafeRelativePath"))
export type SafeRelativePath = typeof SafeRelativePath.Type

export const WorkspaceRoot = Schema.String.check(
  Schema.makeFilter((value: string) =>
    value.startsWith("/") ? undefined : "WorkspaceRoot must be absolute.")
).pipe(Schema.brand("WorkspaceRoot"))
export type WorkspaceRoot = typeof WorkspaceRoot.Type
