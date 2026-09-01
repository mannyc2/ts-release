import { encodeCanonicalJson, parseStrictJson, type Json } from "../../model/canonical.js"
import { objectChecksum } from "../canonical.js"
import {
  S3JournalBoundaryError,
  type S3JournalAuthority,
  type S3JournalOidcTrustConditions
} from "../model.js"

const encoder = new TextEncoder()

type JsonObject = { readonly [key: string]: Json }

interface NormalizedPrincipal {
  readonly AWS?: ReadonlyArray<string>
  readonly Federated?: ReadonlyArray<string>
}

interface NormalizedStatement {
  readonly Sid: string
  readonly Effect: "Allow" | "Deny"
  readonly Principal?: "*" | NormalizedPrincipal
  readonly Action: ReadonlyArray<string>
  readonly Resource?: ReadonlyArray<string>
  readonly NotResource?: ReadonlyArray<string>
  readonly Condition?: Readonly<Record<string, Readonly<Record<string, ReadonlyArray<string>>>>>
}

interface NormalizedPolicy {
  readonly Version: "2012-10-17"
  readonly Statement: ReadonlyArray<NormalizedStatement>
}

export interface AwsJournalPolicyCoordinates {
  readonly accountId: string
  readonly bucketArn: string
  readonly roleArn: string
  readonly rolePolicyName: string
  readonly oidcTrust: S3JournalOidcTrustConditions
}

export interface AwsJournalObservedPolicyDigests {
  readonly bucketPolicyDigest: string
  readonly rolePolicyDigest: string
  readonly oidcTrustPolicyDigest: string
}

const boundaryFailure = (reason: string): S3JournalBoundaryError =>
  S3JournalBoundaryError.make({
    operation: "observe-authority",
    commitment: "not-applicable",
    reason
  })

const fail = (reason: string): never => {
  throw boundaryFailure(reason)
}

const isObject = (value: Json): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const exactObject = (
  value: Json,
  fields: ReadonlyArray<string>,
  label: string
): JsonObject => {
  if (!isObject(value)) fail(`${label} must be an object.`)
  const object = value as JsonObject
  const actual = Object.keys(object).sort()
  const expected = [...fields].sort()
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) {
    fail(`${label} fields are not the exact admitted set.`)
  }
  return object
}

const stringValue = (value: Json | undefined, label: string): string => {
  if (typeof value !== "string" || value.length === 0 || value !== value.normalize("NFC")) {
    fail(`${label} must be one non-empty NFC string.`)
  }
  return value as string
}

const stringSet = (value: Json | undefined, label: string): ReadonlyArray<string> => {
  const values = Array.isArray(value)
    ? value.map((item, index) => stringValue(item, `${label}[${index}]`))
    : [stringValue(value, label)]
  const sorted = [...values].sort()
  if (sorted.length === 0 || new Set(sorted).size !== sorted.length) {
    fail(`${label} must be one duplicate-free string set.`)
  }
  return sorted
}

const normalizePrincipal = (value: Json | undefined, label: string): "*" | NormalizedPrincipal => {
  if (value === "*") return "*"
  if (!isObject(value!)) fail(`${label} must be '*' or an exact principal object.`)
  const principal = value as JsonObject
  const fields = Object.keys(principal).sort()
  if (fields.length !== 1 || (fields[0] !== "AWS" && fields[0] !== "Federated")) {
    fail(`${label} must contain exactly one AWS or Federated principal kind.`)
  }
  const field = fields[0] as "AWS" | "Federated"
  return { [field]: stringSet(principal[field], `${label}.${field}`) }
}

