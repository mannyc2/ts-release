import { Schema } from "effect"
import { hashCanonicalValue } from "../trial-hash.js"
import {
  ArtifactId,
  Description,
  ExistingRepositoryPath,
  MetricId,
  PlannedRepositoryPath,
  Sha256Hex
} from "./primitives.js"

const PositiveInt = Schema.Int.check(Schema.isGreaterThan(0))

export const REQUIRED_INPUT_BINDINGS = [
  {
    id: "B01-research-traceability",
    path: "docs/refactor/architecture-program/inputs/research-traceability.json",
    sha256: "3b0b1bcb162b4aa76829bf4e153e2e9ddd875885ad48d08146131403e1e35bbd"
  },
  {
    id: "B02-baseline",
    path: "docs/refactor/architecture-program/inputs/baseline.json",
    sha256: "8bbb7fbfa5b3e4b2165a98715e22ded0683606678214c7b0405341a9d64003f5"
  },
  {
    id: "B03-ownership-decisions",
    path: "docs/refactor/architecture-program/inputs/ownership-decisions.json",
    sha256: "c8c9238b9d787f5a5978159bdbd10c82ce509174b643b11a8e665c4e52b5f5da"
  },
  {
    id: "B04-architecture-tool-lock",
    path: "tools/architecture-program/bun.lock",
    sha256: "cb19d13f47b05f908c1531695574dd9221b6e201e7ceb81734c04a8c72c06fd9"
  }
] as const

export const REQUIRED_CASE_ACTIONS = [
  ["action.initialize-operation", "Construct the release and operation from the canonical fixture."],
  ["action.prepare-operation", "Prepare the provider operation without dispatching it."],
  ["action.validate-provider-graph", "Decode and validate the complete provider graph before provider effects."],
  ["action.append-dispatch-authority", "Conditionally append the event that solely constructs dispatch authority."],
  ["action.dispatch-operation", "Dispatch only after durable authority exists."],
  ["action.record-provider-receipt", "Append the provider-native receipt when one is available."],
  ["action.observe-operation", "Obtain and append a fresh provider-native observation."],
  ["action.derive-terminal-report", "Derive the terminal report only from the canonical journal."],
  ["action.record-precommit-rejection", "Record a rejection proven before provider commitment."],
  ["action.resume-fresh-runner", "Resume from durable state in a fresh runner with no process-local authority."],
  ["action.request-risk-acceptance", "Derive a risk-acceptance request from an inconclusive operation."],
  ["action.append-risk-acceptance", "Append risk acceptance bound to the exact operation and request."],
  ["action.contend-append-cas", "Run two contenders against the same expected journal revision."],
  ["action.refold-after-cas-loss", "Refold durable state after losing conditional append."],
  ["action.verify-request-correspondence", "Verify recorded and proposed request, endpoint, and authority correspondence."],
  ["action.append-supersession", "Append a superseding decision while preserving the earlier operation identity."],
  ["action.append-late-evidence", "Append exact late receipt and observation facts without reopening dispatch."],
  ["action.reconcile-ambiguous-append", "Read back before any retry after an outcome-unknown append."],
  ["action.load-external-provider", "Load a packed external provider and two configured instances by ordinary import and Layer composition."],
  ["action.submit-apple-operation", "Submit the Apple operation whose remote commitment may precede an identifier."],
  ["action.adopt-finalized-artifacts", "Adopt finalized file and tree values through the lossless boundary."],
  ["action.attempt-host-shadow", "Attempt to shadow host-owned journal, clock, transport, and approval services."],
  ["action.write-journal-at-limit", "Write canonical journal bytes at the exact trial-only limit."],
  ["action.read-journal-at-limit", "Read canonical journal bytes at the exact trial-only limit."],
  ["action.reject-journal-write-over-limit", "Reject a write one byte over the trial-only limit before append."],
  ["action.reject-journal-read-over-limit", "Reject a read one byte over the trial-only limit."]
] as const

