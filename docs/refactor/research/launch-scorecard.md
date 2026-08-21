# Atomic launch scorecard

Status: sole product-scope authority for the product checkpoint. The census,
roadmap, competitive summary, and research index are projections of this file;
they may not introduce leaves, dispositions, or counts.

Each record has this schema:

```text
ID|family|exact user outcome|owner/status|finite scope|input>finalized output|external oracle[evidence]|representative fixture|dependencies|disposition|maintainer decision|sources
```

The scorecard deliberately counts outcomes, not feature headings. A clean
consumer check is evidence (`C`), never a provider capability, journal event,
or universal `ConsumerScenario`. Likewise, `verify` is not a phase: acceptance,
metadata, bytes, consumer behavior, and continuation remain separate evidence.

Codes:

- `V`: selected proposed vNext acceptance leaf.
- `D`: genuine maintainer decision; the row is a candidate, not selected scope.
- `X`, `L`: deferred maintained package or preserved later outcome. No
  architecture-proof-only row remains in this revision.
- `A`, `M`, `B`, `C`, `J`: provider acceptance, authoritative metadata,
  intended bytes, consumer behavior, and interruption continuation evidence.

Mechanically counted record totals in this revision:

```text
launch candidates=79; selected V=69; unresolved D=10
architecture proofs=0; deferred maintained destinations=7; named later leaves=20
```

The 69 selected rows are mutually exclusive records. `D` rows are not also
represented as proof or later rows; their recommendation belongs only in the
decision table below.

## Owner and implementation-status registry

The compact owner/status field in every row resolves here. "Missing" means
missing from the rewrite, not that no adjacent tool exists.

| Code | Owning boundary | Observed implementation status |
| --- | --- | --- |
| `N*` | `ts-release` npm integration | current/released code exists but is superseded; rewrite missing |
| `W*` | `ts-release` Warehouse integration | current/released behavior is partial; rewrite missing |
| `G*` | `ts-release` GitHub integration | current/released behavior exists; wire-first rewrite missing |
| `MR` | planned `ts-release` MCP Registry integration | protocol researched; production implementation missing |
| `R0` | concrete Homebrew/Scoop renderer package | owner/package name unselected; implementation missing |
| `RG`, `JG` | `ts-release` conditional-Git transport | released generic Git and current GitHub-coupled behavior exist; rewrite missing |
| `CI` | cross-platform acceptance fixture | acceptance workflow missing |
| `A0`, `AC`, `AJ` | consuming application and `ts-release` CLI boundary | clean-consumer/two-process probes only |
| `PD`, `PT`, `PL`, `PC` | external provider package plus `ts-release` durable envelope | research/probe only |
| `BK` | internal extraction-ready immutable handoff kernel in `ts-release` | research probes only |
| `BB` | existing `effect-build-bun` | exact six-cell matrix implemented at pin; coordinated acceptance still missing |
| `BD` | existing `effect-build-deno` | exact six-cell matrix implemented at pin; coordinated acceptance still missing |
| `BS`, `BE` | existing `effect-build-node-sea` and internal `effect-build-esbuild` stage | Linux x64 GNU implemented; broader matrices unsupported at pin |
| `BA`, `BSA` | provisional `effect-build-archives` package | missing; package name is not frozen |
| `BUV`, `BPO` | provisional `effect-build-python` package | missing; one uv frontend is selected, poetry-core is a fixture rather than a second provider |
| `BN`, `BMX` | provisional `effect-build-nfpm` package | missing; nFPM v2.47.0 is the selected external tool |
| `BWX` | provisional `effect-build-windows` package | missing; MSI toolchain decision remains open |
| `BAP` | provisional `effect-build-apple` package | missing; concrete Apple operations only, with durable continuation in `ts-release` |
| `BWS` | provisional `effect-build-windows` signing operation | missing; MSIX mechanics selected, production credential backend unresolved |
| `BGP`, `BCO` | future OpenPGP and Cosign transformations | missing and not selected for launch |
| `BCK` | deterministic bundle checksum projection | missing; may remain internal rather than a separately published package |
| `BSB` | provisional `effect-build-sbom` package | missing; pinned Syft integration selected |
| `BOC` | future concrete OCI producer and provider packages | missing and not selected for launch |
| `TP`, `AP`, `APP` | `ts-release` planning/policy layer | proposed; production implementation missing |
| `validator` | pure OpenAI plugin-package/submission validator | architecture proof missing |
| `external` | independently maintained provider package | explicitly deferred |
| `later` | concrete future owner named by the row | preserved, not launch acceptance |

## Structural prerequisite registry

Dependencies use these stable IDs instead of names such as "bundle" or
"plan". They are architecture prerequisites, not extra product-scope peers.

| ID | Canonical fact or service |
| --- | --- |
| `R01` | finalized immutable bundle with logical artifact identity and content digest |
| `R02` | durable release plan containing versioned provider Intents |
| `R03` | append-if-revision journal and deterministic history fold |
| `R04` | exact source snapshot/tree identity |
| `R05` | effect-build execution boundary that returns finalized outputs |
| `R06` | application-supplied provider resolver composed from ordinary imports and Layers |
| `R07` | externally established package coordinate supplied as immutable input, with no claim that ts-release published it |

