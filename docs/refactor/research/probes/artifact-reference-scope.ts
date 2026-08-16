// Disposable research probe. Not production API.
// Question: when does bundle identity belong in every artifact reference?

declare const bundleIdBrand: unique symbol
declare const artifactIdBrand: unique symbol

type BundleId = string & { readonly [bundleIdBrand]: true }
type ArtifactId = string & { readonly [artifactIdBrand]: true }

type RelativeArtifactRef = ArtifactId

interface RelativeOutput {
  readonly executables: ReadonlyArray<RelativeArtifactRef>
}

interface BoundOutput<A> {
  readonly bundleId: BundleId
  readonly value: A
}

interface QualifiedArtifactRef {
  readonly bundleId: BundleId
  readonly artifactId: ArtifactId
}

interface QualifiedOutput {
  readonly executables: ReadonlyArray<QualifiedArtifactRef>
}

class WrongBundle {
  readonly _tag = "WrongBundle"
  constructor(
    readonly expected: BundleId,
    readonly observed: BundleId
  ) {}
}

class MissingArtifact {
  readonly _tag = "MissingArtifact"
  constructor(readonly artifactId: ArtifactId) {}
}

type LookupError = WrongBundle | MissingArtifact

type Result<A, E> =
  | { readonly _tag: "Success"; readonly value: A }
  | { readonly _tag: "Failure"; readonly error: E }

interface Bundle {
  readonly id: BundleId
  readonly artifacts: ReadonlySet<ArtifactId>
}

const resolveRelative = (
  bundle: Bundle,
  ref: RelativeArtifactRef
): Result<ArtifactId, MissingArtifact> =>
  bundle.artifacts.has(ref)
    ? { _tag: "Success", value: ref }
    : { _tag: "Failure", error: new MissingArtifact(ref) }

const resolveQualified = (
  bundle: Bundle,
  ref: QualifiedArtifactRef
): Result<ArtifactId, LookupError> => {
  if (ref.bundleId !== bundle.id) {
    return { _tag: "Failure", error: new WrongBundle(bundle.id, ref.bundleId) }
  }
  return bundle.artifacts.has(ref.artifactId)
    ? { _tag: "Success", value: ref.artifactId }
    : { _tag: "Failure", error: new MissingArtifact(ref.artifactId) }
}

// Relative law: a durable output is valid only inside the one envelope that
// carries its owning BundleId. Bundle identity is represented once. Extracting
// and transporting a ref independently loses wrong-bundle detection.
const relativeEnvelope: BoundOutput<RelativeOutput> = {
  bundleId: "bundle-a" as BundleId,
  value: { executables: ["cli" as ArtifactId] }
}

// Qualified law: every ref is independently portable and can reject use with a
// different bundle. The cost is repeated bundle identity in nested output.
const qualifiedOutput: QualifiedOutput = {
  executables: [{
    bundleId: "bundle-a" as BundleId,
    artifactId: "cli" as ArtifactId
  }]
}

void [relativeEnvelope, qualifiedOutput, resolveRelative, resolveQualified]