const normalizeCondition = (
  value: Json | undefined,
  label: string
): Readonly<Record<string, Readonly<Record<string, ReadonlyArray<string>>>>> => {
  if (!isObject(value!)) fail(`${label} must be an object.`)
  const condition = value as JsonObject
  const normalized: Record<string, Record<string, ReadonlyArray<string>>> = {}
  const operators = Object.keys(condition).sort()
  if (operators.length === 0) fail(`${label} must not be empty.`)
  for (const operator of operators) {
    if (!/^[A-Za-z][A-Za-z0-9:]*$/u.test(operator)) fail(`${label} has an invalid operator.`)
    const entries = condition[operator]
    if (!isObject(entries!)) fail(`${label}.${operator} must be an object.`)
    const normalizedEntries: Record<string, ReadonlyArray<string>> = {}
    const keys = Object.keys(entries as JsonObject).sort()
    if (keys.length === 0) fail(`${label}.${operator} must not be empty.`)
    for (const key of keys) {
      normalizedEntries[key] = stringSet((entries as JsonObject)[key], `${label}.${operator}.${key}`)
    }
    normalized[operator] = normalizedEntries
  }
  return normalized
}

const normalizeStatement = (value: Json, index: number): NormalizedStatement => {
  if (!isObject(value)) fail(`Policy statement ${index} must be an object.`)
  const object = value as JsonObject
  const admitted = new Set(["Sid", "Effect", "Principal", "Action", "Resource", "NotResource", "Condition"])
  for (const field of Object.keys(object)) {
    if (!admitted.has(field)) fail(`Policy statement ${index} contains unadmitted field ${field}.`)
  }
  const sid = stringValue(object.Sid, `Policy statement ${index}.Sid`)
  if (!/^[A-Za-z0-9]{1,128}$/u.test(sid)) fail(`Policy statement ${index}.Sid is not canonical.`)
  const effect = stringValue(object.Effect, `Policy statement ${index}.Effect`)
  if (effect !== "Allow" && effect !== "Deny") fail(`Policy statement ${index}.Effect is not admitted.`)
  if (object.Resource !== undefined && object.NotResource !== undefined) {
    fail(`Policy statement ${index} cannot contain both Resource and NotResource.`)
  }
  return {
    Sid: sid,
    Effect: effect as "Allow" | "Deny",
    ...(object.Principal === undefined ? {} : { Principal: normalizePrincipal(object.Principal, `Policy statement ${index}.Principal`) }),
    Action: stringSet(object.Action, `Policy statement ${index}.Action`),
    ...(object.Resource === undefined ? {} : { Resource: stringSet(object.Resource, `Policy statement ${index}.Resource`) }),
    ...(object.NotResource === undefined ? {} : { NotResource: stringSet(object.NotResource, `Policy statement ${index}.NotResource`) }),
    ...(object.Condition === undefined ? {} : { Condition: normalizeCondition(object.Condition, `Policy statement ${index}.Condition`) })
  }
}

const parsePolicyDocument = (document: string, label: string): NormalizedPolicy => {
  let parsed: Json
  try {
    const source = document.trimStart().startsWith("{") ? document : decodeURIComponent(document)
    parsed = parseStrictJson(source)
  } catch {
    return fail(`${label} is not one valid JSON or RFC3986-encoded JSON policy.`)
  }
  const policy = exactObject(parsed, ["Statement", "Version"], label)
  if (policy.Version !== "2012-10-17") fail(`${label} has an unsupported version.`)
  const rawStatements = Array.isArray(policy.Statement) ? policy.Statement : [policy.Statement!]
  if (rawStatements.length === 0) fail(`${label} has no statements.`)
  const statements = rawStatements.map(normalizeStatement).sort((left, right) => left.Sid.localeCompare(right.Sid))
  if (new Set(statements.map((statement) => statement.Sid)).size !== statements.length) {
    fail(`${label} repeats a statement Sid.`)
  }
  return { Version: "2012-10-17", Statement: statements }
}

const canonicalPolicy = (policy: NormalizedPolicy): string => encodeCanonicalJson(policy)
const policyDigest = (policy: NormalizedPolicy): string => objectChecksum(encoder.encode(canonicalPolicy(policy)))

