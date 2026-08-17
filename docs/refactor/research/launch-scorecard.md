# Atomic launch scorecard

Sole product-scope authority. Row schema:
`ID|family|outcome|owner/status|finite scope|input>output|oracle[evidence]|fixture|deps|disp|decision|sources`.

Codes: `V` proposed vNext; `D` maintainer decision; `P/X/L` proof/deferred/later; evidence `A/M/B/C/J`. Owner/status codes are defined by the source-linked integration named in each row.

```text
candidate=69; V=49; D=20; P=3; X=6; L=3
```

`D` rows are alternatives, not selected scope.

```text
D01-01|D01 npm|Publish native npm tarball+initial tag to npmjs|N0|npmjs; pub/scoped pkg; token auth|fin .tgz + name/ver/tag -> imm ver + initial tag|ok publisher result; packument ver/tag; SHA/integrity; install/import/bin[A,M,B,C]|library+CLI scratch pkg|bundle,plan|V|-|S01-S04
D01-02|D01 npm|Publish same npm outcome by GHA OIDC with provenance|N1|npmjs OIDC trusted publisher; pub pkg|same as D01-01 + OIDC -> ver/tag/provenance|npm result; registry provenance meta; install[A,M,C]|OIDC fixture pkg|D01-01|V|-|S02-S04
D01-03|D01 npm|Move npm dist-tag after publish|N2|npmjs; pkg/tag/target ver|coordinate + tag + ver -> mut tag binding|ok mutation + packument tag read[A,M]|beta-to-latest fixture|D01-01|V|-|S02
D01-04|D01 npm|Publish 3 workspace packages; omit 1 private|N3|3 pub + 1 private pkg; ind coordinates|3 fin tarballs -> 3 receipts/states|per-coordinate registry reads+clean consumers[A,M,B,C]|four-pkg workspace|D01-01|V|-|S01-S04
D01-05|D01 npm|Continue after lost npm publish response without blind repeat|NJ|1 scratch coordinate; ver+initial tag facets|DS/no receipt -> sat, conf, pend/inc, or RA-required|packument obs; absence never fences in-flight PUT[M,J]|fault-injected double then scratch registry|D01-01,D01-03|V|-|S01-S04
D02-01|D02 Python index|Upload sdist+py3-none-any wheel to Warehouse/PyPI|W0|pypi.org legacy upload; x 2 files|fin files -> 2 imm file outcomes|HTTP success; Simple hashes; clean pip install/import/console-script[A,M,B,C]|pure-Python project|bundle,plan|V|-|S05-S07
D02-02|D02 Python index|Upload Warehouse files by GHA trusted publishing|W1|pypi.org trusted publisher; same 2 files|files + OIDC -> acc uploads|Warehouse result + Simple[A,M,B]|OIDC project fixture|D02-01|V|-|S06,S07
D02-03|D02 Python index|Retain progress for sdist+3 named wheels|WJ|sdist; py3-none-any; cp312-manylinux-x86_64; cp312-macosx_arm64|4 files -> ind acc/conf/unatt state|per-file receipts+Simple reads[A,M,B,J]|failure injected after file 2|D02-01|V|-|S05-S07
D02-04|D02 Python index|Exercise live Warehouse behavior on TestPyPI|CI|test.pypi.org; exact D02-03 files|files -> live receipts/pub meta|TestPyPI upload, Simple, clean pip install[A,M,B,C,J]|disposable project namespace|D02-03|V|-|S06,S07
D02-05|D02 Python index|Publish/read/install on pinned pypiserver+devpi|CF|exact 2 implementations; Twine upload + Simple only|1 wheel+sdist per server -> server-specific receipts/reads|HTTP result, /simple hashes, install; no inherited Warehouse duplicate law[A,M,B,C]|2 local server fixtures|D02-01|V|-|S08,S09
D02-06|D02 Python index|Continue each file after lost response on runner2|CJ|Warehouse exact-duplicate law only; compatible servers use proven local law or stop Inconclusive|DS/no receipt -> sat/conf/inc/RA-required|authoritative file obs; absence is not a fence[M,B,J]|fault case for all 3 profiles|D02-03,D02-05|V|-|S05,S08,S09
D03-01|D03 GitHub|Create/validate lightweight or annotated tag at commit|G0|GitHub REST refs/tags; 1 repo/tag/commit|tag intent -> ref/tag receipt|201 or exact ref/tag obs[A,M,J]|scratch repo/both modes|plan|V|default policy undecided; recommend lightweight default, annotated explicit|S10,S11
D03-02|D03 GitHub|Create draft GitHub release for tag|G0|1 repository/tag|title/body/draft intent -> rel ID/upload URL|201 receipt + rel read[A,M,J]|scratch draft rel|D03-01|V|-|S10,S11
D03-03|D03 GitHub|Upload 0 or 3 assets with explicit public names|G0|0+3 asset fixtures; 1 req per asset|art handle/name -> asset ID/effective name/size/digest when returned|201 receipt; paginated asset reads; bundle digest comparison[A,M,B,J]|3 portable CLI assets|D03-02,P01/P02|V|-|S10,S11
D03-04|D03 GitHub|Publish draft after required assets|G0|draft=false update|draft receipt + deps -> pub rel|update receipt + rel read[A,M,J]|same scratch rel|D03-02,D03-03|V|-|S10
D03-05|D03 GitHub|Continue after lost release/asset response|GJ|scratch repo; separate rel/asset operations|DS/no receipt -> sat/conf/starter failure/inc|tag/rel/asset obs; absent asset cannot fence in-flight upload[M,B,J]|fault injection around both reqs|D03-02,D03-03|V|-|S10,S11
D03-06|D03 GitHub|Download asset, compare SHA-256, run --version|CI|linux x64 pub asset|pub coordinate -> verified bytes+process output|pub download digest + exit/output[B,C]|portable CLI|D03-03,P01|V|-|S10
D04-01|D04 Homebrew Formula|Render Formula for mac/linux x64/arm64 archives|R0|1 Ruby Formula; x 4 platform/arch entries|rel meta+URLs/digests -> Formula file|Ruby parse; brew audit/style[M,B]|portable CLI formula|D03-03,P02,Q01|V|renderer pkg ownership remains API/pkg decision|S12,S13
D04-02|D04 Homebrew Formula|Publish 1/2 Formula paths by one Git CAS|RG|tap repo/ref; expected+desired commits|base+files -> commit/ref exposing paths atomically|Git receipt + ref/tree read[A,M,B,J]|scratch tap/2 formulas|D04-01|V|-|S14
D04-03|D04 Homebrew Formula|Continue after lost tap push response|JG|same tap/ref|expected/desired OIDs -> sat/conf/CAS-authorized retry|fresh ref/tree obs[M,B,J]|bare repo then scratch GitHub tap|D04-02|V|-|S14
D04-04|D04 Homebrew Formula|Install Formula on clean mac arm64 and run CLI|CI|stable Homebrew, mac arm64|pub Formula -> installed exe|brew install/test + ver output[C]|GHA mac fixture|D04-02|V|-|S12
D05-01|D05 Scoop|Render Scoop manifest for Win x64/arm64|R0|1 JSON manifest; x x64+arm64|rel meta+URLs/digests -> manifest|JSON/schema/selector validation[M,B]|portable CLI manifest|D03-03,P02,Q01|V|-|S15
D05-02|D05 Scoop|Publish 1/2 manifests by one Git CAS|RG|bucket repo/ref|base+files -> commit/ref exposing paths atomically|Git receipt + ref/tree read[A,M,B,J]|scratch bucket/2 manifests|D05-01|V|-|S14,S15
D05-03|D05 Scoop|Continue after lost bucket push response|JG|same bucket/ref|expected/desired OIDs -> sat/conf/CAS retry|fresh ref/tree read[M,B,J]|bare repo then scratch GitHub bucket|D05-02|V|-|S14
D05-04|D05 Scoop|Install Win x64; validate arm64 selector+bytes|CI|Scoop cur; windows-latest x64; arm64 contract-only|pub manifest -> x64 installed CLI + arm64 selected URL/hash|scoop install/run; arm64 selector/digest[B,C]|Win fixture|D05-02|V|-|S15
D06-01|D06 custom prov|Load external provider unknown to built core/CLI|A0|Node ESM pkg installed in consumer project|pkg import -> definition+Layers|clean packed consumer dynamic import[M]|external prov pkg|dynamic TypeScript CLI|V|-|S16-S19
D06-02|D06 custom prov|Persist/reload heterogeneous Intent with versioned codec|PD|1 definition ID + 1 codec ver; canonical JSON-compatible encoding; no codec service requirements|typed Intent <-> encoded Intent|golden round-trip+nested art refs[M,J]|custom prov fixture|bundle,plan,D06-01|V|exact Effect Schema spelling deferred to API phase|S17,S18
D06-03|D06 custom prov|Prepare without send; dispatch by core HTTP/Git|PT|1 HTTP fixture+1 expected-old/desired-new Git fixture|decoded Intent -> imm prepared req -> receipt/error|golden req capture; transport correspondence; Git CAS race[A,M,J]|HTTP server + bare Git repo|D06-02|V|-|S14,S17-S19
D06-04|D06 custom prov|Dispatch opaque Effect with no auto-replay claim|PL|1 write-only custom destination|decoded Intent+credentials -> native receipt/error|prov contract test[A,J]|write-only fixture|D06-02|V|-|S17
D06-05|D06 custom prov|Persist native receipts/observations/errors|PC|1 codec/ver for each value category|native values <-> durable values linked by operation key|round-trip vectors + report projection[A,M,J]|req-status fixture|D06-02|V|-|S17,S18
D06-06|D06 custom prov|Run 2 instances of same provider at distinct endpoints|AC|exact staging+production instances|2 configs/Intents -> distinct operations/clients|captured endpoint/account bindings[A,M,J]|dual-instance fixture|D06-01,D06-02|V|-|S17,S19
D06-07|D06 custom prov|Continue in process 2; stop Inconclusive when required|AJ|no shared memory; req-status+write-only variants|bundle+plan+journal -> continue/sat/conf/pend/inc|two-process durable-files fixture; no blind second send[M,J]|2 custom provs|D06-02,D06-04,D06-05|V|-|S17
P01-01|P01 exes/prebuilt|Adopt finalized prebuilt file without rebuilding|BK|1 file; logical ID; no private path escape|external file -> imm content + logical art|digest/length during copy; reload[B,J]|prebuilt CLI|bundle|V|-|S20
P01-02|P01 exes/prebuilt|Build Bun executables for 5 named targets|BB|exact 5 targets|TS entrypoint -> 5 exe files|prov validation + runnable-target --ver[B,C]|portable CLI|effect-build,P01-01|D|Recommend V; strongest current evidence|S21,S22
P01-03|P01 exes/prebuilt|Build Deno executables for 4 named targets|BD|exact 4 Deno targets|TS entrypoint -> 4 exes|deno compile + runnable-target smoke[B,C]|same CLI|effect-build,P01-01|D|Recommend proof unless runtime breadth strategic|S21,S23
P01-04|P01 exes/prebuilt|Build host Node SEA on linux/mac/Win|BS|exact 3 host builds; no cross-compile claim|bundled SEA entrypoint -> 3 exes|SEA inject/sign checks + smoke[B,C]|same CLI on 3 runners|effect-build,P01-01|D|Recommend proof; higher platform complexity|S21,S24
P01-05|P01 exes/prebuilt|Build Node-20 ESM bundle with esbuild|BE|1 platform-neutral .mjs|TS entrypoint -> .mjs|esbuild result + node execution[B,C]|JS fixture|effect-build,P01-01|D|Recommend proof; JS bundle is not executable target|S21,S25
P02-01|P02 binary archives|Build deterministic ZIP|BA|ZIP only; normalized order/modes/timestamps|art handles+layout -> .zip|ind listing + repeat digest[B,C]|portable CLI|P01|V|-|S26,S27
P02-02|P02 binary archives|Build deterministic tar.gz|BA|tar.gz only; normalized order/modes/owner/timestamps|art handles+layout -> .tar.gz|ind listing + repeat digest[B,C]|portable CLI|P01|V|-|S26,S27
P02-03|P02 binary archives|Reject traversal/duplicate/case-collision layouts|BA|P02-01/P02-02 only|candidate layout -> typed rejection|negative fixtures[M]|malicious layout|P02-01,P02-02|V|-|S27
P03-01|P03 source archives|Build tar.gz source archive from exact Git tree|BSA|tar.gz; explicit include/exclude; no VCS/build outputs|exact snapshot -> source tar.gz|listing, tree binding, repeat digest[B]|repo fixture|snapshot,P02-02|V|-|S26,S28
P03-02|P03 source archives|Build ZIP source archive from exact Git tree|BSA|ZIP; same rules|exact snapshot -> source zip|listing + repeat digest[B]|same fixture|snapshot,P02-01|D|Recommend later unless source ZIP needed|S26,S28
P04-01|P04 Python builds|Build sdist+wheel with uv|BUV|pinned uv; pure-Python PEP 517 project|snapshot+pyproject/lock -> .tar.gz+.whl|meta inspection + install/import[B,C]|pure-Python fixture|effect-build|D|Recommend V|S29
P04-02|P04 Python builds|Build sdist+wheel with poetry-core|BPO|pinned poetry-core; no publish operation|snapshot+pyproject/lock -> .tar.gz+.whl|meta inspection + install/import[B,C]|second backend fixture|effect-build|D|Recommend proof; prebuilt already accepts Poetry outputs|S30
P05-01|P05 system/installers|Build deb with nFPM|BN|nFPM 8428c3; deb; linux x64 fixture|CLI+explicit pkg meta -> pkg|dpkg-deb inspect + Debian install/remove[B,C]|system-pkg CLI|P01|V|-|S31
P05-02|P05 system/installers|Build rpm with nFPM|BN|nFPM 8428c3; rpm; linux x64 fixture|CLI+explicit pkg meta -> pkg|rpm inspect + Fedora install/remove[B,C]|system-pkg CLI|P01|V|-|S31
P05-03|P05 system/installers|Build apk with nFPM|BN|nFPM 8428c3; apk; linux x64 fixture|CLI+explicit pkg meta -> pkg|apk inspect + Alpine install/remove[B,C]|system-pkg CLI|P01|V|-|S31
P05-04|P05 system/installers|Build ipk with nFPM|BN|nFPM 8428c3; ipk; linux x64 fixture|CLI+explicit pkg meta -> pkg|opkg inspection in pinned OpenWrt image[B,C]|system-pkg CLI|P01|D|Recommend later unless embedded market|S31
P05-05|P05 system/installers|Build Arch package with nFPM|BN|nFPM 8428c3; Arch pkg; linux x64 fixture|CLI+explicit pkg meta -> pkg|pacman inspect/install in Arch container[B,C]|system-pkg CLI|P01|D|Recommend later unless Arch strategic|S31
P05-06|P05 system/installers|Build unsigned Win x64 MSIX|BMX|MSIX only|Win exe+manifest/assets -> .msix|MakeAppx unpack/validate + install when runner permits[B,C]|Win CLI|P01|D|Research nFPM/MSIX; recommend proof|S32
P05-07|P05 system/installers|Build Win x64 MSI with WiX 4|BWX|WiX 4 MSI only|Win exe+product meta -> .msi|WiX validation + silent install/uninstall[B,C]|Win CLI|P01|D|Recommend V only if Win installer promised|S33
P06-01|P06 mac app|Build arm64+x64 .app bundles|BAP|exact 2 arch bundles|exes+plist/resources -> 2 unsigned .app dirs|plutil + launch smoke[B,C]|minimal app|P01|V|-|S34
P07-01|P07 DMG|Build arm64+x64 UDZO DMGs|BAP|exact 2 DMGs|signed apps+layout -> 2 .dmg|hdiutil verify/attach/list[B,C]|Apple app|P06,P09|V|-|S35
P08-01|P08 mac pkg|Build arm64+x64 mac pkg installers|BAP|pkgbuild/productbuild; exact 2 pkgs|signed apps+installer meta -> 2 pkgs|pkgutil inspection/signature[B,C]|Apple installer|P06,P09|V|-|S36
P09-01|P09 signing|Developer ID-sign .app|BAP|Apple app signing|unsigned app+identity/entitlements -> signed app|codesign --verify --deep --strict[B]|Apple fixture|P06|V|-|S34,S37
P09-02|P09 signing|Developer ID-sign .pkg|BAP|Apple pkg signing|unsigned pkg+identity -> signed pkg|pkgutil --check-signature[B]|Apple fixture|P08|V|-|S36,S37
P09-03|P09 signing|Authenticode-sign MSI/MSIX|BWS|Win x64; SignTool; test cert in CI|unsigned installer+identity -> signed installer|signtool verify + install smoke[B,C]|Win fixture|P05-06/07|D|Recommend V if Win installer selected|S38
P09-04|P09 signing|Create detached OpenPGP signatures|BGP|1 .asc per selected file|final file+key -> .asc|gpg --verify[B]|archive fixture|arts|D|Recommend later unless existing demand|S39
P09-05|P09 signing|Create keyless Cosign blob signatures|BCO|cosign blob; GitHub OIDC|final file+identity policy -> bundle/signature|cosign verify-blob[B]|archive fixture|arts|D|Recommend later; separate supply-chain outcome|S40
P10-01|P10 notarization|Submit to Apple and retain submission identity|BAP|notarytool; 1 exact input digest per submission|signed art+credentials -> durable submission or terminal result|Apple submission ID/status[A,J]|forced loss after submit|P09|V|durable store/API remains effect-build design question|S41
P10-02|P10 notarization|Resume Apple polling on runner2|BAP|second mac runner|submission record+credentials -> acc/rejected/pend|notarytool info/log[M,J]|fresh-runner fixture|P10-01|V|same unresolved durable design|S41
P10-03|P10 notarization|Staple accepted ticket; produce final bytes|BAP|app/DMG/pkg types selected above|acc result+art -> stapled art|stapler validate + final digest[B]|Apple fixture|P10-02|V|-|S41
P10-04|P10 notarization|Verify Gatekeeper before TR adoption|BAP|cur mac spctl|stapled art -> verified final bytes|spctl + codesign/pkgutil[B,C]|Apple fixture|P10-03|V|-|S41
Q01|Material choice|Generate+verify SHA256SUMS|BCK|SHA-256 only|art set -> checksum file|sha256sum/shasum verification[B]|portable rel|arts|D|Recommend V; low cost/interoperable|S42
Q02|Material choice|Generate SPDX+CycloneDX SBOMs|BSB|exact 2 formats|art/source -> 2 SBOMs|schema validation + component assertions[B]|portable CLI|arts|D|Recommend proof or V if supply-chain strategic|S43
Q03|Material choice|Build/push amd64+arm64 OCI index to GHCR|BOC|OCI image/dist specs; GHCR|context+exes -> 2 manifests+index digest|registry digest + pull/run[A,M,B,C,J]|container CLI/server|prov+journal|D|Recommend later; new build+provider surface|S44
Q04|Material choice|Coordinate 2 logical releases with dependency|TP|core pkg then CLI pkg|2 definitions -> 1 resumable DAG|plan inspection + prov outcomes[A,M,J]|two-pkg workspace|plan/journal|D|Recommend later; preserve model|S45
Q05|Material choice|Produce snapshot+nightly policies|AP|exact snapshot + nightly policies|source+arts -> local snapshot or nightly coordinates|zero-send snapshot; nightly receipts/consumer[A,M,B,C,J]|portable CLI|D01,D03|D|Recommend later; separate retention/version policy|S46
Q06|Material choice|Derive SemVer+notes from Conventional Commits|APP|1 Git range; Conventional Commits|history+policy -> ver+notes|golden history preview[M]|breaking/feat/fix fixture|source identity|D|Recommend later; accept explicit values first|S47
```

