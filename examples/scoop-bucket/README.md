> Historical pre-0.4 configuration example. The current CLI runs an authored
> application; see the repository README and `docs/preparation.md`. Commands and
> configuration APIs below are not supported by the current implementation.

# Scoop bucket delivery

This runnable example prepares a typed Scoop manifest from the exact digest of
a GitHub release ZIP, then models delivery of the manifest and its canonical
managed-state record to `owner/scoop-bucket`.

Catalog delivery runs only after the GitHub release subjects converge. The
bucket branch is updated through the same conditional, non-force Git Data
protocol used by the Homebrew example. Replace every `owner/*` coordinate and
the credential reference before use.
