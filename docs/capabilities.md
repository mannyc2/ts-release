# Capabilities

The core coordinates immutable Bundle/Plan inputs and durable journal recovery.
Applications select providers and runtime boundaries explicitly.

| Package or subpath              | Purpose                                                                     |
| ------------------------------- | --------------------------------------------------------------------------- |
| ts-release                      | Planning, evidence-based execution and recovery                             |
| bundle, effect-build            | Content ownership and producer adoption                                     |
| node, bun                       | Native HTTP/Git transport, storage and application runners                  |
| apple                           | Scoped Apple preparation and recovery                                       |
| ts-release-npm, ts-release-pypi | Registry provider operations                                                |
| ts-release-github               | Tags, releases and assets                                                   |
| ts-release-catalog              | Homebrew/Scoop rendering for shared Git publication                         |
| ts-release-mcp                  | MCP registry provider                                                       |
| ts-release-openai               | Existing plugin packaging, marketplace rendering and optional human handoff |

Behavioral and installed-package checks cover local contracts. Native tool and
host requirements vary by provider. Public uploads, hosted Action execution,
Apple service acceptance and plugin portal publication require separate execution;
local test success does not imply those external outcomes.
