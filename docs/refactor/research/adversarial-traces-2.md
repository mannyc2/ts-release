# Source-specific replay and storage evidence supplement

Status: source index for `adversarial-traces.md`. This file does not define a second journal or replay model.

## Idempotency scope and expiry

Out-of-scope provider examples prove that an idempotency token must bind request equivalence, scope, and time rather than being modeled as an unscoped string:

- Stripe documents bounded key reuse and request-parameter equivalence;
- AWS Cloud Control accepts a caller-supplied client token and expires it after 36 hours;
- documented Google request IDs have bounded duplicate-suppression windows.

Sources:

- https://docs.stripe.com/api-v2-overview
- https://docs.aws.amazon.com/cloudcontrolapi/latest/APIReference/API_CreateResource.html
- https://docs.cloud.google.com/backup-disaster-recovery/docs/reference/rest/v1/projects.locations.serviceConfig/initialize

R2 found no fixed vNext provider requiring secret token persistence. See `idempotency-material.md`.

## Request-status reconciliation

AWS Cloud Control returns a request token and exposes request-status observation. This supports committed, terminal non-commit, pending, and unknown states. It does not make the token replay protection.

Sources:

- https://docs.aws.amazon.com/cloudcontrolapi/latest/APIReference/API_GetResourceRequestStatus.html
- https://docs.aws.amazon.com/cloudcontrolapi/latest/userguide/resource-operations.html

## Conditional Git

Explicit `--force-with-lease=<ref>:<expect>` updates only when the remote ref still matches the expected value. This is the provider-side condition recorded as `replay.cas/1`.

Source:

- https://git-scm.com/docs/git-push

## Warehouse exact duplicate

Pinned Warehouse source accepts the same filename with matching hashes and rejects conflicting content. Each distribution file is uploaded independently.

Source:

- https://github.com/pypi/warehouse/blob/4bdd89d85bc522a0d555a871ffe250d644c660dc/warehouse/forklift/legacy.py

## npm composite PUT

Pinned npm source constructs one document containing version metadata, initial dist-tag, and attachment bytes, then sends one package request. This supports one composite operation/receipt rather than operation members.

Source:

- https://github.com/npm/cli/blob/51c2bf81fa2c31547d0fec44fff2aaac3d9a9862/workspaces/libnpmpublish/lib/publish.js

## GitHub release and asset requests

Official GitHub APIs expose release creation and asset upload as separate endpoints/requests and document no general idempotency-key field for either.

Sources:

- https://docs.github.com/en/rest/releases/releases#create-a-release
- https://docs.github.com/en/rest/releases/assets#upload-a-release-asset

## Filesystem CAS caveats

Linux documents `O_EXCL` and hard-link semantics, including network-filesystem caveats. The selected local algorithm installs a fully written/synchronized candidate through a unique hard-link generation path and excludes generic network filesystems.

Sources:

- https://www.man7.org/linux/man-pages/man2/open.2.html
- https://man7.org/linux/man-pages/man2/link.2.html
- https://www.man7.org/linux/man-pages/man3/fsync.3p.html

## SQLite

SQLite permits one writer, `BEGIN IMMEDIATE` obtains the write transaction early, and a conditional update distinguishes the winner. SQLite separately warns that network-filesystem locking can be unreliable.

Sources:

- https://www.sqlite.org/lang_transaction.html
- https://www.sqlite.org/rescode.html
- https://www.sqlite.org/lockingv3.html

## S3 conditional head

S3 documents ETag `If-Match` conditional writes and strong read-after-write consistency. The journal algorithm uses immutable segments plus one small conditional head object.

Sources:

- https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html

## CI artifacts

GitHub Actions artifact uploads are immutable transport with bounded retention. They do not expose the conditional mutable head required by the journal.

Sources:

- https://github.com/actions/upload-artifact
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository

## Durable engines

Temporal documents the external-effect gap: an Activity may complete external work and crash before completion is recorded, after which it is retried. Durable execution therefore does not remove provider idempotency/reconciliation requirements.

Source:

- https://github.com/temporalio/documentation/blob/7f42b11f9ea68c1b463527fc1c13150a61c5cd16/docs/encyclopedia/activities/activity-definition.mdx
