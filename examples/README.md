# Release examples

Examples are schema-checked authored configurations. They show jobs that map
to native ts-release primitives; they do not publish during repository checks.

Start with the automatic path:

```sh
ts-release init
ts-release release --config release.config.json
```

The fixtures cover npm, GitHub Releases, portable binaries, archive/checksum
preparation, and local catalog rendering. The PyPI fixture demonstrates an
imported file only; PyPI publication remains outside the automatic set. See
the generated [capability inventory](../docs/capabilities.md).
