# Portable CLI example

This fixture demonstrates a Bun-built CLI with Linux and macOS x64/arm64
artifact targets. ts-release runs only on Linux; the macOS executables are
cross-compiled artifacts. Preparation requires an external Bun runtime and
`libseccomp.so.2` on the Linux host. The standalone CLI still delegates
network-denied commands to those native tools and is not self-contained.

Use the public path from the repository root:

```sh
ts-release inspect --config examples/portable-cli/release.config.json
ts-release prepare --config examples/portable-cli/release.config.json
```

The prepared bundle contains exact executable bytes, archives, and checksum
data when those effects are configured.
