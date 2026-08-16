# Two-runner frozen-dispatch probe

This disposable probe executes runner A and runner B as separate Node
processes. Durable JSON files are their only shared state.

It exercises one selected provider/dispatch shape and compares two identity and
replay alternatives. It does not discover or prove an exact field list.

## Exercised behavior

- `DispatchStarted` is written before send.
- Runner A can stop before send or after simulated response loss.
- Runner B re-prepares an immutable core HTTP request.
- Compare-and-swap permits only one fresh runner to send.
- Unknown replay scheme and opaque transport stop with structured reasons.
- The original strict candidate stops on behavior/lockfile drift.
- A separate identity comparison shows that core-derived operation identity is
  stable across provider implementations and that equal wire facts can support
  a bytes-sufficient policy even when implementation provenance differs.

## What it proves

- the selected shapes compile and execute consistently;
- the fixture sends only after winning its CAS seam;
- a core-derived operation ID does not require provider-executed projection;
- strict implementation blocking and wire-correspondence replay are different
  policies with different outcomes.

## What it does not prove

- that the selected field list is necessary, minimal, or preferable;
- that equal request bytes establish provider idempotency;
- that the fake remote models npm, Warehouse, GitHub, or another live provider;
- that behavior or lockfile identity should be replay authorities;
- that the local directory lock is a production journal backend;
- durable storage, real response-loss behavior, or production Effect APIs.
