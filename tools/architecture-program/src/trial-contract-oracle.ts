/**
 * Independent literal oracle for the architecture trial v2 contract.
 *
 * Keep this module import-free. Only the checker and hostile tests may consume
 * these literals; the schema and document builder must remain unaware of them.
 */

export const V2_EXPECTED_LAW_IDS = [
  "L01-single-canonical-durable-chain",
  "L02-single-pure-transition-owner",
  "L03-single-interpreter-cas-authority",
  "L04-facts-decisions-effects-separated",
  "L05-host-owned-single-journal",
  "L06-provider-vertical-ownership",
  "L07-open-provider-composition",
  "L08-host-neutral-kernel",
  "L09-lossless-effect-build-handoff",
  "L10-apple-operation-journal-boundary",
  "L11-hard-cut-or-one-shot-migration",
  "L12-generated-exact-public-surface",
  "L13-exact-acyclic-import-graph",
  "L14-total-owned-traceability"
] as const

export const V2_EXPECTED_CASE_IDS = [
  "C01-initial-success",
  "C02-rejection-before-commit",
  "C03-response-loss-satisfied-observation",
  "C04-response-loss-inconclusive-stop",
  "C05-core-git-cas-protected-replay",
  "C06-explicit-risk-acceptance",
  "C07-concurrent-runners-single-cas-winner",
  "C08-request-endpoint-mismatch",
  "C09-supersession-late-evidence",
  "C10-ambiguous-append-readback",
  "C11-malformed-provider-graph",
  "C12-external-provider-two-instances",
  "C13-apple-commit-before-id-loss",
  "C14-finalized-file-tree-adoption",
  "C15-host-dependency-shadowing",
  "C16-journal-bound-symmetry"
] as const

export const V2_EXPECTED_PROBE_IDS = [
  "P01-second-provider-instance",
  "P02-packed-external-provider",
  "P03-new-first-party-provider",
  "P04-new-commitment-mechanism",
  "P05-existing-provider-operation",
  "P06-journal-store-backend",
  "P07-file-tree-producer-adapter",
  "P08-deliberate-public-export",
  "P09-difficult-recovery-transition"
] as const

export const V2_EXPECTED_MACHINE_CANDIDATE_IDS = [
  "M1-extracted-fold",
  "M2-total-transition"
] as const

export const V2_EXPECTED_TOPOLOGY_CANDIDATE_IDS = [
  "T1-root",
  "T2-kernel-provider-bundle",
  "T3-provider-verticals"
] as const

export const V2_EXPECTED_MACHINE_GATE_IDS = [
  "GM01-shared-case-semantics",
  "GM02-law-and-owner-invariants",
  "GM03-construction-boundaries",
  "GM04-result-provenance",
  "GM05-machine-source-budget",
  "GM06-marginal-measurement",
  "GM07-candidate-equivalence",
  "GM08-metric-and-readability-completeness",
  "GM09-offline-nonmutation"
] as const

export const V2_EXPECTED_TOPOLOGY_GATE_IDS = [
  "GT01-shared-fixture-machine-and-cases",
  "GT02-packed-library-node",
  "GT03-packed-library-bun",
  "GT04-packed-cli",
  "GT05-packed-github-action",
  "GT06-packed-external-provider-two-instances",
  "GT07-lossless-effect-build-file-tree-adoption",
  "GT08-exact-runtime-declaration-surface",
  "GT09-exact-emitted-packed-inventory",
  "GT10-exact-static-type-dynamic-manifest-graph",
  "GT11-no-cycle-sibling-reversal-or-host-edge",
  "GT12-version-skew-partial-publication",
  "GT13-dry-run-build-publication-self-release",
  "GT14-tree-shaking-and-packed-bytes",
  "GT15-all-nine-marginal-probes",
  "GT16-offline-nonmutation"
] as const

export const V2_EXPECTED_PROBE_MEASUREMENT_IDS = [
  "before-tree-sha256",
  "after-tree-sha256",
  "patch-sha256",
  "gross-product-additions",
  "gross-product-deletions",
  "files-touched",
  "modules-touched",
  "packages-touched",
  "concepts-touched",
  "central-branches-touched",
  "public-surface-delta",
  "durable-format-delta",
  "dependency-dag-delta"
] as const

export const V2_EXPECTED_REQUIRED_TOOLCHAIN_BINDINGS = [
  "bun",
  "typescript",
  "effect",
  "git",
  "bubblewrap"
] as const

