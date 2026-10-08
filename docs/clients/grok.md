# Grok (xAI)

| Surface | Skills | MCP servers |
|---|---|---|
| Grok Build (`grok` CLI) | Yes | Yes (OAuth) |
| Grok Bot | Via the Cursor plugin marketplace it shares with Cursor | Inherits your Cursor team MCP policy |
| grok.com / Grok apps | No | Yes, as a custom connector |
| xAI API (Responses API) | No | `dodo-knowledge` (no auth); the API server needs OAuth, which the xAI API does not broker |

## Grok Build

Grok Build reads this repository as-is: the root `plugin.json`, `skills/`, `.mcp.json`, and `.claude-plugin/marketplace.json`. No Grok-specific manifest is needed.

```bash
grok plugin marketplace add dodopayments/dodo-agent-plugin
grok plugin install dodopayments --trust
```

Plugins are disabled and untrusted until you pass `--trust` (or trust them from `/plugins`). Until then their skills and MCP servers stay inactive.

If you already added this marketplace in Claude Code, Grok Build discovers it automatically.

The API server signs in through your browser the first time a tool is called; tokens are stored in `~/.grok/mcp_credentials.json`.

### MCP servers only

```bash
grok mcp add --transport http dodopayments-api https://mcp.dodopayments.com/mcp
grok mcp add --transport http dodo-knowledge  https://knowledge.dodopayments.com/mcp
```

Or in `~/.grok/config.toml` (user) / `.grok/config.toml` (project):

```toml
[mcp_servers.dodopayments-api]
url = "https://mcp.dodopayments.com/mcp"

[mcp_servers.dodo-knowledge]
url = "https://knowledge.dodopayments.com/mcp"
```

### Skills only

Grok Build also scans `.agents/skills/`, `.claude/skills/`, and `.grok/skills/`, so `npx skills add dodopayments/dodo-agent-plugin` works too.

## grok.com and the Grok apps

1. Open **grok.com/connectors → New Connector → Custom**.
2. Paste `https://mcp.dodopayments.com/mcp` and complete the sign-in.
3. Repeat with `https://knowledge.dodopayments.com/mcp` (no sign-in needed).

On **Grok Business / Enterprise**, an admin adds the connector first at **console.x.ai → Grok Business → Connectors → Add Connector → Other**; each member then connects their own account.

## xAI API

```json
{
    "model": "grok-4.7",
    "input": "How do I verify a Dodo Payments webhook signature?",
    "tools": [
        {
            "type": "mcp",
            "server_url": "https://knowledge.dodopayments.com/mcp",
            "server_label": "dodo_knowledge"
        }
    ]
}
```
