# Portable CLI template

This complete fixture prepares one Bun CLI for GitHub Releases and npm. The
portable binary targets include Windows output, while ts-release itself runs
on Linux and macOS. Update all product and destination identities before use.

```sh
ts-release inspect --config release.config.json
ts-release release --config release.config.json
```
