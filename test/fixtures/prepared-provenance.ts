import { sha256Digest } from "../../src/model/digest.js"
import { NonEmptyName } from "../../src/model/primitives.js"
import { ExplicitInputSnapshot, StagingSnapshot } from "../../src/release/context.js"
import {
  PreparedExecutionInputs,
  PreparedProvenance
} from "../../src/release/prepared.js"

export const fixtureBasis = sha256Digest(new TextEncoder().encode("fixture preparation basis"))

export const fixtureStagingSnapshot = StagingSnapshot.make({
  entries: [],
  digest: sha256Digest(new TextEncoder().encode("fixture source snapshot"))
})

export const fixturePreparedProvenance = PreparedProvenance.make({
  source: fixtureStagingSnapshot,
  externalInputs: [] as ExplicitInputSnapshot[],
  execution: PreparedExecutionInputs.make({
    environment: "closed",
    network: "prohibited",
    timezone: "UTC",
    locale: "C",
    clock: "source-date-epoch=0;host-clock-not-isolated",
    randomness: "host-randomness-not-isolated",
    platform: "fixture-platform",
    runtime: "fixture-runtime",
    networkIsolation: "fixture-network-isolation/v1",
    bunCompileRuntimes: "not-used",
    npmPack: "not-used",
    releaseGraph: sha256Digest(new TextEncoder().encode("fixture release graph")),
    preparer: "fixture-preparer"
  }),
  inputBasis: fixtureBasis,
  reproducibility: "not-asserted"
})

export const fixtureArtifactProvenance = (producer = "fixture-producer") => ({
  producer: NonEmptyName.make(producer),
  inputBasis: fixtureBasis
})
