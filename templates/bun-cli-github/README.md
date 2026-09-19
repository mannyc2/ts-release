> Historical pre-0.4 configuration example. The current CLI runs an authored
> application; see the repository README and `docs/preparation.md`. Commands and
> configuration APIs below are not supported by the current implementation.

# Bun CLI and GitHub Releases

This complete fixture prepares an npm package plus a Bun-compiled CLI matrix
attached to a GitHub Release. Build outputs are captured in the prepared bundle.

```sh
ts-release inspect --config release.config.json
ts-release release --config release.config.json
```

Rename the project-local ids, entrypoint, target matrix, and output template
before releasing.
