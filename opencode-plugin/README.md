# @dodopayments/opencode-plugin

Official OpenCode plugin for Dodo Payments. Ships eight integration skills and auto-registers two MCP servers.

This package is part of [`dodopayments/dodo-agent-plugin`](https://github.com/dodopayments/dodo-agent-plugin) - the universal Dodo Payments plugin that also installs into Claude Code, Codex, and Cursor.

## Install

Add to your `opencode.json`:

```jsonc
{
    "$schema": "https://opencode.ai/config.json",
    "plugin": ["@dodopayments/opencode-plugin"]
}
```

Restart OpenCode. That's it.

- Both MCP servers are registered automatically via the plugin's `config` hook.
- The eight skills are auto-discovered from this package's `skills/` directory.
- The first call to `dodopayments-api` opens a browser for OAuth. `dodo-knowledge` needs no auth.

## What you get

Eight agent skills (auto-loaded when relevant): `best-practices`, `checkout-integration`, `subscription-integration`, `webhook-integration`, `usage-based-billing`, `credit-based-billing`, `license-keys`, `billing-sdk`.

Two MCP servers (registered automatically):

| Server | Purpose | Auth |
|--------|---------|------|
| `dodopayments-api` | Live API access (payments, subscriptions, customers, products, refunds, licenses, usage) | OAuth (browser) on first call |
| `dodo-knowledge` | Semantic search over the Dodo Payments documentation | None |

## Enable / disable individual MCP servers

Both MCPs ship enabled. To disable either one, set the matching env var to `1` (or `true`) before launching OpenCode:

| Env var | Effect |
|---|---|
| `DODO_DISABLE_API_MCP=1` | Skips registering `dodopayments-api` |
| `DODO_DISABLE_KNOWLEDGE_MCP=1` | Skips registering `dodo-knowledge` |

```bash
# Disable just the API server (keep docs search)
DODO_DISABLE_API_MCP=1 opencode

# Disable both
DODO_DISABLE_API_MCP=1 DODO_DISABLE_KNOWLEDGE_MCP=1 opencode
```

Persist the toggle by exporting the var in your shell profile or a project `.env` file your shell auto-loads. Truthy values: `1`, `true`, `yes`, `on` (case-insensitive). Anything else - including unset - keeps the MCP enabled.

## Overriding the defaults

The plugin registers MCPs with nullish-assign semantics, so anything you declare in your own `opencode.json` wins. Example - swap the default remote OAuth server for the local stdio server with your own API key:

```jsonc
{
    "plugin": ["@dodopayments/opencode-plugin"],
    "mcp": {
        "dodopayments-api": {
            "type": "local",
            "command": ["npx", "-y", "dodopayments-mcp@latest"],
            "environment": {
                "DODO_PAYMENTS_API_KEY": "dodo_test_...",
                "DODO_PAYMENTS_WEBHOOK_KEY": "whsec_...",
                "DODO_PAYMENTS_ENVIRONMENT": "test_mode"
            },
            "enabled": true
        }
    }
}
```

`dodo-knowledge` continues to be registered by the plugin unless you declare it explicitly too.

## License

MIT. See [LICENSE](../LICENSE).
