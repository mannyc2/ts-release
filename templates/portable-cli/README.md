# Portable CLI Template

This template publishes one Bun-compiled CLI through GitHub Releases, Homebrew,
Scoop, npm, and optional PyPI wrapper wheels. Update package names, repository
names, artifact paths, and PyPI metadata before publishing.

Preview the generated plan after staging artifacts:

```sh
ts-release build --config release.config.json --format text
ts-release plan --config release.config.json --format text
```
