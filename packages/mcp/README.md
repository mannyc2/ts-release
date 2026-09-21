# @mannyc1/ts-release-mcp

Official MCP Registry manifest validation, deterministic rendering, publication
planning, exact-version observation, and token or GitHub Actions OIDC credential
binding. Install with the matching `@mannyc1/ts-release@0.4.0` core and `effect@4.0.0-rc.115`.

Publication is represented as immutable `PublishIntent` data. The kernel owns
dispatch and recovery. A missing exact version after a possibly completed POST
remains pending and never authorizes an automatic resend.
