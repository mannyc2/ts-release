# @mannyc1/ts-release-mcp

Official MCP Registry manifest validation, deterministic rendering, publication
planning, exact-version observation, and token or GitHub Actions OIDC credential
binding. This 0.4.0 source is an unpublished implementation candidate.

Publication is represented as immutable `PublishIntent` data. The kernel owns
dispatch and recovery. A missing exact version after a possibly completed POST
remains pending and never authorizes an automatic resend.
