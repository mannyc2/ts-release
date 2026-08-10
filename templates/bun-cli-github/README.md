# Bun CLI and GitHub Releases

This complete fixture prepares an npm package plus a Bun-compiled CLI matrix
attached to a GitHub Release. Build outputs are captured in the prepared bundle.

```sh
ts-release inspect --config release.config.json
ts-release release --config release.config.json
```

Rename the project-local ids, entrypoint, target matrix, and output template
before releasing.
