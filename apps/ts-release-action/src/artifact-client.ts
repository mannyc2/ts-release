import artifactClient, { type ArtifactClient } from "@actions/artifact"

const artifactLookupDigestPattern = /^sha256:([a-f0-9]{64})$/u
const positiveDecimalPattern = /^[1-9][0-9]*$/u

export interface ActionArtifactFindBy {
  readonly token: string
  readonly workflowRunId: string
  readonly repositoryOwner: string
  readonly repositoryName: string
}

export interface ActionArtifactTransport {
  readonly upload: (input: {
    readonly name: string
    readonly files: ReadonlyArray<string>
    readonly rootDirectory: string
  }) => Promise<{ readonly id?: number, readonly digest?: string }>
  readonly download: (input: {
    readonly name: string
    readonly destination: string
    readonly findBy?: ActionArtifactFindBy
  }) => Promise<{
    readonly id?: number
    readonly digest?: string
    readonly path?: string
    readonly digestMismatch?: boolean
  }>
}

const positiveSafeInteger = (value: string, field: string): number => {
  if (!positiveDecimalPattern.test(value)) throw new Error(`${field} must be a canonical positive decimal string.`)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed.toString() !== value) {
    throw new Error(`${field} exceeds the exact GitHub API integer boundary.`)
  }
  return parsed
}

export const makeActionsArtifactTransport = (
  client: ArtifactClient = artifactClient
): ActionArtifactTransport => ({
  upload: async ({ name, files, rootDirectory }) => {
    const uploaded = await client.uploadArtifact(
      name, [...files], rootDirectory, { compressionLevel: 0 }
    )
    return {
      ...(uploaded.id === undefined ? {} : { id: uploaded.id }),
      ...(uploaded.digest === undefined ? {} : { digest: uploaded.digest })
    }
  },
  download: async ({ name, destination, findBy }) => {
    const options = findBy === undefined ? undefined : {
      findBy: {
        token: findBy.token,
        workflowRunId: positiveSafeInteger(findBy.workflowRunId, "prepared reference run id"),
        repositoryOwner: findBy.repositoryOwner,
        repositoryName: findBy.repositoryName
      }
    }
    const found = await client.getArtifact(name, options)
    const lookupDigest = artifactLookupDigestPattern.exec(found.artifact.digest ?? "")
    const lookupDigestHex = lookupDigest?.[1]
    if (found.artifact.name !== name || !Number.isSafeInteger(found.artifact.id) || found.artifact.id <= 0 ||
      lookupDigestHex === undefined) {
      throw new Error("Actions artifact lookup returned non-canonical artifact identity metadata.")
    }
    const downloaded = await client.downloadArtifact(found.artifact.id, {
      path: destination,
      // The lookup API canonicalizes the hash as `sha256:<hex>`, while the
      // official download client compares expectedHash to its bare computed
      // SHA-256 hex. Normalize only at that native-client boundary.
      expectedHash: lookupDigestHex,
      ...options
    })
    return {
      id: found.artifact.id,
      digest: `sha256:${lookupDigestHex}`,
      ...(downloaded.downloadPath === undefined ? {} : { path: downloaded.downloadPath }),
      ...(downloaded.digestMismatch === undefined ? {} : { digestMismatch: downloaded.digestMismatch })
    }
  }
})