export const V2_EXPECTED_DIFF_ARGV = [
  "git",
  "diff",
  "--no-index",
  "--numstat",
  "--no-renames",
  "--diff-algorithm=myers",
  "--no-ext-diff",
  "--no-textconv",
  "--"
] as const

export const V2_EXPECTED_GIT_ENVIRONMENT = {
  inheritedVariableNames: ["PATH"],
  fixedVariables: [
    { name: "LC_ALL", value: "C" },
    { name: "LANG", value: "C" },
    { name: "TZ", value: "UTC" },
    { name: "NO_COLOR", value: "1" },
    { name: "GIT_CONFIG_NOSYSTEM", value: "1" },
    { name: "GIT_CONFIG_GLOBAL", value: "/dev/null" },
    { name: "GIT_CONFIG_SYSTEM", value: "/dev/null" },
    { name: "GIT_ATTR_NOSYSTEM", value: "1" }
  ]
} as const

export const V2_EXPECTED_GIT_EXECUTABLE_POLICY = {
  resolution: "preflight-resolve-once",
  executableSha256Field: "toolchain.gitExecutableSha256",
  measurementInvocation: "retained-resolved-absolute-path",
  postPreflightPathLookup: "forbidden"
} as const

export const V2_EXPECTED_BINARY_NON_PRODUCT_LINE_DELTA_POLICY =
  "git-binary-marker-maps-to-zero-lines" as const

export const V2_EXPECTED_TOP_LEVEL_KEYS = [
  "schemaVersion",
  "programId",
  "inputBindings",
  "executionContract",
  "measurementContract",
  "authorities",
  "laws",
  "machineCases",
  "machineCandidates",
  "topologyFixture",
  "topologyCandidates",
  "marginalProbes",
  "gateRequirements",
  "machineSelectionPolicy",
  "topologySelectionPolicy",
  "receiptContract"
] as const

