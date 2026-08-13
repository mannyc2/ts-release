# Homebrew template migration note

There is no runnable Homebrew template in the current release kernel. Homebrew
and generic catalog destinations are absent from the authored schema until a
provider-owned implementation can prepare, publish, observe, and recover the
same exact subject.

Start from `../bun-cli-github/release.config.json` for the retained binary and
GitHub release slice. Add Homebrew only after the capability inventory marks a
future implementation supported.
