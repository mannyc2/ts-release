# Portable CLI example

This fixture demonstrates a Bun-built CLI with retained Linux, macOS, and
Windows artifact targets. ts-release runs on Linux and macOS; Windows is an
artifact target, not an execution-host claim.

Use the public path from the repository root:

```sh
ts-release inspect --config examples/portable-cli/release.config.json
ts-release prepare --config examples/portable-cli/release.config.json
```

The prepared bundle contains exact executable bytes, archives, and checksum
data when those effects are configured.
