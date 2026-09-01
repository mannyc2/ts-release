import type { S3JournalAuthority } from "../../src/operation-journal.js"
import {
  makeAwsJournalBucketPolicy,
  makeAwsJournalRolePolicy,
  makeAwsJournalTrustPolicy,
  validateAwsJournalPolicies,
  type AwsJournalPolicyCoordinates
} from "../../src/operation-journal/aws/policy.js"

export const rolePolicyName = "OperationalJournal"

const oidc = {
  issuer: "https://token.actions.githubusercontent.com",
  audience: "sts.amazonaws.com",
  subject: "repo:fixture@1234567/consumer@123456789:environment:certification",
  repository: "fixture/consumer",
  repositoryId: "123456789",
  repositoryOwnerId: "1234567",
  repositoryVisibility: "public",
  eventName: "workflow_dispatch",
  ref: "refs/heads/main",
  refType: "branch",
  sha: "a".repeat(40),
  environment: "certification",
  runnerEnvironment: "github-hosted",
  runId: "42",
  runAttempt: "1",
  workflow: "Certification",
  workflowRef: "fixture/consumer/.github/workflows/certification.yml@refs/heads/main",
  workflowSha: "a".repeat(40),
  jobWorkflowRef: `fixture/owner/.github/workflows/journal.yml@${"c".repeat(40)}`,
  jobWorkflowSha: "c".repeat(40)
} as const

const oidcTrust = {
  audience: oidc.audience,
  subject: oidc.subject,
  repository: oidc.repository,
  repositoryId: oidc.repositoryId,
  repositoryOwnerId: oidc.repositoryOwnerId,
  workflow: oidc.workflow,
  ref: oidc.ref,
  environment: oidc.environment,
  jobWorkflowRef: oidc.jobWorkflowRef
} as const

export const policyCoordinates: AwsJournalPolicyCoordinates = {
  accountId: "123456789012",
  bucketArn: "arn:aws:s3:::fixture-operation-journal",
  roleArn: "arn:aws:iam::123456789012:role/fixture-operation-journal",
  rolePolicyName,
  oidcTrust
}

export const policyDocuments = {
  trust: JSON.stringify(makeAwsJournalTrustPolicy(policyCoordinates)),
  role: JSON.stringify(makeAwsJournalRolePolicy(policyCoordinates)),
  bucket: JSON.stringify(makeAwsJournalBucketPolicy(policyCoordinates))
}

const digests = validateAwsJournalPolicies({
  coordinates: policyCoordinates,
  trustPolicyDocument: policyDocuments.trust,
  rolePolicyDocument: policyDocuments.role,
  bucketPolicyDocument: policyDocuments.bucket
})

export const awsAuthority: S3JournalAuthority = {
  accountId: policyCoordinates.accountId,
  bucketName: "fixture-operation-journal",
  bucketArn: policyCoordinates.bucketArn,
  region: "us-east-1",
  roleArn: policyCoordinates.roleArn,
  prefix: "operation-journal/v1",
  expectedBucketOwner: policyCoordinates.accountId,
  versioning: "Enabled",
  objectLock: "Enabled",
  retentionMode: "COMPLIANCE",
  retentionYears: 10,
  bucketOwnerEnforced: true,
  publicAccessBlocked: true,
  deleteDenied: true,
  multipartDenied: true,
  conditionalWritesEnforced: true,
  ...digests,
  oidc,
  oidcTrust
}

export const makeOidcJwt = (
  now: Date,
  claims = awsAuthority.oidc,
  payloadOverrides: Readonly<Record<string, unknown>> = {}
): string => {
  const encoded = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64url")
  const payload = {
    aud: claims.audience,
    environment: claims.environment,
    event_name: claims.eventName,
    exp: Math.floor(now.getTime() / 1000) + 600,
    iat: Math.floor(now.getTime() / 1000),
    iss: claims.issuer,
    job_workflow_ref: claims.jobWorkflowRef,
    job_workflow_sha: claims.jobWorkflowSha,
    nbf: Math.floor(now.getTime() / 1000) - 1,
    ref: claims.ref,
    ref_type: claims.refType,
    repository: claims.repository,
    repository_id: claims.repositoryId,
    repository_owner_id: claims.repositoryOwnerId,
    repository_visibility: claims.repositoryVisibility,
    run_attempt: claims.runAttempt,
    run_id: claims.runId,
    runner_environment: claims.runnerEnvironment,
    sha: claims.sha,
    sub: claims.subject,
    workflow: claims.workflow,
    workflow_ref: claims.workflowRef,
    workflow_sha: claims.workflowSha,
    ...payloadOverrides
  }
  return [
    encoded({ alg: "RS256", kid: "fixture-key", typ: "JWT" }),
    encoded(payload),
    encoded("fixture-signature")
  ].join(".")
}