```text
K01|K01 release report|Emit one machine-readable finalized release report for downstream automation|BK|one JSON report per plan; finalized artifacts and operations only|bundle+plan+journal>report with logical names,digests,sizes,producer facts,provider coordinates,receipts,observations,status|Schema decode; every projection resolves to canonical bundle/history facts[M,B,J]|multi-provider fixture|R01,R02,R03|V|-|S20,S45,S49
K02|K02 whole-release continuation|Continue an interrupted complete release on a fresh runner without blind mutation|AJ|one persisted plan; npm+Warehouse+GitHub+Git operations; no shared memory|bundle+plan+journal+reacquired credentials>terminal report or typed Pending/Inconclusive/RiskAccepted request|two-process crash injection; per-operation provider oracles; no duplicate remote effect[A,M,B,J]|multi-provider release interrupted at every dispatch boundary|R01,R02,R03,R06,K01|V|-|S16,S17,S20,S45
K03|K03 first-party GitHub Action|Run a non-manual release from a packed first-party GitHub Action, including fresh-runner continuation|CI|github.com Actions; Node action invokes CLI; OIDC/token inputs; immutable bundle handoff|tag/workflow inputs>same K01 report and public release outcomes as CLI|packed action test; OIDC permission assertions; clean-runner continuation; ts-release self-release[A,M,B,C,J]|scratch repository then ts-release self-release|K01,K02,D01-01,D02-01,D03-04|V|-|S03,S07,S45,S49
D01-01|D01 npm|Publish native npm tarball+initial tag to npmjs|N0|npmjs; public scoped or unscoped package; token auth|final .tgz+name/version/tag>immutable version+initial tag|documented success result; packument version/tag; SHA/integrity; clean install/import/bin[A,M,B,C]|library+CLI scratch package|R01,R02|V|-|S01-S04
D01-02|D01 npm|Publish same npm outcome by GHA OIDC with provenance|N1|npmjs OIDC trusted publisher; pub pkg|same as D01-01 + OIDC -> ver/tag/provenance|npm result; registry provenance meta; install[A,M,C]|OIDC fixture pkg|D01-01|V|-|S02-S04
D01-03|D01 npm|Move npm dist-tag after publish|N2|npmjs; pkg/tag/target ver|coordinate + tag + ver -> mut tag binding|ok mutation + packument tag read[A,M]|beta-to-latest fixture|D01-01|V|-|S02
D01-04|D01 npm|Publish three public workspace packages as three independent coordinates|N3|exactly 3 public workspaces|3 finalized tarballs>3 receipts and operation states|per-coordinate registry reads and clean installs[A,M,B,C]|three-package workspace|D01-01|V|-|S01-S04
D01-05|D01 npm|Exclude one package declared private while publishing public siblings|N3|exactly 2 public+1 private workspace; private package has no operation|workspace plan>2 publish operations and 1 structural omission|plan/report contains no private coordinate; registry confirms two public packages[M,C]|three-package workspace|D01-04,K01|V|-|S01,S02
D01-06|D01 npm|Continue after lost npm publish response without blind repeat|NJ|1 scratch coordinate; version and initial-tag facets|DispatchStarted/no receipt>AlreadySatisfied,Conflict,Pending/Inconclusive,or RiskAccepted request|packument observation; absence never fences in-flight PUT[M,J]|fault-injected double then scratch registry|D01-01,D01-03,R03|V|-|S01-S04,S45
D02-01|D02 Python index|Upload sdist+py3-none-any wheel to Warehouse/PyPI|W0|pypi.org legacy upload; exactly 2 files|finalized files>2 immutable file outcomes|HTTP success; Simple hashes; clean pip install/import/console-script[A,M,B,C]|pure-Python project|R01,R02|V|-|S05-S07
D02-02|D02 Python index|Upload Warehouse files by GHA trusted publishing|W1|pypi.org trusted publisher; same 2 files|files + OIDC -> acc uploads|Warehouse result + Simple[A,M,B]|OIDC project fixture|D02-01|V|-|S06,S07
D02-03|D02 Python index|Retain progress for sdist+3 named wheels|WJ|sdist; py3-none-any; cp312-manylinux-x86_64; cp312-macosx_arm64|4 files -> ind acc/conf/unatt state|per-file receipts+Simple reads[A,M,B,J]|failure injected after file 2|D02-01|V|-|S05-S07
D02-04|D02 Python index|Publish one wheel and one sdist to pinned pypiserver|CF|one pinned pypiserver version; upload+Simple-read laws only|2 finalized files>2 server-specific receipts and public files|HTTP result; Simple hashes; clean pip install; no inherited Warehouse duplicate law[A,M,B,C]|local pypiserver fixture|D02-01|V|-|S06,S08
D02-05|D02 Python index|Publish one wheel and one sdist to pinned devpi-server|CF|one pinned devpi-server version; upload+Simple-read laws only|2 finalized files>2 server-specific receipts and public files|HTTP result; Simple hashes; clean pip install; no inherited Warehouse duplicate law[A,M,B,C]|local devpi fixture|D02-01|V|-|S06,S09
D02-06|D02 Python index|Continue each Warehouse file after a lost response on runner 2|CJ|Warehouse exact-duplicate law at pinned source; TestPyPI live fixture|DispatchStarted/no receipt>AlreadySatisfied,Conflict,or Inconclusive/RiskAccepted request|authoritative per-file observation and exact-duplicate evidence; absence is not a fence[M,B,J]|fault-injected local double then disposable TestPyPI namespace|D02-03,R03|V|-|S05-S07,S45
D02-07|D02 Python index|Stop honestly after ambiguous completion on a compatible server without a proven duplicate law|CJ|pypiserver and devpi fixtures; no Warehouse-law inheritance|DispatchStarted/no receipt>provider observation then typed Inconclusive or explicit RiskAccepted request|fresh Simple observation is evidence but absence never authorizes replay[M,B,J]|lost-response case on both local servers|D02-04,D02-05,R03|V|-|S06,S08,S09,S45
D03-01|D03 GitHub|Create or validate a lightweight or annotated tag at a commit|G0|GitHub REST refs/tags; one repository/tag/commit|tag Intent>ref/tag receipt|201 or exact ref/tag observation[A,M,J]|scratch repository/both modes|R02|V|default policy unresolved; recommend lightweight default and annotated explicit|S10,S11
D03-02|D03 GitHub|Create draft GitHub release for tag|G0|1 repository/tag|title/body/draft intent -> rel ID/upload URL|201 receipt + rel read[A,M,J]|scratch draft rel|D03-01|V|-|S10,S11
D03-03|D03 GitHub|Upload zero or three assets with explicit public names|G0|zero-or-infinity cardinality demonstrated by 0 and 3; one request/operation per asset|artifact handle+public name>asset ID,effective name,size,digest when returned|201 receipt; paginated reads; public download digest; executable smoke[A,M,B,C,J]|three portable CLI assets|D03-02,P02-01,P02-02|V|-|S10,S11
D03-04|D03 GitHub|Publish draft after required assets|G0|draft=false update|draft receipt + deps -> pub rel|update receipt + rel read[A,M,J]|same scratch rel|D03-02,D03-03|V|-|S10
D03-05|D03 GitHub|Continue release creation after a lost response|GJ|one scratch repository/tag/release operation|DispatchStarted/no receipt>AlreadySatisfied,Conflict,or Inconclusive/RiskAccepted request|release lookup by durable coordinate; absence cannot fence in-flight create[M,J]|fault injection around release creation|D03-02,R03|V|-|S10,S45
D03-06|D03 GitHub|Continue one asset upload after a lost response without treating absence as a fence|GJ|one scratch release and one independently named asset|DispatchStarted/no receipt>uploaded/starter/conflict/Inconclusive/RiskAccepted request|asset list/read; returned size/digest where available; documented starter cleanup; no blind repeat[M,B,J]|fault injection around asset upload|D03-03,R03|V|-|S11,S45
D04-01|D04 Homebrew Formula|Render Formula for macOS/Linux x64/arm64 archives|R0|one Ruby Formula; exact four platform/architecture entries|release metadata+URLs+bundle digests>Formula file|Ruby parse; brew audit/style; every URL digest binds canonical bundle bytes[M,B]|portable CLI formula|D03-03,P02-01,P02-02,R01|V|renderer package ownership remains a package-layout decision|S12,S13
D04-02|D04 Homebrew Formula|Publish one or two Formula paths by one Git compare-and-swap|RG|tap repository/ref; expected and desired commit IDs|base+files>commit/ref exposing all paths atomically|Git receipt+ref/tree read+clean brew install/test[A,M,B,C,J]|scratch tap with two formulas|D04-01|V|-|S12-S14
D04-03|D04 Homebrew Formula|Continue after lost tap push response|JG|same tap/ref|expected/desired OIDs -> sat/conf/CAS-authorized retry|fresh ref/tree obs[M,B,J]|bare repo then scratch GitHub tap|D04-02|V|-|S14
D05-01|D05 Scoop|Render a Scoop manifest for Windows x64/arm64|R0|one JSON manifest; exact x64 and arm64 selectors|release metadata+URLs+bundle digests>manifest|JSON/schema/selector validation; every URL hash binds canonical bundle bytes[M,B]|portable CLI manifest|D03-03,P02-01,R01|V|-|S15
D05-02|D05 Scoop|Publish one or two manifests by one Git compare-and-swap|RG|bucket repository/ref|base+files>commit/ref exposing all paths atomically|Git receipt+ref/tree read+clean x64 install/run and arm64 selector/hash validation[A,M,B,C,J]|scratch bucket with two manifests|D05-01|V|-|S14,S15
D05-03|D05 Scoop|Continue after lost bucket push response|JG|same bucket/ref|expected/desired OIDs -> sat/conf/CAS retry|fresh ref/tree read[M,B,J]|bare repo then scratch GitHub bucket|D05-02|V|-|S14
D06-01|D06 custom provider|Load an external provider unknown when core and CLI were built|A0|one packed Node ESM provider installed in a clean consumer application|ordinary import+application resolver>definition and operation-local Layers|clean packed consumer import and execution; no allowlist/global registry[M]|external provider package|R06|V|-|S16-S19
D06-02|D06 custom provider|Persist and reload heterogeneous Intent values with a versioned service-free codec|PD|one definition ID+codec version; conceptual Schema.Codec<Intent,Json,never,never>; separately versioned canonical-byte encoder|typed Intent>exact persisted bytes>typed Intent|golden byte vectors, round-trip, nested artifact references, no service requirements[M,J]|custom provider fixture|R01,R02,D06-01|V|production TypeScript names remain API-phase work; the service-free bidirectional law does not|S17,S18
D06-03|D06 custom provider|Prepare without sending, then dispatch through core HTTP or conditional Git|PT|one HTTP fixture+one expected-old/desired-new Git fixture|decoded Intent>immutable prepared request>receipt or durable error|golden request capture; recorded/sent correspondence; Git CAS race[A,M,J]|HTTP server+bare Git repository|D06-02,R03|V|-|S14,S17-S19
D06-04|D06 custom prov|Dispatch opaque Effect with no auto-replay claim|PL|1 write-only custom destination|decoded Intent+credentials -> native receipt/error|prov contract test[A,J]|write-only fixture|D06-02|V|-|S17
D06-05|D06 custom prov|Persist native receipts/observations/errors|PC|1 codec/ver for each value category|native values <-> durable values linked by operation key|round-trip vectors + report projection[A,M,J]|req-status fixture|D06-02|V|-|S17,S18
D06-06|D06 custom provider|Run two instances of one provider against distinct endpoints|AC|exact staging+production instances; destination coordinate in Intent; credentials reacquired; operation-local Layer|2 configs/Intents>distinct operations and clients|captured endpoint/account bindings; no duplicate global service tag[A,M,J]|dual-instance fixture|D06-01,D06-02|V|-|S17,S19
D06-07|D06 custom prov|Continue in process 2; stop Inconclusive when required|AJ|no shared memory; req-status+write-only variants|bundle+plan+journal -> continue/sat/conf/pend/inc|two-process durable-files fixture; no blind second send[M,J]|2 custom provs|D06-02,D06-04,D06-05|V|-|S17
D07-01|D07 MCP Registry|Render and validate one MCP server manifest referencing finalized package coordinates|MR|official server.json schema; exact registry types npm,pypi,oci,nuget,mcpb and transports stdio,streamable-http,sse|release metadata+published coordinates>schema-valid server.json|official schema validation; every referenced package coordinate is explicit[M]|five-package-type fixture with one selected transport each|R01,R07|V|-|S51
D07-02|D07 MCP Registry|Publish the validated manifest to the official MCP Registry|MR|one reverse-DNS server name; GitHub OIDC and token auth fixtures|server.json+auth>registry publication receipt and public version|publisher success; registry API read; clean MCP-client discovery[A,M,C]|scratch MCP server namespace|D07-01,R02,R03|V|-|S51
D07-03|D07 MCP Registry|Continue after a lost MCP Registry publish response without blind repetition|MR|one manifest version and official registry observation law|DispatchStarted/no receipt>AlreadySatisfied,Conflict,or Inconclusive/RiskAccepted request|fresh registry metadata/version observation; absence never fences in-flight publication[M,J]|fault-injected protocol double then scratch namespace|D07-02,R03|V|-|S45,S51
P01-01|P01 executables/prebuilt|Adopt a finalized prebuilt file without rebuilding|BK|one file; logical identity; no private path escape|external file>immutable content+logical artifact|digest/length during copy and load-boundary decode[B,J]|prebuilt CLI|-|V|-|S20
P01-02|P01 executables/prebuilt|Build Bun executables for the six cells shipped by pinned effect-build|BB|macOS x64/arm64; Linux x64 glibc/musl; Linux arm64 glibc; Windows x64|TypeScript entrypoint>6 finalized executables|effect-build provider result; exact matrix assertion; runnable-target --version[B,C]|portable CLI|R05,P01-01|V|-|S21,S22
P01-03|P01 executables/prebuilt|Build Deno executables for the six cells shipped by pinned effect-build|BD|macOS x64/arm64; Linux x64/arm64 glibc; Windows x64/arm64|TypeScript entrypoint>6 finalized executables|effect-build provider result; exact matrix assertion; runnable-target --version[B,C]|same CLI|R05,P01-01|V|-|S21,S23
P01-04|P01 executables/prebuilt|Build the Node SEA target shipped by pinned effect-build|BS|Node 26.7.0; Linux x64 GNU; esbuild 0.28.2 internal bundle stage|TypeScript entrypoint>1 finalized executable|effect-build provider result; SEA inspection; Linux x64 execution[B,C]|same CLI|R05,P01-01|V|-|S21,S24,S25
P02-01|P02 binary archives|Build deterministic ZIP|BA|ZIP only; normalized order/modes/timestamps|artifact handles+layout>.zip|independent listing+repeat digest[B,C]|portable CLI|R01|V|-|S26,S27
P02-02|P02 binary archives|Build deterministic tar.gz|BA|tar.gz only; normalized order/modes/owner/timestamps|artifact handles+layout>.tar.gz|independent listing+repeat digest[B,C]|portable CLI|R01|V|-|S26,S27
P02-03|P02 binary archives|Reject traversal/duplicate/case-collision layouts|BA|P02-01/P02-02 only|candidate layout -> typed rejection|negative fixtures[M]|malicious layout|P02-01,P02-02|V|-|S27
P03-01|P03 source archives|Build a tar.gz source archive from an exact Git tree|BSA|tar.gz; one project-version root prefix; honor export-ignore; preserve Git executable/symlink modes; submodules excluded unless supplied as separate snapshots; LFS pointer bytes remain pointers; exclude .git and build outputs|exact tree+version>source.tar.gz|independent listing; expected tree projection; repeat digest[B]|repository fixture with symlink, executable, export-ignore, submodule, and LFS pointer|R04,P02-02|V|-|S26,S28
P03-02|P03 source archives|Build a ZIP source archive from the same exact Git tree|BSA|ZIP; same tree/projection laws as P03-01, with ZIP mode encoding asserted explicitly|exact tree+version>source.zip|independent listing; expected tree projection; repeat digest[B]|same repository fixture|R04,P02-01|V|-|S26,S28
P04-01|P04 Python builds|Build a wheel and sdist through one pinned uv frontend|BUV|uv 0.12.0; exact uv_build and poetry-core PEP 517 backend fixtures|source snapshot+pyproject+lock>wheel+sdist|metadata inspection and clean install/import for both backends[B,C]|two pure-Python backend fixtures|R04,R05|V|Poetry CLI is not a second domain capability; finalized Poetry outputs remain adoptable|S29,S30
P05-01|P05 system/installers|Build deb with nFPM|BN|nFPM v2.47.0; deb; Linux x64 fixture|CLI+explicit package metadata>package|dpkg-deb inspection+Debian install/remove/run[B,C]|system-package CLI|P01-01|V|-|S31
P05-02|P05 system/installers|Build rpm with nFPM|BN|nFPM v2.47.0; rpm; Linux x64 fixture|CLI+explicit package metadata>package|rpm inspection+Fedora install/remove/run[B,C]|system-package CLI|P01-01|V|-|S31
P05-03|P05 system/installers|Build apk with nFPM|BN|nFPM v2.47.0; apk; Linux x64 fixture|CLI+explicit package metadata>package|apk inspection+Alpine install/remove/run[B,C]|system-package CLI|P01-01|V|-|S31
P05-04|P05 system/installers|Build ipk with nFPM|BN|nFPM v2.47.0; ipk; Linux x64 fixture|CLI+explicit package metadata>package|opkg inspection in pinned OpenWrt image[B,C]|system-package CLI|P01-01|D|Recommend later unless embedded/OpenWrt distribution matters|S31
P05-05|P05 system/installers|Build an Arch package with nFPM|BN|nFPM v2.47.0; Arch; Linux x64 fixture|CLI+explicit package metadata>package|pacman inspection and clean install/remove/run[B,C]|system-package CLI|P01-02|V|-|S31
P05-06|P05 system/installers|Build an unsigned Windows x64 MSIX with nFPM|BMX|nFPM v2.47.0; MSIX; Windows x64|Windows executable+manifest/assets>.msix|nFPM result; MakeAppx unpack/validation; clean install/run[B,C]|Windows CLI|P01-02|V|-|S31,S32
P05-07|P05 system/installers|Build a Windows x64 MSI with a current MSI toolchain|BWX|one of WiX 7 or msitools; exact choice unresolved; no WiX 4 claim|Windows executable+product metadata>.msi|tool validation and silent clean install/uninstall/run[B,C]|Windows CLI|P01-02|D|Recommend later: nFPM MSIX is already in the selected generic integration; WiX 7 adds licensing/fee review|S33
P06-01|P06 mac app|Build arm64+x64 .app bundles|BAP|exact two architecture bundles|executables+plist/resources>2 unsigned .app directories|plutil+launch smoke[B,C]|minimal app|P01-02|V|-|S34
P07-01|P07 DMG|Build arm64+x64 UDZO DMGs|BAP|exact two DMGs|signed apps+layout>2 .dmg files|hdiutil verify/attach/list and clean launch[B,C]|Apple app|P09-01|V|-|S35
P08-01|P08 mac pkg|Build unsigned arm64+x64 macOS pkg installers|BAP|pkgbuild/productbuild; exact 2 packages|signed apps+installer metadata>2 unsigned pkgs|pkgutil payload inspection and clean installer fixture[B,C]|Apple installer|P09-01|V|-|S36
P09-01|P09 signing|Developer ID-sign .app|BAP|Apple app signing|unsigned app+identity/entitlements>signed app|codesign --verify --deep --strict[B]|Apple fixture|P06-01|V|-|S34,S37
P09-02|P09 signing|Developer ID-sign .pkg|BAP|Apple installer signing|unsigned pkg+identity>signed pkg|pkgutil --check-signature[B]|Apple fixture|P08-01|V|-|S36,S37
P09-03|P09 signing|Authenticode-sign an MSIX with SignTool|BWS|Windows x64; local PFX/certificate-store backend; SHA-256; RFC 3161 timestamp; test certificate proves mechanics only|unsigned MSIX+signing identity>signed MSIX|SignTool /pa verification; timestamp assertion; clean install smoke[B,C]|Windows fixture|P05-06|V|production credential backend remains an explicit implementation decision, not a reason to omit mechanics|S38
P09-04|P09 signing|Authenticode-sign an MSI with SignTool|BWS|same policy as P09-03; only if MSI selected|unsigned MSI+signing identity>signed MSI|SignTool /pa verification; timestamp assertion; clean install smoke[B,C]|Windows fixture|P05-07|D|Later with the MSI toolchain decision|S38
P09-05|P09 signing|Create detached OpenPGP signatures|BGP|one .asc per selected file|final file+key>.asc|gpg --verify[B]|archive fixture|R01|D|Later unless existing demand appears|S39
P09-06|P09 signing|Create keyless Cosign blob signatures|BCO|cosign blob; GitHub OIDC|final file+identity policy>Sigstore bundle/signature|cosign verify-blob[B]|archive fixture|R01|D|Later: separate identity, transparency, publication, and verification policy|S40
P10-01|P10 notarization|Submit exact Apple bytes and durably retain the returned submission identity|BAP+AJ|notarytool; one exact input digest/submission|signed artifact+credentials>submission ID or terminal result, then journal event|Apple submission ID/status plus durable journal append[A,J]|crash after ID received and before/after append|P09-01,P09-02,R03|V|if Apple accepts before the ID is recorded, continuation is Inconclusive absent an authoritative correlation API|S41,S45
P10-02|P10 notarization|Resume Apple status polling by recorded submission ID on runner 2|BAP+AJ|second macOS runner; credential reacquisition|journaled submission ID+credentials>accepted,rejected,or pending observation|notarytool info/log recorded as observation[M,J]|fresh-runner fixture|P10-01,R03|V|-|S41,S45
P10-03|P10 notarization|Staple accepted ticket; produce final bytes|BAP|app/DMG/pkg types selected above|acc result+art -> stapled art|stapler validate + final digest[B]|Apple fixture|P10-02|V|-|S41
P10-04|P10 notarization|Verify Gatekeeper before TR adoption|BAP|cur mac spctl|stapled art -> verified final bytes|spctl + codesign/pkgutil[B,C]|Apple fixture|P10-03|V|-|S41
Q01|Trust|Generate and verify SHA256SUMS as a deterministic view of the finalized bundle|BCK|SHA-256 only; sorted public names; no peer digest store|finalized artifact set>checksum file|sha256sum/shasum verification against bundle bytes[B]|portable release|R01|V|-|S42
Q02-01|Trust|Generate an SPDX JSON SBOM with pinned Syft|BSB|Syft v1.50.0; SPDX JSON; exact scan-subject policy|source/final artifact>SPDX JSON|schema validation and component assertions[B]|portable CLI|R01,R04,R05|V|-|S43
Q02-02|Trust|Generate a CycloneDX JSON SBOM with the same pinned Syft integration|BSB|Syft v1.50.0; CycloneDX JSON; same scan-subject policy|source/final artifact>CycloneDX JSON|schema validation and component assertions[B]|same CLI|Q02-01|V|-|S43
Q03|Material choice|Build/push amd64+arm64 OCI index to GHCR|BOC|OCI Image/Distribution specs; GHCR|context+executables>2 manifests+index digest|registry digest+pull/run[A,M,B,C,J]|container CLI/server|P01-02,R03|D|Recommend later; new producer and provider surface|S44
Q05-02|Material choice|Publish a nightly under an explicit version and retention policy|AP|one GitHub nightly policy; exact retention rule|source+artifacts>nightly coordinates and retained history|provider receipts, public reads, clean download/run, continuation[A,M,B,C,J]|portable CLI|D03-04,K02|D|Recommend later; local snapshots already fall out from planning/building without dispatch|S46
Q06-01|Material choice|Derive a SemVer proposal from Conventional Commits|APP|one exact Git range and Conventional Commits 1.0|history+policy>version proposal|golden breaking/feat/fix history preview[M]|release-history fixture|R04|D|Recommend later; accept explicit version first|S47
Q06-02|Material choice|Derive release notes/changelog from Conventional Commits|APP|same exact Git range and one notes template|history+policy>reviewable notes|golden history preview[M]|release-history fixture|R04|D|Recommend later; accept explicit notes first|S47
Q07|Material choice|Produce one macOS universal executable from matching x64 and arm64 inputs|BAP|Mach-O universal2 only|two finalized executables>one universal executable|lipo inspection+execution on supported macOS runners[B,C]|portable CLI|P01-02|D|Recommend later unless a universal download is a launch promise|S21,S34
```

