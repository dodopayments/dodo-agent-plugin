# Changelog

## 0.1.0 - 2026-04-21

Initial release.

- Eight Dodo Payments agent skills bundled via the `dodopayments/skills` submodule: `best-practices`, `checkout-integration`, `subscription-integration`, `webhook-integration`, `usage-based-billing`, `credit-based-billing`, `license-keys`, `billing-sdk`.
- `dodopayments-api` MCP server (remote SSE via `mcp-remote`) pre-registered for live API access.
- `dodo-knowledge` MCP server (remote HTTP via `mcp-remote`) pre-registered for on-demand docs lookup.
- Optional `userConfig` for users who switch the API MCP to local stdio (`dodopayments-mcp`).