## Finite non-launch rows

```text
A01|P01|Adopt Deno linux-x64 executable|BD+BK|deno compile linux-x64|TS>exe|run+digest[BC]|CLI|P01-01|P|-|S21,S23
A02|P01|Adopt Node SEA linux-x64 executable|BS+BK|Node SEA linux-x64|TS>exe|run+digest[BC]|CLI|P01-01|P|-|S21,S24
A03|AI|Validate OpenAI plugin/skills handoff|validator|pkg+listing+tests|dir>result|schema+tests[M]|plugin|-|P|-|S48
X01|D06|GitLab provider package|external|GitLab|Intent>receipt|contract[AMJ]|fixture|D06|X|-|S49
X02|D06|Gitea provider package|external|Gitea|Intent>receipt|contract[AMJ]|fixture|D06|X|-|S49
X03|D06|Cloudsmith provider package|external|Cloudsmith|Intent>receipt|contract[AMJ]|fixture|D06|X|-|S49
X04|D06|GemFury provider package|external|GemFury|Intent>receipt|contract[AMJ]|fixture|D06|X|-|S49
X05|D06|Artifactory provider package|external|Artifactory|Intent>receipt|contract[AMJ]|fixture|D06|X|-|S49
X06|D06|Nexus provider package|external|Nexus|Intent>receipt|contract[AMJ]|fixture|D06|X|-|S49
L01|D04|Homebrew Cask render/publish/install|later|Cask|arts>cask/ref|audit/install[MBC]|app|D03|L|-|S12
L02|catalog|Winget render/PR/catalog/install|later|Winget|arts>PR|validate/install[MBC]|Win CLI|D03|L|-|S50
L03|P05|Source RPM production|later EB|SRPM|source>srpm|rpm inspect[B]|source pkg|P05|L|-|S31
```

## Source groups

`S01-04` npm; `S05-09` Warehouse/PyPI/pypiserver/devpi; `S10-15` GitHub/Homebrew/Git/Scoop; `S16-20` PR20/Effect/artifacts; `S21-25` effect-build/Bun/Deno/SEA/esbuild; `S26-30` archives/uv/Poetry; `S31-41` nFPM/Windows/Apple/signing/notary; `S42-50` checksum/SBOM/OCI/monorepo/snapshot/changelog/OpenAI/GoReleaser/Winget.

## Material choices

- P01: Bun-only vs Deno/SEA; esbuild is a JS-bundle choice.
- P04: uv-only vs uv+Poetry.
- P05: exact deb/rpm/apk/ipk/Arch/MSIX/WiX set.
- P09: Apple/Windows signing vs GPG/Cosign.
- Q01-Q06: checksum, SBOM, OCI, coordinated releases, snapshot/nightly, changelog/version policy.
