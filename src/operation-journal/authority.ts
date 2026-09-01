import { encodeCanonicalJson } from "../model/canonical.js"
import {
  JournalAuthorityMismatch,
  type S3JournalAuthority
} from "./model.js"

const escapedPattern = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")

const requireExactFields = (
  value: object,
  expected: ReadonlyArray<string>,
  label: string
): void => {
  const actual = Object.keys(value).sort()
  const fields = [...expected].sort()
  if (actual.length !== fields.length || actual.some((field, index) => field !== fields[index])) {
    throw JournalAuthorityMismatch.make({ reason: `${label} fields are not the exact admitted set.` })
  }
}

export const validateS3JournalAuthority = (authority: S3JournalAuthority): void => {
  requireExactFields(authority, [
    "accountId",
    "bucketArn",
    "bucketName",
    "bucketOwnerEnforced",
    "bucketPolicyDigest",
    "conditionalWritesEnforced",
    "deleteDenied",
    "expectedBucketOwner",
    "multipartDenied",
    "objectLock",
    "oidc",
    "oidcTrust",
    "oidcTrustPolicyDigest",
    "prefix",
    "publicAccessBlocked",
    "region",
    "retentionMode",
    "retentionYears",
    "roleArn",
    "rolePolicyDigest",
    "versioning"
  ], "Journal authority")
  requireExactFields(authority.oidc, [
    "audience",
    "environment",
    "eventName",
    "issuer",
    "jobWorkflowRef",
    "jobWorkflowSha",
    "ref",
    "refType",
    "repository",
    "repositoryId",
    "repositoryOwnerId",
    "repositoryVisibility",
    "runAttempt",
    "runId",
    "runnerEnvironment",
    "sha",
    "subject",
    "workflow",
    "workflowRef",
    "workflowSha"
  ], "Journal OIDC claims")
  requireExactFields(authority.oidcTrust, [
    "audience",
    "environment",
    "jobWorkflowRef",
    "ref",
    "repository",
    "repositoryId",
    "repositoryOwnerId",
    "subject",
    "workflow"
  ], "Journal OIDC trust projection")
  if (!/^[0-9]{12}$/u.test(authority.accountId) || authority.expectedBucketOwner !== authority.accountId) {
    throw JournalAuthorityMismatch.make({ reason: "Journal AWS account and expected bucket owner are not the same exact account." })
  }
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(authority.bucketName) ||
      authority.bucketArn !== `arn:aws:s3:::${authority.bucketName}`) {
    throw JournalAuthorityMismatch.make({ reason: "Journal bucket identity is not canonical." })
  }
  if (!/^(?:af|ap|ca|eu|il|me|mx|sa|us)-[a-z]+-[0-9]$/u.test(authority.region)) {
    throw JournalAuthorityMismatch.make({ reason: "Journal region is not canonical." })
  }
  if (authority.roleArn.length > 512 || !(new RegExp(
    `^arn:aws:iam::${authority.accountId}:role\/(?:[A-Za-z0-9+=,.@_-]{1,128}\/)*[A-Za-z0-9+=,.@_-]{1,64}$`,
    "u"
  )).test(authority.roleArn)) {
    throw JournalAuthorityMismatch.make({ reason: "Journal role does not belong to the exact bucket account." })
  }
  if (!/^sha256:[a-f0-9]{64}$/u.test(authority.bucketPolicyDigest) ||
      !/^sha256:[a-f0-9]{64}$/u.test(authority.rolePolicyDigest) ||
      !/^sha256:[a-f0-9]{64}$/u.test(authority.oidcTrustPolicyDigest)) {
    throw JournalAuthorityMismatch.make({ reason: "Journal policy digests are not canonical SHA-256 values." })
  }
  if (authority.prefix !== "operation-journal/v1" || authority.versioning !== "Enabled" ||
      authority.objectLock !== "Enabled" || authority.retentionMode !== "COMPLIANCE" ||
      authority.retentionYears !== 10 || authority.bucketOwnerEnforced !== true ||
      authority.publicAccessBlocked !== true || authority.deleteDenied !== true ||
      authority.multipartDenied !== true || authority.conditionalWritesEnforced !== true) {
    throw JournalAuthorityMismatch.make({ reason: "Journal bucket governance is not the one admitted ten-year COMPLIANCE policy." })
  }
  if (authority.oidc.issuer !== "https://token.actions.githubusercontent.com" ||
      authority.oidc.audience !== "sts.amazonaws.com" ||
      !/^[1-9][0-9]{0,19}$/u.test(authority.oidc.repositoryId) ||
      !/^[1-9][0-9]{0,19}$/u.test(authority.oidc.repositoryOwnerId) ||
      !/^[1-9][0-9]{0,19}$/u.test(authority.oidc.runId) ||
      !/^[1-9][0-9]{0,19}$/u.test(authority.oidc.runAttempt) ||
      authority.oidc.repository.length > 200 ||
      !/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/u.test(authority.oidc.repository) ||
      authority.oidc.repositoryVisibility !== "public" ||
      authority.oidc.eventName !== "workflow_dispatch" ||
      authority.oidc.ref.length > 256 ||
      !/^refs\/heads\/[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(authority.oidc.ref) ||
      authority.oidc.refType !== "branch" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(authority.oidc.environment) ||
      authority.oidc.runnerEnvironment !== "github-hosted" ||
      !/^[ -~]{1,128}$/u.test(authority.oidc.workflow) ||
      !/^[a-f0-9]{40}$/u.test(authority.oidc.sha) ||
      authority.oidc.workflowSha !== authority.oidc.sha ||
      authority.oidc.workflowRef.length > 512 || !(new RegExp(
        `^${escapedPattern(authority.oidc.repository)}\\/.github\\/workflows\\/[A-Za-z0-9._-]+\\.ya?ml@${escapedPattern(authority.oidc.ref)}$`,
        "u"
      )).test(authority.oidc.workflowRef) ||
      authority.oidc.jobWorkflowRef.length > 512 ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/\.github\/workflows\/[A-Za-z0-9._-]+\.ya?ml@[a-f0-9]{40}$/u.test(authority.oidc.jobWorkflowRef) ||
      !/^[a-f0-9]{40}$/u.test(authority.oidc.jobWorkflowSha) ||
      !authority.oidc.jobWorkflowRef.endsWith(`@${authority.oidc.jobWorkflowSha}`)) {
    throw JournalAuthorityMismatch.make({
      reason: "Journal OIDC claims do not bind the exact caller and called workflow identities."
    })
  }
  const [repositoryOwner, repositoryName] = authority.oidc.repository.split("/") as [string, string]
  const admittedSubjects = [
    `repo:${authority.oidc.repository}:environment:${authority.oidc.environment}`,
    `repo:${repositoryOwner}@${authority.oidc.repositoryOwnerId}/${repositoryName}@${authority.oidc.repositoryId}:environment:${authority.oidc.environment}`
  ]
  if (!admittedSubjects.includes(authority.oidc.subject)) {
    throw JournalAuthorityMismatch.make({
      reason: "Journal OIDC subject is neither the exact name-bound nor immutable-ID-bound environment subject."
    })
  }
  const trustProjection = {
    audience: authority.oidc.audience,
    subject: authority.oidc.subject,
    repository: authority.oidc.repository,
    repositoryId: authority.oidc.repositoryId,
    repositoryOwnerId: authority.oidc.repositoryOwnerId,
    workflow: authority.oidc.workflow,
    ref: authority.oidc.ref,
    environment: authority.oidc.environment,
    jobWorkflowRef: authority.oidc.jobWorkflowRef
  }
  if (encodeCanonicalJson(authority.oidcTrust) !== encodeCanonicalJson(trustProjection)) {
    throw JournalAuthorityMismatch.make({
      reason: "Journal AWS trust-policy conditions do not equal the re-observed trust-enforced OIDC claims."
    })
  }
}
