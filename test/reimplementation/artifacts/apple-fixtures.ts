import { randomUUID } from "node:crypto"
import { chmod, cp, readFile, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { Effect, FileSystem, Layer, type Crypto, type Path } from "effect"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Artifact from "effect-build/Artifact"
import type * as Tool from "effect-build/Author/Tool"
import * as File from "effect-build/Author/File"
import * as Tree from "effect-build/Author/Tree"
import * as Model from "effect-build-apple/Model"
import * as Notary from "effect-build-apple/Notary"
import * as Staple from "effect-build-apple/Staple"
import * as Assess from "effect-build-apple/Assess"
import { adoptFile, adoptTree } from "../../../packages/ts-release/src/EffectBuild.js"
import { fileContentOwner, nodeDirectoryReader } from "../../../packages/ts-release/src/Node.js"
import type { ContentOwner } from "../../../packages/ts-release/src/Bundle.js"
import {
  ApplicationSignature,
  DiskImageSignature,
  InstallerSignature,
  createApplePreparations,
  type ApplePreparationInput,
  type ApplePreparations,
} from "../../../packages/ts-release/src/Apple.js"

/** API/protocol fixtures only. These observations certify no native Apple tool. */
export const observation = <Name extends string>(name: Name): Tool.Observation<Name> => ({
  name,
  participants: [
    {
      role: "protocol-double",
      name,
      version: "fixture-only",
      revision: "fixture-only",
      channel: "fixture-only",
      content: { bytes: Artifact.decimalBytes("0"), digest: Artifact.sha256Digest("0".repeat(64)) },
    },
  ],
  capabilities: [],
})
export const tools = {
  codesign: observation("codesign"),
  productsign: observation("productsign"),
  pkgutil: observation("pkgutil"),
  notarytool: observation("notarytool"),
  ditto: observation("ditto"),
  stapler: observation("stapler"),
  spctl: observation("spctl"),
}
export const run = <A, E>(
  effect: Effect.Effect<A, E, Crypto.Crypto | FileSystem.FileSystem | Path.Path>,
) => Effect.runPromise(effect.pipe(Effect.provide(BunServices.layer)))
export const makeSources = async (
  root: string,
  readOnlyApps = false,
): Promise<{
  owner: ContentOwner
  inputs: ApplePreparationInput[]
  collection: ApplePreparations
}> => {
  const owner = fileContentOwner(
    join(root, "objects"),
    nodeDirectoryReader(process.env.TS_RELEASE_HTTP_PEER_NODE ?? "/usr/bin/node"),
  )
  const inputs: ApplePreparationInput[] = []
  for (const architecture of ["arm64", "x64"] as const) {
    const base = {
      format: "ts-release/apple-preparation/1" as const,
      architecture,
      principal: "fixture-team",
      credentialRef: "fixture-key",
      producerRevision: "ef29a087baac8bdbcd90a54bb62a2dceb739dd91" as const,
    }
    const tree = await run(
      Tree.publish(
        {
          outdir: join(root, `source-${architecture}.app`),
          observation: "hashed",
          provenance: tools.codesign,
        },
        (candidate) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem
            yield* fs.makeDirectory(join(candidate, "Contents"))
            yield* fs.writeFileString(
              join(candidate, "Contents/Info.plist"),
              "Protocol fixture; not a native app",
            )
            if (readOnlyApps) yield* fs.chmod(join(candidate, "Contents"), 0o555)
          }),
      ),
    )
    inputs.push({
      ...base,
      _tag: "AppPreparation",
      artifactName: Artifact.portableRelativePath(`app-${architecture}`),
      bundleName: Artifact.portableRelativePath(`Fixture-${architecture}.app`),
      source: await run(adoptTree(owner, `source-${architecture}`, tree)),
      signature: new ApplicationSignature({
        certificateSha1: "0".repeat(40),
        tool: tools.codesign,
        hardenedRuntime: true,
        secureTimestamp: true,
      }),
    })
    if (readOnlyApps) await chmod(join(tree.root, "Contents"), 0o755)
    for (const kind of ["dmg", "pkg"] as const) {
      const provenance =
        kind === "dmg"
          ? tools.codesign
          : {
              ...tools.productsign,
              participants: [...tools.productsign.participants, ...tools.pkgutil.participants] as [
                Tool.ParticipantIdentity,
                ...Tool.ParticipantIdentity[],
              ],
            }
      const native = await run(
        File.publish(
          {
            destination: join(root, `source-${architecture}.${kind}`),
            observation: "hashed",
            provenance,
          },
          (candidate) =>
            Effect.gen(function* () {
              const fs = yield* FileSystem.FileSystem
              yield* fs.writeFileString(
                candidate,
                `Protocol ${kind}/${architecture}; not a native signed container`,
              )
            }),
        ),
      )
      const source = await run(adoptFile(owner, `source-${architecture}.${kind}`, native))
      inputs.push(
        kind === "dmg"
          ? {
              ...base,
              _tag: "DmgPreparation",
              artifactName: Artifact.portableRelativePath(`${architecture}.dmg`),
              source,
              signature: new DiskImageSignature({
                certificateSha1: "0".repeat(40),
                tool: tools.codesign,
                secureTimestamp: true,
              }),
            }
          : {
              ...base,
              _tag: "PkgPreparation",
              artifactName: Artifact.portableRelativePath(`${architecture}.pkg`),
              source,
              signature: new InstallerSignature({
                certificateSha1: "0".repeat(40),
                signer: tools.productsign,
                verifier: tools.pkgutil,
              }),
            },
      )
    }
  }
  const collection = await run(
    createApplePreparations(inputs as [ApplePreparationInput, ...ApplePreparationInput[]]),
  )
  return { owner, inputs, collection }
}
export const appleDoubles = () => {
  const calls = { submit: 0, info: 0, staple: 0, assess: 0 }
  let status: Notary.Status = new Notary.Pending({ providerStatus: "In Progress" })
  const submission = (
    kind: "app" | "dmg" | "pkg",
    source:
      | Model.DeveloperIdApplicationBundle
      | Model.DeveloperIdDiskImage
      | Model.DeveloperIdInstallerPackage,
  ) => {
    calls.submit++
    const app = "root" in source
    const bytes = app ? source.totalBytes : source.bytes,
      digest = app ? source.manifestDigest : source.digest
    return new Notary.Submission({
      submissionId: randomUUID(),
      kind: kind === "app" ? "zip" : kind,
      architecture: source.architecture,
      artifactBytes: app ? Artifact.decimalBytes("123") : bytes,
      artifactDigest: app ? Artifact.sha256Digest("a".repeat(64)) : digest,
      status,
      submissionTool: tools.notarytool,
      tool: tools.notarytool,
      stapleTarget: new Notary.StapleTarget({
        kind,
        identityKind: app ? "tree-manifest" : "file-bytes",
        artifactBytes: bytes,
        artifactDigest: digest,
        ...(app && { bundleName: basename(source.root) }),
      }),
      ...(app && { transportTool: tools.ditto }),
    })
  }
  const ticket = (acceptance: Notary.AcceptedReference) =>
    new Model.NotarizationTicket({
      submissionId: acceptance.submissionId,
      submittedKind: acceptance.kind,
      submittedBytes: acceptance.artifactBytes,
      submittedDigest: acceptance.artifactDigest,
      targetKind: acceptance.stapleTarget.kind,
      targetIdentityKind: acceptance.stapleTarget.identityKind,
      targetBytes: acceptance.stapleTarget.artifactBytes,
      targetDigest: acceptance.stapleTarget.artifactDigest,
      targetArchitecture: acceptance.architecture,
      ...(acceptance.stapleTarget.bundleName && {
        targetBundleName: acceptance.stapleTarget.bundleName,
      }),
      submissionTool: acceptance.submissionTool,
      acceptanceTool: acceptance.tool,
    })
  const native = <A, E>(
    effect: Effect.Effect<A, E, Crypto.Crypto | FileSystem.FileSystem | Path.Path>,
  ) =>
    effect.pipe(
      Effect.provide(BunServices.layer),
      Effect.mapError(
        () =>
          new Model.ProductStateInvalid({
            operation: "protocol-fixture",
            path: "fixture",
            expected: "native finalizer fixture",
          }),
      ),
    )
  const layer = Layer.mergeAll(
    Layer.succeed(Notary.Client, {
      submit: (input) => Effect.sync(() => submission(input.kind, input.artifact)),
      submitApp: (input) => Effect.sync(() => submission("app", input.bundle)),
      info: (reference) =>
        Effect.sync(() => {
          calls.info++
          return new Notary.Observation({ ...reference, status, tool: tools.notarytool })
        }),
      log: (reference) =>
        Effect.succeed(
          new Notary.Log({ ...reference, status, issues: [], tool: tools.notarytool }),
        ),
    }),
    Layer.succeed(Staple.Stapler, {
      stapleApp: (input) =>
        native(
          Effect.gen(function* () {
            calls.staple++
            const artifact = yield* Tree.publish(
              { outdir: input.outdir, observation: "hashed", provenance: tools.stapler },
              (candidate) =>
                Effect.tryPromise(async () => {
                  await cp(input.source.root, candidate, { recursive: true })
                  await writeFile(join(candidate, "ticket"), "protocol ticket")
                }),
            )
            return {
              ...artifact,
              architecture: input.source.architecture,
              signature: input.source.signature,
              notarizationTicket: ticket(input.acceptance),
            }
          }),
        ),
      stapleFile: (input) =>
        native(
          Effect.gen(function* () {
            calls.staple++
            const artifact = yield* File.publish(
              { destination: input.outfile, observation: "hashed", provenance: tools.stapler },
              (candidate) =>
                Effect.tryPromise(async () => {
                  const bytes = await readFile(input.source.path)
                  await writeFile(candidate, Buffer.concat([bytes, Buffer.from("protocol ticket")]))
                }),
            )
            return input.kind === "dmg"
              ? {
                  ...artifact,
                  architecture: input.source.architecture,
                  signature: input.source.signature,
                  notarizationTicket: ticket(input.acceptance),
                }
              : {
                  ...artifact,
                  architecture: input.source.architecture,
                  signature: input.source.signature,
                  notarizationTicket: ticket(input.acceptance),
                }
          }),
        ),
    }),
    Layer.succeed(Assess.Assessor, {
      assess: (input) =>
        Effect.sync(() => {
          calls.assess++
          const app = input.kind === "app"
          return new Assess.GatekeeperAccepted({
            kind: input.kind,
            architecture: input.artifact.architecture,
            identityKind: app ? "tree-manifest" : "file-bytes",
            artifactBytes: app ? input.artifact.totalBytes : input.artifact.bytes,
            artifactDigest: app ? input.artifact.manifestDigest : input.artifact.digest,
            accepted: true,
            gatekeeper: tools.spctl,
            structuralVerifier: input.kind === "pkg" ? tools.pkgutil : tools.codesign,
          })
        }),
    }),
  )
  return {
    calls,
    layer,
    status: (value: Notary.Status) => {
      status = value
    },
  }
}
