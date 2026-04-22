# Dodo Payments Claude Code Plugin

[![License](https://img.shields.io/github/license/dodopayments/dodo-claude-plugin.svg?style=flat-square)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg?style=flat-square)](./CHANGELOG.md)
[![Discord](https://img.shields.io/discord/1305511580854779984?label=discord&style=flat-square)](https://discord.gg/bYqAp4ayYh)

The official Dodo Payments plugin for Claude Code. Installs agent skills and MCP servers in one step so Claude Code can build against Dodo Payments with up-to-date SDK patterns and live access to your account.

## What you get

The plugin ships three things in a single install:

- **The Dodo Payments API MCP server** - Pre-registered with Claude Code. Uses the remote SSE endpoint (`mcp.dodopayments.com/sse`) so you authenticate through your browser - no local credentials required.
- **The Dodo Knowledge MCP server** - No credentials required. Your agent can look up Dodo Payments' current documentation as it works, rather than relying on what the model was trained on.
- **Eight agent skills** - Written as Markdown files that teach Claude Code how to integrate Dodo Payments correctly. Claude Code loads the relevant skill on its own when a task calls for it.

## Structure

```
.claude-plugin/
├── plugin.json              # Plugin manifest and user config schema
└── marketplace.json         # Marketplace manifest for install-by-name flows
skills/                      # Flattened symlinks to the skills submodule
├── best-practices/
│   └── SKILL.md
├── checkout-integration/
│   └── SKILL.md
├── subscription-integration/
│   └── SKILL.md
├── webhook-integration/
│   └── SKILL.md
├── usage-based-billing/
│   └── SKILL.md
├── credit-based-billing/
│   └── SKILL.md
├── license-keys/
│   └── SKILL.md
├── billing-sdk/
│   └── SKILL.md
skills-src/                  # Git submodule: dodopayments/skills
.mcp.json                    # Dodo Payments API and docs MCP servers
```

## Included Skills

| Skill | Description |
|-------|-------------|
| `/dodopayments:best-practices` | Comprehensive guide to integrating Dodo Payments with best practices |
| `/dodopayments:checkout-integration` | Creating checkout sessions and payment flows |
| `/dodopayments:subscription-integration` | Implementing subscription billing flows |
| `/dodopayments:webhook-integration` | Setting up and handling webhooks for payment events |
| `/dodopayments:usage-based-billing` | Implementing metered billing with events and meters |
| `/dodopayments:credit-based-billing` | Credit entitlements, balances, and metered credit deduction |
| `/dodopayments:license-keys` | Managing license keys for digital products |
| `/dodopayments:billing-sdk` | Using BillingSDK React components |

Skills source: [`dodopayments/skills`](https://github.com/dodopayments/skills).

## Included MCP Servers

| Server | Purpose | Auth |
|--------|---------|------|
| `dodopayments-api` | Live API access (payments, subscriptions, customers, products, refunds, licenses, usage) | OAuth (browser) |
| `dodo-knowledge` | Semantic search over the Dodo Payments documentation | None |

Both servers are wired through `mcp-remote` so they run in any MCP-compatible client.

## Install

In your terminal, run:

```bash
claude plugins marketplace add dodopayments/dodo-claude-plugin
claude plugins install dodopayments@dodopayments
```

The API MCP server uses browser-based OAuth by default, so no keys are required at install time. The first time your agent calls a Dodo tool, you'll be prompted to sign in.

## Configure (optional)

If you prefer to run the API MCP locally with an API key instead of the remote SSE server, open `/plugins` in Claude Code, go to the **Installed** tab, select **Dodo Payments**, and choose **Configure options**. Fill in:

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

Once the plugin is active, try a prompt like:

```
Set up Dodo Payments webhook handlers in my Next.js app for payment.succeeded and subscription.active events.
```

Claude Code will load the `webhook-integration` skill, use the `dodo-knowledge` MCP to pull the latest payload shapes, and write a handler with signature verification following the Standard Webhooks spec.

## Local development

Clone the repo with the skills submodule:

```bash
git clone --recurse-submodules https://github.com/dodopayments/dodo-claude-plugin.git
cd dodo-claude-plugin
```

Validate the plugin and marketplace:

```bash
claude plugin validate .
```

Load the plugin directly for a dev session:

```bash
claude --plugin-dir ./dodo-claude-plugin
```

Then verify:

- `/help` shows the `dodopayments` namespace
- `/dodopayments:webhook-integration` loads the webhook skill

Install it end-to-end through the bundled marketplace:

```bash
claude plugin marketplace add ./dodo-claude-plugin --scope local
claude plugin install dodopayments@dodopayments --scope local
```

To refresh the bundled skills to the latest upstream version:

```bash
git submodule update --remote skills-src
```

## Resources

- [Dodo Payments documentation](https://docs.dodopayments.com)
- [Agent Skills docs](https://docs.dodopayments.com/developer-resources/agent-skills)
- [MCP Server docs](https://docs.dodopayments.com/developer-resources/mcp-server)
- [Skills source repo](https://github.com/dodopayments/skills)
- [Discord community](https://discord.gg/bYqAp4ayYh)

## License

MIT - see [LICENSE](./LICENSE).