## AI-native launch and finite non-launch rows

```text
AI01|AI native|Construct and validate an installable skills-only OpenAI plugin package|validator|one .codex-plugin manifest plus one skill tree|source directory>finalized plugin directory|official manifest/path rules plus clean local install[M,C]|one deterministic skill plugin|R01|V|-|S48
AI02|AI native|Create or update one repository marketplace entry for that package|R0+RG|one repo-scoped marketplace JSON and one relative plugin source|plugin directory+listing data>validated marketplace file and conditional Git state|official marketplace schema; ref/tree read; clean directory discovery[A,M,C,J]|same plugin in scratch repository|AI01,R03|V|-|S14,S48
AI03|AI native|Produce and validate a complete public-submission handoff without pretending to submit it|validator|skills-only submission; listing assets; starter prompts; 5 positive and 3 negative tests; release notes; policy attestations|package+review material>typed validation report and submission directory|official portal requirements plus local positive/negative tests[M]|same plugin submission directory|AI01,K01|V|portal review and final publication are a human external step, never a provider success|S48
X01|D06|GitLab provider package|external|GitLab|Intent>receipt|contract[A,M,J]|fixture|D06-01,D06-07|X|-|S49
X02|D06|Gitea provider package|external|Gitea|Intent>receipt|contract[A,M,J]|fixture|D06-01,D06-07|X|-|S49
X03|D06|Cloudsmith provider package|external|Cloudsmith|Intent>receipt|contract[A,M,J]|fixture|D06-01,D06-07|X|-|S49
X04|D06|GemFury provider package|external|GemFury|Intent>receipt|contract[A,M,J]|fixture|D06-01,D06-07|X|-|S49
X05|D06|Artifactory provider package|external|Artifactory|Intent>receipt|contract[A,M,J]|fixture|D06-01,D06-07|X|-|S49
X06|D06|Nexus provider package|external|Nexus|Intent>receipt|contract[A,M,J]|fixture|D06-01,D06-07|X|-|S49
X07|destination|Iru provider package|external|Iru macOS library publication protocol at current GoReleaser pin|Intent+finalized Apple artifact>provider receipt|provider contract and scratch account when available[A,M,B,J]|macOS app fixture|D06-01,D06-07,P10-04|X|-|S52
L01|D04|Homebrew Cask render/publish/install|later|Cask|artifacts>cask/ref|audit/install[M,B,C]|app|D03-03|L|-|S12
L02|catalog|Winget render/PR/catalog/install|later|Winget|artifacts>PR|validate/install[M,B,C]|Windows CLI|D03-03|L|-|S50
L03|P05|Source RPM production|later effect-build|SRPM|source>srpm|rpm inspect[B]|source package|P03-01|L|-|S31
L04|npm wrapper|Generate platform wrapper packages that download SCM assets|later effect-build+provider|npm wrapper only; distinct from native D01|release asset coordinates>wrapper tarballs|pack/install/download/run[B,C]|portable CLI|D03-03|L|-|S49
L05|installer|Build makeself installer|later effect-build|Linux x64 makeself|final files>self-extracting installer|unpack/install/run[B,C]|portable CLI|P01-01|L|-|S49
L06|installer|Build NSIS installer|later effect-build|Windows x64 NSIS|final files>.exe installer|silent install/uninstall/run[B,C]|Windows CLI|P01-02|L|-|S49
L07|catalog|Build/publish Snapcraft package|later producer+provider|Snap Store|final files>snap coordinate|store metadata+clean install[A,M,B,C,J]|Linux CLI|P01-01|L|-|S49
L08|catalog|Build/publish Flatpak package|later producer+provider|Flathub-compatible|final files>flatpak coordinate|repository metadata+clean install[A,M,B,C,J]|Linux app|P01-01|L|-|S49
L09|catalog|Build/publish Chocolatey package|later producer+provider|Chocolatey|final files>nupkg coordinate|feed metadata+clean install[A,M,B,C,J]|Windows CLI|P01-02|L|-|S49
L10|catalog|Render/publish AUR package|later renderer+Git|AUR|release inputs>PKGBUILD Git state|namcap+clean makepkg/install[M,B,C,J]|Linux CLI|P02-02|L|-|S49
L11|catalog|Render/publish AUR source package|later renderer+Git|AUR source package|source snapshot>PKGBUILD Git state|namcap+clean makepkg/install[M,B,C,J]|source fixture|P03-01|L|-|S49
L12|catalog|Render/publish NUR/Nix expression|later renderer+Git|NUR/Nixpkgs-compatible|release inputs>Nix expression Git state|nix evaluation/build/run[M,B,C,J]|portable CLI|P02-02|L|-|S49
L13|catalog|Render/publish Krew manifest|later renderer+Git|Krew index|release inputs>manifest Git state|krew validation/install/run[M,B,C,J]|kubectl plugin|P02-02|L|-|S49
L14|catalog|Publish to another AI-native registry protocol|later provider|one future named registry, excluding selected D07|final package>registry coordinate|registry receipt/read/install[A,M,B,C,J]|AI server|D06-01,D06-07|L|-|S49
L15|destination|Publish finalized bytes to one blob/HTTP destination|later provider package|one explicitly selected service/protocol, not a universal uploader|final bytes>remote object coordinate|service receipt+digest read[A,M,B,J]|portable asset|D06-01,D06-07|L|-|S49
L16|metadata|Update Docker Hub repository description|later provider|one Docker Hub repository|rendered README>public description|provider receipt+public read[A,M]|OCI fixture|Q03|L|-|S49
L17|policy|Generate AI-assisted release notes|later policy integration|one named model/provider and review flow|commits+prompt>reviewed notes|golden cases+human approval[M]|release history|Q06-02|L|-|S49
L18|producer|Add Go, Rust, and Zig compiler integrations|later effect-build|one concrete package/toolchain per language|source snapshot>final executable matrix|toolchain result+cross-platform run[B,C]|three CLIs|P01-01|L|-|S49
L19|producer|Add UPX and verifiable-Go transformations|later effect-build|two separately implemented transformations|final inputs>transformed bytes|tool-specific validation+run[B,C]|portable CLI|P01-01|L|-|S49
L20|planning policy|Scope independent projects inside one monorepo|later ts-release policy|directory/tag/changelog filters for two independent releases; not a coordinated-release mode|repository+explicit project definitions>two ordinary plans|plan/report inspection; each plan retains ordinary provider laws[M,J]|two-project monorepo|R02,K01|L|-|S45,S49
```

