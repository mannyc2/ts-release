# Architecture

An owned Bundle fixes artifact content. An immutable Plan binds provider
operations to that Bundle. A durable Journal records dispatches and evidence;
reports derive current progress from those records.

Providers prepare exact requests and interpret corresponding receipts and
observations. Host boundaries own credentials, transports and durable storage.
The core decides whether dispatch is authorized, including unresolved-attempt
and conditional-replay rules. CLI and Action run the same authored application.

Homebrew and Scoop share exact Bundle download validation in catalog/Shared.ts.
Their renderers retain format-specific escaping and layout. Their files and
OpenAI marketplace files all use the same Git prepare/update machinery, object
verification, conditional push and journal recovery. No separate catalog engine
is needed. Apple preparation retains its scoped journal and native evidence.

See [the retained decisions](docs/design-decisions.md),
[application contract](docs/preparation.md) and [recovery](docs/recovery.md).
