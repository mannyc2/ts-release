> Historical pre-0.4 configuration example. The current CLI runs an authored
> application; see the repository README and `docs/preparation.md`. Commands and
> configuration APIs below are not supported by the current implementation.

# PyPI migration note

This directory is not a runnable ts-release example. The current authored
schema has no PyPI publication destination. The wheel is retained only as a
fixture that a future provider-owned implementation may import and verify.

There is intentionally no `release.config.json`: importing bytes is not proof
that ts-release can publish them to PyPI.