const condition = (
  operator: string,
  entries: Readonly<Record<string, string | ReadonlyArray<string>>>
): Readonly<Record<string, Readonly<Record<string, ReadonlyArray<string>>>>> => ({
  [operator]: Object.fromEntries(Object.entries(entries).map(([key, value]) => [
    key,
    [...(Array.isArray(value) ? value : [value])].sort()
  ]))
})

const statement = (value: NormalizedStatement): NormalizedStatement => value

const requireImmutableCalledWorkflow = (coordinates: AwsJournalPolicyCoordinates): void => {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/\.github\/workflows\/[A-Za-z0-9._-]+\.ya?ml@[a-f0-9]{40}$/u
    .test(coordinates.oidcTrust.jobWorkflowRef)) {
    fail("Journal OIDC trust must pin the called workflow to one immutable source SHA.")
  }
}

export const makeAwsJournalTrustPolicy = (
  coordinates: AwsJournalPolicyCoordinates
): NormalizedPolicy => {
  requireImmutableCalledWorkflow(coordinates)
  return {
    Version: "2012-10-17",
    Statement: [statement({
      Sid: "AllowGitHubJournalOidc",
      Effect: "Allow",
      Principal: {
        Federated: [`arn:aws:iam::${coordinates.accountId}:oidc-provider/token.actions.githubusercontent.com`]
      },
      Action: ["sts:AssumeRoleWithWebIdentity"],
      Condition: condition("StringEquals", {
        "token.actions.githubusercontent.com:aud": coordinates.oidcTrust.audience,
        "token.actions.githubusercontent.com:sub": coordinates.oidcTrust.subject,
        "token.actions.githubusercontent.com:repository": coordinates.oidcTrust.repository,
        "token.actions.githubusercontent.com:repository_id": coordinates.oidcTrust.repositoryId,
        "token.actions.githubusercontent.com:repository_owner_id": coordinates.oidcTrust.repositoryOwnerId,
        "token.actions.githubusercontent.com:workflow": coordinates.oidcTrust.workflow,
        "token.actions.githubusercontent.com:ref": coordinates.oidcTrust.ref,
        "token.actions.githubusercontent.com:environment": coordinates.oidcTrust.environment,
        "token.actions.githubusercontent.com:job_workflow_ref": coordinates.oidcTrust.jobWorkflowRef
      })
    })]
  }
}

