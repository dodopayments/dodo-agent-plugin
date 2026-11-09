# @dodopayments/opencode-plugin

Official OpenCode plugin for Dodo Payments. Ships the Dodo Payments integration skill and auto-registers the MCP server.

This package is part of [`dodopayments/dodo-agent-plugin`](https://github.com/dodopayments/dodo-agent-plugin) - the universal Dodo Payments plugin that also installs into Claude Code, Codex, and Cursor.

## Install

Install the package into your project, then add it to `opencode.json`:

```bash
npm install --save-dev @dodopayments/opencode-plugin
```

```jsonc
{
    "$schema": "https://opencode.ai/config.json",
    "plugin": ["@dodopayments/opencode-plugin"],
    "skills": {
        "paths": ["node_modules/@dodopayments/opencode-plugin/skills"]
    }
}
```

Restart OpenCode.

- The MCP server is registered automatically via the plugin's `config` hook.
- The `skills.paths` entry is what makes the skills visible - OpenCode does not scan installed packages for skills. The path resolves against the **project** directory, not OpenCode's plugin cache, which is why the local install above is required. An absolute path works too and avoids that requirement.
- The plugin module exports only its default function. OpenCode's loader throws `Plugin export is not a function` on any non-function named export, skips the plugin, and swallows the error - leaving you with no MCP servers. Verified on OpenCode 1.18.15.
- The server returns 401 until you sign in. `opencode mcp auth dodopayments` opens a Dodo Payments consent page in the browser: pick the business, mode and permissions. To review or revoke access, open the dashboard at **Settings > Connected Apps**.

Verify the install:

```bash
opencode run "List every skill available to you by name."
```

## What you get

Agent skill (auto-loaded when relevant): `dodo-payments`, a short index plus reference files loaded on demand (checkout, mobile-checkout, subscriptions, webhooks, usage-billing, credits, license-keys, products, discounts, localized-pricing, customers, refunds-disputes, framework-adapters, better-auth, billing-sdk, testing-go-live, mcp).

One MCP server (registered automatically):

| Server | Purpose | Auth |
|--------|---------|------|
| `dodopayments` | Documentation search and live API access | OAuth (browser) |

Tools: `search_docs`, `read_docs_page`, `search`, `execute`, `feedback`.

## Disable the MCP server

To disable it, set the env var to `1` (or `true`) before launching OpenCode:

| Env var | Effect |
|---|---|
| `DODO_DISABLE_API_MCP=1` | Skips registering `dodopayments` |

`DODO_DISABLE_KNOWLEDGE_MCP` is still accepted and does nothing.

```bash
DODO_DISABLE_API_MCP=1 opencode
```

Persist the toggle by exporting the var in your shell profile or a project `.env` file your shell auto-loads. Truthy values: `1`, `true`, `yes`, `on` (case-insensitive). Anything else, including unset, keeps the MCP enabled.

## Overriding the defaults

The plugin registers MCPs with nullish-assign semantics, so anything you declare in your own `opencode.json` wins. Example - keep the server declared but turned off:

```jsonc
{
    "plugin": ["@dodopayments/opencode-plugin"],
    "mcp": {
        "dodopayments": {
            "type": "remote",
            "url": "https://mcp.dodopayments.com/mcp",
            "enabled": false
        }
    }
}
```

The server has no API key mode. Declare it only as the remote server above, which signs in with OAuth.

Migration: if your own config disables the old `dodopayments-api` key, rename it to `dodopayments`.

## License

MIT. See [LICENSE](../LICENSE).
