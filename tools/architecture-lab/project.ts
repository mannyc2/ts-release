/** Project a proposed design into reviewable metadata; never write product files. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import ts from "typescript";
import { satisfies, valid, validRange } from "semver";
import { readRecordText } from "./records.js";
const root = resolve(import.meta.dir, "../..");
const handoff = "docs/refactor/architecture-program/handoff";
const designPath = `${handoff}/design.json`;
const read = (path: string) => readFile(resolve(root, path), "utf8");
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const lines = (text: string) => text.trimEnd().split("\n").length;
function assert(test: unknown, message: string): asserts test { if (!test)
    throw new Error(message); }
type Module = {
    id: string;
    owner: string;
    path: string;
    zone: string;
    dependencies: string[];
    externalImports?: string[];
    dynamicDependencies?: string[];
    dynamicBoundary?: string;
    purpose?: string;
};
type Provider = {
    id: string;
    package: string;
    namespace: string;
    dependencies: Record<string, string>;
    files: {
        name: string;
        symbols: string[];
        dependencies: string[];
        externalImports?: string[];
    }[];
};
type Design = {
    selection: { machine: string; topology: string; marginalPolicy: unknown };
    recommendation: {
        topology: string;
    };
    version: string;
    rootPackage: string;
    aggregatePackage: string;
    providerPackagePrefix: string;
    engines: Record<string, string>;
    pins: Record<string, string>;
    peerPolicy: Record<string, string>;
    effectPatch: {
        required: boolean;
        path: string;
        proof: string;
        scope: string;
    };
    authorities: Record<string, string>;
    modules: Module[];
    providers: Provider[];
    externalOwners: {
        id: string;
        package: string;
        version: string;
    }[];
    alternatives: {
        id: string;
        coreDirectory: string;
        providerPackaging: string;
        publicPackageCount: number;
    }[];
    invariants: string[];
    qualification: unknown;
};
type Declaration = {
    id: string;
    authority: string;
    namespace: string | null;
    sourceName: string;
    spaces: string[];
    declarations: {
        line: number;
        sha256: string;
    }[];
};
type SymbolRef = {
    declaration: string;
    name: string;
    module: string;
};
type Surface = {
    id: string;
    entry: string;
    symbols: SymbolRef[];
};
const designText = await read(designPath);
const design: Design = JSON.parse(designText);
const authorityTexts: Record<string, string> = Object.fromEntries(await Promise.all(Object.entries(design.authorities).map(async ([id, path]) => [id, await read(path)] as const)));
const declarations = new Map<string, Declaration>();
// Implemented kernel exports are resolved by the compiler through their real
// declaration owners. Unimplemented provider/host proposals retain their parser.
const apiProgram = ts.createProgram([resolve(root, design.authorities.kernel!), resolve(root, design.authorities.application!)], {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext, types: [],
});
const apiChecker = apiProgram.getTypeChecker();
for (const [authority, text] of Object.entries(authorityTexts)) {
    if (authority === "kernel" || authority === "application") {
        const source = apiProgram.getSourceFile(resolve(root, design.authorities[authority]!))!;
        const module = apiChecker.getSymbolAtLocation(source);
        assert(module, "Production kernel declaration entry is not a module");
        for (const exported of apiChecker.getExportsOfModule(module)) {
            const symbol = exported.flags & ts.SymbolFlags.Alias ? apiChecker.getAliasedSymbol(exported) : exported;
            const spaces = [
                ...(symbol.flags & ts.SymbolFlags.Type ? ["type"] : []),
                ...(symbol.flags & ts.SymbolFlags.Value ? ["value"] : []),
            ];
            const id = `${authority}:${exported.name}`;
            declarations.set(id, { id, authority, namespace: null, sourceName: exported.name, spaces,
                declarations: (symbol.declarations ?? []).map(node => ({
                    line: node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1,
                    sha256: hash(node.getText()),
                })),
            });
        }
        continue;
    }
    const source = ts.createSourceFile(design.authorities[authority]!, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (statements: ts.NodeArray<ts.Statement>, namespace: string | null) => {
        for (const statement of statements) {
            if (!ts.canHaveModifiers(statement) || !ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
                continue;
            if (ts.isModuleDeclaration(statement) && statement.body && ts.isModuleBlock(statement.body)) {
                visit(statement.body.statements, statement.name.text);
                continue;
            }
            const names = ts.isVariableStatement(statement) ? statement.declarationList.declarations.map((item) => item.name.getText(source)) : "name" in statement && statement.name && ts.isIdentifier(statement.name as ts.Node) ? [(statement.name as ts.Identifier).text] : [];
            const spaces = ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) ? ["type"] : ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement) ? ["type", "value"] : ["value"];
            for (const sourceName of names) {
                const id = `${authority}:${namespace ? `${namespace}.` : ""}${sourceName}`;
                const record = declarations.get(id) ?? { id, authority, namespace, sourceName, spaces: [], declarations: [] };
                record.spaces = [...new Set([...record.spaces, ...spaces])].sort();
                record.declarations.push({ line: source.getLineAndCharacterOfPosition(statement.getStart(source)).line + 1, sha256: hash(statement.getText(source)) });
                declarations.set(id, record);
            }
        }
    };
    visit(source.statements, null);
}
const pick = (authority: string, name: string, module: string, alias = name, namespace?: string): SymbolRef => {
    const declaration = `${authority}:${namespace ? `${namespace}.` : ""}${name}`;
    assert(declarations.has(declaration), `Missing API ${declaration}`);
    return { declaration, name: alias, module };
};
const picks = (authority: string, names: string[], module: string, namespace?: string) => names.map((name) => pick(authority, name, module, name, namespace));
const named = (authority: string, namespace: string | null = null) => [...declarations.values()].filter((item) => item.authority === authority && item.namespace === namespace).map((item) => item.sourceName);
const kernelOwners: Record<string, string[]> = {
    "kernel.Error": ["ReleaseError"],
    "kernel.Provider": ["PROVIDER_CONTRACT", "ProviderDefinition", "ProviderDescriptor", "NativeFailureBoundary", "ProviderContext", "Observation", "OperationEvidence", "PreparedRequest", "SendResult", "Transport", "Author", "Json", "OperationId"],
    "kernel.Decision": ["CandidateRequest", "Next", "Machine", "MachineConstructor", "historyMachine", "sameProtectedRequest", "sameStrings"],
    "kernel.Plan": ["createOperation", "createPlan", "createPreparationScope", "loadPlan", "makeRequest"],
    "kernel.Journal": ["Snapshot", "AppendResult", "JournalStore", "Scope", "JournalContext"],
    "kernel.Host": ["Host", "HostShape"],
    "kernel.GitAuthority": ["GitReceipt", "GitExecution", "CoreGitOptions", "makeCoreGitTransport"],
    "kernel.Release": ["reportRelease", "observeRelease", "runRelease", "supersedePlan", "acceptRisk"]
};
const kernel = named("kernel").map((name) => pick("kernel", name, Object.entries(kernelOwners).find(([, names]) => names.includes(name))?.[0] ?? "kernel.Model"));
const host = [...picks("application", ["Application", "CreateApplication", "runApplication"], "host.Application"), pick("application", "FinalizedReport", "kernel.Report")];
host.push(...picks("host", ["makeHttpTransport"], "host.Http"), ...picks("host", ["openGitJournal"], "host.GitJournal"), pick("contentOwner", "fileContentOwner", "host.Content"), pick("provider", "nativeHost", "host.NativeGit", "makeGitCatalogHost", "GitCatalog"));
const appleNative = ["RestoredSource", "FinalNativeArtifact", "NativeAppleError", "NativeAppleServices", "DeriveDeliveryFiles", "restorePreparedSource", "submitPrepared", "finishPrepared"];
const applePreparation = ["createApplePreparations", "loadApplePreparations", "preparationProvider", "preparationScopes", "runPreparation", "validateApplePublication", "reportAppleContext"];
const surfaces: Surface[] = [
    { id: "core.root", entry: "kernel.Entry", symbols: kernel },
    { id: "core.bundle", entry: "kernel.Bundle", symbols: [
            ...picks("adoption", ["Content", "AdoptionError"], "kernel.ArtifactModel"),
            ...[["OwnedFile", "File"], ["OwnedTree", "Tree"], ["OwnedArtifact", "Artifact"], ["OwnedBundle", "Bundle"]].map(([name, alias]) => pick("adoption", name!, "kernel.ArtifactModel", alias!)),
            ...picks("adoption", ["ContentOwner"], "kernel.Content"), ...picks("adoption", ["finalize"], "kernel.BundleFinalize"),
            ...picks("codec", ["encodeBundle", "loadBundle"], "kernel.BundleCodec"), ...picks("provider", ["ReadContent", "PutContent", "ArtifactAccess"], "kernel.Content"), ...picks("checksum", ["ChecksumInput", "renderSha256Sums", "verifySha256Sums"], "kernel.Checksums")
        ] },
    { id: "core.effect-build", entry: "kernel.EffectBuild", symbols: [...picks("adoption", ["adoptFile", "adoptTree"], "kernel.EffectBuild"), pick("codec", "restoreTree", "kernel.EffectBuild")] },
    { id: "core.apple", entry: "kernel.Apple", symbols: named("apple").map((name) => pick("apple", name, appleNative.includes(name) ? "kernel.AppleNative" : applePreparation.includes(name) ? "kernel.ApplePreparation" : "kernel.AppleModel")) },
    { id: "core.http", entry: "kernel.Http", symbols: [...picks("http", named("http"), "kernel.Http"), ...picks("provider", ["Headers", "HttpReadRequest", "HttpResponse", "HttpRead", "HttpProviderDefinition", "CredentialBinding", "CredentialHeaders", "OidcTokenRequest", "OidcTokenSource", "CredentialExchange", "TrustedPublisherHost"], "kernel.Http"), ...picks("host", ["CredentialRequest", "ResolveCredentials", "HttpTransportOptions"], "kernel.Http")] },
    { id: "core.git", entry: "kernel.Git", symbols: [...picks("provider", named("provider", "GitCatalog").filter((name) => name !== "nativeHost"), "kernel.GitCatalog", "GitCatalog"), ...kernel.filter((item) => ["GitCas", "GitReceipt", "GitExecution", "CoreGitOptions", "makeCoreGitTransport"].includes(item.name))] },
    { id: "core.node", entry: "host.Node", symbols: host },
    { id: "core.bun", entry: "host.Bun", symbols: [...host, pick("host", "openSqliteJournal", "host.Sqlite")] }
];
for (const provider of design.providers) {
    const names = provider.files.flatMap((file) => file.symbols);
    assert(new Set(names).size === names.length && json([...names].sort()) === json(named("provider", provider.namespace).sort()), `Incomplete or duplicated ${provider.namespace} ownership`);
    surfaces.push({ id: `provider.${provider.id}`, entry: `provider.${provider.id}`, symbols: provider.files.flatMap((file) => picks("provider", file.symbols, `provider.${provider.id}.${file.name}`, provider.namespace)) });
}
const migrationPath = `${handoff}/migration.json`;
const migrationText = readRecordText(resolve(root, migrationPath));
const successorIds = new Set<string>();
const collect = (value: unknown): void => {
    if (!value || typeof value !== "object")
        return;
    for (const [key, child] of Object.entries(value)) {
        if ((key === "successors" || key === "successorModules") && Array.isArray(child))
            child.forEach((id) => { assert(typeof id === "string", "Non-string successor"); successorIds.add(id); });
        else
            collect(child);
    }
};
collect(JSON.parse(migrationText));
const authorityBindings = Object.fromEntries(Object.entries(design.authorities).map(([id, path]) => [id, { path, sha256: hash(authorityTexts[id]!) }]));
const actionYaml = [
    "name: ts-release", "description: Execute one authored release application against its durable journal.", "author: mannyc2", "inputs:",
    "  application:", "    description: Workspace-contained ESM application exporting createApplication.", "    required: true", "  input:", "    description: JSON input passed to createApplication.", "    required: false", "    default: '{}'", "outputs:",
    "  plan-id:", "    description: Identity of the application's exact publication plan.", "  journal-revision:", "    description: Durable journal revision reported by the application.",
    "runs:", "  using: node24", "  main: dist/launcher.cjs", "branding:", "  icon: package", "  color: blue", ""
].join("\n");
const commonManifest = { version: design.version, type: "module", license: "MIT", sideEffects: false, files: ["dist", "README.md", "LICENSE"], engines: design.engines, publishConfig: { access: "public", registry: "https://registry.npmjs.org" } };
type Manifest = Record<string, unknown> & {
    name: string;
    dependencies: Record<string, string>;
    exports?: Record<string, unknown>;
};
const projection: unknown[] = [];
const physicalSurfaces: unknown[] = [];
for (const alternative of design.alternatives) {
    const coreDirectory = alternative.coreDirectory;
    const corePath = (path: string) => coreDirectory === "." ? path : `${coreDirectory}/${path}`;
    const packageName = (id: string) => alternative.providerPackaging === "grouped-by-capability" ? design.providers.find((provider) => provider.id === id)!.package : id;
    const grouped = (id: string) => design.providers.filter((provider) => packageName(provider.id) === packageName(id)).length > 1;
    const providerPackage = (id: string) => alternative.id === "T1" ? "core" : alternative.id === "T2" ? "providers" : `provider.${packageName(id)}`;
    const providerDirectory = (id: string) => alternative.id === "T1" ? `src/providers/${id}` : alternative.id === "T2" ? `packages/providers/src/${id}` : `packages/${packageName(id)}/src${grouped(id) ? `/${id}` : ""}`;
    const modules: Module[] = design.modules.map((module) => ({...module, path: module.owner === "core" ? corePath(module.path) : module.path}));
    for (const provider of design.providers) {
        const prefix = `provider.${provider.id}`;
        for (const file of provider.files)
            modules.push({ id: `${prefix}.${file.name}`, owner: providerPackage(provider.id), path: `${providerDirectory(provider.id)}/${file.name}.ts`, zone: "provider", dependencies: file.dependencies, ...(file.externalImports ? { externalImports: file.externalImports } : {}) });
        modules.push({ id: prefix, owner: providerPackage(provider.id), path: `${providerDirectory(provider.id)}/index.ts`, zone: "provider", dependencies: provider.files.map((file) => `${prefix}.${file.name}`) });
    }
    const moduleMap = new Map(modules.map((item) => [item.id, item]));
    assert(moduleMap.size === modules.length && new Set(modules.map((item) => item.path)).size === modules.length, `Duplicate module in ${alternative.id}`);
    const closure = (id: string, active: string[] = []): Set<string> => {
        assert(!active.includes(id), `Cycle ${[...active, id].join(" -> ")}`);
        const module = moduleMap.get(id);
        assert(module, `Unknown module ${id}`);
        return new Set([id, ...[...module.dependencies, ...(module.dynamicDependencies ?? [])].flatMap((child) => [...closure(child, [...active, id])])]);
    };
    for (const module of modules) {
        const reachable = [...closure(module.id)].map((id) => moduleMap.get(id)!);
        if (module.zone === "neutral")
            assert(reachable.every((item) => item.zone === "neutral"), `Neutral host leak ${module.id}`);
        if (module.zone === "provider")
            assert(reachable.every((item) => item.zone === "neutral" || item.zone === "provider" && item.id.split(".")[1] === module.id.split(".")[1]), `Sibling/host leak ${module.id}`);
        if (module.id === "host.Node")
            assert(reachable.every((item) => item.zone !== "bun-host" && !item.externalImports?.some((name) => name.startsWith("bun:"))), "Node reaches Bun");
        if (module.id === "host.Bun")
            assert(!reachable.some((item) => item.id === "host.Node"), "Bun reaches Node facade");
    }
    const manifests = new Map<string, {
        directory: string;
        manifest: Manifest;
    }>();
    const coreManifest: Manifest = { ...commonManifest, name: design.rootPackage, bin: { "ts-release": "./dist/bin/ts-release.js" }, exports: {}, dependencies: { "effect-build": design.pins["effect-build"]! }, peerDependencies: Object.fromEntries(["effect", "@effect/platform-node", "@effect/platform-bun", "effect-build-apple"].map((name) => [name, design.peerPolicy[name]])), peerDependenciesMeta: { "@effect/platform-node": { optional: true }, "@effect/platform-bun": { optional: true }, "effect-build-apple": { optional: true } } };
    manifests.set("core", { directory: coreDirectory, manifest: coreManifest });
    const workspaceManifest: Manifest = coreDirectory === "." ? coreManifest : {name: "@ts-release-private/workspace", version: design.version, private: true, type: "module", engines: design.engines, dependencies: {}};
    workspaceManifest.packageManager = `bun@${design.pins.bun}`;
    workspaceManifest.workspaces = alternative.id === "T1" ? ["apps/*"] : alternative.id === "T2" ? ["apps/*", "packages/kernel", "packages/providers"] : ["apps/*", "packages/*"];
    workspaceManifest.devDependencies = Object.fromEntries(["effect", "@effect/platform-node", "@effect/platform-bun", "effect-build-apple", "typescript", "bun-types", "@types/semver"].map((name) => [name, design.pins[name]]));
    if (design.effectPatch.required)
        workspaceManifest.patchedDependencies = { [`effect@${design.pins.effect}`]: design.effectPatch.path };
    workspaceManifest.overrides = { "@effect/platform-node-shared": design.pins.effect };
    workspaceManifest.scripts = { build: "bun scripts/build.ts", check: "bun scripts/check.ts", test: "bun test", "build:delivery": "bun scripts/build-delivery.ts" };
    for (const provider of design.providers) {
        const owner = providerPackage(provider.id);
        if (!manifests.has(owner))
            manifests.set(owner, { directory: alternative.id === "T2" ? "packages/providers" : `packages/${packageName(provider.id)}`, manifest: { ...commonManifest, name: alternative.id === "T2" ? design.aggregatePackage : `${design.providerPackagePrefix}${packageName(provider.id)}`, exports: {}, dependencies: {}, peerDependencies: { [design.rootPackage]: design.peerPolicy.kernelPeerRange, effect: design.peerPolicy.effect } } });
        Object.assign(manifests.get(owner)!.manifest.dependencies, provider.dependencies);
    }
    const exportEntries = surfaces.map((surface) => {
        const entry = moduleMap.get(surface.entry)!;
        assert(entry, `Unknown surface entry ${surface.entry}`);
        const pkg = manifests.get(entry.owner)!;
        assert(pkg, `No public owner ${entry.owner}`);
        const name = surface.id.replace(/^core\./, "");
        const providerId = surface.id.startsWith("provider.") ? surface.id.slice(9) : null;
        const providerRoot = providerId !== null && alternative.providerPackaging !== "root" && alternative.providerPackaging !== "aggregate" && !grouped(providerId);
        const subpath = surface.id === "core.root" || providerRoot ? "." : `./${providerId ?? name}`;
        const emitted = `./${relative(resolve(pkg.directory), resolve(entry.path)).replace(/^src\//, "dist/").replace(/\.ts$/, ".js")}`;
        const conditions = { types: emitted.replace(/\.js$/, ".d.ts"), import: emitted };
        assert(!subpath.includes("*") && !emitted.includes("internal/"), `Private export ${subpath}`);
        assert(!(subpath in pkg.manifest.exports!), `Duplicate package export ${pkg.manifest.name}${subpath}`);
        pkg.manifest.exports![subpath] = conditions;
        assert(new Set(surface.symbols.map((symbol) => symbol.name)).size === surface.symbols.length, `Duplicate export in ${surface.id}`);
        for (const symbol of surface.symbols)
            assert(closure(entry.id).has(symbol.module), `Export ${symbol.name} is not owned/reachable from ${surface.id}: ${symbol.module}`);
        return { id: surface.id, package: pkg.manifest.name, subpath, specifier: `${pkg.manifest.name}${subpath === "." ? "" : subpath.slice(1)}`, entryModule: entry.id, source: entry.path, conditions, runtimeNames: surface.symbols.filter((symbol) => declarations.get(symbol.declaration)!.spaces.includes("value")).map((symbol) => symbol.name).sort(), typeNames: surface.symbols.filter((symbol) => declarations.get(symbol.declaration)!.spaces.includes("type")).map((symbol) => symbol.name).sort() };
    });
    assert(manifests.size === alternative.publicPackageCount, `Wrong public count ${alternative.id}`);
    for (const [owner, { manifest }] of manifests) {
        const peers = manifest.peerDependencies as Record<string, string>;
        for (const [name, range] of Object.entries(peers)) {
            if (name !== "effect" && !name.startsWith("@effect/")) continue;
            assert(valid(range) === null && validRange(range) !== null && satisfies(design.pins[name]!, range, { includePrerelease: true }), `Effect peer must be a compatible range: ${manifest.name} ${name} ${range}`);
        }
        if (owner !== "core") {
            assert(!(design.rootPackage in manifest.dependencies), `Provider nests the kernel: ${manifest.name}`);
            assert(peers[design.rootPackage] === design.peerPolicy.kernelPeerRange && valid(peers[design.rootPackage]) === null && satisfies(design.version, peers[design.rootPackage]!), `Invalid kernel peer: ${manifest.name}`);
        }
    }
    if (alternative.providerPackaging === "grouped-by-capability") {
        const catalog = manifests.get("provider.catalog")!.manifest;
        assert(json(Object.keys(catalog.exports!).sort()) === json(["./homebrew", "./scoop"]), "Catalog must expose exactly Homebrew and Scoop subpaths");
        assert(!("semver" in catalog.dependencies), "OpenAI-only semver leaked into catalog");
        assert(manifests.get("provider.openai")!.manifest.dependencies.semver === design.pins.semver, "OpenAI must own its semver dependency");
    }
    const packages = [...manifests].map(([id, item]) => ({ id, directory: item.directory, manifestPath: `${item.directory === "." ? "" : `${item.directory}/`}package.json`, manifest: item.manifest, manifestSha256: hash(json(item.manifest)), manifestLines: lines(json(item.manifest)) }));
    const privateWorkspaces = [...(coreDirectory === "." ? [] : [{id: "workspace", directory: ".", manifestPath: "package.json", manifest: workspaceManifest, manifestSha256: hash(json(workspaceManifest)), manifestLines: lines(json(workspaceManifest))}]), ...(alternative.providerPackaging === "grouped-by-capability" ? ["action", "self-release"] : ["cli", "action", "self-release"]).map((id) => {
        const dependencies: Record<string, string> = { [design.rootPackage]: design.version, effect: design.pins.effect! };
        if (id !== "cli")
            dependencies["@effect/platform-node"] = design.pins["@effect/platform-node"]!;
        if (id === "self-release") {
            dependencies["effect-build"] = design.pins["effect-build"]!;
            dependencies["effect-build-apple"] = design.pins["effect-build-apple"]!;
            for (const pkg of packages.filter((item) => item.id !== "core"))
                dependencies[pkg.manifest.name] = design.version;
        }
        const manifest = { name: `@ts-release-private/${id}`, private: true, type: "module", version: design.version, engines: design.engines, dependencies };
        return { id, directory: `apps/${id}`, manifestPath: `apps/${id}/package.json`, manifest, manifestSha256: hash(json(manifest)), manifestLines: lines(json(manifest)), ...(id === "cli" ? { deliverySource: corePath("src/bin/ts-release.ts"), artifact: corePath("dist/bin/ts-release.js"), ownership: "Stages the core package's shared CLI; no second authored parser or loader." } : id === "action" ? { deliverySource: "apps/action/src/launcher.ts", artifact: "apps/action/dist/launcher.cjs", actionYamlPath: "apps/action/action.yml", actionYaml, actionYamlSha256: hash(actionYaml), actionYamlLines: lines(actionYaml) } : { application: "apps/self-release/src/application.ts" }) };
    })];
    if (alternative.providerPackaging === "grouped-by-capability") {
        const manifest = JSON.parse(await read("apps/ts-release-agents/package.json"));
        privateWorkspaces.push({ id: "ts-release-agents", directory: "apps/ts-release-agents", manifestPath: "apps/ts-release-agents/package.json", manifest, manifestSha256: hash(json(manifest)), manifestLines: lines(json(manifest)) });
    }
    const baseTsconfig = { compilerOptions: { target: "ES2022", lib: ["ES2022", "DOM", "DOM.Iterable", "ESNext.Disposable"], module: "NodeNext", moduleResolution: "NodeNext", strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, skipLibCheck: false, verbatimModuleSyntax: true, declaration: true, declarationMap: false, sourceMap: false, noEmit: true, types: ["bun-types"], paths: {} }, include: [coreDirectory === "." ? "src/**/*.ts" : "packages/**/*.ts", "apps/**/*.ts", "test/**/*.ts", "scripts/**/*.ts"], exclude: ["**/dist", "**/node_modules", ".repos", "tools", "docs"] };
    const configs = [{ path: "tsconfig.json", template: baseTsconfig }, ...packages.map((pkg) => ({ path: `${pkg.directory === "." ? "" : `${pkg.directory}/`}tsconfig.build.json`, template: { extends: pkg.directory === "." ? "./tsconfig.json" : "../../tsconfig.json", compilerOptions: { rootDir: "./src", outDir: "./dist", noEmit: false }, include: ["src/**/*.ts"], exclude: ["src/**/*.test.ts"] } })), { path: "apps/action/tsconfig.json", template: { extends: "../../tsconfig.json", include: ["src/**/*.ts"], exclude: ["dist"] } }, { path: "apps/self-release/tsconfig.build.json", template: { extends: "../../tsconfig.json", compilerOptions: { rootDir: "./src", outDir: "./dist", noEmit: false }, include: ["src/**/*.ts"], exclude: ["src/**/*.test.ts"] } }].map((config) => ({ ...config, sha256: hash(json(config.template)), lines: lines(json(config.template)) }));
    for (const config of configs)
        assert(ts.convertCompilerOptionsFromJson("compilerOptions" in config.template ? config.template.compilerOptions : {}, root).errors.length === 0, `Invalid TypeScript options ${config.path}`);
    const entryByModule = new Map(exportEntries.map((entry) => [entry.entryModule, entry]));
    const sourceEdges = modules.flatMap((module) => [...module.dependencies.map((target) => ({ target, loading: "static" })), ...(module.dynamicDependencies ?? []).map((target) => ({ target, loading: "dynamic-runtime-choice" }))].map(({ target, loading }) => {
        const dependency = moduleMap.get(target)!;
        const publicEntry = entryByModule.get(target);
        assert(module.owner === dependency.owner || publicEntry, `Cross-package private import ${module.id} -> ${target}`);
        return { from: module.id, to: target, loading, specifier: module.owner === dependency.owner ? (() => { const path = relative(dirname(module.path), dependency.path).replace(/\.ts$/, ".js"); return path.startsWith(".") ? path : `./${path}`; })() : publicEntry!.specifier };
    }));
    const packageEdges = [...packages.map((item) => ({ id: item.id, manifest: item.manifest })), ...privateWorkspaces.map((item) => ({ id: `app.${item.id}`, manifest: item.manifest }))].flatMap(({ id, manifest }) => ["dependencies", "peerDependencies", "devDependencies"].flatMap((field) => Object.entries((manifest as Record<string, unknown>)[field] as Record<string, string> ?? {}).map(([to, version]) => ({ from: id, to, version, kind: field, optional: field === "peerDependencies" && Boolean(((manifest as Record<string, unknown>).peerDependenciesMeta as Record<string, {
            optional: boolean;
        }> | undefined)?.[to]?.optional) }))));
    const resolvedSuccessors = [...successorIds].sort().map((id) => {
        const module = moduleMap.get(id);
        const external = design.externalOwners.find((item) => item.id === id);
        assert(module || external, `Unresolved migration successor ${id}`);
        return module ? { id, owner: module.owner, path: module.path } : { id, external: external!.package, version: external!.version };
    });
    const importPolicy = { edgeMeaning: "Exact proposed direct module dependencies, covering value and type imports; implementation does not exist. Actual runtime/type edge classification and transitive installed-package closure must be measured in Plan 009.", sourceEdgesSha256: hash(json(sourceEdges)), packageEdgesSha256: hash(json(packageEdges)), sourceEdges, packageEdges, externalImports: modules.flatMap((module) => (module.externalImports ?? []).map((specifier) => ({ from: module.id, specifier }))), universalDependency: { specifier: "effect", version: design.pins.effect, ownership: "Required peer available to every module; each implementation's exact import list is qualified after emission." }, dynamicApplications: modules.filter((module) => module.dynamicBoundary).map((module) => ({ from: module.id, rule: module.dynamicBoundary })) };
    projection.push({ id: alternative.id, status: alternative.id === design.selection.topology ? "selected-for-implementation" : "retained-alternative", publicPackageCount: packages.length, workspaceRoot: {manifestPath: "package.json", private: coreDirectory !== ".", coreDirectory, rationale: "T2/T3 give the already independent kernel its own package directory; this relocates paths and development metadata without changing public coordinates or semantic dependency mechanisms."}, packages, privateWorkspaces, configs, modules, graph: importPolicy, resolvedSuccessors, metadata: { publicPackageJsonLines: packages.reduce((sum, item) => sum + item.manifestLines, 0), privatePackageJsonLines: privateWorkspaces.reduce((sum, item) => sum + item.manifestLines, 0), actionYamlLines: lines(actionYaml), tsconfigJsonLines: configs.reduce((sum, item) => sum + item.lines, 0), futureScriptFiles: 3, futureScriptLines: null, authoredProductModuleFiles: modules.length, generatedRuntimePolicyFiles: 0, countBoundary: "Exact serialized templates only. Future script bodies have no claimed line measurement. package.json and tsconfig metadata are separate from the old TypeScript product numerator; Action YAML remains separately visible for the original comparable count." } });
    physicalSurfaces.push({ id: alternative.id, entries: exportEntries, exportsSha256: hash(json(exportEntries)) });
}
const used = new Set(surfaces.flatMap((surface) => surface.symbols.map((symbol) => symbol.declaration)));
const publicSurface = { format: "proposed-public-surface/1", status: "actual-kernel-declarations-with-remaining-proposed-surfaces", selection: design.selection, design: { path: designPath, sha256: hash(designText) }, authorityBindings, symbols: [...declarations.values()].filter((item) => used.has(item.id)), logicalSurfaces: surfaces, alternatives: physicalSurfaces, intentionallyPrivateAuthorityExports: [...declarations.values()].filter((item) => !used.has(item.id)).map((item) => ({ id: item.id, reason: item.id === "host:runAction" ? "Private Action adapter, apps/action/src/launcher.ts; only host loading primitives are public." : "Implementation detail, not included in the explicit proposed public API." })), aliasRules: { GitCatalog_nativeHost: "provider:GitCatalog.nativeHost -> makeGitCatalogHost only on core.node and core.bun", providerNamespaces: "The seven source namespaces are unwrapped into direct named package-root exports (or provider subpaths in T1/T2). Namespace wrappers are provenance only.", adoption: "OwnedFile/OwnedTree/OwnedArtifact/OwnedBundle become File/Tree/Artifact/Bundle on core.bundle." }, qualifications: "Declaration hashes bind exact source signatures and private schema bases through whole authority-file hashes. No generated declaration stand-in or unimplemented JavaScript is represented as a consumer-tested package." };
const patchText = await read(design.effectPatch.path);
const patchProofText = await read(design.effectPatch.proof);
const layout = { format: "proposed-package-layout/1", status: "selected-layout-with-retained-alternatives", selection: design.selection, recommendation: design.recommendation, design: { path: designPath, sha256: hash(designText) }, migration: { path: migrationPath, sha256: hash(await read(migrationPath)), expandedSha256: hash(migrationText), successorCount: successorIds.size }, authorityBindings, publicSurfaceSha256: hash(json(publicSurface)), effectPatch: { required: design.effectPatch.required, donorPath: design.effectPatch.path, donorSha256: hash(patchText), proof: {path: design.effectPatch.proof, sha256: hash(patchProofText)}, rationale: design.effectPatch.scope }, alternatives: projection, delivery: { stage: "Plan 009", sourceCompilation: "TypeScript ESM plus declarations from these physical sources, with explicit exports. Bundle only CLI/Action delivery applications; do not ship handwritten shadow dist.", scriptsAndConfigTemplates: "Per-layout exact tsconfig templates are in alternatives[].configs; root manifest contains exact commands.", scriptContracts: [{ path: "scripts/build.ts", task: "Run TypeScript with each selected public package tsconfig.build.json in core-first package-DAG order, then compile apps/self-release. No source path aliases." }, { path: "scripts/check.ts", task: "Build first, run strict root noEmit check, then verify actual emitted exports/import/package graphs against the selected contract." }, { path: "scripts/build-delivery.ts", task: "Stage the core-owned CLI and bundle apps/action/src/launcher.ts as node24 CommonJS apps/action/dist/launcher.cjs; validate dynamic application loading in fresh installed consumers." }], scriptsAndConfigStatus: "Exact configuration templates and script paths/contracts are proposed. Script implementations remain wave work and have no invented line totals.", actionRuntime: "node24", cliRuntimeSelection: "One shared loader runs the fully provided application Effect inside Scope. Application authors select/provide their host layers; CLI does not automatically import platform facades.", generatedRuntimePolicyFiles: 0 }, measuredEvidence: { path: "tools/architecture-lab/topology/results.json", relation: "Smaller identical real machine/provider/host fixture across T1/T2/T3. Its measured installed/runtime/declaration graphs are not the proposed full production graph or its added semver/sigstore/effect-build dependencies." }, invariants: design.invariants, qualification: design.qualification };
for (const [file, value] of [["layout.json", layout], ["public-surface.json", publicSurface]] as const) {
    const path = `${handoff}/${file}`;
    if (process.argv.includes("--write"))
        await writeFile(resolve(root, path), json(value));
    else
        assert(await read(path) === json(value), `${file} differs; run bun tools/architecture-lab/project.ts --write`);
}
console.log(json({ status: process.argv.includes("--write") ? "written-proposal" : "checked-proposal", selectedTopology: (design.selection as {
        topology: unknown;
    }).topology, alternatives: design.alternatives.map((item) => item.id), logicalSurfaces: surfaces.length, publicSymbols: used.size, resolvedSuccessors: successorIds.size, modulesPerAlternative: (projection[0] as {
        modules: unknown[];
    }).modules.length }));