export const makeAwsJournalRolePolicy = (
  coordinates: AwsJournalPolicyCoordinates
): NormalizedPolicy => ({
  Version: "2012-10-17",
  Statement: [
    statement({
      Sid: "DenyJournalBucketGovernanceMutation",
      Effect: "Deny",
      Action: [
        "s3:DeleteBucket*",
        "s3:DeletePublicAccessBlock",
        "s3:PutBucket*",
        "s3:PutLifecycleConfiguration",
        "s3:PutPublicAccessBlock"
      ].sort(),
      Resource: [coordinates.bucketArn]
    }),
    statement({
      Sid: "DenyJournalCopy",
      Effect: "Deny",
      Action: ["s3:PutObject"],
      Resource: [`${coordinates.bucketArn}/operation-journal/v1/*`],
      Condition: condition("Null", { "s3:x-amz-copy-source": "false" })
    }),
    statement({
      Sid: "DenyJournalDestructiveObjectMutation",
      Effect: "Deny",
      Action: [
        "s3:AbortMultipartUpload",
        "s3:BypassGovernanceRetention",
        "s3:DeleteObject",
        "s3:DeleteObjectVersion",
        "s3:PutObjectAcl",
        "s3:PutObjectLegalHold",
        "s3:PutObjectRetention",
        "s3:PutObjectTagging"
      ].sort(),
      Resource: [`${coordinates.bucketArn}/*`]
    }),
    statement({
      Sid: "DenyJournalIamMutation",
      Effect: "Deny",
      Action: [
        "iam:Add*",
        "iam:Attach*",
        "iam:Change*",
        "iam:Create*",
        "iam:Deactivate*",
        "iam:Delete*",
        "iam:Detach*",
        "iam:Enable*",
        "iam:PassRole",
        "iam:Put*",
        "iam:Remove*",
        "iam:Reset*",
        "iam:Resync*",
        "iam:Set*",
        "iam:Tag*",
        "iam:Untag*",
        "iam:Update*",
        "iam:Upload*"
      ].sort(),
      Resource: ["*"]
    }),
    statement({
      Sid: "DenyJournalMultipart",
      Effect: "Deny",
      Action: ["s3:PutObject"],
      Resource: [`${coordinates.bucketArn}/operation-journal/v1/*`],
      Condition: condition("Bool", { "s3:ObjectCreationOperation": "false" })
    }),
    statement({
      Sid: "DenyJournalWritesOutsideNamespace",
      Effect: "Deny",
      Action: ["s3:PutObject"],
      NotResource: [`${coordinates.bucketArn}/operation-journal/v1/*`]
    }),
    statement({
      Sid: "ListJournalNamespace",
      Effect: "Allow",
      Action: ["s3:ListBucketVersions"],
      Resource: [coordinates.bucketArn],
      Condition: condition("StringLike", { "s3:prefix": "operation-journal/v1/*" })
    }),
    statement({
      Sid: "ReadJournalBucketGovernance",
      Effect: "Allow",
      Action: [
        "s3:GetBucketObjectLockConfiguration",
        "s3:GetBucketOwnershipControls",
        "s3:GetBucketPolicy",
        "s3:GetBucketPolicyStatus",
        "s3:GetBucketPublicAccessBlock",
        "s3:GetBucketVersioning"
      ].sort(),
      Resource: [coordinates.bucketArn]
    }),
    statement({
      Sid: "ReadJournalRole",
      Effect: "Allow",
      Action: [
        "iam:GetRole",
        "iam:GetRolePolicy",
        "iam:ListAttachedRolePolicies",
        "iam:ListRolePolicies"
      ].sort(),
      Resource: [coordinates.roleArn]
    }),
    statement({
      Sid: "ReadWriteJournalObjects",
      Effect: "Allow",
      Action: [
        "s3:GetObjectRetention",
        "s3:GetObjectVersion",
        "s3:GetObjectVersionAttributes",
        "s3:PutObject"
      ].sort(),
      Resource: [`${coordinates.bucketArn}/operation-journal/v1/*`]
    })
  ].sort((left, right) => left.Sid.localeCompare(right.Sid))
})