export const V2_EXPECTED_CASE_EXECUTIONS = {
  "C01-initial-success": {
    actionIds: [
      "action.initialize-operation",
      "action.prepare-operation",
      "action.append-dispatch-authority",
      "action.dispatch-operation",
      "action.record-provider-receipt",
      "action.observe-operation",
      "action.derive-terminal-report"
    ],
    faultIds: []
  },
  "C02-rejection-before-commit": {
    actionIds: [
      "action.initialize-operation",
      "action.prepare-operation",
      "action.record-precommit-rejection",
      "action.derive-terminal-report"
    ],
    faultIds: ["fault.provider-precommit-rejection"]
  },
  "C03-response-loss-satisfied-observation": {
    actionIds: [
      "action.initialize-operation",
      "action.prepare-operation",
      "action.append-dispatch-authority",
      "action.dispatch-operation",
      "action.resume-fresh-runner",
      "action.observe-operation",
      "action.derive-terminal-report"
    ],
    faultIds: ["fault.dispatch-response-loss"]
  },
  "C04-response-loss-inconclusive-stop": {
    actionIds: [
      "action.initialize-operation",
      "action.prepare-operation",
      "action.append-dispatch-authority",
      "action.dispatch-operation",
      "action.resume-fresh-runner",
      "action.observe-operation",
      "action.derive-terminal-report"
    ],
    faultIds: ["fault.dispatch-response-loss", "fault.observation-absence"]
  },
  "C05-core-git-cas-protected-replay": {
    actionIds: [
      "action.initialize-operation",
      "action.prepare-operation",
      "action.observe-operation",
      "action.append-dispatch-authority",
      "action.dispatch-operation",
      "action.observe-operation",
      "action.derive-terminal-report"
    ],
    faultIds: ["fault.prior-dispatch-response-loss"]
  },
  "C06-explicit-risk-acceptance": {
    actionIds: [
      "action.initialize-operation",
      "action.prepare-operation",
      "action.append-dispatch-authority",
      "action.dispatch-operation",
      "action.observe-operation",
      "action.request-risk-acceptance",
      "action.append-risk-acceptance",
      "action.append-dispatch-authority",
      "action.dispatch-operation",
      "action.observe-operation",
      "action.derive-terminal-report"
    ],
    faultIds: ["fault.prior-inconclusive-operation"]
  },
  "C07-concurrent-runners-single-cas-winner": {
    actionIds: [
      "action.initialize-operation",
      "action.prepare-operation",
      "action.contend-append-cas",
      "action.refold-after-cas-loss",
      "action.dispatch-operation",
      "action.observe-operation",
      "action.derive-terminal-report"
    ],
    faultIds: ["fault.concurrent-cas-contenders"]
  },
  "C08-request-endpoint-mismatch": {
    actionIds: [
      "action.initialize-operation",
      "action.prepare-operation",
      "action.verify-request-correspondence",
      "action.derive-terminal-report"
    ],
    faultIds: ["fault.request-endpoint-mismatch"]
  },
  "C09-supersession-late-evidence": {
    actionIds: [
      "action.initialize-operation",
      "action.prepare-operation",
      "action.append-dispatch-authority",
      "action.dispatch-operation",
      "action.append-supersession",
      "action.append-late-evidence",
      "action.derive-terminal-report"
    ],
    faultIds: ["fault.supersession-during-dispatch"]
  },
  "C10-ambiguous-append-readback": {
    actionIds: [
      "action.initialize-operation",
      "action.prepare-operation",
      "action.append-dispatch-authority",
      "action.reconcile-ambiguous-append",
      "action.derive-terminal-report"
    ],
    faultIds: ["fault.append-outcome-unknown"]
  },
  "C11-malformed-provider-graph": {
    actionIds: [
      "action.initialize-operation",
      "action.validate-provider-graph",
      "action.derive-terminal-report"
    ],
    faultIds: ["fault.malformed-provider-graph"]
  },
  "C12-external-provider-two-instances": {
    actionIds: [
      "action.load-external-provider",
      "action.validate-provider-graph",
      "action.initialize-operation",
      "action.prepare-operation",
      "action.append-dispatch-authority",
      "action.dispatch-operation",
      "action.observe-operation",
      "action.derive-terminal-report"
    ],
    faultIds: []
  },
  "C13-apple-commit-before-id-loss": {
    actionIds: [
      "action.initialize-operation",
      "action.prepare-operation",
      "action.append-dispatch-authority",
      "action.submit-apple-operation",
      "action.resume-fresh-runner",
      "action.observe-operation",
      "action.derive-terminal-report"
    ],
    faultIds: ["fault.apple-submission-id-loss"]
  },
  "C14-finalized-file-tree-adoption": {
    actionIds: [
      "action.adopt-finalized-artifacts",
      "action.derive-terminal-report"
    ],
    faultIds: [
      "fault.duplicate-artifact-name",
      "fault.mutable-producer-path",
      "fault.symlink-traversal"
    ]
  },
  "C15-host-dependency-shadowing": {
    actionIds: [
      "action.attempt-host-shadow",
      "action.derive-terminal-report"
    ],
    faultIds: ["fault.consumer-host-shadow"]
  },
  "C16-journal-bound-symmetry": {
    actionIds: [
      "action.write-journal-at-limit",
      "action.read-journal-at-limit",
      "action.reject-journal-write-over-limit",
      "action.reject-journal-read-over-limit",
      "action.derive-terminal-report"
    ],
    faultIds: ["fault.journal-one-byte-over-limit"]
  }
} as const

export const V2_EXPECTED_PROBE_ACTION_IDS = {
  "P01-second-provider-instance": "probe.add-second-provider-instance",
  "P02-packed-external-provider": "probe.add-packed-external-provider",
  "P03-new-first-party-provider": "probe.add-first-party-provider",
  "P04-new-commitment-mechanism": "probe.add-commitment-mechanism",
  "P05-existing-provider-operation": "probe.add-existing-provider-operation",
  "P06-journal-store-backend": "probe.add-journal-store-backend",
  "P07-file-tree-producer-adapter": "probe.add-file-tree-producer-adapter",
  "P08-deliberate-public-export": "probe.add-public-export",
  "P09-difficult-recovery-transition": "probe.change-difficult-recovery"
} as const

