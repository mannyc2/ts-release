# Plan 207 — feature translation and capability cut

Input-Commit: c61669e
Result-Commit: 425449e
Evidence-Commit: SELF
Status: DONE
Outcome: PASS
Date: 2026-08-09

## Decision

Schema presence and historical upstream shape are not treated as executable support. The retained first slice is the set of native capabilities with vertical evidence; every other case is explicitly translated, externalized, deferred, or rejected.

## Frozen inputs

- 151 parity cases from the source-derived parity ledger.
- 44 current configuration families from the generated schema.
- 260 nested schema paths from the generated schema.
- 44 complete translation groups below, with unique coverage of all frozen inputs.

## S001: s001

- **Parity cases**: C001/c001 C045/c045 C089/c089 P018/p018
- **Current cases**: S001/s001
- **Current paths**: K001 K002 K003 K004 K005 K006 K007 K008 K009 K010 K011 K012 K013 K014 K015 K016 K017 K018 K019 K020 K021 K022 K023
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Executable native capability.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: RETAIN-NATIVE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S002: s002

- **Parity cases**: C002/c002 C046/c046 C090/c090 P019/p019
- **Current cases**: S002/s002
- **Current paths**: K024 K025 K026 K027 K028 K029 K030 K031 K032 K033 K034 K035 K036
- **Scenario**: The named consumer ecosystem needs a stable interchange format.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Consumer-facing interoperability boundary.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: COPY-INTEROP
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S003: s003

- **Parity cases**: C003/c003 C047/c047 C091/c091 P020/p020
- **Current cases**: S003/s003
- **Current paths**: K037 K038 K039 K040
- **Scenario**: A native process pipe or command primitive composes the behavior.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Native process composition.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose through a native CommandCheck or CommandArtifact process pipe; no upstream lifecycle is copied.
- **Disposition**: TRANSLATE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S004: s004

- **Parity cases**: C004/c004 C048/c048 C092/c092 P021/p021
- **Current cases**: S004/s004
- **Current paths**: K041 K042 K043 K044 K045 K046 K047 K048 K049 K050
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: EXTERNALIZE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S005: s005

- **Parity cases**: C005/c005 C049/c049 C093/c093 P022/p022
- **Current cases**: S005/s005
- **Current paths**: K051 K052 K053 K054 K055 K056 K057
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: DEFER
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S006: s006

- **Parity cases**: C006/c006 C050/c050 C094/c094 P023/p023
- **Current cases**: S006/s006
- **Current paths**: K058 K059 K060 K061
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: REJECT
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S007: s007

- **Parity cases**: C007/c007 C051/c051 C095/c095 P024/p024
- **Current cases**: S007/s007
- **Current paths**: K062 K063
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Executable native capability.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: RETAIN-NATIVE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S008: s008

- **Parity cases**: C008/c008 C052/c052 C096/c096 P025/p025
- **Current cases**: S008/s008
- **Current paths**:
- **Scenario**: The named consumer ecosystem needs a stable interchange format.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Consumer-facing interoperability boundary.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: COPY-INTEROP
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S009: s009

- **Parity cases**: C009/c009 C053/c053 C097/c097 P026/p026
- **Current cases**: S009/s009
- **Current paths**: K064 K065 K066 K067 K068 K069 K070 K071 K072 K073
- **Scenario**: A native process pipe or command primitive composes the behavior.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Native process composition.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose through a native CommandCheck or CommandArtifact process pipe; no upstream lifecycle is copied.
- **Disposition**: TRANSLATE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S010: s010

- **Parity cases**: C010/c010 C054/c054 C098/c098 P027/p027
- **Current cases**: S010/s010
- **Current paths**: K074 K075 K076 K077 K078 K079 K080 K081
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: EXTERNALIZE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S011: s011

- **Parity cases**: C011/c011 C055/c055 C099/c099 P028/p028
- **Current cases**: S011/s011
- **Current paths**: K082 K083 K084 K085
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: DEFER
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S012: s012

