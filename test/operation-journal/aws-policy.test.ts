import { describe, expect, test } from "bun:test"
import {
  makeAwsJournalBucketPolicy,
  makeAwsJournalRolePolicy,
  makeAwsJournalTrustPolicy,
  validateAwsJournalPolicies
} from "../../src/operation-journal/aws/policy.js"
import { policyCoordinates, policyDocuments } from "./aws-fixture.js"

describe("AWS operation journal policy parser", () => {
  test("normalizes provider formatting but digests one exact admitted policy topology", () => {
    const trust = makeAwsJournalTrustPolicy(policyCoordinates)
    const role = makeAwsJournalRolePolicy(policyCoordinates)
    const bucket = makeAwsJournalBucketPolicy(policyCoordinates)
    const reversedRole = {
      ...role,
      Statement: [...role.Statement].reverse().map((statement) => ({
        ...statement,
        Action: [...statement.Action].reverse()
      }))
    }
    const observed = validateAwsJournalPolicies({
      coordinates: policyCoordinates,
      trustPolicyDocument: encodeURIComponent(JSON.stringify(trust)),
      rolePolicyDocument: JSON.stringify(reversedRole),
      bucketPolicyDocument: JSON.stringify({ ...bucket, Statement: [...bucket.Statement].reverse() })
    })
    const canonical = validateAwsJournalPolicies({
      coordinates: policyCoordinates,
      trustPolicyDocument: policyDocuments.trust,
      rolePolicyDocument: policyDocuments.role,
      bucketPolicyDocument: policyDocuments.bucket
    })
    expect(observed).toEqual(canonical)
    expect(Object.values(observed)).toEqual([
      expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      expect.stringMatching(/^sha256:[a-f0-9]{64}$/u)
    ])
  })

  test("rejects an extra grant rather than trusting governance booleans", () => {
    const bucket = makeAwsJournalBucketPolicy(policyCoordinates)
    const widened = {
      ...bucket,
      Statement: [
        ...bucket.Statement,
        {
          Sid: "UnexpectedGrant",
          Effect: "Allow",
          Principal: "*",
          Action: "s3:*",
          Resource: "*"
        }
      ]
    }
    try {
      validateAwsJournalPolicies({
        coordinates: policyCoordinates,
        trustPolicyDocument: policyDocuments.trust,
        rolePolicyDocument: policyDocuments.role,
        bucketPolicyDocument: JSON.stringify(widened)
      })
      throw new Error("Expected widened bucket policy rejection")
    } catch (cause) {
      expect(cause).toMatchObject({ reason: expect.stringContaining("does not equal the one admitted operational-journal policy") })
    }
  })

  test("grants only the exact versioned object reads used by the live boundary", () => {
    const role = makeAwsJournalRolePolicy(policyCoordinates)
    const objectAccess = role.Statement.find((statement) => statement.Sid === "ReadWriteJournalObjects")
    expect(objectAccess?.Action).toEqual([
      "s3:GetObjectRetention",
      "s3:GetObjectVersion",
      "s3:GetObjectVersionAttributes",
      "s3:PutObject"
    ].sort())
    expect(objectAccess?.Action).not.toContain("s3:GetObject")
    expect(objectAccess?.Action).not.toContain("s3:GetObjectAttributes")

    const bucket = makeAwsJournalBucketPolicy(policyCoordinates)
    const nonJournalDeny = bucket.Statement.find((statement) =>
      statement.Sid === "DenyNonJournalPrincipalObjectAccess")
    expect(nonJournalDeny?.Action).toContain("s3:GetObjectVersionAttributes")
  })

  test("rejects wildcard reusable-workflow trust and unadmitted policy syntax", () => {
    try {
      makeAwsJournalTrustPolicy({
        ...policyCoordinates,
        oidcTrust: {
          ...policyCoordinates.oidcTrust,
          jobWorkflowRef: "fixture/owner/.github/workflows/journal.yml@refs/heads/main"
        }
      })
      throw new Error("Expected mutable workflow rejection")
    } catch (cause) {
      expect(cause).toMatchObject({ reason: expect.stringContaining("immutable source SHA") })
    }

    const trust = makeAwsJournalTrustPolicy(policyCoordinates)
    const statement = trust.Statement[0]!
    const widened = {
      ...trust,
      Statement: [{
        ...statement,
        Condition: {
          StringLike: {
            "token.actions.githubusercontent.com:job_workflow_ref": ["fixture/owner/*"]
          }
        }
      }]
    }
    try {
      validateAwsJournalPolicies({
        coordinates: policyCoordinates,
        trustPolicyDocument: JSON.stringify(widened),
        rolePolicyDocument: policyDocuments.role,
        bucketPolicyDocument: policyDocuments.bucket
      })
      throw new Error("Expected widened trust policy rejection")
    } catch (cause) {
      expect(cause).toMatchObject({ reason: expect.stringContaining("does not equal the one admitted operational-journal policy") })
    }

    const role = JSON.parse(policyDocuments.role) as { Statement: Array<Record<string, unknown>> }
    role.Statement[0]!.NotAction = "s3:DeleteObject"
    try {
      validateAwsJournalPolicies({
        coordinates: policyCoordinates,
        trustPolicyDocument: policyDocuments.trust,
        rolePolicyDocument: JSON.stringify(role),
        bucketPolicyDocument: policyDocuments.bucket
      })
      throw new Error("Expected NotAction rejection")
    } catch (cause) {
      expect(cause).toMatchObject({ reason: expect.stringContaining("contains unadmitted field NotAction") })
    }
  })
})
