# Scoop template migration note

There is no runnable Scoop template in the current release kernel. Scoop and
generic catalog destinations are absent from the authored schema until a
provider-owned implementation can prepare, publish, observe, and recover the
same exact subject.

Start from `../bun-cli-github/release.config.json` for the retained binary and
GitHub release slice. Add Scoop only after the capability inventory marks a
future implementation supported.