export const REQUIRED_PROBE_ACTIONS = [
  ["probe.add-second-provider-instance", "Materialize a second configured instance of an existing provider."],
  ["probe.add-packed-external-provider", "Materialize and consume a packed external provider."],
  ["probe.add-first-party-provider", "Materialize a new first-party provider vertical."],
  ["probe.add-commitment-mechanism", "Materialize a genuinely new provider commitment mechanism."],
  ["probe.add-existing-provider-operation", "Materialize a new operation in an existing provider."],
  ["probe.add-journal-store-backend", "Materialize an additional JournalStore backend."],
  ["probe.add-file-tree-producer-adapter", "Materialize an additional finalized file and tree producer adapter."],
  ["probe.add-public-export", "Materialize one deliberate generated public export."],
  ["probe.change-difficult-recovery", "Materialize a difficult recovery transition with durable-format and migration review."]
] as const

export const REQUIRED_CASE_EXECUTIONS = {
  "C01-initial-success": {
    actionIds: ["action.initialize-operation", "action.prepare-operation", "action.append-dispatch-authority", "action.dispatch-operation", "action.record-provider-receipt", "action.observe-operation", "action.derive-terminal-report"],
    faultIds: []
  },
  "C02-rejection-before-commit": {
    actionIds: ["action.initialize-operation", "action.prepare-operation", "action.record-precommit-rejection", "action.derive-terminal-report"],
    faultIds: ["fault.provider-precommit-rejection"]
  },
  "C03-response-loss-satisfied-observation": {
    actionIds: ["action.initialize-operation", "action.prepare-operation", "action.append-dispatch-authority", "action.dispatch-operation", "action.resume-fresh-runner", "action.observe-operation", "action.derive-terminal-report"],
    faultIds: ["fault.dispatch-response-loss"]
  },
  "C04-response-loss-inconclusive-stop": {
    actionIds: ["action.initialize-operation", "action.prepare-operation", "action.append-dispatch-authority", "action.dispatch-operation", "action.resume-fresh-runner", "action.observe-operation", "action.derive-terminal-report"],
    faultIds: ["fault.dispatch-response-loss", "fault.observation-absence"]
  },
  "C05-core-git-cas-protected-replay": {
    actionIds: ["action.initialize-operation", "action.prepare-operation", "action.observe-operation", "action.append-dispatch-authority", "action.dispatch-operation", "action.observe-operation", "action.derive-terminal-report"],
    faultIds: ["fault.prior-dispatch-response-loss"]
  },
  "C06-explicit-risk-acceptance": {
    actionIds: ["action.initialize-operation", "action.prepare-operation", "action.append-dispatch-authority", "action.dispatch-operation", "action.observe-operation", "action.request-risk-acceptance", "action.append-risk-acceptance", "action.append-dispatch-authority", "action.dispatch-operation", "action.observe-operation", "action.derive-terminal-report"],
    faultIds: ["fault.prior-inconclusive-operation"]
  },
  "C07-concurrent-runners-single-cas-winner": {
    actionIds: ["action.initialize-operation", "action.prepare-operation", "action.contend-append-cas", "action.refold-after-cas-loss", "action.dispatch-operation", "action.observe-operation", "action.derive-terminal-report"],
    faultIds: ["fault.concurrent-cas-contenders"]
  },
  "C08-request-endpoint-mismatch": {
    actionIds: ["action.initialize-operation", "action.prepare-operation", "action.verify-request-correspondence", "action.derive-terminal-report"],
    faultIds: ["fault.request-endpoint-mismatch"]
  },
  "C09-supersession-late-evidence": {
    actionIds: ["action.initialize-operation", "action.prepare-operation", "action.append-dispatch-authority", "action.dispatch-operation", "action.append-supersession", "action.append-late-evidence", "action.derive-terminal-report"],
    faultIds: ["fault.supersession-during-dispatch"]
  },
  "C10-ambiguous-append-readback": {
    actionIds: ["action.initialize-operation", "action.prepare-operation", "action.append-dispatch-authority", "action.reconcile-ambiguous-append", "action.derive-terminal-report"],
    faultIds: ["fault.append-outcome-unknown"]
  },
  "C11-malformed-provider-graph": {
    actionIds: ["action.initialize-operation", "action.validate-provider-graph", "action.derive-terminal-report"],
    faultIds: ["fault.malformed-provider-graph"]
  },
  "C12-external-provider-two-instances": {
    actionIds: ["action.load-external-provider", "action.validate-provider-graph", "action.initialize-operation", "action.prepare-operation", "action.append-dispatch-authority", "action.dispatch-operation", "action.observe-operation", "action.derive-terminal-report"],
    faultIds: []
  },
  "C13-apple-commit-before-id-loss": {
    actionIds: ["action.initialize-operation", "action.prepare-operation", "action.append-dispatch-authority", "action.submit-apple-operation", "action.resume-fresh-runner", "action.observe-operation", "action.derive-terminal-report"],
    faultIds: ["fault.apple-submission-id-loss"]
  },
  "C14-finalized-file-tree-adoption": {
    actionIds: ["action.adopt-finalized-artifacts", "action.derive-terminal-report"],
    faultIds: ["fault.duplicate-artifact-name", "fault.mutable-producer-path", "fault.symlink-traversal"]
  },
  "C15-host-dependency-shadowing": {
    actionIds: ["action.attempt-host-shadow", "action.derive-terminal-report"],
    faultIds: ["fault.consumer-host-shadow"]
  },
  "C16-journal-bound-symmetry": {
    actionIds: ["action.write-journal-at-limit", "action.read-journal-at-limit", "action.reject-journal-write-over-limit", "action.reject-journal-read-over-limit", "action.derive-terminal-report"],
    faultIds: ["fault.journal-one-byte-over-limit"]
  }
} as const

