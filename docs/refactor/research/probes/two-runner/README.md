# Frozen-dispatch two-runner probe

This disposable probe discriminates the provider-definition and replay design without implementing production release APIs.

It runs runner A and runner B as separate Node processes. Durable JSON files are their only shared state. The probe covers:

- crash after `DispatchStarted` and before send;
- response loss after a simulated remote commit;
- exact re-preparation and deterministic replay through `core.http/1`;
- strict behavior/lockfile drift with an equal request fingerprint;
- unknown replay-scheme and opaque-transport stops;
- two fresh runners racing to append the continuation before send.

`shape.ts` makes the five-field `ProviderDefinition` and singular-operation `DispatchStarted` field lists compile-time assertions. `two-runner-probe.mjs` exercises the runtime trace.

The local directory lock is intentionally only a CAS seam for this probe. It is not evidence that the filesystem is the selected production journal backend.
