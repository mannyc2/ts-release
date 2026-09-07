import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { ReleaseError } from "@mannyc1/ts-release"
import {
  Bundle,
  File,
  Tree,
  verifiedArtifacts,
  type ArtifactAccess,
} from "@mannyc1/ts-release/bundle"
import {
  attempt,
  canonical,
  inspectPackage,
  name,
  own,
  publicText,
  containsSecret,
} from "./Package.js"
import { Marketplace, marketplaceDocument } from "./Marketplace.js"

export class Listing extends Schema.Class<Listing>("OpenAi.Listing")({
  displayName: Schema.String,
  shortDescription: Schema.String,
  longDescription: Schema.String,
  developerName: Schema.String,
  category: Schema.String,
  websiteUrl: Schema.String,
  supportUrl: Schema.String,
  privacyPolicyUrl: Schema.String,
  termsOfServiceUrl: Schema.String,
  logo: File,
}) {}
export class PositiveTest extends Schema.Class<PositiveTest>("OpenAi.PositiveTest")({
  id: Schema.String,
  prompt: Schema.String,
  expectedBehavior: Schema.String,
  expectedResultShape: Schema.String,
  fixture: Schema.String,
}) {}
export class NegativeTest extends Schema.Class<NegativeTest>("OpenAi.NegativeTest")({
  id: Schema.String,
  prompt: Schema.String,
  expectedBehavior: Schema.String,
  reason: Schema.String,
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
  starterPrompts: Schema.Array(Schema.String),
  positiveTests: Schema.Tuple([
    PositiveTest,
    PositiveTest,
    PositiveTest,
    PositiveTest,
    PositiveTest,
  ]),
  negativeTests: Schema.Tuple([NegativeTest, NegativeTest, NegativeTest]),
  releaseNotes: Schema.String,
  attestations: Attestations,
}) {}

const https = (value: string): boolean => {
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (url.href === value || (url.pathname === "/" && url.origin === value))
    )
  } catch {
    return false
  }
}
const narrative = (value: string, maximum = 8192): boolean =>
  value.length > 0 &&
  value === value.normalize("NFC") &&
  value.trim() === value &&
  [...value].length <= maximum &&
  !/[\u0000\u007f]/u.test(value) &&
  !containsSecret(value)
const unique = (values: readonly string[]): boolean => new Set(values).size === values.length
const validateListing = (value: Listing): void => {
  if (
    !publicText(value.displayName, 128) ||
    !publicText(value.shortDescription, 256) ||
    !narrative(value.longDescription, 4096) ||
    !publicText(value.developerName, 256) ||
    !publicText(value.category, 64) ||
    ![
      value.websiteUrl,
      value.supportUrl,
      value.privacyPolicyUrl,
      value.termsOfServiceUrl,
    ].every(https)
  )
    throw new Error("OpenAI listing is invalid")
}
const validateTests = (value: Submission): void => {
  if (
    value.starterPrompts.length < 1 ||
    value.starterPrompts.length > 8 ||
    !unique(value.starterPrompts) ||
    value.starterPrompts.some((prompt) => !narrative(prompt)) ||
    !narrative(value.releaseNotes)
  )
    throw new Error("OpenAI starter prompts or release notes are invalid")
  const ids = [...value.positiveTests, ...value.negativeTests].map((test) => test.id)
  if (!unique(ids) || ids.some((id) => !name(id)))
    throw new Error("OpenAI submission test IDs must be unique kebab-case names")
  for (const test of value.positiveTests)
    if (
      !narrative(test.prompt) ||
      !narrative(test.expectedBehavior) ||
      !narrative(test.expectedResultShape) ||
      !narrative(test.fixture)
    )
      throw new Error("OpenAI positive test is invalid")
  for (const test of value.negativeTests)
    if (!narrative(test.prompt) || !narrative(test.expectedBehavior) || !narrative(test.reason))
      throw new Error("OpenAI negative test is invalid")
}

export const submission = Effect.fn("openai.submission")(function* (
  input: Submission,
  access: ArtifactAccess,
) {
  const readContent = access.readContent.bind(access)
  const selected = yield* attempt("openai-submission", () => {
    const value = own(Submission, input)
    validateListing(value.listing)
    validateTests(value)
    const marketplace = marketplaceDocument(value.marketplace), bundle = own(Bundle, access.bundle)
    const treeMembers = bundle.artifacts.filter(
      (artifact) => artifact._tag === "OwnedTree" && canonical(artifact) === canonical(value.plugin),
    )
    if (treeMembers.length !== 1)
      throw new Error("OpenAI plugin tree is not an exact owned Bundle member")
    const artifacts = verifiedArtifacts({ bundle, readContent }, 10 * 1024 * 1024)
    if (!artifacts.has(value.listing.logo))
      throw new Error("OpenAI listing logo is not an exact owned Bundle member")
    return { value, marketplace, bundle, artifacts }
  })
  const plugin = yield* inspectPackage(selected.value.plugin, readContent)
  const entries = selected.marketplace.plugins.filter((entry) => entry.name === plugin.manifest.name)
  if (entries.length !== 1 || entries[0]!.category !== selected.value.listing.category)
    return yield* new ReleaseError({
      code: "openai-submission",
      message: "OpenAI marketplace does not contain the listed plugin",
    })
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
