// @bun
// scripts/release-input.ts
import { Schema as Schema3 } from "effect";

// scripts/ReleaseMetadata.ts
import { Schema as Schema2 } from "effect";

// apps/self-release/src/Model.ts
import { constants } from "fs";
import { open } from "fs/promises";
import { Effect, Schema } from "effect";
import { ReleaseError } from "@mannyc1/ts-release";
import * as GitHub from "@mannyc1/ts-release-github";
import * as Npm from "@mannyc1/ts-release-npm";
var text = Schema.String.check(Schema.isMinLength(1));
var positive = Schema.Int.check(Schema.isGreaterThan(0));
var digest = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/u));
var oid = Schema.String.check(Schema.isPattern(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u));
var environmentName = text.check(Schema.isPattern(/^[A-Za-z_][A-Za-z0-9_]*$/u));

class SourceIdentity extends Schema.Class("Release.SourceIdentity")({
  repository: GitHub.Repository,
  commit: oid,
  tree: oid,
  version: text
}) {
}
class SigstoreTrust extends Schema.Class("Release.SigstoreTrust")({
  tufRootPath: text,
  tufCachePath: text,
  timeoutMilliseconds: positive
}) {
}

class ProvenancePreparation extends Schema.Class("Release.ProvenancePreparation")({
  authorize: Schema.Literal(true),
  source: Npm.ProvenanceSource,
  trust: SigstoreTrust
}) {
}

class PreparationInput extends Schema.Class("Release.PreparationInput")({
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
    provenance: Schema.optionalKey(ProvenancePreparation)
  })
}) {
}

class JournalInput extends Schema.Class("Release.JournalInput")({
  remote: text,
  cacheDirectory: text,
  gitExecutable: text,
  principal: text,
  scope: text,
  timeoutMilliseconds: positive,
  maximumOutputBytes: positive
}) {
}

class TokenAuthentication extends Schema.Class("Release.TokenAuthentication")({
  mode: Schema.Literal("Token"),
  npmTokenEnvironment: environmentName,
  githubTokenEnvironment: environmentName
}) {
}

class TrustedAuthentication extends Schema.Class("Release.TrustedAuthentication")({
  mode: Schema.Literal("Trusted"),
  githubTokenEnvironment: environmentName
}) {
}

class LocalAuthentication extends Schema.Class("Release.LocalAuthentication")({
  mode: Schema.Literal("Local"),
  npmConfigFile: text,
  githubTokenEnvironment: environmentName
}) {
}

class ApplicationInput extends Schema.Class("Release.ApplicationInput")({
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
    planId: digest
  }))),
  timeoutMilliseconds: Schema.optionalKey(positive)
}) {
}
var failure = (code, message) => new ReleaseError({ code: `release-application-${code}`, message });
var io = (subject, body) => Effect.tryPromise({
  try: body,
  catch: () => failure(subject, `Release ${subject} could not be read or retained`)
});
var readIo = (body) => io("file", body).pipe(Effect.uninterruptible);
var fileFailure = () => failure("file", "Release file could not be read or retained");
var read = Effect.fn("release.read")((path, maximumBytes = 32 * 1024 * 1024) => Effect.acquireUseRelease(readIo(() => open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)), (handle) => Effect.gen(function* () {
  const stat = yield* readIo(() => handle.stat());
  if (!stat.isFile() || stat.size > maximumBytes)
    return yield* fileFailure();
  const bytes = yield* readIo(() => handle.readFile());
  if (bytes.length !== stat.size)
    return yield* fileFailure();
  return new Uint8Array(bytes);
}), (handle) => readIo(() => handle.close())));

// scripts/ReleaseMetadata.ts
var CandidateIdentity = Schema2.Struct({
  bundleSha256: ApplicationInput.fields.bundleSha256,
  planId: ApplicationInput.fields.planId
});
var SigstoreSeeds = Schema2.Struct({
  "https://tuf-repo-cdn.sigstore.dev": Schema2.Struct({ "root.json": Schema2.String })
});
var PackageExports = Schema2.Struct({
  name: Schema2.String,
  version: Schema2.String,
  exports: Schema2.Record(Schema2.String, Schema2.StructWithRest(Schema2.Struct({ types: Schema2.String, import: Schema2.String }), [
    Schema2.Record(Schema2.String, Schema2.Unknown)
  ])),
  bin: Schema2.optionalKey(Schema2.Record(Schema2.String, Schema2.String))
});

