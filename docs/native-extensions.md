# Native extensions

Applications explicitly compose providers using `defineProvider`, `makeRequest`
and the root provider types. A provider defines durable intent and evidence
codecs, request/receipt correspondence, preparation and optional observation.
The core owns dispatch authorization and replay decisions.

The trusted application's `createApplication` factory supplies providers and host
services. Serialized Plan or Journal data cannot select a module to import.
Preparation can adopt producer artifacts through `effect-build`, and Apple
preparation remains available through `apple` with its scoped recovery model.
See [application preparation](preparation.md) for runtime wiring.