## Explicit census-only dispositions

These stable IDs let each GoReleaser source case resolve to exactly one
non-launch disposition without inventing another product leaf.

| ID | Class | Finite meaning |
| --- | --- | --- |
| `ADJ01` | adjacent composition | announcement delivery belongs to ordinary user Effects/provider packages after a release result |
| `ADJ02` | adjacent composition | CI-host setup is a recipe/fixture, not a release-domain provider |
| `ADJ03` | adjacent composition | GitHub Actions attestations consume finalized outputs outside the release kernel |
| `ADJ04` | adjacent composition | project-management mutations such as closing milestones are separate integrations |
| `ADJ05` | adjacent composition | non-vNext compiler/build ecosystems compose through finalized prebuilt adoption |
| `M01` | mechanism/taxonomy | root schema, configuration index, and product name |
| `M02` | mechanism/taxonomy | metadata defaults, output folder, and artifact-manifest presentation |
| `M03` | mechanism/taxonomy | named pipeline phase, builder selector, or single-target execution |
| `M04` | mechanism/taxonomy | templates, includes, environment interpolation, and template variables |
| `M05` | mechanism/taxonomy | hooks and user-defined transformations; ordinary Effect composition is the mechanism |
| `M06` | mechanism/taxonomy | retry, split/merge, staged command, or conditional filtering mechanisms |
| `M07` | mechanism/taxonomy | artifact size/reporting and generated-manifest presentation |
| `M08` | mechanism/taxonomy | `verify` heading decomposed into the row's A/M/B/C evidence rather than copied as an API |
| `M09` | mechanism/taxonomy | CI integration index or example workflow |
| `M10` | mechanism/taxonomy | GoReleaser Pro licensing mechanics, not a ts-release product outcome |
| `M11` | mechanism/taxonomy | opt-in/out product telemetry and its privacy policy, not a release artifact/provider outcome |
| `M12` | mechanism/taxonomy | broad provider, signing, SCM-release, package, or archive family heading; atomic children carry product scope |
| `M13` | mechanism/taxonomy | local snapshot is ordinary plan/build composition with dispatch omitted, not a named release mode |
| `M14` | mechanism/taxonomy | cross-publish credential/routing selection, not another publication outcome |
| `E01` | intentional exclusion | offline/fallback GoReleaser Pro licence-key behavior |
| `E02` | intentional exclusion | PR-template checkboxes as release correctness or product capability |
| `E03` | intentional exclusion | deprecated GoReleaser Docker image/manifest pipelines; current OCI work is represented only by `Q03` |
| `E04` | intentional exclusion | deprecated legacy Podman image/manifest pipeline |

