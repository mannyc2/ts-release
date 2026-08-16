# Provider-specific wire models

Status: provider protocol research companion to [provider-contracts.md](./provider-contracts.md). It does not select the production API.

## 1. Provider-specific wire models

## 2. npmjs

Primary source:

- [`libnpmpublish/lib/publish.js`](https://github.com/npm/cli/blob/51c2bf81fa2c31547d0fec44fff2aaac3d9a9862/workspaces/libnpmpublish/lib/publish.js)
- [`npm publish` command](https://github.com/npm/cli/blob/51c2bf81fa2c31547d0fec44fff2aaac3d9a9862/lib/commands/publish.js)
- [npm publish documentation](https://docs.npmjs.com/cli/v11/commands/npm-publish/)
- [dist-tag documentation](https://docs.npmjs.com/adding-dist-tags-to-packages/)

### Actual initial publish request

For normal publication, `libnpmpublish` constructs one package metadata document containing:

```text
versions[manifest.version] = manifest
dist-tags[tag] = manifest.version
_attachments[tarballName] = tarball bytes
```

It sends one package PUT. The initial immutable version, tarball attachment, and selected initial tag are co-requested through one physical mutation.

### Competing Intent models

#### Model N1: one composite `NpmPublishIntent`

The Intent contains the version bytes and the initial tag desired by the same PUT. Fresh observation compares version identity and tag state as separate facets.

**Strength:** matches the physical provider mutation and avoids inventing a prerequisite that the wire does not have.

**Tradeoff:** one accepted response may satisfy a composite Intent while later observations find the mutable tag moved.

#### Model N2: separate version and tag Intents sharing one physical dispatch

**Strength:** independent durable status for immutable version and mutable tag.

**Tradeoff:** suggests two logical provider mutations even though npmjs initially accepts one document. It also requires one physical response to classify several Intents.

**Provisional recommendation:** Model N1 for the initial npmjs PUT, with high confidence for npmjs at the pinned source. A later `npm dist-tag` mutation is a separate Intent. Compatible registries may require another model.

### Success receipt discipline

The normal publish code uses `ignoreBody: true` and returns transport response information rather than a rich provider object. Package name, version, tarball digest, access, provenance, and tag are primarily known from the request/Intent, not echoed by the provider.

A durable npm receipt should therefore contain only provider/transport-returned facts, such as successful completion, status/headers, and request identifiers when exposed, plus a reference to the Intent. It should not copy request fields and label them provider-returned.

### Partial success

The pinned source does not establish that npmjs can commit the version while failing to establish the initial tag within the same package PUT. Treating that as a documented partial commit would be an unsupported claim. Version and tag remain independently observable because the tag is mutable after publication.

## 3. Warehouse and PyPI-compatible repositories

Primary sources:

- [`warehouse/forklift/legacy.py`](https://github.com/pypi/warehouse/blob/4bdd89d85bc522a0d555a871ffe250d644c660dc/warehouse/forklift/legacy.py)
- [PyPI upload API](https://docs.pypi.org/api/upload/)
- [Simple Repository API](https://packaging.python.org/en/latest/specifications/simple-repository-api/)
- [file yanking](https://packaging.python.org/en/latest/specifications/file-yanking/)

### Commit unit

One legacy upload request commits one distribution file. A release containing an sdist and several wheels can make partial progress file by file.

### Success receipt

Warehouse returns HTTP 200 with a body consisting of warnings. It does not return a provider-generated distribution ID, digest, size, URL, or upload time in the success body.

The receipt therefore contains:

- provider acceptance status and response headers/request IDs;
- warnings returned by Warehouse; and
- a reference to the file Intent.

Filename, project/version, size, and expected digest remain Intent facts. A later Simple API read supplies fresh provider observations.

### Duplicate behavior

Pinned Warehouse source distinguishes:

- exact duplicate content for an existing filename: accepted as a successful duplicate;
- same filename with different content: rejected; and
- a previously deleted filename: rejected from reuse.

These are Warehouse laws, not guaranteed laws of every compatible index.

### Yank state

Warehouse currently yanks a release rather than replacing uploaded bytes. Immutable file upload and mutable yanked state are separate desired facts. A compatible repository may expose different yanking granularity.

**Provisional recommendation:** model file upload Intents separately from a provider-specific yank Intent. Confidence is high for Warehouse, lower for generic compatible repositories.

## Continued research

The remaining sections continue in [provider-wire-github-catalogs.md](./provider-wire-github-catalogs.md).
