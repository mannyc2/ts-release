# npm and Warehouse wire models

Status: provider-protocol companion to `provider-contracts.md`. It records wire facts and the operation shapes they force; it does not select a public API.

## npmjs initial publication

Primary sources:

- https://github.com/npm/cli/blob/v12.0.2/workspaces/libnpmpublish/lib/publish.js
- https://github.com/npm/cli/blob/v12.0.2/lib/commands/publish.js
- https://docs.npmjs.com/cli/v12/commands/npm-publish/

Pinned `libnpmpublish` constructs one package document containing:

```text
versions[manifest.version] = manifest
dist-tags[tag] = manifest.version
_attachments[tarballName] = tarball bytes
```

and sends one package PUT. Therefore the initial publish is one logical operation and one physical dispatch.

The selected public scoped/unscoped npmjs Intent records `access: "public"`
explicitly; the current library default is not used as product policy.

### Frozen operation shape

```text
NpmPublishOperation
  desired immutable version and tarball
  desired initial dist-tag in the same PUT
```

The resulting receipt is composite because the one request concerns two independently observable remote facets:

```text
NpmPublishReceipt {
  provider/transport acceptance facts,
  versionFacet,
  initialTagFacet
}
```

The receipt must distinguish provider-returned facts from Intent-derived facts.
Current `libnpmpublish` ignores a rich response body and returns the HTTP
response; documented HTTP `201` is normal success. No success JSON is invented.
Name, version, tarball digest, access, provenance, and requested tag remain
request/Intent facts unless a provider response explicitly returns them.

A fresh observation may report:

```text
version: satisfied | absent | conflict
tag: satisfied | moved | absent
```

This does not split the historical PUT into member operations. `memberOperationIds` is not required.

A later dist-tag change is a separate `NpmDistTagOperation` because it is a separate request and can occur after version publication.

### Lost response

Version immutability alone does not authorize replay. The same PUT may conflict and also asks for a mutable tag. After response loss:

- observe version and tag;
- stop satisfied when both match;
- treat moved tag as a new correction operation;
- stop/wait inconclusive when absence cannot fence the earlier request;
- report conflict for incompatible version bytes.

The pinned client exposes no documented idempotency-key input. npm contributes no secret replay material.

## Warehouse/PyPI-compatible upload

Primary sources:

- https://github.com/pypi/warehouse/blob/4bdd89d85bc522a0d555a871ffe250d644c660dc/warehouse/forklift/legacy.py
- https://docs.pypi.org/api/upload/
- https://packaging.python.org/en/latest/specifications/simple-repository-api/

One legacy upload request commits one distribution file. A release with an sdist and several wheels therefore has one operation per file and can make partial progress.

### Receipt discipline

Warehouse HTTP 200 returns warnings but no provider-generated distribution ID, digest, size, URL, or upload time. The receipt contains acceptance status, provider/transport headers or request IDs, warnings, and a reference to the operation. Project/version, filename, size, and digest remain Intent facts. The Simple API supplies later observation.

### Exact duplicate

Pinned Warehouse source distinguishes:

- same filename and matching content hashes: successful duplicate;
- same filename and different content: conflict;
- previously deleted filename: reuse rejected.

This can support `replay.exact-duplicate/1` only when exact coordinate/content
facts, request correspondence, and a versioned application-trusted Warehouse
protocol-law binding all match. Implementation provenance is diagnostic, not
replay authority. v1 does not enable this non-structural law, and it is not
assumed for every compatible repository.

No secret replay material is required.

## Production boundary

uv and Poetry build wheels/sdists through concrete effect-build integrations. ts-release adopts the finalized files and owns Warehouse publication, per-file journal state, observation, and recovery.

## Operation-shape consequence

The current provider set does not justify a generic one-request-many-operations mechanism:

- npm: one request, one composite operation/receipt;
- Warehouse: one request per file operation;
- GitHub release/asset: separate requests and operations;
- conditional Git: one ref/tree transition operation.

A future provider may reopen this only with a concrete counterexample and a demonstrated law.
