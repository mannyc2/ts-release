import { Effect, Schema } from "effect"
import { Bundle, File, Tree, verifiedArtifacts } from "@mannyc1/ts-release/bundle"
import type { ArtifactAccess } from "@mannyc1/ts-release/bundle"
import { attempt, canonical, inspectPackage, name, own, reject } from "./Package.js"
import { Marketplace, marketplaceDocument } from "./Marketplace.js"
import { containsSecret, PublicText, publicUrl } from "@mannyc1/ts-release/http"

const https = (value: string): boolean => publicUrl(value) !== null
const narrative = (value: string, maximum = 8192): boolean =>
  value.length > 0 &&
  value === value.normalize("NFC") &&
  value.trim() === value &&
  [...value].length <= maximum &&
  !/[\u0000\u007f]/u.test(value) &&
  !containsSecret(value)
const unique = (values: readonly string[]): boolean => new Set(values).size === values.length
const Narrative = (maximum = 8192) =>
  Schema.String.check(Schema.makeFilter((value) => narrative(value, maximum)))
const Url = Schema.String.check(Schema.makeFilter(https))
const TestId = Schema.String.check(Schema.makeFilter(name))

export class Listing extends Schema.Class<Listing>("OpenAi.Listing")({
  displayName: PublicText(128),
  shortDescription: PublicText(256),
  longDescription: Narrative(4096),
  developerName: PublicText(256),
  category: PublicText(64),
  websiteUrl: Url,
  supportUrl: Url,
  privacyPolicyUrl: Url,
  termsOfServiceUrl: Url,
  logo: File,
}) {}
export class PositiveTest extends Schema.Class<PositiveTest>("OpenAi.PositiveTest")({
  id: TestId,
  prompt: Narrative(),
  expectedBehavior: Narrative(),
  expectedResultShape: Narrative(),
  fixture: Narrative(),
}) {}
export class NegativeTest extends Schema.Class<NegativeTest>("OpenAi.NegativeTest")({
  id: TestId,
  prompt: Narrative(),
  expectedBehavior: Narrative(),
  reason: Narrative(),
}) {}
export class Attestations extends Schema.Class<Attestations>("OpenAi.Attestations")({
  developerIdentityVerified: Schema.Literal(true),
  intellectualPropertyRightsConfirmed: Schema.Literal(true),
  listingAndTestsAccurate: Schema.Literal(true),
  privacyAndTermsPublished: Schema.Literal(true),
  pluginPoliciesReviewed: Schema.Literal(true),
  humanPortalReviewAndPublicationRequired: Schema.Literal(true),
}) {}
export class Submission extends Schema.Class<Submission>("OpenAi.Submission")({
  plugin: Tree,
  marketplace: Marketplace,
  listing: Listing,
  starterPrompts: Schema.Array(Narrative()).check(
    Schema.makeFilter((values) => values.length >= 1 && values.length <= 8 && unique(values)),
  ),
  positiveTests: Schema.Tuple([
    PositiveTest,
    PositiveTest,
    PositiveTest,
    PositiveTest,
    PositiveTest,
  ]),
  negativeTests: Schema.Tuple([NegativeTest, NegativeTest, NegativeTest]),
  releaseNotes: Narrative(),
  attestations: Attestations,
}) {}
const SubmissionCodec = Submission.check(
  Schema.makeFilter((value) => {
    const ids = [...value.positiveTests, ...value.negativeTests].map((test) => test.id)
    return unique(ids)
  }),
)

export const submission = Effect.fn("openai.submission")(function* (
  input: Submission,
  access: ArtifactAccess,
) {
  const readContent = access.readContent.bind(access)
  const selected = yield* attempt("openai-submission", () => {
    const value = own(SubmissionCodec, input)
    const marketplace = marketplaceDocument(value.marketplace),
      bundle = own(Bundle, access.bundle)
    const artifacts = verifiedArtifacts({ bundle, readContent }, 10 * 1024 * 1024)
    if (!artifacts.has(value.plugin) || !artifacts.has(value.listing.logo))
      throw new Error("OpenAI plugin or logo is not an exact owned Bundle member")
    return { value, marketplace, artifacts }
  })
  const plugin = yield* inspectPackage(selected.value.plugin, readContent)
  const entries = selected.marketplace.plugins.filter(
    (entry) => entry.name === plugin.manifest.name,
  )
  if (entries.length !== 1 || entries[0]!.category !== selected.value.listing.category)
    return yield* reject("openai-submission", "Marketplace does not contain the listed plugin")
  yield* selected.artifacts.read(selected.value.listing.logo)
  const status = "validated-handoff-human-submission-required" as const
  const document = {
    schemaVersion: "openai-plugin-submission-handoff/1",
    status,
    plugin: {
      manifest: plugin.manifest,
      tree: plugin.tree,
      skillName: plugin.skillName,
    },
    marketplace: selected.marketplace,
    listing: selected.value.listing,
    resolvedLogo: {
      logicalName: selected.value.listing.logo.logicalName,
      content: selected.value.listing.logo.content,
      deliveryMode: selected.value.listing.logo.deliveryMode,
    },
    starterPrompts: selected.value.starterPrompts,
    positiveTests: selected.value.positiveTests,
    negativeTests: selected.value.negativeTests,
    releaseNotes: selected.value.releaseNotes,
    attestations: selected.value.attestations,
  }
  return Object.freeze({
    status,
    bytes: new TextEncoder().encode(`${canonical(document)}\n`),
  })
})
