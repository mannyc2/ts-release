import * as Effect from "effect/Effect"
import {
  Check,
  Exec,
  ForgeRelease,
  HttpPublish,
  OutputDeclaration,
  PublishCredential,
  WireContract
} from "../../src/model/operation.js"
import {
  ReleaseIdentityV6,
  ReleasePlanV6,
  ReleaseStages
} from "../../src/model/plan.js"
import {
  CredentialName,
  NonEmptyName,
  OperationId,
  OutputId,
  ProfileId,
  SafeRelativePath,
  Version
} from "../../src/model/primitives.js"
import {
  acceptPlan,
  encodePlanBytes,
  type AcceptedPlan
} from "../../src/plan/accepted.js"

const output = (id: string) => OutputDeclaration.make({
  id: OutputId.make(id),
  path: SafeRelativePath.make(`dist/${id}`),
  kind: "file"
})
const wire = WireContract.make({
  profileId: ProfileId.make("http.generic-upload/v1"),
  contractFixtureId: "contract.http.generic-upload/v1",
  baseUrl: "https://example.invalid",
  pathTemplate: "/upload",
  responseShapeId: "empty-v1",
  pagination: "none",
  commitment: "status-2xx",
  reconciliation: "get-same-resource"
})
const credential = PublishCredential.make({
  name: CredentialName.make("PUBLISH_CREDENTIAL")
})

export const acceptedRunPlan = (): Promise<AcceptedPlan> => {
  const source = output("source")
  const second = output("second")
  const processed = output("processed")
  const plan = ReleasePlanV6.make({
    schemaVersion: "release-plan/v6",
    identity: ReleaseIdentityV6.make({
      name: NonEmptyName.make("run-fixture"),
      version: Version.make("1.0.0"),
      tag: NonEmptyName.make("v1.0.0"),
      commit: NonEmptyName.make("abc123"),
      snapshot: false
    }),
    stages: ReleaseStages.make({
      build: [
        Check.make({
          id: OperationId.make("source"),
          inputs: [],
          outputs: [source],
          path: source.path
        }),
        Check.make({
          id: OperationId.make("second"),
          inputs: [],
          outputs: [second],
          path: second.path
        })
      ],
      process: [],
      catalog: [],
      validate: [
        Exec.make({
          id: OperationId.make("trusted"),
          inputs: [source.id],
          outputs: [processed],
          contractFixtureId: "contract.build.command/v1",
          argv: ["verify"],
          cwd: SafeRelativePath.make("."),
          environmentNames: []
        })
      ],
      publish: [
        HttpPublish.make({
          id: OperationId.make("upload"),
          inputs: [source.id],
          outputs: [],
          method: "POST",
          wire,
          credential
        }),
        ForgeRelease.make({
          id: OperationId.make("forge"),
          inputs: [source.id, second.id],
          outputs: [],
          repository: "owner/repository",
          tag: "v1.0.0",
          title: "fixture 1.0.0",
          draft: true,
          prerelease: false,
          assets: [
            {
              outputId: source.id,
              path: source.path,
              name: "source",
              contentType: "application/octet-stream"
            }
          ],
          credential,
          contractFixtureId: "contract.publish.github/v1"
        })
      ],
      announce: [],
      verify: []
    }),
    annotations: []
  })
  return Effect.runPromise(acceptPlan(encodePlanBytes(plan)))
}
