# Prepared workflow

The normal workflow is:

```text
inspect → prepare → publish
```

`release` composes the last two steps automatically. Use `prepare` followed by
`publish` when a host deliberately transfers exact prepared bytes between
processes. The host may insert its own review or environment gate between those
steps without changing the bundle or adding a second lifecycle protocol.
