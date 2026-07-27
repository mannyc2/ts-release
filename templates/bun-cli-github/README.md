# Bun CLI and GitHub Releases

This complete fixture plans an npm package plus a Bun-compiled CLI matrix
attached to a GitHub Release. Builds are operations in the immutable plan.

```sh
ts-release plan --config release.config.json --out release-plan.json
ts-release apply release-plan.json --plan-id PLAN_ID --review-only --scope all
```

Rename the project-local ids, entrypoint, target matrix, and output template
before applying the reviewed plan.