export const V2_EXPECTED_ISOLATION_POLICY = {
  policyId: "bubblewrap-linux-offline-v1",
  platform: "linux",
  bubblewrapExecutable: "/usr/bin/bwrap",
  namespaceArguments: [
    "--unshare-all",
    "--disable-userns",
    "--assert-userns-disabled"
  ],
  networkPolicy: "unshared-by-unshare-all",
  sessionArguments: ["--new-session", "--die-with-parent"],
  capabilityArguments: ["--cap-drop", "ALL"],
  hostname: "architecture-trial",
  receiptBindings: {
    bunVersionField: "toolchain.bun",
    bunExecutableSha256Field: "toolchain.bunExecutableSha256",
    bubblewrapVersionField: "toolchain.bubblewrapVersion",
    bubblewrapExecutableSha256Field: "toolchain.bubblewrapExecutableSha256",
    runnerNodeModulesSha256Field: "runnerNodeModulesSha256"
  },
  hostRuntimeTrust: {
    mountSource: "/usr",
    mountDestination: "/usr",
    mountMode: "read-only",
    trustStatus: "host-runtime-trust-base",
    hermeticityClaim: "not-fully-hermetic"
  },
  bunExecutableSnapshot: {
    sourceAuthority: "retained-preflight-realpath-verified-then-snapshotted",
    exactBytesSha256Field: "toolchain.bunExecutableSha256",
    fileMode: "0555"
  },
  candidateSnapshot: {
    rootAndImpliedDirectoryMode: "0700",
    emptyDirectoryPolicy: "omit",
    regularFileModePolicy: "exact-from-canonical-candidate-tree-0644-or-0755"
  },
  runtimeDependencyTree: {
    algorithmId: "canonical-runtime-dependency-tree-manifest-sha256-v2",
    hashDomain: "ts-release/architecture-runtime-dependency-tree/v2",
    manifestEncoding: "CanonicalJsonV1",
    manifestShape: "ordered-array-of-RegularFile-or-SymbolicLink",
    sourceAuthority: "retained-preflight-realpath-verified-then-snapshotted",
    mountDestination: "/candidate/node_modules",
    runContextSha256Field: "runnerNodeModulesSha256",
    pathSyntax: "NFC slash-relative with no empty, dot, dot-dot, or backslash segments",
    entryOrder: "Unicode-code-point ascending by slash-relative path",
    entryTypes: ["regular-file", "symbolic-link"],
    directoryPolicy: "empty-directories-rejected-topology-implied-by-descendants",
    snapshotDirectoryMode: "0755",
    regularFileEntryShape: "RegularFile(path,mode,byteLength,bytesSha256)",
    regularFileModePolicy: "canonical-git-modes-100644-or-100755",
    regularFileBytesPolicy: "bytesSha256-is-sha256-of-exact-file-bytes",
    symlinkEntryShape: "SymbolicLink(path,target)",
    symlinkTraversalPolicy: "lstat-and-do-not-follow",
    symlinkTargetPolicy: "NFC relative target text resolving within dependency root",
    dotBinSymlinkPolicy: "include",
    absoluteSymlinkTargetPolicy: "reject",
    escapingSymlinkTargetPolicy: "reject",
    specialEntryPolicy: "reject"
  },
  threatModelBoundary: {
    isolationGuarantees: [
      "filesystem-confidentiality-and-integrity",
      "network-isolation",
      "credential-nonexposure"
    ],
    hostAvailabilityGuarantee: "none",
    candidateResourceExhaustion: "out-of-scope",
    memoryQuota: "not-enforced",
    blockQuota: "not-enforced",
    inodeQuota: "not-enforced",
    sameUidHostProcessBoundary:
      "trusted-runner-account-out-of-scope-candidate-inside-bwrap-remains-in-scope",
    timeoutRole: "wall-clock-termination-only-not-resource-containment"
  },
  rootFilesystem: {
    base: "empty",
    hostRootMount: "forbidden",
    readOnlyBinds: [
      {
        sourceAuthority: "literal-host-runtime",
        source: "/usr",
        destination: "/usr",
        kind: "directory"
      },
      {
        sourceAuthority: "verified-run-context-bun-snapshot",
        source: "exact-hash-bun-executable-snapshot",
        destination: "/runtime/bun",
        kind: "file"
      },
      {
        sourceAuthority: "verified-run-context-runner-node-modules-snapshot",
        source: "exact-hash-runner-node-modules-snapshot",
        destination: "/candidate/node_modules",
        kind: "directory"
      }
    ],
    symlinks: [
      { target: "usr/bin", destination: "/bin" },
      { target: "usr/lib", destination: "/lib" },
      { target: "usr/lib64", destination: "/lib64" }
    ],
    deviceFilesystem: { destination: "/dev", policy: "new-minimal-dev" },
    procFilesystem: { destination: "/proc", policy: "new-proc" },
    privateTmpfs: [{ destination: "/tmp" }],
    writableBinds: [{
      sourceAuthority: "fresh-candidate-copy",
      destination: "/candidate",
      persistence: "invocation-private"
    }],
    onlyPersistentWritableBindDestination: "/candidate"
  },
  workingDirectory: "/candidate",
  environment: {
    clear: true,
    inheritedVariableNames: [],
    variables: [
      { name: "PATH", value: "/runtime:/usr/bin" },
      { name: "LC_ALL", value: "C" },
      { name: "LANG", value: "C" },
      { name: "TZ", value: "UTC" },
      { name: "NO_COLOR", value: "1" },
      { name: "TMPDIR", value: "/tmp" }
    ]
  },
  forbiddenMountClasses: [
    "host-root",
    "home-directory",
    "root-home",
    "repository",
    "credential-store",
    "ssh-agent-socket",
    "gpg-agent-socket",
    "container-runtime-socket",
    "arbitrary-host-socket"
  ]
} as const