export const makeAwsJournalBucketPolicy = (
  coordinates: AwsJournalPolicyCoordinates
): NormalizedPolicy => ({
  Version: "2012-10-17",
  Statement: [
    statement({
      Sid: "DenyJournalCopy",
      Effect: "Deny",
      Principal: "*",
      Action: ["s3:PutObject"],
      Resource: [`${coordinates.bucketArn}/operation-journal/v1/*`],
      Condition: condition("Null", { "s3:x-amz-copy-source": "false" })
    }),
    statement({
      Sid: "DenyJournalDeletes",
      Effect: "Deny",
      Principal: "*",
      Action: ["s3:DeleteObject", "s3:DeleteObjectVersion"],
      Resource: [`${coordinates.bucketArn}/operation-journal/v1/*`]
    }),
    statement({
      Sid: "DenyJournalDualConditionWrite",
      Effect: "Deny",
      Principal: "*",
      Action: ["s3:PutObject"],
      Resource: [`${coordinates.bucketArn}/operation-journal/v1/*`],
      Condition: {
        Bool: { "s3:ObjectCreationOperation": ["true"] },
        Null: { "s3:if-match": ["false"], "s3:if-none-match": ["false"] }
      }
    }),
    statement({
      Sid: "DenyJournalMetadataMutation",
      Effect: "Deny",
      Principal: "*",
      Action: [
        "s3:PutObjectAcl",
        "s3:PutObjectLegalHold",
        "s3:PutObjectRetention",
        "s3:PutObjectTagging"
      ].sort(),
      Resource: [`${coordinates.bucketArn}/operation-journal/v1/*`]
    }),
    statement({
      Sid: "DenyJournalMultipart",
      Effect: "Deny",
      Principal: "*",
      Action: ["s3:PutObject"],
      Resource: [`${coordinates.bucketArn}/operation-journal/v1/*`],
      Condition: condition("Bool", { "s3:ObjectCreationOperation": "false" })
    }),
    statement({
      Sid: "DenyJournalRoleWriteOutsideNamespace",
      Effect: "Deny",
      Principal: "*",
      Action: ["s3:PutObject"],
      NotResource: [`${coordinates.bucketArn}/operation-journal/v1/*`],
      Condition: condition("ArnEquals", { "aws:PrincipalArn": coordinates.roleArn })
    }),
    statement({
      Sid: "DenyJournalUnconditionalWrite",
      Effect: "Deny",
      Principal: "*",
      Action: ["s3:PutObject"],
      Resource: [`${coordinates.bucketArn}/operation-journal/v1/*`],
      Condition: {
        Bool: { "s3:ObjectCreationOperation": ["true"] },
        Null: { "s3:if-match": ["true"], "s3:if-none-match": ["true"] }
      }
    }),
    statement({
      Sid: "DenyNonJournalPrincipalList",
      Effect: "Deny",
      Principal: "*",
      Action: ["s3:ListBucketVersions"],
      Resource: [coordinates.bucketArn],
      Condition: condition("ArnNotEquals", { "aws:PrincipalArn": coordinates.roleArn })
    }),
    statement({
      Sid: "DenyNonJournalPrincipalObjectAccess",
      Effect: "Deny",
      Principal: "*",
      Action: [
        "s3:GetObject",
        "s3:GetObjectAttributes",
        "s3:GetObjectRetention",
        "s3:GetObjectVersion",
        "s3:GetObjectVersionAttributes",
        "s3:PutObject"
      ].sort(),
      Resource: [`${coordinates.bucketArn}/operation-journal/v1/*`],
      Condition: condition("ArnNotEquals", { "aws:PrincipalArn": coordinates.roleArn })
    })
  ].sort((left, right) => left.Sid.localeCompare(right.Sid))
})

const requireExactPolicy = (
  observedDocument: string,
  expected: NormalizedPolicy,
  label: string
): NormalizedPolicy => {
  const observed = parsePolicyDocument(observedDocument, label)
  if (canonicalPolicy(observed) !== canonicalPolicy(expected)) {
    fail(`${label} does not equal the one admitted operational-journal policy.`)
  }
  return observed
}

export const validateAwsJournalPolicies = (input: {
  readonly coordinates: AwsJournalPolicyCoordinates
  readonly trustPolicyDocument: string
  readonly rolePolicyDocument: string
  readonly bucketPolicyDocument: string
}): AwsJournalObservedPolicyDigests => {
  const trust = requireExactPolicy(
    input.trustPolicyDocument,
    makeAwsJournalTrustPolicy(input.coordinates),
    "Journal role trust policy"
  )
  const role = requireExactPolicy(
    input.rolePolicyDocument,
    makeAwsJournalRolePolicy(input.coordinates),
    "Journal role permission policy"
  )
  const bucket = requireExactPolicy(
    input.bucketPolicyDocument,
    makeAwsJournalBucketPolicy(input.coordinates),
    "Journal bucket policy"
  )
  return {
    bucketPolicyDigest: policyDigest(bucket),
    rolePolicyDigest: policyDigest(role),
    oidcTrustPolicyDigest: policyDigest(trust)
  }
}

export const assertAwsJournalPolicyDigests = (
  authority: S3JournalAuthority,
  observed: AwsJournalObservedPolicyDigests
): void => {
  if (authority.bucketPolicyDigest !== observed.bucketPolicyDigest ||
      authority.rolePolicyDigest !== observed.rolePolicyDigest ||
      authority.oidcTrustPolicyDigest !== observed.oidcTrustPolicyDigest) {
    fail("Observed journal policy digests drifted from the exact activation contract.")
  }
}
