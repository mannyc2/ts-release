import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { Effect, Schema } from "effect";
import { ReleaseError } from "@mannyc1/ts-release";
import * as GitHub from "@mannyc1/ts-release-github";
import * as Npm from "@mannyc1/ts-release-npm";
export const NPM_PRINCIPAL = "npm-publisher";
export const GITHUB_PRINCIPAL = "github-publisher";
export const text = Schema.String.check(Schema.isMinLength(1));
export const positive = Schema.Int.check(Schema.isGreaterThan(0));
export const digest = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/u));
export const oid = Schema.String.check(Schema.isPattern(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u));
export const environmentName = text.check(Schema.isPattern(/^[A-Za-z_][A-Za-z0-9_]*$/u));
export class SourceIdentity extends Schema.Class("Release.SourceIdentity")({
    repository: GitHub.Repository,
    commit: oid,
    tree: oid,
    version: text,
}) {
}
/** A new signature, notes file or source commit must not choose a fresh history
 * for the same public release coordinate. A different Plan then fails admission
 * against the original journal instead of bypassing its unresolved dispatches. */
export const releaseJournalId = (source) => `npm-github:${source.repository.owner.toLowerCase()}/${source.repository.name.toLowerCase()}:v${source.version}`;
export class SigstoreTrust extends Schema.Class("Release.SigstoreTrust")({
    tufRootPath: text,
    tufCachePath: text,
    timeoutMilliseconds: positive,
}) {
}
export class ProvenancePreparation extends Schema.Class("Release.ProvenancePreparation")({
    authorize: Schema.Literal(true),
    source: Npm.ProvenanceSource,
    trust: SigstoreTrust,
}) {
}
export class PreparationInput extends Schema.Class("Release.PreparationInput")({
    candidateDirectory: text,
    repository: Schema.Struct({ owner: text, name: text }),
    source: Schema.Struct({ commit: oid, tree: oid }),
    version: text,
    title: Schema.String,
    notesFile: text,
    packages: Schema.Array(Schema.Struct({ archiveFile: text, publicName: text })),
    assets: Schema.optionalKey(Schema.Array(Schema.Struct({ file: text, publicName: text, mediaType: text }))),
    corePackage: Schema.optionalKey(text),
    npm: Schema.Struct({
        authorization: Npm.Authorization,
        initialTag: Schema.optionalKey(text),
        provenance: Schema.optionalKey(ProvenancePreparation),
    }),
}) {
}
export class JournalInput extends Schema.Class("Release.JournalInput")({
    remote: text,
    cacheDirectory: text,
    gitExecutable: text,
    principal: text,
    scope: text,
    timeoutMilliseconds: positive,
    maximumOutputBytes: positive,
}) {
}
export class TokenAuthentication extends Schema.Class("Release.TokenAuthentication")({
    mode: Schema.Literal("Token"),
    npmTokenEnvironment: environmentName,
    githubTokenEnvironment: environmentName,
}) {
}
export class TrustedAuthentication extends Schema.Class("Release.TrustedAuthentication")({
    mode: Schema.Literal("Trusted"),
    githubTokenEnvironment: environmentName,
}) {
}
export class LocalAuthentication extends Schema.Class("Release.LocalAuthentication")({
    mode: Schema.Literal("Local"),
    npmConfigFile: text,
    githubTokenEnvironment: environmentName,
}) {
}
export class ApplicationInput extends Schema.Class("Release.ApplicationInput")({
    candidateDirectory: text,
    bundleSha256: digest,
    planId: digest,
    authorize: Schema.Boolean,
    journal: JournalInput,
    authentication: Schema.Union([TokenAuthentication, TrustedAuthentication, LocalAuthentication]),
    sigstore: Schema.optionalKey(SigstoreTrust),
    supersededCandidates: Schema.optionalKey(Schema.Array(Schema.Struct({
        candidateDirectory: text,
        bundleSha256: digest,
        planId: digest,
    }))),
    timeoutMilliseconds: Schema.optionalKey(positive),
}) {
}
export const failure = (code, message) => new ReleaseError({ code: `release-application-${code}`, message });
export const attempt = (subject, body) => Effect.try({
    try: body,
    catch: () => failure(subject, `Release ${subject} could not be admitted`),
});
export const io = (subject, body) => Effect.tryPromise({
    try: body,
    catch: () => failure(subject, `Release ${subject} could not be read or retained`),
});
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
// Join each issued native operation before closing its handle. A native call
// that never settles can delay interruption; the workflow stays interruptible
// between calls.
const readIo = (body) => io("file", body).pipe(Effect.uninterruptible);
const fileFailure = () => failure("file", "Release file could not be read or retained");
export const read = Effect.fn("release.read")((path, maximumBytes = 32 * 1024 * 1024) => Effect.acquireUseRelease(readIo(() => open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)), (handle) => Effect.gen(function* () {
    const stat = yield* readIo(() => handle.stat());
    if (!stat.isFile() || stat.size > maximumBytes)
        return yield* fileFailure();
    const bytes = yield* readIo(() => handle.readFile());
    if (bytes.length !== stat.size)
        return yield* fileFailure();
    return new Uint8Array(bytes);
}), (handle) => readIo(() => handle.close())));
export const requireNodeProvenance = () => {
    const major = Number(process.versions.node.split(".")[0]);
    if (process.versions.bun || major < 22)
        throw failure("provenance-runtime", "Native provenance requires a qualified Node runtime");
};
