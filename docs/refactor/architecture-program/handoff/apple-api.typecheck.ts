/** Compile-only proposed Apple collection/native-operation correspondence witness. */
import * as Model from "effect-build-apple/Model"
import * as Notary from "effect-build-apple/Notary"
import * as Staple from "effect-build-apple/Staple"
import * as Assess from "effect-build-apple/Assess"
import type * as Schema from "effect/Schema"
import { AppPreparation, DmgPreparation, PkgPreparation, ApplePreparations, ApplicationSignature, DiskImageSignature, InstallerSignature, createApplePreparations, type ApplePreparationInput, type RestoredSource, type FinalNativeArtifact } from "./apple-api.js"
declare const app: AppPreparation
declare const dmg: DmgPreparation
declare const pkg: PkgPreparation
const appNative = new Model.DeveloperIdApplicationSignature({ ...app.signature, architecture: app.architecture })
const dmgNative = new Model.DeveloperIdDiskImageSignature({ ...dmg.signature, architecture: dmg.architecture })
const pkgNative = new Model.DeveloperIdInstallerSignature({ ...pkg.signature, architecture: pkg.architecture })
const appInput: ApplePreparationInput = { _tag: "AppPreparation", format: "ts-release/apple-preparation/1", artifactName: app.artifactName, architecture: app.architecture, principal: app.principal, credentialRef: app.credentialRef, producerRevision: app.producerRevision, source: app.source, bundleName: app.bundleName, signature: app.signature }
createApplePreparations([appInput])
const codecs: readonly Schema.Codec<unknown, unknown>[] = [AppPreparation, DmgPreparation, PkgPreparation, ApplePreparations, ApplicationSignature, DiskImageSignature, InstallerSignature]
declare const restored: RestoredSource
declare const acceptance: Notary.AcceptedReference
if (restored.kind === "app") {
  const submit: Notary.SubmitAppInput = { bundle: restored.artifact }
  const staple: Staple.StapleAppInput = { source: restored.artifact, acceptance, outdir: "/private/output.app" }
  void [submit, staple]
} else {
  if (restored.kind === "dmg") {
    const submit: Notary.SubmitInput = { kind: "dmg", artifact: restored.artifact }
    const staple: Staple.StapleFileInput = { kind: "dmg", source: restored.artifact, acceptance, outfile: "/private/output.dmg" }
    void [submit, staple]
  } else {
    const submit: Notary.SubmitInput = { kind: "pkg", artifact: restored.artifact }
    const staple: Staple.StapleFileInput = { kind: "pkg", source: restored.artifact, acceptance, outfile: "/private/output.pkg" }
    void [submit, staple]
  }
}
declare const finalized: FinalNativeArtifact
if (finalized.kind === "app") { const assess: Assess.AssessInput = { kind: "app", artifact: finalized.artifact }; void assess }
else if (finalized.kind === "dmg") { const assess: Assess.AssessInput = { kind: "dmg", artifact: finalized.artifact }; void assess }
else { const assess: Assess.AssessInput = { kind: "pkg", artifact: finalized.artifact }; void assess }
// @ts-expect-error An empty native input collection has no Apple release root.
createApplePreparations([])
// @ts-expect-error Collection members cannot supply an arbitrary journal root.
createApplePreparations([{ ...appInput, journalId: "caller-chosen" }])
// @ts-expect-error A finalized File cannot substitute for an application Tree.
const appSource: ConstructorParameters<typeof AppPreparation>[0]["source"] = dmg.source
// @ts-expect-error A package signature needs productsign/pkgutil, not codesign.
const packageSignature: ConstructorParameters<typeof PkgPreparation>[0]["signature"] = dmg.signature
void [appNative, dmgNative, pkgNative, codecs, appSource, packageSignature]
