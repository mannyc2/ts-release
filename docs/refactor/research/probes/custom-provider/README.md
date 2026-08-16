# Custom-provider clean-consumer probe

This is a disposable research fixture, not a ts-release provider API.

The clean Node consumer proves only this boundary at Effect `4.0.0-rc.109`:

1. a packed core fixture has no knowledge of the outside package;
2. a separately packed outside package owns a concrete service, Layer, receipt,
   and publication Effect;
3. a packed Node CLI dynamically imports a consumer-owned module; and
4. that module has already supplied its own Layer and closed the Effect's
   requirements before the CLI executes it.

The CLI therefore receives an `Effect<unknown, unknown, never>`. The probe does
not establish integration with a ts-release publication-provider contract,
durable preparation, typed CLI reporting, more than one provider, dependency
ordering, partial-success recovery, or resumability.

The separately named `probe:standalone:informational` experiment compiles the
CLI to one Bun executable and records whether that executable can load a
provider installed only in the consumer project. Its JSON result includes the
actual `loadedUnknownProvider` boolean. The command is informational by default:
a green workflow step means the experiment ran, not that the capability exists.
Set `REQUIRE_STANDALONE_UNKNOWN_PROVIDER=1` only in a future acceptance gate
that deliberately chooses this capability as required.
