# Bun CLI + GitHub Releases

This template publishes an npm package and attaches a Bun-compiled CLI matrix
to a GitHub Release.

Before planning or running the release, stage the executable artifacts:

```sh
bun run cli stage-artifacts --config release.config.json
```

The `id` fields are project-local identifiers. Rename the recipe, outputs,
entrypoint, and paths to match your CLI; ts-release uses those values as data
when it builds the release plan.
