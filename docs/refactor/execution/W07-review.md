# Independent W07 review

Reviewer: Hypatia (`/root/review_beta_declaration`), inherited GPT-6 Astra task
context. Bounded independent review; implementation stayed with the root. All
material CLI and external-provider findings are closed. Final full candidate review
remains required after all waves and native host/publication acceptance.

The CLI review reproduced default Effect logs on stdout, Node exiting a waiting
Effect without cleanup, and SIGTERM hanging behind an unread1MiB report pipe.
The implementation now supplies LogToStderr, owns a process keepalive, and tears
down signal exits only after awaited application scope finalization. Native
Node22.22.2 and Bun1.3.14 pass15focused tests/88assertions plus13native pipe
assertions each. Independent150ms delayed/logging finalizers pass both signals
and runtimes, with release markers present before130/143. FIFO inputs reject;
closed output is consumed without raw errors. Arbitrary synchronous trusted
application code cannot be cooperatively interrupted; no broader claim is made.

External native-status review demonstrated false Satisfied from HTTP500 plus a
valid observation and HTTP202 plus a created receipt. Exact200 reads and
201/created or202/pending writes now admit; both mismatches reject. Real HTTPS
negative controls retain uncertain committed writes without receipts or retry.
Opaque Account acquisition moved to transport.prepare before DispatchStarted;
missing account tests now prove zero starts and zero native writes. Native tagged
errors use explicit codec encoding on the wire; typed correspondence callbacks
accept already decoded Schema error instances without re-decoding hidden stacks.
Excess wire fields and wrong typed bindings reject independently.

The reviewer independently verified all78frozen bindings including owned SPDX
JSON, exact installed package inventories, optional-peer absence and both archive
hashes in the four fresh Bun/npm Node/Bun consumers. Each cell passed199checks
and35CLI processes. The forced journal barrier puts two distinct processes at
revision0; exactly one Appended and one AmbiguousStorageOutcome were observed,
with one actual HTTP commit and one DispatchStarted. Native Git histories directly
confirm one start/no receipt for killed HTTP and opaque cases, and zero starts for
missing opaque credentials. Git race captures show two actual expected-old lease
pushes, statuses0/1, against the identical initial commit. Restarts do not repeat
mutation. Consumers wait for child close and reject incomplete JSON output.

The initial HTTP counter12 counted requests, including one denied non-commit;
it is explicitly reported as12requests/11commits per cell. These custom destination
fixtures qualify the external contract locally; they do not qualify real npm/PyPI/
GitHub/catalog publication, hosted trust, native Windows/macOS delivery, or the
full seven-package release. Independent accounting review before seal confirms13757=9737replacement+4020legacy,
all714source-ledger bindings,72actualsource/declarationfiles,89unique logical modules
and zero retirement rows. W07adds90lines (CLI77+bin7+application6). Forecast12728
exceeds unchanged11485by1243; metadata620 and ownedSPDX789/15973 remain separate
and conservatively combined. Original native obligations and W08-W10 duties remain.
Source ceiling and selected scope remain unchanged; this is not an achieved reduction.