export const V2_EXPECTED_CONTRACT_HASHES = {
  execution: "1fff96c0ba968699e1cbc9ab174ebb7b0c83aa4b71b3bf1fe731d62dc2e9c1c6",
  measurement: "703f898ccbc053cfc6ab4c79e1f40317d1f883e35ffdec5acb2b016d57a8c40c"
} as const

export const V2_EXPECTED_TOPOLOGY_FIXTURE_SHA256 =
  "5ca9f093cb3038558ff763457a7d5a841de4076e61969e0a3d4e81a0f2b387a0" as const

export const V2_EXPECTED_CASE_COMPONENT_HASHES = {
  "C01-initial-success": {
    fixtureSha256: "4031e2df467e71c72754e27460350f8c3de8d3ad730823ad39d217ad2aec3c76",
    expectedEvidenceSha256: "18e7b850d5d037d3086221e3ca0240778bda450c8cb2bf7195490b46113da46d",
    definitionSha256: "8d9f176ff6b379d3c8c68eee64794a26d3e7d40f7282ee09438dd9c2a264228e"
  },
  "C02-rejection-before-commit": {
    fixtureSha256: "6277cb0898098d95100f37a364811962ad102158c6bf24eb57d89988b1ea0740",
    expectedEvidenceSha256: "b137b1b7e9ac7a32a736a58403f2efb1b3ea0471e7029904b5cbfca9d508adf6",
    definitionSha256: "e84c283b839abe3b62954fc0fba5facfb631ba3887a7905dcba32c66985861a4"
  },
  "C03-response-loss-satisfied-observation": {
    fixtureSha256: "e7e94ec53227e5ee88c6a2a547d4812df6573aff3252eba027509757a068c6af",
    expectedEvidenceSha256: "1fc3f5b5490342f36398d8348a94038f3379b43fbe0f2e910604dc91d0bc75ad",
    definitionSha256: "7496f4f1d27e4d8ee8e2f12bb57b5663c3e2509997511da25f2b63fc27bf4604"
  },
  "C04-response-loss-inconclusive-stop": {
    fixtureSha256: "735f0887ed2cdc2d423381f471442552d688addcc48103822b67cae295b293fa",
    expectedEvidenceSha256: "530994b85c712590378fc7a0b9f550b0887ae74fa24b20fc0896c82cdaa8fe6c",
    definitionSha256: "c6f5e5ee4a00a5b4fc05439a66b3d0833347bcc4ad181e81dd1a8b89b3cd941e"
  },
  "C05-core-git-cas-protected-replay": {
    fixtureSha256: "bbca5de6550b41d9754b6a69c7fe5737f4e51a6a3efcb764a54e2cebe8705dda",
    expectedEvidenceSha256: "06bfdba783498525b5191afcf339ce7428887c0e3804f21047161774f11902ef",
    definitionSha256: "e609845ac87abf2cc9cd4f8e7c433b2fb356d309d42763694de06b6109a6836f"
  },
  "C06-explicit-risk-acceptance": {
    fixtureSha256: "4f25888da564bf5878db6103d9aa454f6e2d82a8963a02d41debaaa69c37ede4",
    expectedEvidenceSha256: "4d911d242ff93dc57e79e5475d709a31f1fdc8ded6d9a05f37f9d3a2360f23bb",
    definitionSha256: "9a699cc509a780134171a660167731f17b70886b762ff0c8be3ac7530c7568a7"
  },
  "C07-concurrent-runners-single-cas-winner": {
    fixtureSha256: "5aa7f41669adf48bde01722bdd4d2f09d8ff1a406c720a40fa944c886036cf7a",
    expectedEvidenceSha256: "306794061f4a95691d25d35322556fe674de98fa0690de6d464cfcf84ce7edfc",
    definitionSha256: "1639160c9f20840aa9d93fa643c206bc707fc93cc75b833d42dee2367f881449"
  },
  "C08-request-endpoint-mismatch": {
    fixtureSha256: "9020c116b0430cd571767f6c88cb3a67186129f075c3c6882e212c044b11649c",
    expectedEvidenceSha256: "c15964ec1095879dbe576e05ff3980847f3992f3782123e8713e4a35c2e5e9b4",
    definitionSha256: "9993a29206d4d171f92391d7967dc61164cc70206c246a5f73fa0a9928160e8c"
  },
  "C09-supersession-late-evidence": {
    fixtureSha256: "431758d521bba092879249ca2017231afaa4a765ed87dcee0a1dcc86786804b2",
    expectedEvidenceSha256: "983ca444c8d1dd3d57ab39ff82f52d922974cb73c33115c02c668b547d9ec146",
    definitionSha256: "54e4c4409ac0d85369cb3afaa25bd1cf0ead60aa3a85a22e539f27ed8823e431"
  },
  "C10-ambiguous-append-readback": {
    fixtureSha256: "ed4fc4ca8409ed7b6c6389715adb1c0c349ca4d50bdd3b9ac57ca82fc40684bc",
    expectedEvidenceSha256: "22e325733122843e091be6405c5d3e61bff32a0aefdc511f3cc21a5997055025",
    definitionSha256: "e08e764bd83feb09412dcddc17f355b93feedcd4035cef5f375470034cc5ac14"
  },
  "C11-malformed-provider-graph": {
    fixtureSha256: "a848d61ea2ff3a8a2ee7741700d629b5dc13f5cbd56ff3c0e24d2d0ed87f9b66",
    expectedEvidenceSha256: "4ce983b998bc34784685d54d641278d8a548ab96df16c92c8ec16c3a62f28790",
    definitionSha256: "76fc8dbb48c111a93b7e86946fbe668bb2ab9e95c75c69b3afbd51238804416a"
  },
  "C12-external-provider-two-instances": {
    fixtureSha256: "5670686adb4cb59b37cda4dfa3abf5164886cd3defaf31f72bd1547e6d1eedef",
    expectedEvidenceSha256: "6c54be412b454ade571b3368ba5125618eae970498e64da27a96da3c203d6637",
    definitionSha256: "b9cff17b3e80f45d6c4672baa38e61d695149c35eb1a4e45ddab8a09a1469054"
  },
  "C13-apple-commit-before-id-loss": {
    fixtureSha256: "c11f35f97c6c7afe43aa02e92a56daf285dfecf7e0ee262d7db21d16fe3c12fe",
    expectedEvidenceSha256: "b9ba3ecda9821be0dbe78ccb1a2536573db8f4fba2cffd4dc0be779a5754cc9c",
    definitionSha256: "528060cb1edfa4c3b0a8b392d489238873243f7a62a85bacb1dab3eed198e2f7"
  },
  "C14-finalized-file-tree-adoption": {
    fixtureSha256: "c6e692639352b321e076ebd5060f6e628e71e51910e17049428cf1b9469d723b",
    expectedEvidenceSha256: "3cffcdd2989b3c927da82d1b4a04368fd259ab5c749a8f5535ad91f1cc31eee9",
    definitionSha256: "e621d5f0936c93944326207231b696d22e70f7d6e9fda2460633045df94c4160"
  },
  "C15-host-dependency-shadowing": {
    fixtureSha256: "ff13febc77ffac5ab5d2b38743f7615af78b259bca3d00a4ac046c8a2bc81541",
    expectedEvidenceSha256: "f484a1ddb47aba63ad93fd756b7f849fb58225725eb62d12203b9691ec25d403",
    definitionSha256: "4a4bf17f2e801e470431f37b1a05dae7ab1a12cd76b9edf5fd718461582cf39b"
  },
  "C16-journal-bound-symmetry": {
    fixtureSha256: "fe343cdbf26caeefbafbaab7f625de0da6733fc357e384ed48ef2345c809ec5a",
    expectedEvidenceSha256: "69f2948934f3e2647bde9bc6a6dceb8d852661bdc8c74369cc75079363eeee87",
    definitionSha256: "faea5da51979af5c39c52bbbbb7270569cd361527c19bb03ecc3200c8997545f"
  }
} as const