- **Parity cases**: C012/c012 C056/c056 C100/c100 P029/p029
- **Current cases**: S012/s012
- **Current paths**: K086 K087 K088 K089
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: REJECT
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S013: s013

- **Parity cases**: C013/c013 C057/c057 C101/c101 P030/p030
- **Current cases**: S013/s013
- **Current paths**: K090 K091
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Executable native capability.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: RETAIN-NATIVE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S014: s014

- **Parity cases**: C014/c014 C058/c058 C102/c102 P031/p031
- **Current cases**: S014/s014
- **Current paths**: K092 K093 K094 K095 K096 K097
- **Scenario**: The named consumer ecosystem needs a stable interchange format.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Consumer-facing interoperability boundary.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: COPY-INTEROP
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S015: s015

- **Parity cases**: C015/c015 C059/c059 C103/c103 P032/p032
- **Current cases**: S015/s015
- **Current paths**:
- **Scenario**: A native process pipe or command primitive composes the behavior.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Native process composition.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose through a native CommandCheck or CommandArtifact process pipe; no upstream lifecycle is copied.
- **Disposition**: TRANSLATE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S016: s016

- **Parity cases**: C016/c016 C060/c060 C104/c104 P033/p033
- **Current cases**: S016/s016
- **Current paths**: K098 K099
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: EXTERNALIZE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S017: s017

- **Parity cases**: C017/c017 C061/c061 C105/c105 P034/p034
- **Current cases**: S017/s017
- **Current paths**:
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: DEFER
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S018: s018

- **Parity cases**: C018/c018 C062/c062 C106/c106 P035/p035
- **Current cases**: S018/s018
- **Current paths**: K100 K101 K102 K103
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: REJECT
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S019: s019

- **Parity cases**: C019/c019 C063/c063 C107/c107 P036/p036
- **Current cases**: S019/s019
- **Current paths**: K104 K105 K106 K107
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Executable native capability.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: RETAIN-NATIVE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S020: s020

- **Parity cases**: C020/c020 C064/c064 C108/c108
- **Current cases**: S020/s020
- **Current paths**: K108 K109 K110 K111 K112 K113 K114 K115 K116
- **Scenario**: The named consumer ecosystem needs a stable interchange format.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Consumer-facing interoperability boundary.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: COPY-INTEROP
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S021: s021

- **Parity cases**: C021/c021 C065/c065 C109/c109
- **Current cases**: S021/s021
- **Current paths**: K117 K118 K119
- **Scenario**: A native process pipe or command primitive composes the behavior.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Native process composition.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose through a native CommandCheck or CommandArtifact process pipe; no upstream lifecycle is copied.
- **Disposition**: TRANSLATE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S022: s022

- **Parity cases**: C022/c022 C066/c066 C110/c110
- **Current cases**: S022/s022
- **Current paths**: K120 K121
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: EXTERNALIZE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S023: s023

- **Parity cases**: C023/c023 C067/c067 C111/c111
- **Current cases**: S023/s023
- **Current paths**: K122 K123 K124 K125 K126 K127 K128 K129 K130 K131
- **Scenario**: npm publication binds exact package bytes, package/version/dist-tag coordinates, and one explicit token or trusted-publisher authority policy.
- **Observable success**: The public API prepares the selected npm tarball, constructs the installed npm provider subject, observes exact registry facts, and dispatches only after provider-specific create authority.
- **Classification**: Executable npm provider capability restored by Plans 225 and 227.
- **Required information**: Exact package identity and bytes, canonical registry, dist-tag/access/provenance policy, and explicit token or trusted-publisher attestation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: The same installed npm module owns resolution fields, graph contribution, prepared-subject dispatch, recovery policy, and certification evidence.
- **Disposition**: RETAIN-NATIVE
- **Owner**: Plans 225 and 227 own the hard-cut npm authority grammar and executable module; Plan 207 retains the historical source-path inventory.
- **Evidence**: `test/api.test.ts`, `test/protocol/npm/npm-provider-protocol.test.ts`, strict schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S024: s024

- **Parity cases**: C024/c024 C068/c068 C112/c112
- **Current cases**: S024/s024
- **Current paths**: K132 K133 K134 K135 K136 K137
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: REJECT
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S025: s025

