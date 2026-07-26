import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import {
  encodeCanonicalJson
} from "../../src/rewrite/model/canonical.js"
import {
  Check,
  DigestOp,
  HttpPublish,
  HttpRead,
  OutputDeclaration,
  PublishCredential,
  ReadCredential,
  WireContract,
  Write,
  mechanismTags,
  operationAuthority
} from "../../src/rewrite/model/operation.js"
import {
  Annotation,
  ReleaseIdentityV6,
  ReleasePlanV6,
  ReleaseStages
} from "../../src/rewrite/model/plan.js"
import {
  CredentialName,
  NonEmptyName,
  OperationId,
  OutputId,
  ProfileId,
  SafeRelativePath,
  Version
} from "../../src/rewrite/model/primitives.js"
import {
  acceptPlan,
  encodePlanBytes
} from "../../src/rewrite/plan/accepted.js"

const output = (id: string, path: string) => OutputDeclaration.make({
  id: OutputId.make(id),
  path: SafeRelativePath.make(path),
  kind: "file"
})
const check = (id: string, declared: OutputDeclaration, inputs: ReadonlyArray<string> = []) =>
  Check.make({
    id: OperationId.make(id),
    inputs: inputs.map((input) => OutputId.make(input)),
    outputs: [declared],
    path: declared.path
  })
const stages = (overrides: Partial<ReleaseStages> = {}) => ReleaseStages.make({
  build: [],
  process: [],
  catalog: [],
  validate: [],
  publish: [],
  announce: [],
  verify: [],
  ...overrides
})
const plan = (value: ReleaseStages, annotations: ReadonlyArray<Annotation> = []) =>
  ReleasePlanV6.make({
    schemaVersion: "release-plan/v6",
    identity: ReleaseIdentityV6.make({
      name: NonEmptyName.make("fixture"),
      version: Version.make("1.0.0"),
      tag: NonEmptyName.make("v1.0.0"),
      commit: NonEmptyName.make("abc123"),
      snapshot: false
    }),
    stages: value,
    annotations
  })
const failure = (bytes: Uint8Array) =>
  Effect.runPromise(acceptPlan(bytes).pipe(Effect.flip))
const bytes = (value: unknown) =>
  new TextEncoder().encode(encodeCanonicalJson(value))
const json = (document: ReleasePlanV6) =>
  JSON.parse(new TextDecoder().decode(encodePlanBytes(document))) as Record<string, unknown>

