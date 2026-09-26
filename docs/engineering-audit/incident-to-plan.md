# Adopter incidents mapped to engineering and product work

> Historical engineering research snapshot, captured on 2026-09-26 before the current implementation milestone. Baseline findings, counts and proposed work describe that captured state; they are not current completion claims. See [current implementation status](implementation-status.md) for the bounded milestone, actual verification and remaining work. These are task research documents, excluded from published packages.

The first audit's [census and case studies](../adoption-audit/README.md) remain
the historical evidence ledger: four verified adopters among 46 accessible
repositories, with declared limitations. This pass does not claim a new
repository census or a fresh download of every historical job log. It revisits
the interpretation and turns each finding into a current disposition and a
proof requirement. The source audits' stricter testing policy supersedes the
earlier suggestion to turn every historical row into a new regression fixture.

IDs below link to the detailed source reports; they are findings, not a count of
independent engine bugs. Duplicate reports of one underlying correction remain
one root cause. All proposed work references the [requirements](requirements.md)
and [waves](refactor-plan.md).

## Direct adopter findings

| Finding | Current disposition | Plan and cheapest sufficient proof |
| --- | --- | --- |
| [BB-1](../adoption-audit/effect-agent-browserbase.md#bb-1--successful-oidc-exchange-rejected-because-timestamp-metadata-was-treated-as-authorization): OIDC timestamp metadata rejected a valid token | Engine correction adopted in 0.4.1; overlaps TS-8. | W3/R08/R27: retain the tolerant token schema and exact authorization binding. Inspect/run existing native credential acceptance; add no duplicate case unless a real response shape escapes it. |
| [BB-2](../adoption-audit/effect-agent-browserbase.md#bb-2--asynchronous-publish-acknowledgement-became-an-uncertain-dispatch): successful acknowledgement decoded as unknown | Engine correction adopted in 0.4.1; overlaps TS-9. Durable recovery worked. | Preserve acknowledgement decoding under W3; W6.1/R32 addresses the separate visibility wait. Existing journal/transport acceptance must prove no resend. |
| [BB-3](../adoption-audit/effect-agent-browserbase.md#bb-3--generic-cli-failure-obscured-the-real-release-error): generic CLI failure | Safe code/message output fixed in 0.4.1; richer stage/recovery guidance remains an opportunity. | W3/W6.5/R10/R35: retain safe output using the actual installed CLI/Action. Do not expose secrets or reclassify programming defects to obtain a convenient message. |
| [BB-4](../adoption-audit/effect-agent-browserbase.md#bb-4--evidence-reuse-could-block-the-full-validation-fallback): failed evidence reuse prevented fallback | Consumer orchestration defect, not a kernel dispatch bug. | W6.4/R30/R34: document and demonstrate exact-source reuse and a valid miss/fallback in the existing workflow recipe. Do not build a second universal CI engine. |
| [BB-5](../adoption-audit/effect-agent-browserbase.md#bb-5--release-validation-was-repeated-for-approximately-an-hour): duplicated qualification | Consumer cost observation. | W5/R31 and W6.4: measure stage timings and remove repeated qualification/builds before caching. Prove the retained tarballs are those qualified; no test-count target. |
| [BB-6](../adoption-audit/effect-agent-browserbase.md#bb-6--hand-maintained-status-prose-trails-authoritative-release-evidence): stale release prose | Documentation maintenance problem. | W6.5/R04/R35: derive exact support coordinates from released artifacts and journal evidence. Do not add another manually maintained release ledger. |
| [REC-1](../adoption-audit/reactor-effect-client.md#rec-1--five-releases-outlasted-the-observation-budget-after-successful-publication-acknowledgement): five visibility-budget overruns | Surviving operator friction under 0.4.2. Not proof of failed uploads. | W6.1/R13/R32: one bounded observation session with deadline/backoff, per-member pending state and observation-only continuation. Existing native peer plus retained journal demonstrates unchanged dispatch counts; isolate clock behavior only if the real workflow cannot adequately prove the deadline. |
| [REC-2](../adoption-audit/reactor-effect-client.md#rec-2--large-native-publication-passed-preparation-but-failed-http-request-admission): native request overflowed the JSON lexer | Engine parser fixed in 0.4.2; overlaps TS-13. Whole-release transport-path preflight is still incomplete. | W6.3/R14/R34: reuse the retained 18,235,775-byte shape and current native wire check. Distinguish provider encoder success from actual transport admission; a malformed resolvable npm member must fail before earlier uploads. Requests needing future provider receipts must be explicitly deferred, not given invented evidence. |
| [REC-3](../adoption-audit/reactor-effect-client.md#rec-3--restoring-the-original-application-commit-prevented-recovery-with-repaired-dependencies): original-host pin blocked a repaired executor | Consumer fixed source/executor separation; shared support remains useful. | W6.2/R15/R33: restored original bytes, original journal and request hashes under repaired code, with no candidate rebuild or blanket replay permission. |
| [REC-4](../adoption-audit/reactor-effect-client.md#rec-4--neither-kind-of-ci-rerun-could-originally-produce-an-eligible-replacement-artifact): rerun/attempt/artifact mismatch | Established by workflow review; no specific failed hosted rerun claimed. | W6.4/R30/R34: exact producer attempt/artifact identity and full-rerun semantics in the recipe. Failed-jobs-only eligibility must be explicit, not made permissive to force a pass. |
| [REC-5](../adoption-audit/reactor-effect-client.md#rec-5--a-copied-effect-policy-constant-blocked-release-qualification-after-an-sdk-dependency-update): duplicated policy pin | Consumer fix landed; illustrates schema/fixture duplication. | W3/W6.4/R08/R22: derive product policy from one owner and admit actual packed identity data. Keep product Effect range separate from publishing runtime pin. |
| [Reactor historical-candidate risk](../adoption-audit/reactor-effect-client.md#current-review-risk-repaired-hosts-still-need-historical-candidate-compatibility) | Code-review risk, not a stranded release; all inspected journals completed. | W6.2/R33: versioned candidate-policy admission. A new executor's current ABI/Effect/SBOM schema must not silently redefine an old format. Use an actual retained old candidate as proof; current candidates must retain current policy. |
| [EB-1/2](../adoption-audit/effect-build.md#eb-1-a-clean-supported-install-failed-even-when-declaring-the-required-effect-peers): clean-install peer drift and consumer runtime conflict | Historical 0.2.2 library/install blockers; not a claim that the same pin defect exists in 0.4.2. | W1/W5/R22/R29: existing clean packed installers, independently aligned runtime peers and bundled-host isolation. Test fresh resolution; a frozen root lockfile alone is insufficient. |
| [EB-3/4](../adoption-audit/effect-build.md#eb-3-the-released-cliaction-could-not-express-the-workspaces-package-graph): single-package authoring and forced repacking | Corrected in the qualified historical Action; current native library already has Bundle/Plan/adoption and dependency ordering. | W6.4/R15/R34: start from current `prepareRelease` and public primitives, extract only missing shared behavior. Prove original qualified archive bytes survive handoff; do not invent a new release graph. |
| [EB-5](../adoption-audit/effect-build.md#eb-5-the-integration-required-substantial-repository-specific-transfer-and-verification-code): integration burden | Measured whole-file cost, not proof that all lines were unnecessary or that size caused removal. | W6.4/R03/R34: trace shared versus product-owned responsibilities, delete duplicate identity/handoff mechanisms where supported. Acceptance is a simpler real consumer workflow with preserved contracts, not a percentage reduction in LOC. |
| [EB-6](../adoption-audit/effect-build.md#eb-6-qualification-initially-targeted-an-unreleased-exact-version): unavailable expected version | Availability/documentation friction. | W6.5/R04/R22: supported instructions name actual published package/Action identities and qualified combinations, not roadmap versions. |
| [NT-1](../adoption-audit/nyc-transit-kit.md#nt-1--missing-runtime-dependency-broke-release-preparation): missing packaged runtime dependency | Legacy 0.0.7-era defect/workaround. | W2/W5/R21/R29: real archive dependency closure and installed entrypoint; retain current stronger acceptance rather than reimplementing the old wrapper. |
| [NT-2](../adoption-audit/nyc-transit-kit.md#nt-2--npm-authentication-configuration-was-not-honored-during-validation): child npm auth plumbing | Legacy consumer/native-process boundary; do not transplant ambient npm config into the new credential model. | W4/W6.5/R07/R35: explicit credential routing and actual native-client arguments/environment. Credential preflight cannot be represented as publication. |
| [NT-3](../adoption-audit/nyc-transit-kit.md#nt-3--invalid-action-yaml-prevented-the-job-from-starting): invalid Action metadata | Historical distribution defect. | W5/R29: validate the distributed metadata and actual launcher through existing packaged acceptance. Source unit success cannot prove an Action starts. |
| [NT-4](../adoption-audit/nyc-transit-kit.md#nt-4--published-npm-packages-plus-an-absent-github-release-required-manual-recovery): partial multi-target release | Historical production recovery; old logs limit causal precision. | W6.2/R15/R33: retain per-target facts and exact candidates; installed workflow/fresh journal recovery is the relevant proof. Do not claim atomicity across registries. |
| [NT-5](../adoption-audit/nyc-transit-kit.md#nt-5--npm-propagation-made-successful-side-effects-appear-to-be-a-failed-release): propagation false failure | Legacy symptom related to surviving REC-1 friction, with different engine behavior. | W6.1/R32: distinguish accepted, pending visibility, observed and conflicting. Do not collapse both histories into one identical root cause. |
| [NT-6](../adoption-audit/nyc-transit-kit.md#nt-6--draft-visibility-and-the-completion-predicate-disagreed): draft/completion mismatch | Historical predicate/consumer-state issue. | W3/W6.5/R08/R15: retain genuine draft-to-published provider transitions and stable identity, distinguishing expected draft state from missing completion. |
| [NT-7](../adoption-audit/nyc-transit-kit.md#nt-7--the-engine-error-omitted-the-actionable-operation-failure): opaque errors | Historical diagnostics gap; current safe code output is already improved. | W6.5/R35: specific safe next action from durable state through real CLI; no blanket dump of provider exceptions. |
| [NT-8](../adoption-audit/nyc-transit-kit.md#nt-8--consumer-git-detection-treated-checkout-metadata-as-a-regular-file): checkout detection | Consumer defect, not ts-release kernel behavior. | W6.4/R07/R34: recipes should use Git's actual repository/worktree discovery rather than filesystem guesses. No kernel feature or dedicated fixture is justified solely by this row. |

## Upstream corroboration, without double counting

The [self-release ledger](../adoption-audit/self-release-corroboration.md)
contains thirteen entries. Each correction remains historical evidence; these
are not thirteen newly open bugs.

| IDs | Engineering implication and plan disposition |
| --- | --- |
| TS-1 | Actual `@actions/artifact` digest contract, not a fake approximation: W5/W6.4, R27/R30. |
| TS-2/3 | Optional metadata and real producer artifact variants: W3/W6.3, R08/R27/R34. Do not reintroduce stricter invented schemas. |
| TS-4/6 | Exact workflow/job/environment OIDC identities: W3/W6.5, R08/R35. Keep credential checks separate from publishing authorization. |
| TS-5 | Partial publication versus retained-proof completeness: W6.2/W6.5, R15/R33/R35. A successful mutation does not manufacture absent retention evidence. |
| TS-7 | Repaired host plus fresh-install alignment: W1/W6.2, R22/R33. Dependency drift was independently reproduced, not proven to cause the hosted failure. |
| TS-8/9 | Same root corrections as BB-1/2/3: retain fixed token/2xx behavior and safe diagnostics; no duplicate feature or counted incident. |
| TS-10/11/12 | Actual Actions-token view and draft/published asset identity: W3/W5, R08/R15/R27. Inspect current existing native provider proof before proposing cases. |
| TS-13 | Same native request parser correction as REC-2: preserve its existing large-body acceptance and close the preflight gap, W6.3. |

## Adjacent evidence from effect-build's replacement publisher

[EB-A1–A10](../adoption-audit/effect-build.md#subsequent-release-incidents-adjacent-lessons-not-ts-release-defects)
occurred after ts-release was removed. They motivate design, not claims of
ts-release defects: A1/A5/A6 require actual npm/Sigstore/Bun boundaries (R27);
A2/A9 require real candidate/environment context (R30); A3 requires one owned
credential endpoint contract (R08/R35); A4/A10 motivate repaired-host recovery
and observation policy (R32/R33); A7 requires realistic retained version history
(R15); A8 motivates deleting unnecessary qualification/handoff machinery first
(R03/R31/R34).

## Scope of the improved incident audit

The original four-case evidence is retained with its fix status and limitations.
This pass additionally checked current 0.4.2 `Release.ts` observation and
dispatch preparation paths, self-release `prepareRelease`, the shared data/error
boundaries and the new peer requirements. It establishes where the prior backlog
was too generic or duplicated functionality already present. New production
failures are not inferred from source counters, lint differences, or this plan.

The remaining research before implementing a product increment is specific:
identify its existing strongest proof, inspect the exact retained candidate or
response it will use, and resolve the ownership/compatibility decision named in
W6. There is no justification for rerunning paid releases, credential exchanges,
or every historical workflow merely to enlarge this report.
