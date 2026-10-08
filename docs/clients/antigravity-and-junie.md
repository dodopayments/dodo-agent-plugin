# Google Antigravity and JetBrains Junie

Both clients use a closed manifest format that conflicts with the root Agent Plugins `plugin.json`, so each gets a self-contained, generated bundle under `providers/`. Do not hand-edit them — run `npm run build`.

## Antigravity

Bundle: [`providers/antigravity/`](../../providers/antigravity) — `plugin.json`, `mcp_config.json` (remote servers use `serverUrl`), `skills/`.

```bash
agy plugin install https://github.com/dodopayments/dodo-agent-plugin/providers/antigravity
```

Antigravity handles OAuth automatically for the API server the first time a tool is called.

MCP servers only — add to `~/.gemini/config/mcp_config.json` (or `.agents/mcp_config.json` in a project):

```json
{
    "mcpServers": {
        "dodopayments-api": { "serverUrl": "https://mcp.dodopayments.com/mcp" },
        "dodo-knowledge": { "serverUrl": "https://knowledge.dodopayments.com/mcp" }
    }
}
```

Antigravity rejects `url` and `httpUrl` for remote servers; it must be `serverUrl`.

## Junie

Bundle: [`providers/junie/`](../../providers/junie) — `extension.json`, `skills/`, `mcp/.mcp.json`.

Junie also reads Claude-style marketplaces, so the quickest install is:

1. In Junie, run `/extensions` → **Add marketplace** → `https://github.com/dodopayments/dodo-agent-plugin`.
2. Install **dodopayments**.
3. Run `/mcp` and authorize `dodopayments-api`.

MCP servers only — add to `.junie/mcp/mcp.json` (project) or `~/.junie/mcp/mcp.json` (user):

```json
{
    "mcpServers": {
        "dodopayments-api": { "url": "https://mcp.dodopayments.com/mcp" },
        "dodo-knowledge": { "url": "https://knowledge.dodopayments.com/mcp" }
    }
}
```

Skills only: Junie reads `.junie/skills/` and `.agents/skills/`, so `npx skills add dodopayments/dodo-agent-plugin -a junie` works.
