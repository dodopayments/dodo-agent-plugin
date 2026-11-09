# More clients

Every client below loads this repository without a client-specific manifest. Where a client reads `.mcp.json`, the server is dialled natively over Streamable HTTP (`"type": "http"`) and signs in through your browser when it is connected.

## Load the whole plugin

| Client | Install | Notes |
|---|---|---|
| GitHub Copilot CLI / app | `copilot plugin marketplace add dodopayments/dodo-agent-plugin` then `copilot plugin install dodopayments@dodopayments` | Uses `.claude-plugin/marketplace.json`; direct repo installs are deprecated. Verified on Copilot CLI 1.0.93 |
| Qwen Code | `qwen extensions install dodopayments/dodo-agent-plugin` | Agent Plugins, Claude marketplaces and Gemini extensions are all accepted |
| Devin CLI / Desktop | `devin plugins install dodopayments/dodo-agent-plugin` | Loads via `.claude-plugin/`; `devin mcp login dodopayments` |
| Goose | `goose plugin install https://github.com/dodopayments/dodo-agent-plugin` | Plugin MCP servers come from `.mcp.json` |
| Factory Droid | `droid plugin marketplace add dodopayments/dodo-agent-plugin` then `droid plugin install dodopayments@dodopayments` | Uses `.claude-plugin/marketplace.json` |
| Augment / Auggie | `auggie plugin marketplace add dodopayments/dodo-agent-plugin` then `auggie plugin install dodopayments@dodopayments` | Uses `.claude-plugin/marketplace.json` |
| OpenHands, OpenClaw, Hermes Agent, NanoClaw | Point the client at a clone of this repo | Native Agent Plugins clients |

## Skills and MCP separately

For clients without a plugin loader (Cline, Kilo Code, Zed, Warp, Amp, Continue, Kimi Code, Trae, Qoder and others), install the skills with [`skills`](https://github.com/vercel-labs/skills) and the MCP server with [`add-mcp`](https://github.com/neondatabase/add-mcp):

```bash
npx skills add dodopayments/dodo-agent-plugin            # add -a <agent> to target one client, -g for global
npx add-mcp https://mcp.dodopayments.com/mcp
```

Client-specific shortcuts:

| Client | Skills | MCP |
|---|---|---|
| Cline | `cline skill install dodopayments/dodo-agent-plugin` | `cline_mcp_settings.json`: `{"type": "streamableHttp", "url": "…"}` |
| Kilo Code | `npx skills add dodopayments/dodo-agent-plugin -a kilo` | `kilo.json`: `"mcp": {"dodopayments": {"type": "remote", "url": "https://mcp.dodopayments.com/mcp"}}` |
| Amp | `amp skill add dodopayments/dodo-agent-plugin` | `amp mcp add dodopayments https://mcp.dodopayments.com/mcp` |
| Kimi Code CLI | `npx skills add dodopayments/dodo-agent-plugin -a kimi-code-cli` | `kimi mcp add --transport http --auth oauth dodopayments https://mcp.dodopayments.com/mcp` |
| Zed | `npx skills add dodopayments/dodo-agent-plugin -a zed -g` | `settings.json` → `context_servers` |

> Kimi's `kimi plugin` command uses an unrelated `plugin.json` format. Do not point it at this repository; use the skills and MCP commands above.

## MCP-only assistants

These have no skill primitive. Add the server as a custom connector:

| Assistant | Where |
|---|---|
| Claude.ai / Claude Desktop | Settings → Connectors → Add custom connector |
| ChatGPT | Settings → Apps & Connectors → Create (developer mode) |
| Perplexity | Account → Connectors → Remote |
| Mistral Le Chat / Vibe | Connectors → Add MCP connector (admin) |
| grok.com | See [Grok](./grok.md) |

URLs:

- `https://mcp.dodopayments.com/mcp` — documentation search and live API, OAuth sign-in
- `https://mcp.dodopayments.com/mcp?auth=optional` — for connectors that cannot sign in: docs tools work without an account, `execute` returns 401. (`https://knowledge.dodopayments.com/mcp` is a docs-only server with no account, if you prefer that.)