describe("release-plan/v6 model and acceptance", () => {
  test("has seven fixed stages, eight mechanisms, and structural authority", () => {
    const document = plan(stages())
    expect(Object.keys(document.stages)).toEqual([
      "build", "process", "catalog", "validate", "publish", "announce", "verify"
    ])
    expect(mechanismTags).toEqual([
      "Check", "Write", "Pack", "Digest", "Exec", "HttpRead", "HttpPublish", "ForgeRelease"
    ])
    const sample = [
      check("check", output("a", "a")),
      Write.make({
        id: OperationId.make("write"),
        inputs: [],
        outputs: [output("b", "b")],
        path: SafeRelativePath.make("b"),
        content: ""
      }),
      DigestOp.make({
        id: OperationId.make("digest"),
        inputs: [OutputId.make("a")],
        outputs: [output("c", "c")],
        algorithm: "sha256"
      })
    ]
    expect(sample.map(operationAuthority)).toEqual(["LocalRead", "LocalWrite", "LocalWrite"])
    expect(json(document)).not.toHaveProperty("phase")
    expect(json(document)).not.toHaveProperty("risk")
    expect(json(document)).not.toHaveProperty("artifacts")
  })

  test("accepts only canonical bytes and changes PlanId on semantic change", async () => {
    const first = plan(stages({ build: [check("one", output("one", "dist/one"))] }))
    const accepted = await Effect.runPromise(acceptPlan(encodePlanBytes(first)))
    expect(accepted.bytes).toEqual(encodePlanBytes(first))
    const spaced = new TextEncoder().encode(
      `${JSON.stringify(json(first), null, 2)}\n`
    )
    expect((await failure(spaced))._tag).toBe("NonCanonicalPlanError")
    const second = plan(stages({ build: [check("two", output("two", "dist/two"))] }))
    const moved = await Effect.runPromise(acceptPlan(encodePlanBytes(second)))
    expect(moved.planId).not.toBe(accepted.planId)
  })

  test("strict decode rejects excess fields at every nesting level", async () => {
    const valid = json(plan(stages({ build: [check("one", output("one", "one"))] })))
    const top = structuredClone(valid)
    top.excess = true
    const nested = structuredClone(valid)
    ;(nested.identity as Record<string, unknown>).excess = true
    const operation = structuredClone(valid)
    const operationBuild = (operation.stages as Record<
      string,
      Array<Record<string, unknown>>
    >).build!
    operationBuild[0]!.excess = true
    const declaration = structuredClone(valid)
    const declarationBuild = (declaration.stages as Record<
      string,
      Array<Record<string, unknown>>
    >).build!
    const declarations = declarationBuild[0]!.outputs as Array<Record<string, unknown>>
    declarations[0]!.excess = true
    for (const candidate of [top, nested, operation, declaration]) {
      expect((await failure(bytes(candidate)))._tag).toBe("PlanDecodeError")
    }
  })

  test("stage unions reject remote publication outside publish and announce", async () => {
    const raw = json(plan(stages({ build: [check("one", output("one", "one"))] })))
    const credential = { name: "PUBLISH_TOKEN" }
    const remote = {
      _tag: "HttpPublish",
      id: "remote",
      inputs: [],
      outputs: [],
      method: "POST",
      wire: {
        profileId: "upload/v1",
        contractFixtureId: "contract.http.generic-upload/v1",
        baseUrl: "https://example.invalid",
        pathTemplate: "/upload",
        responseShapeId: "empty-v1",
        pagination: "none",
        commitment: "status-2xx",
        reconciliation: "get-same-resource"
      },
      credential
    }
    for (const stage of ["build", "process", "catalog", "validate", "verify"]) {
      const candidate = structuredClone(raw)
      ;(candidate.stages as Record<string, unknown>)[stage] = [remote]
      expect((await failure(bytes(candidate)))._tag).toBe("PlanDecodeError")
    }
  })

  test("rejects duplicate ids/paths and missing, same, or forward references", async () => {
    const a = output("a", "dist/a")
    const duplicateOperation = plan(stages({ build: [check("same", a), check("same", output("b", "b"))] }))
    expect((await failure(encodePlanBytes(duplicateOperation)))._tag).toBe("DuplicatePlanValueError")
    const duplicateOutput = plan(stages({ build: [check("a", a), check("b", output("a", "b"))] }))
    expect((await failure(encodePlanBytes(duplicateOutput)))._tag).toBe("DuplicatePlanValueError")
    const duplicatePath = plan(stages({ build: [check("a", a), check("b", output("b", "dist/a"))] }))
    expect((await failure(encodePlanBytes(duplicatePath)))._tag).toBe("DuplicatePlanValueError")
    const forward = plan(stages({
      build: [check("first", a, ["later"]), check("later", output("later", "later"))]
    }))
    expect((await failure(encodePlanBytes(forward)))._tag).toBe("OutputReferenceError")
  })

  test("derives outputs/dependencies and confines credential names by authority", async () => {
    const source = output("source", "source")
    const transformed = output("transformed", "transformed")
    const wire = WireContract.make({
      profileId: ProfileId.make("read/v1"),
      contractFixtureId: "contract.http.generic-upload/v1",
      baseUrl: "https://example.invalid",
      pathTemplate: "/resource",
      responseShapeId: "json-object-v1",
      pagination: "none",
      commitment: "read-only",
      reconciliation: "none"
    })
    const credential = CredentialName.make("SHARED_TOKEN")
    const read = HttpRead.make({
      id: OperationId.make("read"),
      inputs: [source.id],
      outputs: [],
      method: "GET",
      wire,
      credential: ReadCredential.make({ name: credential })
    })
    const publish = HttpPublish.make({
      id: OperationId.make("publish"),
      inputs: [transformed.id],
      outputs: [],
      method: "POST",
      wire: WireContract.make({
        ...wire,
        commitment: "status-2xx",
        reconciliation: "get-same-resource"
      }),
      credential: PublishCredential.make({ name: credential })
    })
    const document = plan(stages({
      build: [check("source", source)],
      process: [DigestOp.make({
        id: OperationId.make("transform"),
        inputs: [source.id],
        outputs: [transformed],
        algorithm: "sha256"
      })],
      validate: [read],
      publish: [publish]
    }))
    expect((await failure(encodePlanBytes(document)))._tag).toBe("CredentialConfinementError")
    const accepted = await Effect.runPromise(acceptPlan(encodePlanBytes(plan(stages({
      build: [check("source", source)],
      process: [DigestOp.make({
        id: OperationId.make("transform"),
        inputs: [source.id],
        outputs: [transformed],
        algorithm: "sha256"
      })]
    })))))
    expect(accepted.outputs.map((item) => String(item.output.id))).toEqual([
      "source",
      "transformed"
    ])
    expect(accepted.dependencies).toEqual([{
      operationId: "transform",
      inputId: "source",
      producerId: "source"
    }])
  })

  test("rejects unsafe paths, duplicate JSON keys, and secret-like durable values", async () => {
    const raw = json(plan(stages()))
    ;(raw.stages as Record<string, unknown>).build = [{
      _tag: "Check",
      id: "unsafe",
      inputs: [],
      outputs: [{ id: "unsafe", path: "../outside", kind: "file" }],
      path: "../outside"
    }]
    expect((await failure(bytes(raw)))._tag).toBe("PlanDecodeError")
    const duplicate = new TextEncoder().encode('{"schemaVersion":"release-plan/v6","schemaVersion":"x"}\n')
    expect((await failure(duplicate))._tag).toBe("PlanDecodeError")
    const secretLikeValue = ["gh", "p_", "abcdefghijklmnopqrstuvwxyz"].join("")
    const secret = plan(stages(), [Annotation.make({
      key: "value",
      value: secretLikeValue
    })])
    expect((await failure(encodePlanBytes(secret)))._tag).toBe("SecretLikePlanValueError")
  })
})
