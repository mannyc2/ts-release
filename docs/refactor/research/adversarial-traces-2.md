# Source-specific replay evidence supplement

Status: source index for the canonical traces in `adversarial-traces.md`. This file does not define another journal model.

## Idempotency-key expiry and scope

- Stripe API v1 replay: same key within 24 hours.
- Stripe API v2 replay: same API, same account/sandbox, within 30 days.
- AWS Cloud Control client token: 36 hours.
- Google request IDs: commonly at least 60 minutes.

Sources:

- https://docs.stripe.com/api-v2-overview
- https://docs.aws.amazon.com/cloudcontrolapi/latest/APIReference/API_CreateResource.html
- https://docs.cloud.google.com/backup-disaster-recovery/docs/reference/rest/v1/projects.locations.serviceConfig/initialize

These sources refute a replay model that records only an unscoped key string.

## Request-status reconciliation

AWS Cloud Control mutations return a `ProgressEvent` with `RequestToken`; `GetResourceRequestStatus` observes the request.

- https://docs.aws.amazon.com/cloudcontrolapi/latest/APIReference/API_GetResourceRequestStatus.html
- https://docs.aws.amazon.com/cloudcontrolapi/latest/userguide/resource-operations.html

This supports a separate observation capability. It does not make request status a replay-protection scheme.

## Conditional Git

Explicit `--force-with-lease=<ref>:<expect>` updates only if the remote ref matches `expect`.

- https://git-scm.com/docs/git-push

This is a structural replay proof because the same expected-old condition fences a second successful update.

## Warehouse duplicate behavior

Pinned Warehouse source:

- exact filename plus matching hashes -> HTTP 200 with transaction doomed;
- filename reused with different content -> HTTP 400;
- each distribution file is uploaded independently.

Source:

- https://github.com/pypi/warehouse/blob/4bdd89d85bc522a0d555a871ffe250d644c660dc/warehouse/forklift/legacy.py

This supports exact-request duplicate safety only for the pinned Warehouse behavior and equivalent request/content.

## Temporal external-effect gap

Temporal documents that an Activity can complete external work and crash before reporting completion; it is then retried. Idempotency is enforced by the called service, not Temporal.

- https://github.com/temporalio/documentation/blob/7f42b11f9ea68c1b463527fc1c13150a61c5cd16/docs/encyclopedia/activities/activity-definition.mdx

This is the same boundary the ts-release journal must expose honestly.
