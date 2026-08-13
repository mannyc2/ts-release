# ts-release CLI

The CLI exposes exactly seven commands:

- `init` writes an explicit preset only after that preset passes strict
  authored-config inspection.
- `inspect` observes authored configuration or reads a prepared bundle.
- `prepare` stages native preparations and stores an exact bundle.
- `observe` reads the remote subjects for one prepared bundle without mutation.
- `publish` observes and publishes one prepared bundle.
- `release` composes preparation and publication automatically.
- `correct` binds one provider-specific correction proposal to the exact
  prepared subject; the installed kernel has no corrective mutation adapter.

```sh
bun run cli init --preset bun-npm-github
bun run cli inspect --config release.config.json
bun run cli release --config release.config.json
```

The published Node bundle is built from `src/cli/node-main.ts`; development
uses the Bun host entrypoint.

The publishing preset first discovers the canonical owner/repository, then
writes explicit trusted-publishing and GitHub intent and strictly inspects the
exact generated object. It refuses to guess when repository discovery is
ambiguous or absent.

The preset binds trusted publication to `.github/workflows/release.yml` at
`refs/heads/main`. Change both `workflow` and `workflowRef` when another exact
workflow/ref is the intended host; a mismatch is rejected before OIDC request
material is read.