## Source registry

The registry was refreshed on 2026-08-21. Official documentation establishes
tool/protocol capability, not ts-release implementation. Repository claims are
commit-pinned where the source itself matters.

| ID | Primary evidence |
| --- | --- |
| `S01` | [current ts-release npm source](https://github.com/mannyc2/ts-release/tree/d57e7e91b58683d030201d278eb96cd5acd05a21) and [v0.0.7](https://github.com/mannyc2/ts-release/tree/af59436cff908fb52773cf18dd95d154f892b8de) |
| `S02` | [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/) and [dist-tags](https://docs.npmjs.com/adding-dist-tags-to-packages/) |
| `S03` | [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) |
| `S04` | [npm registry/package semantics](https://docs.npmjs.com/about-the-public-npm-registry/) |
| `S05` | [Warehouse source](https://github.com/pypi/warehouse) and [file-upload protocol implementation](https://github.com/pypi/warehouse/tree/main/warehouse/forklift) |
| `S06` | [Python Simple Repository API](https://packaging.python.org/en/latest/specifications/simple-repository-api/) |
| `S07` | [PyPI trusted publishers](https://docs.pypi.org/trusted-publishers/) |
| `S08` | [pypiserver source](https://github.com/pypiserver/pypiserver) |
| `S09` | [devpi server documentation](https://devpi.net/docs/devpi/devpi/stable/%2Bd/index.html) |
| `S10` | [GitHub release REST API](https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28) |
| `S11` | [GitHub release-asset REST API](https://docs.github.com/en/rest/releases/assets?apiVersion=2022-11-28) |
| `S12` | [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook) |
| `S13` | [Homebrew package validation and installation](https://docs.brew.sh/Adding-Software-to-Homebrew) |
| `S14` | [Git push and `--force-with-lease`](https://git-scm.com/docs/git-push) |
| `S15` | [Scoop manifest documentation](https://github.com/ScoopInstaller/Scoop/wiki/App-Manifests) and [pinned client source](https://github.com/ScoopInstaller/Scoop/tree/b588a06e41d920d2123ec70aee682bae14935939) |
| `S16` | [PR #20 custom-provider clean-consumer probe](https://github.com/mannyc2/ts-release/tree/2fbb58c3dadb874a528d37530603aa8b396f30c5/docs/refactor/research/probes/custom-provider-clean-consumer) |
| `S17` | [Effect Context and Layer source at 4.0.0-rc.108](https://github.com/Effect-TS/effect/tree/bef7bf38ae4b73d5511043f707aed083de5da7cc/packages/effect/src) |
| `S18` | [Effect Schema/Codec source at 4.0.0-rc.108](https://github.com/Effect-TS/effect/blob/bef7bf38ae4b73d5511043f707aed083de5da7cc/packages/effect/src/Schema.ts) |
| `S19` | [Node package and ESM loading](https://nodejs.org/api/packages.html) |
| `S20` | [PR #20 artifact probes](https://github.com/mannyc2/ts-release/tree/2fbb58c3dadb874a528d37530603aa8b396f30c5/docs/refactor/research/probes/artifact-candidates) |
| `S21` | [requested effect-build research branch at `15c811bb`](https://github.com/mannyc2/effect-build/tree/15c811bb9904142a33d119766b62082f3c689f13) and its [exact support matrix](https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/tooling/support-matrix.json) |
| `S22` | [Bun standalone executables and target matrix](https://bun.com/docs/bundler/executables) |
| `S23` | [Deno compile and target matrix](https://docs.deno.com/runtime/reference/cli/compile/) |
| `S24` | [Node single-executable applications](https://nodejs.org/api/single-executable-applications.html) |
| `S25` | [esbuild build API](https://esbuild.github.io/api/#build-api) |
| `S26` | [Go archive/zip](https://pkg.go.dev/archive/zip) and [archive/tar](https://pkg.go.dev/archive/tar) references |
| `S27` | [OCI layer path/duplicate requirements](https://github.com/opencontainers/image-spec/blob/main/layer.md) used as an external archive-safety comparator |
| `S28` | [Git tree object format](https://git-scm.com/docs/gitformat-pack) and [git archive](https://git-scm.com/docs/git-archive) |
| `S29` | [uv build semantics](https://docs.astral.sh/uv/concepts/projects/build/) and [uv 0.12.0 source pin](https://github.com/astral-sh/uv/tree/b88d7c5c46cbe3c9896544f10255f85a8f0a8a5e) |
| `S30` | [Poetry/poetry-core build semantics](https://python-poetry.org/docs/cli/#build) and [Poetry 2.4.1 source pin](https://github.com/python-poetry/poetry/tree/811a12dae0fe81f199e3f1b88b8b8be9eed543c2) |
| `S31` | [nFPM v2.47.0 at `40c7c8f`](https://github.com/goreleaser/nfpm/tree/40c7c8f7376400e9464d04a2a099045cf5598f8e) and [supported packagers](https://nfpm.goreleaser.com/docs/configuration/) |
| `S32` | [Microsoft MakeAppx](https://learn.microsoft.com/en-us/windows/msix/package/create-app-package-with-makeappx-tool) |
| `S33` | [WiX 7 at `b8977d6f`](https://github.com/wixtoolset/wix/tree/b8977d6f88e7b68e000bac226a2814f236770570), [current WiX packaging/licensing](https://docs.firegiant.com/wix/whatsnew/), and [msitools](https://gitlab.gnome.org/GNOME/msitools) |
| `S34` | [Apple distribution-signed code](https://developer.apple.com/documentation/xcode/creating-distribution-signed-code-for-the-mac) |
| `S35` | [Apple disk-image command reference](https://keith.github.io/xcode-man-pages/hdiutil.1.html) |
| `S36` | [Apple productbuild](https://keith.github.io/xcode-man-pages/productbuild.1.html) and [pkgbuild](https://keith.github.io/xcode-man-pages/pkgbuild.1.html) |
| `S37` | [Apple codesign](https://keith.github.io/xcode-man-pages/codesign.1.html) |
| `S38` | [Microsoft SignTool](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool) |
| `S39` | [GnuPG detached signatures](https://www.gnupg.org/gph/en/manual/x135.html) |
| `S40` | [Sigstore blob signing](https://docs.sigstore.dev/cosign/signing/signing_with_blobs/) |
| `S41` | [Apple notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow) |
| `S42` | [GNU Coreutils checksum output](https://www.gnu.org/software/coreutils/manual/html_node/sha2-utilities.html) |
| `S43` | [SPDX specifications](https://spdx.dev/use/specifications/), [CycloneDX specification](https://cyclonedx.org/specification/overview/), and [Syft v1.50.0 at `16223e6d`](https://github.com/anchore/syft/tree/16223e6dd7893fe578787658ceb876257483d404) |
| `S44` | [OCI Image and Distribution specifications](https://github.com/opencontainers/image-spec/blob/main/spec.md) |
| `S45` | [PR #20 resumability research](https://github.com/mannyc2/ts-release/blob/2fbb58c3dadb874a528d37530603aa8b396f30c5/docs/refactor/research/resumability.md) |
| `S46` | [GoReleaser snapshot semantics](https://goreleaser.com/customization/publish/snapshots/) |
| `S47` | [Semantic Versioning](https://semver.org/) and [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) |
| `S48` | [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins) and [submission requirements](https://developers.openai.com/plugins/deploy/submission) |
| `S49` | [current GoReleaser source at audit pin `97002309`](https://github.com/goreleaser/goreleaser/tree/97002309efe9b11cee15426c940a42c44a9f55b2), [preserved evidence pin `92453c1d`](https://github.com/goreleaser/goreleaser/tree/92453c1dbdf592d227cb236600093a503f2351f3), and [151-case historical index](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md) |
| `S50` | [GoReleaser Winget documentation](https://goreleaser.com/customization/publish/winget/) and [Microsoft manifest validation](https://learn.microsoft.com/en-us/windows/package-manager/package/manifest) |
| `S51` | [official MCP Registry source/protocol](https://github.com/modelcontextprotocol/registry) and [GoReleaser MCP publication flow](https://goreleaser.com/customization/publish/mcp/) |
| `S52` | [GoReleaser Iru publication flow](https://goreleaser.com/customization/publish/iru/) at current audit pin; this is a post-151 delta, not part of the historical denominator |

## Maintainer decisions

Selections already made in this checkpoint are not repeated as questions:
prebuilt adoption, the pinned Bun/Deno/Node SEA matrices, ZIP/tar.gz and source
archives, one uv frontend with two PEP 517 backend fixtures, deb/rpm/apk/Arch/
MSIX, Apple packaging/signing/notarization, MSIX Authenticode mechanics,
SHA256SUMS, SPDX JSON, and CycloneDX JSON are proposed vNext leaves.

The remaining ten `D` leaves reduce to nine decisions. Recommendations are
evidence-based defaults, not silent maintainer choices.

| Decision | Candidate leaves | Product value | Cost/risk | Recommendation |
| --- | --- | --- | --- | --- |
| `DEC01` embedded/OpenWrt package | `P05-04` | reaches `opkg` consumers | another installer oracle and niche support surface | later unless a named user needs ipk |
| `DEC02` MSI toolchain | `P05-07`, `P09-04` | conventional enterprise Windows installer plus signing | nFPM does not produce MSI; WiX 7 has a new licence/fee decision; msitools is another toolchain | ship selected MSIX first; decide MSI after legal/tooling review |
| `DEC03` detached OpenPGP | `P09-05` | conventional detached signatures | key custody and verification policy distinct from platform signing | later absent demand |
| `DEC04` keyless Cosign blobs | `P09-06` | identity and transparency evidence | OIDC, transparency log, bundle publication, and verifier policy create a separate domain | later; do not hide it behind generic signing |
| `DEC05` OCI/GHCR | `Q03` | large GoReleaser parity outcome and container-native delivery | new producer, registry provider, multi-platform index, credentials, and replay laws | later unless a launch user needs containers |
| `DEC06` nightlies | `Q05-02` | continuous downloadable builds | mutable retention/version policy and repeated publication | later; local snapshots already fall out from no-dispatch composition |
| `DEC07` derived version | `Q06-01` | less manual release policy | conventional-commit interpretation and override UX | accept explicit version first; derive later |
| `DEC08` derived notes | `Q06-02` | less manual changelog work | policy/template review; independent of version calculation | accept explicit notes first; derive later |
| `DEC09` universal macOS executable | `Q07` | one macOS download instead of two | extra transformation/signing order and size; current effect-build matrix already provides both thin binaries | later unless one universal download is promised |

## Current GoReleaser delta beyond the 151-case denominator

The 151-row census is an exact historical index pinned at `1e9efd7`; it is not
advertised as an exhaustive list of current GoReleaser. The 2026-08-21 current
index adds or materially changes at least these outcomes:

| Current item | Scorecard disposition |
| --- | --- |
| MCP Registry publication | selected `D07-01` through `D07-03` |
| Iru macOS library publication | deferred maintained provider `X07` |
| telemetry | mechanism/operations policy, not a release-domain outcome (`M11`) |
| Homebrew casks replace deprecated formula publication in current GoReleaser docs | casks remain `L01`; ts-release `D04` Formula support is retained because it is released product behavior and a deliberate product outcome, not because current GoReleaser recommends it |