export const REQUIRED_PROBE_ACTION_IDS = {
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

export const REQUIRED_TRIAL_LANES = [
  ["product-source", true],
  ["generated-product-input", true],
  ["action-source", true],
  ["test-oracle", false],
  ["fixture", false],
  ["tooling", false],
  ["generated-output", false],
  ["delivery-bundle", false]
] as const

export const REQUIRED_MEASUREMENT_METHODS = [
  ["before-tree-sha256", "sha256", "canonical-tree-manifest-sha256-v2", "filesystem"],
  ["after-tree-sha256", "sha256", "canonical-tree-manifest-sha256-v2", "filesystem"],
  ["patch-sha256", "sha256", "canonical-file-delta-manifest-sha256-v2", "filesystem"],
  ["gross-product-additions", "physical-lines", "git-numstat-no-renames-myers-v1", "candidate-manifest-lane"],
  ["gross-product-deletions", "physical-lines", "git-numstat-no-renames-myers-v1", "candidate-manifest-lane"],
  ["files-touched", "files", "canonical-file-delta-count-v2", "filesystem"],
  ["modules-touched", "modules", "candidate-inventory-distinct-module-count-v2", "candidate-manifest"],
  ["packages-touched", "packages", "candidate-inventory-distinct-package-count-v2", "candidate-manifest"],
  ["concepts-touched", "concepts", "candidate-inventory-distinct-concept-count-v2", "candidate-manifest"],
  ["central-branches-touched", "branches", "candidate-inventory-distinct-central-branch-count-v2", "candidate-manifest"],
  ["public-surface-delta", "identifier-delta", "candidate-manifest-public-surface-set-delta-v2", "candidate-manifest"],
  ["durable-format-delta", "identifier-delta", "candidate-manifest-durable-format-set-delta-v2", "candidate-manifest"],
  ["dependency-dag-delta", "identifier-delta", "candidate-manifest-dependency-edge-set-delta-v2", "candidate-manifest"]
] as const

/**
 * The exact Linux isolation policy used for every candidate-controlled process.
 * Dynamic host sources are named by their runner-owned authority; their exact
 * executable bytes are bound into TrialRunContextToolchain before execution.
 */
export const REQUIRED_ISOLATION_POLICY = {
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

export const InputBinding = Schema.Struct({
  id: ArtifactId,
  path: ExistingRepositoryPath,
  sha256: Sha256Hex
})
export type InputBinding = typeof InputBinding.Type

const ExecutionAction = Schema.Struct({
  id: ArtifactId,
  semantics: Description
})

const AdapterDefinition = Schema.Struct({
  executorId: Schema.Literal("candidate-harness-v2"),
  argv: Schema.NonEmptyArray(Description),
  inputTransport: Schema.Literal("canonical-json-stdin"),
  outputTransport: Schema.Literal("canonical-json-stdout"),
  stderrPolicy: Schema.Literal("empty"),
  workingDirectoryPolicy: Schema.Literal("isolated-candidate-copy"),
  timeoutMilliseconds: Schema.Literal(30_000),
  outputLimitBytes: Schema.Literal(1_048_576),
  networkAccess: Schema.Literal(false),
  credentials: Schema.Literal(false),
  mutatesExternalState: Schema.Literal(false)
})

const IsolationPolicy = Schema.Struct({
  policyId: Schema.Literal("bubblewrap-linux-offline-v1"),
  platform: Schema.Literal("linux"),
  bubblewrapExecutable: Schema.Literal("/usr/bin/bwrap"),
  namespaceArguments: Schema.Array(Schema.Literals([
    "--unshare-all",
    "--disable-userns",
    "--assert-userns-disabled"
  ])),
  networkPolicy: Schema.Literal("unshared-by-unshare-all"),
  sessionArguments: Schema.Array(Schema.Literals(["--new-session", "--die-with-parent"])),
  capabilityArguments: Schema.Array(Schema.Literals(["--cap-drop", "ALL"])),
  hostname: Schema.Literal("architecture-trial"),
  receiptBindings: Schema.Struct({
    bunVersionField: Schema.Literal("toolchain.bun"),
    bunExecutableSha256Field: Schema.Literal("toolchain.bunExecutableSha256"),
    bubblewrapVersionField: Schema.Literal("toolchain.bubblewrapVersion"),
    bubblewrapExecutableSha256Field: Schema.Literal(
      "toolchain.bubblewrapExecutableSha256"
    ),
    runnerNodeModulesSha256Field: Schema.Literal("runnerNodeModulesSha256")
  }),
  hostRuntimeTrust: Schema.Struct({
    mountSource: Schema.Literal("/usr"),
    mountDestination: Schema.Literal("/usr"),
    mountMode: Schema.Literal("read-only"),
    trustStatus: Schema.Literal("host-runtime-trust-base"),
    hermeticityClaim: Schema.Literal("not-fully-hermetic")
  }),
  runtimeDependencyTree: Schema.Struct({
    algorithmId: Schema.Literal("canonical-runtime-dependency-tree-manifest-sha256-v2"),
    hashDomain: Schema.Literal("ts-release/architecture-runtime-dependency-tree/v2"),
    manifestEncoding: Schema.Literal("CanonicalJsonV1"),
    manifestShape: Schema.Literal("ordered-array-of-RegularFile-or-SymbolicLink"),
    sourceAuthority: Schema.Literal(
      "retained-preflight-realpath-verified-then-snapshotted"
    ),
    mountDestination: Schema.Literal("/candidate/node_modules"),
    runContextSha256Field: Schema.Literal("runnerNodeModulesSha256"),
    pathSyntax: Schema.Literal(
      "NFC slash-relative with no empty, dot, dot-dot, or backslash segments"
    ),
    entryOrder: Schema.Literal("Unicode-code-point ascending by slash-relative path"),
    entryTypes: Schema.Array(Schema.Literals(["regular-file", "symbolic-link"])),
    directoryPolicy: Schema.Literal(
      "empty-directories-rejected-topology-implied-by-descendants"
    ),
    snapshotDirectoryMode: Schema.Literal("0755"),
    regularFileEntryShape: Schema.Literal(
      "RegularFile(path,mode,byteLength,bytesSha256)"
    ),
    regularFileModePolicy: Schema.Literal("canonical-git-modes-100644-or-100755"),
    regularFileBytesPolicy: Schema.Literal(
      "bytesSha256-is-sha256-of-exact-file-bytes"
    ),
    symlinkEntryShape: Schema.Literal("SymbolicLink(path,target)"),
    symlinkTraversalPolicy: Schema.Literal("lstat-and-do-not-follow"),
    symlinkTargetPolicy: Schema.Literal(
      "NFC relative target text resolving within dependency root"
    ),
    dotBinSymlinkPolicy: Schema.Literal("include"),
    absoluteSymlinkTargetPolicy: Schema.Literal("reject"),
    escapingSymlinkTargetPolicy: Schema.Literal("reject"),
    specialEntryPolicy: Schema.Literal("reject")
  }),
  threatModelBoundary: Schema.Struct({
    isolationGuarantees: Schema.Array(Schema.Literals([
      "filesystem-confidentiality-and-integrity",
      "network-isolation",
      "credential-nonexposure"
    ])),
    hostAvailabilityGuarantee: Schema.Literal("none"),
    candidateResourceExhaustion: Schema.Literal("out-of-scope"),
    memoryQuota: Schema.Literal("not-enforced"),
    blockQuota: Schema.Literal("not-enforced"),
    inodeQuota: Schema.Literal("not-enforced"),
    timeoutRole: Schema.Literal(
      "wall-clock-termination-only-not-resource-containment"
    )
  }),
  rootFilesystem: Schema.Struct({
    base: Schema.Literal("empty"),
    hostRootMount: Schema.Literal("forbidden"),
    readOnlyBinds: Schema.Array(Schema.Struct({
      sourceAuthority: Schema.Literals([
        "literal-host-runtime",
        "verified-run-context-bun-snapshot",
        "verified-run-context-runner-node-modules-snapshot"
      ]),
      source: Schema.Literals([
        "/usr",
        "exact-hash-bun-executable-snapshot",
        "exact-hash-runner-node-modules-snapshot"
      ]),
      destination: Schema.Literals(["/usr", "/runtime/bun", "/candidate/node_modules"]),
      kind: Schema.Literals(["directory", "file"])
    })),
    symlinks: Schema.Array(Schema.Struct({
      target: Schema.Literals(["usr/bin", "usr/lib", "usr/lib64"]),
      destination: Schema.Literals(["/bin", "/lib", "/lib64"])
    })),
    deviceFilesystem: Schema.Struct({
      destination: Schema.Literal("/dev"),
      policy: Schema.Literal("new-minimal-dev")
    }),
    procFilesystem: Schema.Struct({
      destination: Schema.Literal("/proc"),
      policy: Schema.Literal("new-proc")
    }),
    privateTmpfs: Schema.Array(Schema.Struct({ destination: Schema.Literal("/tmp") })),
    writableBinds: Schema.Array(Schema.Struct({
      sourceAuthority: Schema.Literal("fresh-candidate-copy"),
      destination: Schema.Literal("/candidate"),
      persistence: Schema.Literal("invocation-private")
    })),
    onlyPersistentWritableBindDestination: Schema.Literal("/candidate")
  }),
  workingDirectory: Schema.Literal("/candidate"),
  environment: Schema.Struct({
    clear: Schema.Literal(true),
    inheritedVariableNames: Schema.Array(Schema.Never),
    variables: Schema.Array(Schema.Struct({
      name: Schema.Literals(["PATH", "LC_ALL", "LANG", "TZ", "NO_COLOR", "TMPDIR"]),
      value: Schema.Literals(["/runtime:/usr/bin", "C", "UTC", "1", "/tmp"])
    }))
  }),
  forbiddenMountClasses: Schema.Array(Schema.Literals([
    "host-root",
    "home-directory",
    "root-home",
    "repository",
    "credential-store",
    "ssh-agent-socket",
    "gpg-agent-socket",
    "container-runtime-socket",
    "arbitrary-host-socket"
  ]))
})

export const ExecutionContract = Schema.Struct({
  contractSha256: Sha256Hex,
  caseActions: Schema.Array(ExecutionAction),
  probeActions: Schema.Array(ExecutionAction),
  caseAdapter: AdapterDefinition,
  probeAdapter: AdapterDefinition,
  gateAdapter: AdapterDefinition,
  isolationPolicy: IsolationPolicy,
  candidateOutputAuthority: Schema.Literal("raw-evidence-only"),
  evaluationAuthority: Schema.Literal("runner-only"),
  closedEnvironment: Schema.Struct({
    inheritedVariableNames: Schema.Array(Description),
    locale: Schema.Literal("C"),
    timezone: Schema.Literal("UTC"),
    credentialVariablePolicy: Schema.Literal("reject-and-strip"),
    proxyVariablePolicy: Schema.Literal("reject-and-strip")
  })
})
export type ExecutionContract = typeof ExecutionContract.Type

const SourceLane = Schema.Struct({
  id: MetricId,
  countsTowardProductSource: Schema.Boolean,
  inventoryRequired: Schema.Literal(true)
})

const MeasurementMethod = Schema.Struct({
  id: MetricId,
  unit: Schema.Literals([
    "sha256",
    "physical-lines",
    "files",
    "modules",
    "packages",
    "concepts",
    "branches",
    "identifier-delta"
  ]),
  algorithmId: MetricId,
  valueAuthority: Schema.Literal("runner-derived"),
  classificationAuthority: Schema.Literals([
    "filesystem",
    "candidate-manifest-lane",
    "candidate-manifest"
  ])
})

export const MeasurementContract = Schema.Struct({
  contractSha256: Sha256Hex,
  candidateManifestPath: PlannedRepositoryPath,
  candidateAdapterPath: PlannedRepositoryPath,
  inventoryPolicy: Schema.Literal("every-regular-file-exactly-once-no-symlinks"),
  physicalLineDefinition: Schema.Literal("UTF-8 LF count; a final unterminated segment counts as one line"),
  binaryProductSourcePolicy: Schema.Literal("reject"),
  binaryNonProductLineDeltaPolicy: Schema.Literal("git-binary-marker-maps-to-zero-lines"),
  canonicalTreeHashDomain: Schema.Literal("ts-release/architecture-canonical-tree/v2"),
  canonicalTreeEntryShape: Schema.Literal("path-mode-bytes-sha256"),
  patchHashDomain: Schema.Literal("ts-release/architecture-canonical-patch/v2"),
  patchEntryShape: Schema.Literal(
    "path-lane-before-mode-before-sha256-after-mode-after-sha256-additions-deletions"
  ),
  diffArgv: Schema.NonEmptyArray(Description),
  gitEnvironment: Schema.Struct({
    inheritedVariableNames: Schema.Array(Schema.Literal("PATH")),
    fixedVariables: Schema.Array(Schema.Struct({
      name: Schema.Literals([
        "LC_ALL",
        "LANG",
        "TZ",
        "NO_COLOR",
        "GIT_CONFIG_NOSYSTEM",
        "GIT_CONFIG_GLOBAL",
        "GIT_CONFIG_SYSTEM",
        "GIT_ATTR_NOSYSTEM"
      ]),
      value: Schema.Literals(["C", "UTC", "1", "/dev/null"])
    }))
  }),
  gitExecutablePolicy: Schema.Struct({
    resolution: Schema.Literal("preflight-resolve-once"),
    executableSha256Field: Schema.Literal("toolchain.gitExecutableSha256"),
    measurementInvocation: Schema.Literal("retained-resolved-absolute-path"),
    postPreflightPathLookup: Schema.Literal("forbidden")
  }),
  quantileMethod: Schema.Literal("nearest-rank"),
  sourceLanes: Schema.Array(SourceLane),
  methods: Schema.Array(MeasurementMethod),
  requiredToolchainBindings: Schema.Array(Schema.Literals([
    "bun",
    "typescript",
    "effect",
    "git",
    "bubblewrap"
  ]))
})
export type MeasurementContract = typeof MeasurementContract.Type

export const ReceiptContract = Schema.Struct({
  canonicalization: Schema.Literal("CanonicalJsonV1"),
  receiptHashDomain: Schema.Literal("ts-release/architecture-trial-receipt/v2"),
  timestamps: Schema.Literal("forbidden"),
  candidateManifestSchemaId: Schema.Literal("ts-release/architecture-candidate-manifest/v2"),
  runContextSchemaId: Schema.Literal("ts-release/architecture-trial-run-context/v2"),
  gateInvocationSchemaId: Schema.Literal("architecture-gate-invocation-v2"),
  gateObservationSchemaId: Schema.Literal("architecture-gate-observation-v2"),
  machineResultSchemaId: Schema.Literal("machine-trial-result-v2"),
  topologyResultSchemaId: Schema.Literal("topology-trial-result-v2"),
  machineResultRoot: PlannedRepositoryPath,
  topologyResultRoot: PlannedRepositoryPath,
  candidateFileNamePolicy: Schema.Literal("<candidate-id>.json"),
  requiredInputBindingIds: Schema.Array(ArtifactId),
  runnerSourceRoot: ExistingRepositoryPath,
  identityFieldIds: Schema.Array(ArtifactId)
})
export type ReceiptContract = typeof ReceiptContract.Type

export const CaseExecutionDefinition = Schema.Struct({
  definitionId: ArtifactId,
  fixtureId: ArtifactId,
  fixtureSha256: Sha256Hex,
  expectedEvidenceSha256: Sha256Hex,
  definitionSha256: Sha256Hex,
  executionContractSha256: Sha256Hex,
  executorId: Schema.Literal("candidate-harness-v2"),
  actionIds: Schema.NonEmptyArray(ArtifactId),
  faultIds: Schema.Array(ArtifactId),
  assertionIds: Schema.NonEmptyArray(ArtifactId),
  inputSchemaId: Schema.Literal("architecture-case-invocation-v2"),
  outputSchemaId: Schema.Literal("architecture-case-observation-v2")
})
export type CaseExecutionDefinition = typeof CaseExecutionDefinition.Type

export const ProbeExecutionDefinition = Schema.Struct({
  definitionId: ArtifactId,
  fixtureId: Schema.Literal("F01-shared-topology-fixture"),
  baseFixtureSha256: Sha256Hex,
  changeDefinitionSha256: Sha256Hex,
  definitionSha256: Sha256Hex,
  executionContractSha256: Sha256Hex,
  measurementContractSha256: Sha256Hex,
  executorId: Schema.Literal("candidate-harness-v2"),
  actionId: ArtifactId,
  inputSchemaId: Schema.Literal("architecture-probe-invocation-v2"),
  outputSchemaId: Schema.Literal("architecture-probe-observation-v2"),
  nonZeroObservationRequired: Schema.Literal(true)
})
export type ProbeExecutionDefinition = typeof ProbeExecutionDefinition.Type

const withoutHash = <A extends { readonly contractSha256: unknown }>(value: A): Omit<A, "contractSha256"> => {
  const { contractSha256: _contractSha256, ...body } = value
  return body
}

export const executionContractSha256 = (contract: ExecutionContract) =>
  hashCanonicalValue("ts-release/architecture-execution-contract/v2", withoutHash(contract))

export const measurementContractSha256 = (contract: MeasurementContract) =>
  hashCanonicalValue("ts-release/architecture-measurement-contract/v2", withoutHash(contract))

export const definitionSha256 = (kind: "case" | "probe" | "gate" | "topology-fixture", value: unknown) =>
  hashCanonicalValue(`ts-release/architecture-${kind}-definition/v2`, value)

export const fixtureSha256 = (kind: "case" | "topology", value: unknown) =>
  hashCanonicalValue(`ts-release/architecture-${kind}-fixture/v2`, value)

export const exactOrderedIssues = (
  label: string,
  actual: ReadonlyArray<unknown>,
  expected: ReadonlyArray<unknown>
): ReadonlyArray<string> => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return []
  return [`${label} must preserve the exact ordered v2 contract`]
}

export const positiveObservationCount = PositiveInt
