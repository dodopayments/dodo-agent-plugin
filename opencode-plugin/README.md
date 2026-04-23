# @dodopayments/opencode-plugin

OpenCode plugin that ships the Dodo Payments agent skills and references the Dodo Payments API and docs MCP servers.

This package is part of [`dodopayments/dodo-agent-plugin`](https://github.com/dodopayments/dodo-agent-plugin) - the universal Dodo Payments plugin that also installs into Claude Code, Codex, and Cursor.

## Install

Add to your `opencode.json`:

```jsonc
{
    "$schema": "https://opencode.ai/config.json",
    "plugin": ["@dodopayments/opencode-plugin"],
    "mcp": {
        "dodopayments-api": {
            "type": "local",
            "command": ["npx", "-y", "mcp-remote@latest", "https://mcp.dodopayments.com/sse"],
            "enabled": true
        },
        "dodo-knowledge": {
            "type": "local",
            "command": ["npx", "-y", "mcp-remote@latest", "https://knowledge.dodopayments.com/mcp"],
            "enabled": true
        }
    }
}
```

Then restart OpenCode. The eight Dodo Payments skills are auto-discovered from this package's `skills/` directory.

## What you get

- **Eight agent skills** (auto-loaded by OpenCode when relevant):
    - `best-practices`, `checkout-integration`, `subscription-integration`, `webhook-integration`, `usage-based-billing`, `credit-based-billing`, `license-keys`, `billing-sdk`.
- **Two referenced MCP servers** (you configure them in `opencode.json` as shown above):
    - `dodopayments-api` - live API access via OAuth.
    - `dodo-knowledge` - semantic search over Dodo Payments documentation.

## License

MIT. See [LICENSE](../LICENSE).
