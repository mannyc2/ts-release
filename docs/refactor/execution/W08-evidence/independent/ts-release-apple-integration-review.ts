import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { Effect, Schema } from "/tmp/ts-release-implementation/node_modules/effect/dist/index.js"
import * as BunServices from "/tmp/ts-release-implementation/node_modules/@effect/platform-bun/dist/BunServices.js"
import * as Artifact from "/tmp/ts-release-implementation/node_modules/effect-build/dist/Artifact.js"
import * as Notary from "/tmp/ts-release-implementation/node_modules/effect-build-apple/dist/Notary.js"
import { Host, ReleaseError, createPlan, runRelease } from "/tmp/ts-release-implementation/packages/ts-release/src/index.ts"
import { File, encodeBundle, finalize, loadBundle } from "/tmp/ts-release-implementation/packages/ts-release/src/Bundle.ts"
import { ApplePreparation, ReadyToPlan, createApplePreparations, preparationProvider, preparationScopes, runPreparation, submitPrepared, finishPrepared, reportAppleContext, validateApplePublication } from "/tmp/ts-release-implementation/packages/ts-release/src/Apple.ts"
import { classifyEvidence } from "/tmp/ts-release-implementation/packages/ts-release/src/apple/Provider.ts"
import { makeSources, appleDoubles, run } from "/tmp/ts-release-implementation/test/reimplementation/artifacts/apple-fixtures.ts"
import { MemoryJournal } from "/tmp/ts-release-implementation/test/reimplementation/kernel/fixtures.ts"

