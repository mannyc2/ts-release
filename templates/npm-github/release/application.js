import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { Config, Effect, Redacted, Schema } from "effect";
import { Plan, loadPlan } from "@mannyc1/ts-release";
import { loadBundle, verifiedArtifacts } from "@mannyc1/ts-release/bundle";
import { decodeJson, sameData, } from "@mannyc1/ts-release/http";
import { fileContentOwner, makeGithubTrustedPublisherHost, makeHttpRead, makeHttpTransport, openGitJournal, } from "@mannyc1/ts-release/node";
import * as GitHub from "@mannyc1/ts-release-github";
import * as Npm from "@mannyc1/ts-release-npm";
import { ApplicationInput, GITHUB_PRINCIPAL, NPM_PRINCIPAL, SourceIdentity, attempt, failure, read, releaseJournalId, requireNodeProvenance, sha256, } from "./Model.js";
export { ApplicationInput } from "./Model.js";
const secret = (name) => Config.Redacted(name).pipe(Effect.mapError(() => failure("credential", "An explicitly selected credential is unavailable")));
/** Public registry observations do not acquire publish authority. Keep this
 * application policy after the provider's exact scope and cohort admission. */
export const npmCredentials = Effect.fn("release.npmCredentials")(function* (binding, options) {
    const selected = yield* Npm.authorizationBinding(binding);
    if (!options.publications.some((intent) => intent.name === selected.packageName &&
        sameData(intent.authorization, selected.authorization)))
        return yield* failure("credential-binding", "npm credential request is outside the retained cohort");
    if (binding.method === "GET" || binding.method === "HEAD")
        return {};
    if (selected.authorization._tag === "TrustedAuthorization")
        return yield* Npm.authorizeTrusted({ authorization: selected.authorization, packageName: selected.packageName, binding }, options.trusted);
    if (options.local)
        return yield* options.local.credentials(binding);
    if (options.authentication.mode !== "Token")
        return yield* failure("credential-mode", "npm authentication mode differs from the retained Plan");
    return yield* Npm.authorizeToken({
        authorization: selected.authorization,
        binding,
        token: yield* secret(options.authentication.npmTokenEnvironment),
    });
});
/** Reconstruct the exact retained release. The common CLI/Action interpreter
 * owns execution, durable dispatch authority and interruption recovery. */