export const V2_EXPECTED_PROBE_COMPONENT_HASHES = {
  "P01-second-provider-instance": {
    changeDefinitionSha256: "ccc7fa1b9f479b37cd6870fd993f3adaa39a2570ad4bfde8858ca36c91b8ca70",
    definitionSha256: "bb4d103af4dff364722d31017653eea0dd35b57a3dc54b86be32c7bb3fb1e781"
  },
  "P02-packed-external-provider": {
    changeDefinitionSha256: "58822565f0c48df602d5a6e1c54b21f7e28f4aa972994c6fc76c5efaff74d4e8",
    definitionSha256: "bef1d5bc0948e2d292e48aeb1d98ffbdcb5dfe18f8e8f9a723f906db4e812777"
  },
  "P03-new-first-party-provider": {
    changeDefinitionSha256: "cea72cc0f0373d17b47e8bb5e7c9a25fc0a2ae62e4608f002257f3952a6dead7",
    definitionSha256: "5bfef7929632ef6a4f8694516da1072d86154a8802e3b3ca5fd7d34d46236bb8"
  },
  "P04-new-commitment-mechanism": {
    changeDefinitionSha256: "2f58805d33654a325deaf188a82b1d80961b68e9bf005cc3f6c2a2547c9b1343",
    definitionSha256: "25bd0ab54bc462da6badc450a2a3f35e90b6dc39d90178a78859116ebc888c43"
  },
  "P05-existing-provider-operation": {
    changeDefinitionSha256: "56b15710925c2096ee235f3f2505e96ac2c1a162fdce99356cea9f3806120ef8",
    definitionSha256: "2376255da595cc79f4f676c736f6e4dec8bde0c3daeb49fdcbf282813a471167"
  },
  "P06-journal-store-backend": {
    changeDefinitionSha256: "95c25087037f170bc986d9c0cf5649245043db717344871ec7ede3a6cac9ab06",
    definitionSha256: "50943803df6bccf6b3196c3c80f49fda2d44fb425dc41378e83290843a22bbf2"
  },
  "P07-file-tree-producer-adapter": {
    changeDefinitionSha256: "5298d10d3398e3eda4efe5dba9c5475aada2f2d181a2a19229cf388efbe1ae7d",
    definitionSha256: "468762b9a1e32d9460f17492011811538f2154b156a4318d9b390aca4e9fe10a"
  },
  "P08-deliberate-public-export": {
    changeDefinitionSha256: "f2935b719246b6d731745de770cb0a098f1b444fbb2d9782e852b47c7d9d2f7b",
    definitionSha256: "22220ae3db95c5c196d1af5634d17e650b5755b544763aeaf0305bbbc12f2118"
  },
  "P09-difficult-recovery-transition": {
    changeDefinitionSha256: "088977544a3d38ef263b90ab30cb7794552438151ecb798d900a5d6ca5e7c0a5",
    definitionSha256: "43e61fab6392d17118837fab51e62151769e41b6a9e77e7f6a574642677cd749"
  }
} as const