const root = await mkdtemp("/tmp/ts-release-integration-review-")
const log: string[] = []
const boundary = () => new ReleaseError({ code: "review-native", message: "protocol fixture failed" })
try {
  const { inputs, owner } = await makeSources(root)
  const work = join(root, "work")
  await mkdir(work)
  const collection = await run(createApplePreparations([inputs[1]!]))
  const input = collection.preparations[0]!
  const scopes = await run(preparationScopes(collection))
  const plan = scopes[0]!.plan, id = plan.operations[0]!.operationId
  const doubles = appleDoubles(), store = new MemoryJournal()
  const host = {
    store, providers: [preparationProvider], now: Date.now, uniqueId: () => crypto.randomUUID(),
    journal: { journalId: collection.journalId, scopes },
    transport: { send: (request) => submitPrepared(
      Schema.decodeUnknownSync(ApplePreparation)(JSON.parse(new TextDecoder().decode(request.body))), owner, work,
    ).pipe(Effect.provide(doubles.layer), Effect.provide(BunServices.layer), Effect.map(receipt => ({ _tag: "Accepted" as const, receipt })), Effect.mapError(boundary)) },
  }
  await run(runRelease({ plan, authorize: true, observe: false }).pipe(Effect.provideService(Host, host)))
  const initial = await run(store.read(collection.journalId))
  const recorded = initial.events.find(event => event.body._tag === "ReceiptAccepted")!.body.receipt
  const receipt = Schema.decodeUnknownSync(Notary.Submission)(recorded)
  const observation = new Notary.Observation({ ...receipt, status: new Notary.Accepted({providerStatus:"Accepted"}) })
  assert.equal(classifyEvidence(input, id, observation, [receipt]), "Pending")
  const referenceCases = [
    {...observation, submissionId: crypto.randomUUID()},
    {...observation, architecture: observation.architecture === "arm64" ? "x64" : "arm64"},
    {...observation, artifactBytes: "999"},
    {...observation, artifactDigest: Artifact.sha256Digest("f".repeat(64))},
    {...observation, stapleTarget:{...observation.stapleTarget,artifactDigest:Artifact.sha256Digest("f".repeat(64))}},
    {...observation, stapleTarget:{...observation.stapleTarget,artifactBytes:"999"}},
  ]
  for (const value of referenceCases) assert.throws(() => classifyEvidence(input,id,value,[receipt]), ReleaseError)
  log.push("Six mismatched submission/source references reject; accepted-only observation stays Pending")

  doubles.status(new Notary.Accepted({ providerStatus: "Accepted" }))
  let completed = 0
  let unblock!: () => void
  const both = new Promise<void>(resolve => { unblock = resolve })
  const candidates: ReadyToPlan[] = []
  const complete = (label: string) => (submission, preparationId) => finishPrepared(input, submission, preparationId, owner, work,
    () => Effect.gen(function* () {
      const content = yield* owner.putOwned(new TextEncoder().encode(label))
      return [new File({logicalName:Artifact.portableRelativePath(label+".txt"),content,deliveryMode:0o644,executable:null,provenance:Artifact.intrinsicProvenance("review")})]
    }),
  ).pipe(Effect.provide(doubles.layer),Effect.provide(BunServices.layer),Effect.flatMap(value => Effect.promise(async () => {
    assert.equal(value instanceof ReadyToPlan,true)
    candidates.push(value as ReadyToPlan)
    if (++completed === 2) unblock()
    await both
    return value
  })),Effect.mapError(boundary))
  await Promise.all(["first","second"].map(label => run(runPreparation(collection,id,{authorize:true},complete(label)).pipe(Effect.provideService(Host,host)))))
  const report = await run(reportAppleContext(collection,owner).pipe(Effect.provideService(Host,host)))
  const selections = report.nativeFacts.filter(event=>event.body._tag === "ObservationRecorded" && event.body.status === "Satisfied")
  assert.equal(selections.length,1)
  assert.equal(doubles.calls.submit,1)
  const selected = Schema.decodeUnknownSync(ReadyToPlan)(selections[0]!.body.evidence)
  assert.equal(candidates.length,2)
  assert.notEqual(candidates[0]!.outputsBundleContent.sha256,candidates[1]!.outputsBundleContent.sha256)
  log.push("Two concurrent different completions succeed with one immutable selected output and one initial submission")

  for (const candidate of candidates) {
    const bytes = await run(owner.read(candidate.outputsBundleContent))
    const bundle = await run(loadBundle(owner,bytes))
    const content = await run(owner.putOwned(encodeBundle(await run(finalize(bundle.artifacts)))))
    const publication = await run(createPlan(content.sha256,[],collection.journalId))
    const publicationHost = {...host,journal:{journalId:collection.journalId,scopes:[...scopes,{_tag:"PublicationScope" as const,plan:publication}]}}
    const validation = run(validateApplePublication(collection,publication,content,owner).pipe(Effect.provideService(Host,publicationHost)))
    if (candidate.outputsBundleContent.sha256 === selected.outputsBundleContent.sha256) {
      assert.equal((await validation).length,1)
      const planAlias = JSON.parse(JSON.stringify(publication))
      const contentAlias = JSON.parse(JSON.stringify(content))
      const capturedValidation = Effect.runPromise(validateApplePublication(collection,planAlias,contentAlias,owner).pipe(Effect.provideService(Host,publicationHost)))
      planAlias.planId = "replacement-after-start"
      contentAlias.sha256 = "f".repeat(64)
      assert.equal((await capturedValidation).length,1)
      const combined = await run(reportAppleContext(collection,owner,{plan:publication,finalBundleContent:content}).pipe(Effect.provideService(Host,publicationHost)))
      assert.equal(combined.publication!.revision,combined.revision)
      assert.equal(combined.preparations[0]!.revision,combined.revision)
    } else await assert.rejects(validation,(error: unknown) => error instanceof ReleaseError && error.code === "prepared-output-binding")
  }
  log.push("Publication accepts the selected candidate, rejects the losing candidate, and reports one common journal revision")
  log.push("Publication Plan and Content aliases changed after invocation do not replace captured identities")
  const invalidReadyCases = [
    {...selected,preparationId:"foreign-operation"},
    {...selected,acceptance:{...selected.acceptance,submissionId:crypto.randomUUID()}},
    {...selected,finalArtifact:{...selected.finalArtifact,artifactBytes:"999"}},
    {...selected,assessment:{...selected.assessment,artifactDigest:Artifact.sha256Digest("f".repeat(64))}},
    {...selected,assessment:{...selected.assessment,architecture:"x64"}},
    {...selected,finalArtifact:{...selected.finalArtifact,logicalName:"foreign.dmg"}},
  ]
  for (const value of invalidReadyCases) assert.throws(()=>classifyEvidence(input,id,value,[receipt]),ReleaseError)
  log.push("Six mismatched ReadyToPlan operation/submission/final-assessment bindings reject")
  let restartedCompletion = 0
  await run(runPreparation(collection,id,{authorize:true},()=>{
    restartedCompletion++
    return Effect.fail(boundary())
  }).pipe(Effect.provideService(Host,host)))
  assert.equal(restartedCompletion,0)
  assert.equal(doubles.calls.submit,1)
  log.push("Restart after selection neither resubmits nor invokes completion")
  console.log(JSON.stringify({uid:process.getuid!(),log},null,2))
} finally {
  await rm(root,{recursive:true,force:true})
}