- **Parity cases**: C025/c025 C069/c069 C113/c113
- **Current cases**: S025/s025
- **Current paths**: K138 K139 K140 K141 K142 K143 K144
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Executable native capability.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: RETAIN-NATIVE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S026: s026

- **Parity cases**: C026/c026 C070/c070 C114/c114
- **Current cases**: S026/s026
- **Current paths**: K145 K146 K147 K148 K149
- **Scenario**: The named consumer ecosystem needs a stable interchange format.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Consumer-facing interoperability boundary.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: COPY-INTEROP
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S027: s027

- **Parity cases**: C027/c027 C071/c071 C115/c115
- **Current cases**: S027/s027
- **Current paths**: K150 K151 K152 K153 K154 K155
- **Scenario**: A native process pipe or command primitive composes the behavior.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Native process composition.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose through a native CommandCheck or CommandArtifact process pipe; no upstream lifecycle is copied.
- **Disposition**: TRANSLATE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S028: s028

- **Parity cases**: C028/c028 C072/c072 P001/p001
- **Current cases**: S028/s028
- **Current paths**: K156 K157
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: EXTERNALIZE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S029: s029

- **Parity cases**: C029/c029 C073/c073 P002/p002
- **Current cases**: S029/s029
- **Current paths**:
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: DEFER
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S030: s030

- **Parity cases**: C030/c030 C074/c074 P003/p003
- **Current cases**: S030/s030
- **Current paths**:
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: REJECT
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S031: s031

- **Parity cases**: C031/c031 C075/c075 P004/p004
- **Current cases**: S031/s031
- **Current paths**: K158 K159 K160 K161 K162 K163 K164 K165 K166 K167 K168 K169 K170 K171 K172 K173 K174 K175 K176 K177 K178 K179 K180 K181 K182 K183 K184 K185 K186 K187 K188 K189 K190 K191 K192 K193 K194 K195 K196 K197 K198 K199 K200 K201 K202 K203
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Executable native capability.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: RETAIN-NATIVE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S032: s032

- **Parity cases**: C032/c032 C076/c076 P005/p005
- **Current cases**: S032/s032
- **Current paths**: K204 K205 K206 K207 K208 K209 K210
- **Scenario**: The named consumer ecosystem needs a stable interchange format.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Consumer-facing interoperability boundary.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: COPY-INTEROP
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S033: s033

- **Parity cases**: C033/c033 C077/c077 P006/p006
- **Current cases**: S033/s033
- **Current paths**: K211 K212 K213 K214 K215 K216
- **Scenario**: A native process pipe or command primitive composes the behavior.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Native process composition.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose through a native CommandCheck or CommandArtifact process pipe; no upstream lifecycle is copied.
- **Disposition**: TRANSLATE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S034: s034

- **Parity cases**: C034/c034 C078/c078 P007/p007
- **Current cases**: S034/s034
- **Current paths**: K217 K218 K219 K220 K221 K222 K223 K224 K225
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: EXTERNALIZE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S035: s035

- **Parity cases**: C035/c035 C079/c079 P008/p008
- **Current cases**: S035/s035
- **Current paths**: K226 K227 K228
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: DEFER
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S036: s036

- **Parity cases**: C036/c036 C080/c080 P009/p009
- **Current cases**: S036/s036
- **Current paths**:
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: REJECT
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S037: s037

- **Parity cases**: C037/c037 C081/c081 P010/p010
- **Current cases**: S037/s037
- **Current paths**: K229 K230 K231 K232
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Executable native capability.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: RETAIN-NATIVE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S038: s038

- **Parity cases**: C038/c038 C082/c082 P011/p011
- **Current cases**: S038/s038
- **Current paths**: K233 K234
- **Scenario**: The named consumer ecosystem needs a stable interchange format.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Consumer-facing interoperability boundary.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: COPY-INTEROP
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S039: s039

