import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ReleaseError } from "@mannyc1/ts-release";
import { File, Tree, type ArtifactAccess } from "@mannyc1/ts-release/bundle";
import { Marketplace } from "./Marketplace.js";
declare const Listing_base: Schema.Class<Listing, Schema.Struct<{
    readonly displayName: Schema.String;
    readonly shortDescription: Schema.String;
    readonly longDescription: Schema.String;
    readonly developerName: Schema.String;
    readonly category: Schema.String;
    readonly websiteUrl: Schema.String;
    readonly supportUrl: Schema.String;
    readonly privacyPolicyUrl: Schema.String;
    readonly termsOfServiceUrl: Schema.String;
    readonly logo: typeof File;
}>, {}>;
export declare class Listing extends Listing_base {
}
declare const PositiveTest_base: Schema.Class<PositiveTest, Schema.Struct<{
    readonly id: Schema.String;
    readonly prompt: Schema.String;
    readonly expectedBehavior: Schema.String;
    readonly expectedResultShape: Schema.String;
    readonly fixture: Schema.String;
}>, {}>;
export declare class PositiveTest extends PositiveTest_base {
}
declare const NegativeTest_base: Schema.Class<NegativeTest, Schema.Struct<{
    readonly id: Schema.String;
    readonly prompt: Schema.String;
    readonly expectedBehavior: Schema.String;
    readonly reason: Schema.String;
}>, {}>;
export declare class NegativeTest extends NegativeTest_base {
}
declare const Attestations_base: Schema.Class<Attestations, Schema.Struct<{
    readonly developerIdentityVerified: Schema.Literal<true>;
    readonly intellectualPropertyRightsConfirmed: Schema.Literal<true>;
    readonly listingAndTestsAccurate: Schema.Literal<true>;
    readonly privacyAndTermsPublished: Schema.Literal<true>;
    readonly pluginPoliciesReviewed: Schema.Literal<true>;
    readonly humanPortalReviewAndPublicationRequired: Schema.Literal<true>;
}>, {}>;
export declare class Attestations extends Attestations_base {
}
declare const Submission_base: Schema.Class<Submission, Schema.Struct<{
    readonly plugin: typeof Tree;
    readonly marketplace: typeof Marketplace;
    readonly listing: typeof Listing;
    readonly starterPrompts: Schema.$Array<Schema.String>;
    readonly positiveTests: Schema.Tuple<readonly [typeof PositiveTest, typeof PositiveTest, typeof PositiveTest, typeof PositiveTest, typeof PositiveTest]>;
    readonly negativeTests: Schema.Tuple<readonly [typeof NegativeTest, typeof NegativeTest, typeof NegativeTest]>;
    readonly releaseNotes: Schema.String;
    readonly attestations: typeof Attestations;
}>, {}>;
export declare class Submission extends Submission_base {
}
export declare const submission: (input: Submission, access: ArtifactAccess) => Effect.Effect<Readonly<{
    status: "validated-handoff-human-submission-required";
    bytes: Uint8Array<ArrayBuffer>;
}>, ReleaseError, never>;
export {};