export const V2_EXPECTED_GATE_DEFINITION_HASHES = {
  "GM01-shared-case-semantics": "5ea6fe88a4dfc1340581cbe456069b565886f3c6c53e73b972b81bcce5166264",
  "GM02-law-and-owner-invariants": "f3c90bd1ae7cd6c114991217640130c471c2f37c4ede3ef62dbf9ae8cb91632e",
  "GM03-construction-boundaries": "539ef96b0c98040a9936c74a8d681b446ad7caecef8ce2959799f4520013e608",
  "GM04-result-provenance": "4a6b299f0808efd8de9e7f65c535f6adfde1f57e970ea8ef40f09b81e4f3760f",
  "GM05-machine-source-budget": "17a6aca8e34b2718e6aba8d040f816fb6cacbae2c69bac6e3da0c88b4cea5f43",
  "GM06-marginal-measurement": "19a164c969851b59309cb4c57d750d025e7f476fbad853767e77e13854f57c59",
  "GM07-candidate-equivalence": "219f550a1a4c5accfd948bc16cf43f0abef0b110f2b3fbbf8dd90200bf0b409f",
  "GM08-metric-and-readability-completeness": "07ce2226777f71883945a8f30aa1d15e6a8dcc0f8b52b0608abc421c3cc601ae",
  "GM09-offline-nonmutation": "f05b51242709287ef1ba423cf4a475eedae0edc0132fac382c9d76dce9c5bd03",
  "GT01-shared-fixture-machine-and-cases": "cd09f652cbeefa2c221c4bdc387721cb03f9131577a9429205902219a724718c",
  "GT02-packed-library-node": "e06432cb79d57bef6e4227e6ac388c5580f5cce70b189ea5b10bc61085e87ff5",
  "GT03-packed-library-bun": "c80b3422ffe85867b7a9f814dd12703af484c18bae02488e598f9c228e829392",
  "GT04-packed-cli": "062d489bac4af4e9e00ccccf9c6eb74f68e6fb90419c779bd3c569dec3a8e3c2",
  "GT05-packed-github-action": "1df602bd38fe2fa42a2a4dd7406356568cae92b16920b1e5cd5ca35e6e362cc8",
  "GT06-packed-external-provider-two-instances": "36b8b3b9ae0415eaa90a77df6621dc0c17e7c00f60c4c0d10a39a5ac287ac487",
  "GT07-lossless-effect-build-file-tree-adoption": "9e5cef894315cc4e1a6f8867fa6814911d75fc1ef24ca8bd43aa733490546d64",
  "GT08-exact-runtime-declaration-surface": "5a424cb397065a2d3a6ec483913296338f84cd96c5dad4e4f148ed3842443359",
  "GT09-exact-emitted-packed-inventory": "5d9b0081204a4a52d6cc8902c011942638ae7969355c6e4e4fcbe825d3cbc234",
  "GT10-exact-static-type-dynamic-manifest-graph": "25011f65808be889e65084b36771f92759db6517a1225f602ddd6d774c706c89",
  "GT11-no-cycle-sibling-reversal-or-host-edge": "5307230c02e018e2d32a656e27371a8f6a88e7a9170a1a3e8f35e668bc85db7d",
  "GT12-version-skew-partial-publication": "5c7979586623d9e9a0ec1dc76c40f73f5070ddfa182280c896afa844c8d3a5b7",
  "GT13-dry-run-build-publication-self-release": "9030719dcffd8454d5183459f27b1df8c681b5692aa6aebe6713276884c6632f",
  "GT14-tree-shaking-and-packed-bytes": "c8d4c6ffd7980cb8baeba47091e57aa021831acfc77a4f28d9d1781700a4a74c",
  "GT15-all-nine-marginal-probes": "cba712d1c316746d5576395700f105f9582cdc66285b3a6fc7b6f522e0d0b88b",
  "GT16-offline-nonmutation": "63f94aec434a158c7682b07ba346a71efd3811f557deee929cfa9d4208426d95"
} as const

