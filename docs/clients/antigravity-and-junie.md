# Google Antigravity and JetBrains Junie

Both clients use a closed manifest format that conflicts with the root Agent Plugins `plugin.json`, so each gets a self-contained, generated bundle under `providers/`. Do not hand-edit them — run `npm run build`.

## Antigravity

Bundle: [`providers/antigravity/`](../../providers/antigravity) — `plugin.json`, `mcp_config.json` (remote servers use `serverUrl`), `skills/`.

Clone the repository, then install the bundle from its local path. Antigravity documents installing from a repository root, a marketplace, or a local directory; the repository root here is an Agent Plugins manifest that Antigravity's closed schema does not accept, so install the subdirectory:

```bash
git clone https://github.com/dodopayments/dodo-agent-plugin.git
agy plugin install ./dodo-agent-plugin/providers/antigravity
```

To update, `git pull` and run the install command again.

Antigravity starts the OAuth sign-in for `dodopayments` when the server is connected.

MCP server only — add to `~/.gemini/config/mcp_config.json` (or `.agents/mcp_config.json` in a project):

```json
{
    "mcpServers": {
        "dodopayments": { "serverUrl": "https://mcp.dodopayments.com/mcp" }
    }
}
```

Antigravity rejects `url` and `httpUrl` for remote servers; it must be `serverUrl`.

## Junie

Bundle: [`providers/junie/`](../../providers/junie) — `extension.json`, `skills/`, `mcp/.mcp.json`.

Junie also reads Claude-style marketplaces, so the quickest install is:

1. In Junie, run `/extensions` → **Add marketplace** → `https://github.com/dodopayments/dodo-agent-plugin`.
2. Install **dodopayments**.
3. Run `/mcp` and authorize `dodopayments`.

MCP server only — add to `.junie/mcp/mcp.json` (project) or `~/.junie/mcp/mcp.json` (user):

```json
{
    "mcpServers": {
        "dodopayments": { "url": "https://mcp.dodopayments.com/mcp" }
    }
}
```

Skills only: Junie reads `.junie/skills/` and `.agents/skills/`, so `npx skills add dodopayments/dodo-agent-plugin -a junie` works.
