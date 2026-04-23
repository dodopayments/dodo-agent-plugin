# Dodo Payments Agent Plugin

[![License](https://img.shields.io/github/license/dodopayments/dodo-agent-plugin.svg?style=flat-square)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg?style=flat-square)](./CHANGELOG.md)
[![npm](https://img.shields.io/npm/v/@dodopayments/opencode-plugin.svg?style=flat-square)](https://www.npmjs.com/package/@dodopayments/opencode-plugin)
[![Discord](https://img.shields.io/discord/1305511580854779984?label=discord&style=flat-square)](https://discord.gg/bYqAp4ayYh)

The official Dodo Payments plugin for AI coding agents. Installs eight integration skills and two MCP servers across **Claude Code**, **Codex CLI**, **Cursor**, and **OpenCode** from a single source of truth.

## What you get

- **Dodo Payments API MCP server** - Live API access (payments, subscriptions, customers, products, refunds, licenses, usage). Authenticates via browser OAuth, no local credentials required.
- **Dodo Knowledge MCP server** - No credentials. Semantic search over the current Dodo Payments documentation.
- **Eight agent skills** - Written as `SKILL.md` files with YAML frontmatter. Your agent loads the relevant skill on its own when a task calls for it.

## Install

### Claude Code

```bash
claude plugins marketplace add dodopayments/dodo-agent-plugin
claude plugins install dodopayments@dodopayments
```

The API MCP server uses browser OAuth by default, so no keys are required at install time. The first time your agent calls a Dodo tool, you'll be prompted to sign in.

### Codex CLI

Codex reads `.claude-plugin/marketplace.json` natively, so the same repo works:

```bash
codex plugin marketplace add dodopayments/dodo-agent-plugin
codex plugin install dodopayments@dodopayments
```

### Cursor

Manual install:

```bash
git clone https://github.com/dodopayments/dodo-agent-plugin.git ~/.cursor/plugins/local/dodo-agent-plugin
```

Restart Cursor. The plugin loads skills from `.claude/skills/` (via Cursor's Claude Code compat) and MCP servers from `.mcp.json`.

### OpenCode

OpenCode distributes via npm. Add the plugin to your `opencode.json`:

```jsonc
{
    "$schema": "https://opencode.ai/config.json",
    "plugin": ["@dodopayments/opencode-plugin"]
}
```

Restart OpenCode. Both MCP servers (`dodopayments-api`, `dodo-knowledge`) are registered automatically via the plugin's `config` hook, and the eight skills are auto-discovered from the installed package. No manual `mcp` block required.

If you prefer the local stdio API server with your own API key instead of the default remote OAuth server, declare `dodopayments-api` yourself in `opencode.json` - your entry wins over the plugin default:

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

## Included Skills

| Skill | Description |
|-------|-------------|
| `best-practices` | Comprehensive guide to integrating Dodo Payments with best practices |
| `checkout-integration` | Creating checkout sessions and payment flows |
| `subscription-integration` | Implementing subscription billing flows |
| `webhook-integration` | Setting up and handling webhooks for payment events |
| `usage-based-billing` | Implementing metered billing with events and meters |
| `credit-based-billing` | Credit entitlements, balances, and metered credit deduction |
| `license-keys` | Managing license keys for digital products |
| `billing-sdk` | Using BillingSDK React components |

Skills source: [`dodopayments/skills`](https://github.com/dodopayments/skills) (bundled as a git submodule in `skills-src/`).

## Included MCP Servers

| Server | Purpose | Auth |
|--------|---------|------|
| `dodopayments-api` | Live API access (payments, subscriptions, customers, products, refunds, licenses, usage) | OAuth (browser) |
| `dodo-knowledge` | Semantic search over the Dodo Payments documentation | None |

Both servers are wired through `mcp-remote` so they run in any MCP-compatible client.

## Configure (optional, Claude Code)

If you prefer to run the API MCP locally with an API key instead of the remote SSE server, open `/plugins` in Claude Code, select **Dodo Payments**, and choose **Configure options**. Fill in:

- `dodo_api_key` - your `dodo_test_...` or `dodo_live_...` key
- `dodo_webhook_key` - your webhook signing secret
- `dodo_environment` - `test_mode` or `live_mode`

Then edit `.mcp.json` to point `dodopayments-api` at the local stdio server:

```json
{
    "mcpServers": {
        "dodopayments-api": {
            "type": "stdio",
            "command": "npx",
            "args": ["-y", "dodopayments-mcp@latest"],
            "env": {
                "DODO_PAYMENTS_API_KEY": "${user_config.dodo_api_key}",
                "DODO_PAYMENTS_WEBHOOK_KEY": "${user_config.dodo_webhook_key}",
                "DODO_PAYMENTS_ENVIRONMENT": "${user_config.dodo_environment}"
            }
        }
    }
}
```

Run `/reload-plugins` to apply changes to your current session.

## A prompt to try first

Once the plugin is active, try:

```
Set up Dodo Payments webhook handlers in my Next.js app for payment.succeeded and subscription.active events.
```

Your agent will load the `webhook-integration` skill, use the `dodo-knowledge` MCP to pull the latest payload shapes, and write a handler with signature verification following the Standard Webhooks spec.

## Local development

Clone with the skills submodule:

```bash
git clone --recurse-submodules https://github.com/dodopayments/dodo-agent-plugin.git
cd dodo-agent-plugin
```

Validate the Claude Code plugin and marketplace:

```bash
claude plugin validate .
```

Load the plugin directly for a dev session:

```bash
claude --plugin-dir ./dodo-agent-plugin
```

Refresh the bundled skills to the latest upstream version:

```bash
git submodule update --remote skills-src
```

## For maintainers

The repo is configured to publish the OpenCode npm package on every GitHub Release.

**One-time setup (already done for this repo):**

- npm scope `@dodopayments` exists and is owned by Dodo Payments.
- GitHub Actions secret `NPM_TOKEN` is provisioned with publish rights to the `@dodopayments` scope.

**Release workflow:**

1. Bump the version in `.claude-plugin/plugin.json`.
2. Run `node scripts/sync-manifests.mjs` to propagate the version to Cursor, Codex, npm, and marketplace manifests.
3. Commit and tag.
4. Create a GitHub Release - the `Publish @dodopayments/opencode-plugin` workflow runs automatically and publishes to npm with provenance.

**Manual dry-run:**

- Workflow dispatch with `dry_run: true` to validate the release pipeline without publishing.

**CI check:**

- `node scripts/sync-manifests.mjs --check` is run by the workflow and fails the release if any manifest is out of sync.

## Resources

- [Dodo Payments documentation](https://docs.dodopayments.com)
- [Agent Skills docs](https://docs.dodopayments.com/developer-resources/agent-skills)
- [MCP Server docs](https://docs.dodopayments.com/developer-resources/mcp-server)
- [Skills source repo](https://github.com/dodopayments/skills)
- [Discord community](https://discord.gg/bYqAp4ayYh)

## License

MIT - see [LICENSE](./LICENSE).
