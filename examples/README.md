# release examples

Start with the coordinated release example:

```sh
cd examples/multi-target
bun ../../apps/release-ts/src/cli/main.ts plan --config release.config.json --format text
```

That plan shows one release split across GitHub Releases, npm, and a Homebrew
tap. Inspect the artifact inventory, target capabilities, `argv` lines,
approval requirements, and generated catalog-file operations. `plan` is safe: publish
operations stay data until a caller passes explicit execution approval.

Templates live in `../templates/` and are copyable starting points for new
repositories. These examples are runnable fixtures for this repository's
checks.

Focused examples:

- `multi-target`: one release coordinated across GitHub Releases, npm, and Homebrew.
- `npm-only`: npm package directory with native npm dry-run validation.
- `npm-first-publish`: token-based npm bootstrap config for the first version before switching to trusted publishing.
- `github-release`: GitHub release asset with simulated GitHub dry-run validation.
- `homebrew-tap`: Homebrew tap formula rendering with simulated formula validation.
- `pypi-registry`: prebuilt Python distribution planned for TestPyPI with Twine.
- `scoop-bucket`: Scoop bucket manifest rendering with simulated validation.
- `non-strict-skips`: non-strict config that records skipped dry-run evidence.

Trusted-publishing npm examples use `provenance` and
`verifyPackageExists`. `npm-first-publish` demonstrates only the bootstrap shape
for a package that does not exist on npm yet, so it stays token-based and omits
`trustedPublishing`. Replace it with trusted publishing after the first version
exists. TestPyPI is still a real registry publish target, not a dry-run. The
examples only render plans; do not run publish operations without intentional
credentials and approval flags.