- **Parity cases**: C039/c039 C083/c083 P012/p012
- **Current cases**: S039/s039
- **Current paths**: K235 K236 K237 K238 K239 K240
- **Scenario**: A native process pipe or command primitive composes the behavior.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Native process composition.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose through a native CommandCheck or CommandArtifact process pipe; no upstream lifecycle is copied.
- **Disposition**: TRANSLATE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S040: s040

- **Parity cases**: C040/c040 C084/c084 P013/p013
- **Current cases**: S040/s040
- **Current paths**: K241 K242 K243 K244
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: EXTERNALIZE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S041: s041

- **Parity cases**: C041/c041 C085/c085 P014/p014
- **Current cases**: S041/s041
- **Current paths**: K245 K246 K247 K248
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: DEFER
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S042: s042

- **Parity cases**: C042/c042 C086/c086 P015/p015
- **Current cases**: S042/s042
- **Current paths**: K249 K250 K251 K252 K253
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Explicitly outside the first executable slice.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: REJECT
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S043: s043

- **Parity cases**: C043/c043 C087/c087 P016/p016
- **Current cases**: S043/s043
- **Current paths**: K254 K255
- **Scenario**: The source case is classified against the current release-engine boundary.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Executable native capability.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: RETAIN-NATIVE
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## S044: s044

- **Parity cases**: C044/c044 C088/c088 P017/p017
- **Current cases**: S044/s044
- **Current paths**: K256 K257 K258 K259 K260
- **Scenario**: The named consumer ecosystem needs a stable interchange format.
- **Observable success**: The declared native capability produces its promised artifact, observation, or durable file.
- **Classification**: Consumer-facing interoperability boundary.
- **Required information**: Typed configuration, declared inputs, destination identity, and the exact evidence required by the operation.
- **Authority**: The typed candidate configuration and observed destination state; the derived graph is recomputable only.
- **Trust boundary**: Exact prepared bytes and provider-specific observations cross process boundaries; no derived graph is authority.
- **Durability**: Files and exact prepared bytes are durable; plans, reviews, and discovery graphs are ephemeral.
- **Failure behavior**: Fail closed with a typed error and preserve valid user jobs; never silently claim publication or recovery.
- **Composition**: Compose only through the retained typed release primitives.
- **Disposition**: COPY-INTEROP
- **Owner**: Plan 207 owns this translation; later capabilities must add a separate evidence-backed plan.
- **Evidence**: Source-derived manifests, vertical tests, schema validation, and the executable capability registry.
- **Deliberate exclusions**: Historical profile tables, generic rollback, schema-presence claims, and unreachable provider workflows.
- **Re-open bar**: A concrete valid job, provider observation, or user workflow must demonstrate a missing native primitive.

## Verification

Toolchain: Bun 1.3.14, TypeScript 6.0.3, Effect 4.0.0-beta.83, Node v22.22.0.

- 'bun docs/release-program/check-feature-translation.ts' — PASS.
- 'bun run check' — PASS.
- 'bun test' — 174 passing, 0 failing, 757 expectations.
- 'bun run check:config-schema' — PASS.
- 'bun run check:examples' — PASS (9 examples, 6 templates).
- 'bun run check:docs-claims' — PASS (10 claims across 3 files).
- 'bun run check:cli-bundle' — PASS under host-enabled Node execution.
- 'bun run check:portable' — PASS through typecheck/tests/core/app/action gates with host process execution enabled.
- Old-symbol and catalog remote-delivery searches are empty in the retired source surfaces.
- 'git diff --check' — PASS.

## Physical and semantic delta

Inclusive product TypeScript count changed from the program baseline 7,175 to 5,958 lines (−1,217). This is a causal delta, not a quota: disconnected profile tables, schema-only families, closed remote-operation variants, catalog submission commands, and detached tests were removed; the executable registry, strict migration refusal, case validator, and vertical claim test remain verification and authority code.

Evidence classes: source-derived, contract-tested.

Unresolved limitations: PyPI automatic recovery remains provisional pending Plan 208; catalog remote delivery belongs to Plan 215; the public lifecycle and old plan/apply/review protocol remain temporarily present until Plan 217. No publication, push, tag, workflow dispatch, or other external mutation occurred.
