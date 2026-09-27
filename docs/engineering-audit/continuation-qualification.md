# Coordinated provider, application and recovery qualification

The frozen continuation starts at `a7043878ef964dac1ebcff6e3a2569471c5dc0e9`.
Provider admission, self-release admission, bounded observation and executor
selection were qualified together before their separate local commits. This is
evidence for those combined inputs, not a claim that each intermediate commit
independently ran the complete profile. Effect/platform remain rc.115; the host
is Linux x64, Bun 1.3.14 and native Node 22.22.2.

## Stages and corrections

All build/pack/delivery stages ran sequentially under the existing nonblocking
`/tmp/the-show-full-verification.lock`, with tracked runtime inputs frozen.

| Stage                          | Result and interpretation                                                                                                                                                                                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First static batch             | Stopped on `preferTypedSchemaDecoder` in preparation. The typed Repository input now uses `decodeSync`; no behavior stage ran.                                                                                                                                                                                    |
| Second static batch            | Stopped on four contravariant test factory callbacks and a missing `return yield*` in the observation proof. The fixtures now close over their owned input; no runtime implementation changed.                                                                                                                    |
| Final static batch             | `bun run check` exited 0: compiler/Effect diagnostics, lint, formatting, exports and import rules passed (95 production files, 672 edges, 15 entries, two owned computed loads).                                                                                                                                  |
| Full behavior command          | Delivery generation passed; tests finished **354 passed, one failed, 3,765 assertions, 61 files**. The only failure was the overstrong OpenAI expectation described below. This is not reported as an uninterrupted green full suite.                                                                             |
| Corrected existing OpenAI case | **One pass, 14 assertions, six filtered**, using current built core. Explicit `sha: undefined` retains its historical `invalid-json` refusal before marketplace admission; other existing rows retain `openai-marketplace`. Only that assertion changed. The other 354 passing results remain applicable.         |
| Initial packed command         | Stopped during consumer installation because sandboxed Bun could not access temporary storage. No installed consumer test ran. Before retry, the new declaration fixture's accidental fourth Effect-runner argument was corrected to its three-argument API; it had not reached compilation.                      |
| Packed core                    | Passed Bun/npm physical installs, public entries, runtime behavior and strict declarations, including the new runtime policy Schema and bounded-mode factory E/R inference.                                                                                                                                       |
| Packed providers               | `bun scripts/check-packed-npm.ts --catalog` passed **61 commands**, seven archives, Bun/npm installs and Node/Bun consumers. Native HTTP/TLS/Git transport profiles were not selected by this command; their existing full-suite and installed-workflow owners ran separately.                                    |
| Packed Action                  | Passed Bun/npm installed-core resolution, absent optional peers, fresh-runner continuation and one send in each fixture.                                                                                                                                                                                          |
| Installed workflow             | `--skip-build` reused the immediately preceding delivery build. Ordinary/interrupted CLI and Action observation, continuation and completed recognition passed.                                                                                                                                                   |
| Checkout executor installation | The actual installer admitted the retained signed 0.4.1 candidate, installed seven current 0.4.2 archives physically and retained `executor.json`. Candidate content was not regenerated. Historical behavior proof is recorded separately.                                                                       |
| Isolated generated starter     | The old helper stopped before installation because it expected a npm-only receipt filename. An adapted temporary copy accepted the actual seven-package receipt; Node preparation and Bun input generation then passed from physical current archives. This did not execute verification, signing or publication. |

The expanded installed declaration fixture fills one new public-API obligation:
the runtime policy export must exist and passing that policy must preserve a
caller's factory E/R. It extends the existing inference fixture, rather than
adding another matrix. Legacy default/Promise behavior retains its existing
runtime proofs. No retrospective test-first claim is made for this declaration
extension.

## Identities and raw records

`/tmp/ts-release-continuation-qualified-inputs.json` records 44 changed non-Markdown
input hashes plus the three existing packed receipts. Its SHA256 is
`d31c9c9b300fba4a08dcaf6d30d4d09956cb0a28d1e53ad4ad709d275571f51a`.
Subsequent documentation-only edits are outside these archive identities.

| Archive | SHA256                                                             |
| ------- | ------------------------------------------------------------------ |
| core    | `1759342214635566f6e08a5960f9dc95bb1ab01316608a7d8561566d1c29c6d3` |
| npm     | `9c26b33eb3b8041b788822a8289e567b3a566b2a8b79a5525a07630af0d38cd9` |
| PyPI    | `bf4834bb6633a59fc57b0c9508eae53dfac03b1cd8666dda611faf4c1bd56bf6` |
| GitHub  | `6c82b02debcf0d1e699db6a49dfd0d161e041c85c4d45a13bc3e8f114bedf64d` |
| Catalog | `7a500c905bdf102d84ea3258177983d4aeda3000b5e392f509ec32f8f495dc0f` |
| MCP     | `ce5ba547032de6740fb477a4dc882942101c16918e63a48a17e84657b4ef7901` |
| OpenAI  | `7db0236ca9ebe14b21dc737721451f5c62fa79193960cc467f3bd6e6f89f8643` |

The provider receipt is `.release/checks/current-packed-catalog.json`, SHA256
`0071c4fb5cb3650918df70d9de92d5bb7b345c46a2dedf6c75122e69eee29565`, with
work directory `/tmp/ts-release-packed-npm-npyMgE`. Packed core used
`/tmp/ts-release-packed-kernel-e8BSst`; Action used
`/tmp/ts-release-packed-action-AmFc0T`; installed workflow used
`/tmp/ts-release-installed-workflow-OtHclt`.

Logs:

- `/tmp/ts-release-coordinated-continuation-check{,-final,-qualified}.log`.
- `/tmp/ts-release-coordinated-continuation-test.log` (SHA256
  `b485eb2422cd5a057f31d58a72c7fd758627330260ff7b2e2a67e9ccc29decf2`).
- `/tmp/ts-release-provider-policy-openai-correction.log`.
- `/tmp/ts-release-continuation-packed-kernel{,-qualified}.log`.
- `/tmp/ts-release-continuation-packed-{providers,action}.log` and
  `/tmp/ts-release-continuation-installed-workflow.log`.
- `/tmp/ts-release-continuation-executor-install.log` and
  `/tmp/ts-release-continuation-starter{,-qualified}.log`.

The successful isolated starter report is
`/tmp/ts-release-current-starter-az2nxS/qualification.json`, SHA256
`4e25ac9adeebd79adea8d9b2f7c074014769f6febf060a21338d4e97b01c473a`.
It records source/generated/archive hashes, physical dependency resolution,
actual preparation identities and `authorize: false` input. The failed helper's
report remains at `/tmp/ts-release-current-starter-uUzUsQ/qualification.json`.

No registry publication, live signing, hosted workflow, Node24/26, macOS or
Windows qualification is inferred. Later cleanup/preflight changes require
their own affected qualification. The original workspace staging remains
separate, and publication of these local descendants remains unapproved.