// scripts/release-input.ts
import assert from "assert/strict";
import { appendFile, readFile, writeFile } from "fs/promises";
import { join, resolve } from "path";
var [candidate, destination, mode, approval] = process.argv.slice(2);
assert.ok(candidate && destination && ["Token", "Trusted", "Local"].includes(mode ?? ""), "Usage: bun scripts/release-input.ts <candidate> <input.json> <Token|Trusted|Local> [--execute]");
assert.ok(approval === undefined || approval === "--execute");
var directory = resolve(candidate);
var identity = Schema3.decodeSync(Schema3.fromJsonString(CandidateIdentity))(await readFile(join(directory, "identity.json"), "utf8"));
var remote = process.env.TS_RELEASE_JOURNAL_REMOTE;
assert.ok(remote, "Set an explicit TS_RELEASE_JOURNAL_REMOTE shared across runners");
var gitExecutable = Bun.which("git");
assert.ok(gitExecutable);
var authentication = {
  mode,
  githubTokenEnvironment: "GH_TOKEN",
  ...mode === "Token" ? { npmTokenEnvironment: "NPM_TOKEN" } : {},
  ...mode === "Local" ? { npmConfigFile: process.env.NPM_CONFIG_USERCONFIG } : {}
};
if (mode === "Local")
  assert.ok(authentication.npmConfigFile, "Select NPM_CONFIG_USERCONFIG explicitly for local npm login");
var sigstore;
if (mode === "Trusted") {
  const seeds = Schema3.decodeSync(Schema3.fromJsonString(SigstoreSeeds))(await readFile(resolve("node_modules/@sigstore/tuf/seeds.json"), "utf8"));
  const tufRootPath = resolve(`${destination}.trust-root.json`);
  await writeFile(tufRootPath, Buffer.from(seeds["https://tuf-repo-cdn.sigstore.dev"]["root.json"], "base64"), { flag: "wx" });
  sigstore = {
    tufRootPath,
    tufCachePath: resolve(`${destination}.tuf-cache`),
    timeoutMilliseconds: 30000
  };
}
var input = {
  candidateDirectory: directory,
  ...identity,
  authorize: approval === "--execute",
  authentication,
  journal: {
    remote,
    cacheDirectory: resolve(`${destination}.journal-cache`),
    gitExecutable,
    principal: "github-publisher",
    scope: "release-journal",
    timeoutMilliseconds: 60000,
    maximumOutputBytes: 64 * 1024 * 1024
  },
  ...sigstore ? { sigstore } : {},
  ...process.env.TS_RELEASE_SUPERSEDED_CANDIDATES ? {
    supersededCandidates: await Promise.all(Schema3.decodeSync(Schema3.fromJsonString(Schema3.Array(Schema3.String)))(process.env.TS_RELEASE_SUPERSEDED_CANDIDATES).map(async (directory2) => {
      assert.equal(typeof directory2, "string");
      const identity2 = Schema3.decodeSync(Schema3.fromJsonString(CandidateIdentity))(await readFile(join(resolve(directory2), "identity.json"), "utf8"));
      assert.match(identity2.planId, /^[a-f0-9]{64}$/u);
      assert.match(identity2.bundleSha256, /^[a-f0-9]{64}$/u);
      return {
        candidateDirectory: resolve(directory2),
        planId: identity2.planId,
        bundleSha256: identity2.bundleSha256
      };
    }))
  } : {}
};
await writeFile(resolve(destination), JSON.stringify(input, null, 2) + `
`, { flag: "wx" });
if (process.env.GITHUB_OUTPUT)
  await appendFile(process.env.GITHUB_OUTPUT, `application-input=${JSON.stringify(input)}
`);
console.log(JSON.stringify({
  input: resolve(destination),
  planId: identity.planId,
  authorize: input.authorize
}));
