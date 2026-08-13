# PyPI migration note

This directory is not a runnable ts-release example. The current authored
schema has no PyPI publication destination. The wheel is retained only as a
fixture that a future provider-owned implementation may import and verify.

There is intentionally no `release.config.json`: importing bytes is not proof
that ts-release can publish them to PyPI.