export const V2_EXPECTED_SCHEMA_IDS = {
  trialSpec: "ts-release/architecture-trial-spec/v2",
  candidateManifest: "ts-release/architecture-candidate-manifest/v2",
  caseFixture: "architecture-case-fixture-v2",
  expectedCaseEvidence: "architecture-expected-case-evidence-v2",
  probeChangeDefinition: "architecture-probe-change-definition-v2",
  runContext: "ts-release/architecture-trial-run-context/v2",
  caseInvocation: "architecture-case-invocation-v2",
  caseObservation: "architecture-case-observation-v2",
  probeInvocation: "architecture-probe-invocation-v2",
  probeObservation: "architecture-probe-observation-v2",
  gateInvocation: "architecture-gate-invocation-v2",
  gateObservation: "architecture-gate-observation-v2",
  machineResult: "machine-trial-result-v2",
  topologyResult: "topology-trial-result-v2"
} as const

export const V2_EXPECTED_RUN_CONTEXT_KEYS = [
  "candidateId",
  "candidateManifestSha256",
  "candidateModel",
  "candidateScope",
  "candidateTreeSha256",
  "caseDefinitionBindings",
  "executionContractSha256",
  "gateDefinitionBindings",
  "implementationRoot",
  "measurementContractSha256",
  "probeDefinitionBindings",
  "runContextSha256",
  "runnerNodeModulesSha256",
  "runnerSourceSha256",
  "schemaVersion",
  "toolchain",
  "topologyFixtureSha256",
  "trialSpecSha256"
] as const

export const V2_EXPECTED_RUN_CONTEXT_TOOLCHAIN_KEYS = [
  "bubblewrapExecutableSha256",
  "bubblewrapVersion",
  "bun",
  "bunExecutableSha256",
  "effect",
  "git",
  "gitExecutableSha256",
  "typescript"
] as const

export const V2_EXPECTED_COUNTS = {
  topLevelKeys: 16,
  laws: 14,
  machineCases: 16,
  marginalProbes: 9,
  machineCandidates: 2,
  topologyCandidates: 3,
  machineGates: 9,
  topologyGates: 16,
  gateRequirements: 25,
  probeMeasurements: 13,
  schemaIds: 14,
  resultSchemas: 2
} as const

export const V2_RESULT_SCHEMA_IDS = {
  machine: "machine-trial-result-v2",
  topology: "topology-trial-result-v2"
} as const
