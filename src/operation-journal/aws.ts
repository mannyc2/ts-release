import { IAMClient } from "@aws-sdk/client-iam"
import { S3Client } from "@aws-sdk/client-s3"
import { STSClient } from "@aws-sdk/client-sts"
import * as Effect from "effect/Effect"
import {
  S3JournalBoundaryError,
  type S3JournalBoundaryShape
} from "./model.js"
import { validateS3JournalAuthority } from "./authority.js"
import { acquireAwsJournalSession } from "./aws/oidc.js"
import {
  makeAwsS3JournalBoundaryFromClients,
  type AwsS3JournalBoundaryOptions
} from "./aws/s3-boundary.js"

/**
 * Acquire one fresh GitHub OIDC/STS session and seal an AWS S3 boundary around
 * the exact activation contract. The constructor never consults the AWS
 * credential chain and exposes no endpoint, profile, or credential override.
 */
export const makeAwsS3JournalBoundary = (
  options: AwsS3JournalBoundaryOptions
): Effect.Effect<S3JournalBoundaryShape, S3JournalBoundaryError> => Effect.gen(function*() {
  yield* Effect.try({
    try: () => {
      validateS3JournalAuthority(options.authority)
      if (!/^[A-Za-z0-9+=,.@_-]{1,128}$/u.test(options.rolePolicyName)) {
        throw new Error("invalid role policy name")
      }
    },
    catch: () => S3JournalBoundaryError.make({
      operation: "observe-authority",
      commitment: "not-applicable",
      reason: "AWS journal activation contract is malformed."
    })
  })
  const session = yield* acquireAwsJournalSession(options.authority)
  const credentials = session.credentials
  const iam = new IAMClient({
    region: options.authority.region,
    credentials,
    maxAttempts: 1
  })
  const s3 = new S3Client({
    region: options.authority.region,
    credentials,
    maxAttempts: 1,
    followRegionRedirects: false,
    forcePathStyle: false,
    useArnRegion: false
  })
  const sts = new STSClient({
    region: options.authority.region,
    credentials,
    maxAttempts: 1
  })
  return makeAwsS3JournalBoundaryFromClients(options, session, { iam, s3, sts })
})

export type { AwsS3JournalBoundaryOptions } from "./aws/s3-boundary.js"
