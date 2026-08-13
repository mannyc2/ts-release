# Portable CLI template

This complete fixture prepares one Bun CLI for GitHub Releases and npm. Its
artifact targets are Linux and macOS x64/arm64; ts-release itself runs only on
Linux. Preparation requires an external Bun runtime and `libseccomp.so.2` on
the Linux host. A standalone CLI binary still uses those native tools for
network-denied commands and is not a self-contained preparation environment.
Update all product and destination identities before use.

```sh
ts-release inspect --config release.config.json
ts-release release --config release.config.json
```