export const createApplication = Effect.fn("release.createApplication")(function* (raw) {
    const input = yield* attempt("input", () => Schema.decodeUnknownSync(ApplicationInput, { onExcessProperty: "error" })(raw));
    const candidateDirectory = resolve(input.candidateDirectory);
    const bundleBytes = yield* read(join(candidateDirectory, "bundle.json"));
    if (sha256(bundleBytes) !== input.bundleSha256)
        return yield* failure("bundle-identity", "Retained Bundle differs from the selected identity");
    const owner = fileContentOwner(join(candidateDirectory, "content"));
    const bundle = yield* loadBundle(owner, bundleBytes).pipe(Effect.mapError(() => failure("bundle", "Retained Bundle or owned content could not be admitted")));
    const readContent = (content) => owner
        .read(content)
        .pipe(Effect.mapError(() => failure("content", "Owned release bytes differ")));
    const files = verifiedArtifacts({ bundle, readContent }, 512 * 1024 * 1024);
    const sourceFile = bundle.artifacts.find((artifact) => artifact.logicalName === "source.json");
    const notesFile = bundle.artifacts.find((artifact) => artifact.logicalName === "release-notes.md");
    if (sourceFile?._tag !== "OwnedFile" || notesFile?._tag !== "OwnedFile")
        return yield* failure("source", "Release source and notes must be retained Bundle files");
    const sourceBytes = yield* files.read(sourceFile);
    const source = yield* attempt("source", () => Schema.decodeUnknownSync(SourceIdentity, { onExcessProperty: "error" })(decodeJson(sourceBytes)));
    const notesBytes = yield* files.read(notesFile);
    const notes = yield* attempt("notes", () => new TextDecoder("utf-8", { fatal: true }).decode(notesBytes));
    const planBytes = yield* read(join(candidateDirectory, "plan.json"));
    const retained = yield* attempt("plan", () => Schema.decodeUnknownSync(Plan, { onExcessProperty: "error" })(decodeJson(planBytes)));
    if (retained.planId !== input.planId || retained.bundleId !== input.bundleSha256)
        return yield* failure("plan-identity", "Retained Plan differs from the selected Bundle and Plan identities");
    if (retained.journalId !== releaseJournalId(source))
        return yield* failure("journal-identity", "Retained Plan must use the selected release coordinate's journal");
    const publications = yield* attempt("publication-policy", () => {
        const npm = retained.operations
            .filter((operation) => operation.definitionId === "npm.publish")
            .map((operation) => Schema.decodeUnknownSync(Npm.PublishIntent, { onExcessProperty: "error" })(operation.intent));
        if (!npm.length || new Set(npm.map((intent) => intent.name)).size !== npm.length)
            throw new Error("Expected unique npm publications");
        for (const intent of npm) {
            if (intent.version !== source.version || intent.authorization.principal !== NPM_PRINCIPAL)
                throw new Error("Package version or principal differs");
            if ((intent.authorization._tag === "TrustedAuthorization") !==
                (input.authentication.mode === "Trusted"))
                throw new Error("Authentication mode differs from the retained Plan");
            if (!sameData(intent.authorization, npm[0].authorization))
                throw new Error("npm authorization differs across the cohort");
            if (intent.provenance._tag === "GitHubActionsProvenance" &&
                (intent.provenance.source.sourceCommit !== source.commit ||
                    intent.provenance.source.repository !==
                        `${source.repository.owner}/${source.repository.name}`))
                throw new Error("Provenance differs from retained source");
        }
        const tags = [];
        const drafts = [];
        for (const operation of retained.operations) {
            if (operation.definitionId === "npm.publish")
                continue;
            const intent = operation.definitionId === "github.lightweight-tag"
                ? Schema.decodeUnknownSync(GitHub.LightweightTag)(operation.intent)
                : operation.definitionId === "github.draft"
                    ? Schema.decodeUnknownSync(GitHub.DraftIntent)(operation.intent)
                    : operation.definitionId === "github.asset"
                        ? Schema.decodeUnknownSync(GitHub.AssetIntent)(operation.intent)
                        : operation.definitionId === "github.publish"
                            ? Schema.decodeUnknownSync(GitHub.PublishIntent)(operation.intent)
                            : undefined;
            if (!intent ||
                !sameData(intent.repository, source.repository) ||
                intent.principal !== GITHUB_PRINCIPAL)
                throw new Error("Release operation is outside the selected repository or principal");
            if (intent instanceof GitHub.LightweightTag)
                tags.push(intent);
            if (intent instanceof GitHub.DraftIntent)
                drafts.push(intent);
        }
        if (tags.length !== 1 ||
            tags[0].tag !== `v${source.version}` ||
            tags[0].commit !== source.commit ||
            drafts.length !== 1 ||
            drafts[0].body !== notes)
            throw new Error("Release tag or notes differ from the owned source");
        return npm;
    });
    const hasProvenance = publications.some((intent) => intent.provenance._tag === "GitHubActionsProvenance");
    if (hasProvenance) {
        yield* attempt("provenance-runtime", requireNodeProvenance);
        if (!input.sigstore)
            return yield* failure("provenance-trust", "Retained provenance requires explicit Sigstore trust inputs");
    }
    const bounds = {
        timeoutMilliseconds: input.timeoutMilliseconds ?? 30_000,
        maximumResponseBytes: 16 * 1024 * 1024,
    };
    const trusted = makeGithubTrustedPublisherHost(bounds);
    const authorization = publications[0].authorization;
    const credentials = Effect.fn("release.credentials")(function* (binding) {
        if (new URL(binding.endpoint).origin === "https://registry.npmjs.org")
            return yield* npmCredentials(binding, {
                publications,
                authentication: input.authentication,
                trusted,
                local,
            });
        return yield* GitHub.authorizeToken({
            repository: source.repository,
            binding,
            token: yield* secret(input.authentication.githubTokenEnvironment),
        });
    });
    const httpRead = makeHttpRead({ ...bounds, credentials });
    const npmProviders = Npm.definitions({
        bundle,
        readContent,
        read: httpRead,
        ...(hasProvenance && input.sigstore
            ? { verifyProvenance: Npm.makeSigstoreVerifier(input.sigstore) }
            : {}),
    });
    const providers = [
        ...npmProviders.map((provider) => ({
            ...provider,
            decodeResponse: Effect.fn("release.captureAuthentication")(function* (request, response) {
                if (local)
                    yield* attempt("authentication-response", () => local.capture(request, response));
                return yield* provider.decodeResponse(request, response);
            }),
        })),
        ...GitHub.definitions({ bundle, readContent, read: httpRead }),
    ];
    const plan = yield* loadPlan(retained, providers);
    const remote = yield* attempt("journal-remote", () => {
        const url = new URL(input.journal.remote);
        if (url.protocol === "file:" &&
            !url.hostname &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash)
            return "Anonymous";
        const path = `/${source.repository.owner}/${source.repository.name}`;
        if (url.origin !== "https://github.com" ||
            url.username ||
            url.password ||
            url.search ||
            url.hash ||
            ![path, `${path}.git`].includes(url.pathname))
            throw new Error("Journal must be a local file remote or the selected GitHub repository");
        return "Github";
    });
    // Admission above is pure with respect to credentials. Open the local npm
    // session only after the complete retained Plan and journal destination pass.
    const local = input.authentication.mode === "Local" && authorization._tag === "TokenAuthorization"
        ? yield* Npm.makeLocalAuthentication({
            authorization,
            configFile: input.authentication.npmConfigFile,
            notify: (url) => Effect.sync(() => {
                process.stderr.write(`Complete npm authentication: ${Redacted.value(url)}\n`);
            }),
        })
        : null;
    const store = yield* openGitJournal({
        ...input.journal,
        credentials: Effect.fn("release.journalCredentials")(function* (coordinate) {
            if (coordinate.remote !== input.journal.remote ||
                coordinate.principal !== input.journal.principal ||
                coordinate.scope !== input.journal.scope)
                return yield* failure("journal-binding", "Journal credential binding differs");
            if (remote === "Anonymous")
                return { _tag: "Anonymous" };
            return {
                _tag: "Basic",
                username: "x-access-token",
                password: yield* secret(input.authentication.githubTokenEnvironment),
            };
        }),
    });
    return {
        bundle,
        options: { plan, authorize: input.authorize },
        host: {
            providers,
            store,
            transport: makeHttpTransport({ providers, credentials, ...bounds }),
            now: Date.now,
            uniqueId: randomUUID,
        },
        ...(local ? { onRejected: (operation) => local.complete(operation) } : {}),
    };
});
