# Dodo Payments Agent Plugin

[![License](https://img.shields.io/github/license/dodopayments/dodo-agent-plugin.svg?style=flat-square)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.4.0-blue.svg?style=flat-square)](./CHANGELOG.md)
[![npm](https://img.shields.io/npm/v/@dodopayments/opencode-plugin.svg?style=flat-square)](https://www.npmjs.com/package/@dodopayments/opencode-plugin)
[![Discord](https://img.shields.io/discord/1305511580854779984?label=discord&style=flat-square)](https://discord.gg/bYqAp4ayYh)

The official Dodo Payments plugin for AI coding agents. Installs seventeen integration skills and two MCP servers across **Claude Code**, **Codex CLI**, **Cursor**, **VS Code / GitHub Copilot**, and **OpenCode** from a single source of truth.

This plugin conforms to the [Agent Plugins 1.0.0](https://agent-plugins.org/specification) specification: a root [`plugin.json`](./plugin.json), skills as immediate children of [`skills/`](./skills), and MCP servers in [`mcp.json`](./mcp.json). Clients with native Agent Plugins support load it directly; the provider-specific manifests in this repo are generated compatibility shims for clients that do not.

## What you get

- **Dodo Payments API MCP server** - Live API access (payments, subscriptions, customers, products, refunds, licenses, usage). Authenticates via browser OAuth, no local credentials required.
- **Dodo Knowledge MCP server** - No credentials. Semantic search over the current Dodo Payments documentation.
- **Seventeen agent skills** - Written as `SKILL.md` files with YAML frontmatter. Your agent loads the relevant skill on its own when a task calls for it.

## Install

### Claude Code

```bash
claude plugins marketplace add dodopayments/dodo-agent-plugin
claude plugins install dodopayments@dodopayments
```

The API MCP server uses browser OAuth by default, so no keys are required at install time. The first time your agent calls a Dodo tool, you'll be prompted to sign in.

### Codex CLI

Codex installs plugins in two steps: register the marketplace from your shell, then install the plugin from inside the Codex TUI.

1. Register the marketplace:

    ```bash
    codex plugin marketplace add dodopayments/dodo-agent-plugin
    ```

2. Open Codex and run the `/plugins` slash command:

    ```bash
    codex
    ```

    Then type `/plugins`, switch to the **Dodo Payments** marketplace, select the **dodopayments** plugin, and choose **Install plugin**.

If you previously added the marketplace before this fix landed and the plugin doesn't appear under `/plugins`, refresh it:

```bash
codex plugin marketplace upgrade dodopayments
```

> Codex CLI does not have a `codex plugin install` subcommand. Plugin installation always happens through the in-TUI `/plugins` flow ([official docs](https://developers.openai.com/codex/plugins)).

### Cursor

Manual install:

```bash
git clone https://github.com/dodopayments/dodo-agent-plugin.git ~/.cursor/plugins/local/dodo-agent-plugin
```

Restart Cursor. The plugin loads skills from `skills/` and MCP servers from `.mcp.json`, as declared in `.cursor-plugin/plugin.json`.

> Prior to v0.5.0 this clone produced a plugin with **no working skills**: `skills/` contained symlinks into a git submodule that a plain `git clone` does not fetch. Skills are now vendored as real files, so the command above works as documented. If you installed an earlier version, re-clone.

### VS Code / GitHub Copilot

VS Code detects Agent Plugins packages by the `$schema` in the root `plugin.json`, so no separate manifest is needed:

```bash
git clone https://github.com/dodopayments/dodo-agent-plugin.git
```

Then open the Chat view, go to **Plugins**, and add the cloned folder. Skills load from `skills/` and both MCP servers from `mcp.json`.

### OpenCode

OpenCode distributes via npm. Add the plugin to your `opencode.json`:

```jsonc
{
    "$schema": "https://opencode.ai/config.json",
    "plugin": ["@dodopayments/opencode-plugin"]
}
```

Restart OpenCode. Both MCP servers (`dodopayments-api`, `dodo-knowledge`) are registered automatically via the plugin's `config` hook. No manual `mcp` block required.

**Skills need one extra line.** OpenCode builds its skill index before plugin `config` hooks run, so a plugin cannot register its own bundled skills on current versions. Point OpenCode at the package's `skills/` directory:

```jsonc
{
    "$schema": "https://opencode.ai/config.json",
    "plugin": ["@dodopayments/opencode-plugin"],
    "skills": {
        "paths": ["node_modules/@dodopayments/opencode-plugin/skills"]
    }
}
```

Verify with `opencode run "List every skill available to you by name."` - you should see all seventeen.

> Versions before 0.5.0 documented these skills as auto-discovered. They were not: nothing in OpenCode scans an installed package, so OpenCode users had MCP servers but no skills. The plugin now also registers its skills path through both the `config` hook and the v2 `skill.transform` API, so the explicit `skills.paths` entry above becomes redundant as soon as OpenCode applies either during startup. Tracking: [`skills` discovery for npm plugins](https://opencode.ai/docs/skills).

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

**Getting started**

| Skill | Description |
|-------|-------------|
| `dodo-best-practices` | SDK setup, environments, API keys, and the canonical checkout-to-webhook architecture |
| `framework-adapters` | Official `@dodopayments/*` handlers for Next.js, Express, Hono, Astro, Remix, SvelteKit, Nuxt, Fastify, TanStack, Bun, Convex |
| `testing-and-go-live` | Test mode, test payment methods, webhook testing, production launch checklist |

**Accepting payments**

| Skill | Description |
|-------|-------------|
| `checkout-integration` | Checkout Sessions, payment links, and overlay checkout |
| `subscription-integration` | Subscription lifecycle, trials, plan changes, proration, on-demand charges |
| `mobile-checkout` | In-app checkout for React Native, Flutter, iOS, and Android |
| `webhook-integration` | Receiving and verifying webhooks via the Standard Webhooks spec |

**Billing models**

| Skill | Description |
|-------|-------------|
| `credit-based-billing` | Credit entitlements, balances, ledger, rollover, overage, meter-based deduction |
| `usage-based-billing` | Meters, event ingestion, aggregation, and per-unit pricing |
| `license-keys` | License key activation, validation, and instance management |

**Catalog and pricing**

| Skill | Description |
|-------|-------------|
| `product-catalog-management` | Products, pricing, add-ons, collections, images, digital delivery |
| `discounts-and-promotions` | Discount codes, eligibility, stacking, subscription-cycle limits |
| `localized-pricing` | Localized pricing, adaptive currency, and purchasing power parity |

**Customers and operations**

| Skill | Description |
|-------|-------------|
| `customer-management` | Customers, self-service portal, payment methods, wallets |
| `refunds-and-disputes` | Refunds, disputes and chargebacks, access reconciliation |

**UI and integrations**

| Skill | Description |
|-------|-------------|
| `billing-sdk` | BillingSDK React components for pricing tables and billing UI |
| `better-auth-integration` | The `@dodopayments/better-auth` plugin for customer sync, checkout, portal |

Skills source: [`dodopayments/skills`](https://github.com/dodopayments/skills), vendored into `skills/` as real files. Provenance (upstream commit and applied transforms) is recorded in [`.skills-source.json`](./.skills-source.json).

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

## Enable / disable individual MCP servers

Both MCPs ship enabled by default. You can turn either one off independently.

### OpenCode

The npm plugin reads two environment variables before registering MCPs:

| Env var | Effect |
|---|---|
| `DODO_DISABLE_API_MCP=1` | Skips registering `dodopayments-api` |
| `DODO_DISABLE_KNOWLEDGE_MCP=1` | Skips registering `dodo-knowledge` |

Truthy values: `1`, `true`, `yes`, `on` (case-insensitive). Export the var in your shell profile or set it inline:

```bash
DODO_DISABLE_API_MCP=1 opencode
```

### Claude Code, Codex CLI, Cursor

These clients load MCPs from the static `.mcp.json` shipped with the plugin. To disable a server, override its entry in your own project-level config and set `"enabled": false`.

**Claude Code** - edit `.mcp.json` at your project root (or run `claude mcp disable dodopayments-api`):

```json
{
    "mcpServers": {
        "dodopayments-api": {
            "type": "stdio",
            "command": "npx",
            "args": ["-y", "mcp-remote@latest", "https://mcp.dodopayments.com/sse"],
            "enabled": false
        }
    }
}
```

Run `/reload-plugins` to apply.

**Codex CLI / Cursor** - the same `enabled: false` pattern works in any project-level `.mcp.json` that overrides the plugin's bundled file. Restart the client after editing.

> Per-MCP toggles inside the Claude Code `/plugin` UI are tracked upstream in [anthropics/claude-code#27105](https://github.com/anthropics/claude-code/issues/27105) and [#46373](https://github.com/anthropics/claude-code/issues/46373). Until those land, the `enabled: false` override above is the supported path.

## A prompt to try first

Once the plugin is active, try:

```
Set up Dodo Payments webhook handlers in my Next.js app for payment.succeeded and subscription.active events.
```

Your agent will load the `webhook-integration` skill, use the `dodo-knowledge` MCP to pull the latest payload shapes, and write a handler with signature verification following the Standard Webhooks spec.

## Local development

```bash
git clone https://github.com/dodopayments/dodo-agent-plugin.git
cd dodo-agent-plugin
```

No submodules, no build step - `skills/` is vendored as real files.

Validate the Claude Code plugin and marketplace:

```bash
claude plugin validate .
```

Load the plugin directly for a dev session:

```bash
claude --plugin-dir ./dodo-agent-plugin
```

Verify everything before pushing:

```bash
npm run verify     # generated artifacts in sync + Agent Plugins conformance
```

### Repository layout

| Path | Role |
|---|---|
| `plugin.json` | **Canonical.** Agent Plugins v1.0.0 manifest and the version source of truth |
| `mcp.json` | **Canonical.** Agent Plugins v1.0.0 MCP config |
| `skills/` | **Canonical.** Seventeen skills, vendored as real files |
| `overlays/*.json` | Hand-authored provider extras the closed spec schema cannot express |
| `.claude-plugin/`, `.cursor-plugin/`, `.agents/`, `.mcp.json`, `plugins/dodopayments/` | **Generated.** Do not hand-edit - run `npm run build` |
| `scripts/build.mjs` | The single generator (`--check` for drift) |
| `scripts/conformance.mjs` | Agent Plugins conformance validator |
| `.skills-source.json` | Upstream provenance for the vendored skills |

Skills are authored in [`dodopayments/skills`](https://github.com/dodopayments/skills) and vendored here. A weekly workflow re-syncs them and opens a PR; run it on demand with the **Sync skills from upstream** workflow dispatch.

## For maintainers

The repo is configured to publish the OpenCode npm package on every GitHub Release.

**One-time setup (already done for this repo):**

- npm scope `@dodopayments` exists and is owned by Dodo Payments.
- GitHub Actions secret `NPM_TOKEN` is provisioned with publish rights to the `@dodopayments` scope.

**Release workflow:**

1. Bump `version` in `plugin.json` (the single source of truth).
2. Run `npm run build` to propagate it to every generated manifest.
3. Run `npm run verify`, then commit and tag.
4. Create a GitHub Release - the `Publish @dodopayments/opencode-plugin` workflow publishes to npm with provenance.

**Manual dry-run:**

- Workflow dispatch with `dry_run: true` to validate the release pipeline without publishing.

**CI checks:**

- `Verify` runs on every pull request and push to `main`: artifact drift, Agent Plugins conformance, live JSON Schema validation, a "seventeen skills, zero symlinks" assertion, and an npm payload check.
- The release workflow re-runs the same gates before publishing.

## Resources

- [Dodo Payments documentation](https://docs.dodopayments.com)
- [Agent Skills docs](https://docs.dodopayments.com/developer-resources/agent-skills)
- [MCP Server docs](https://docs.dodopayments.com/developer-resources/mcp-server)
- [Skills source repo](https://github.com/dodopayments/skills)
- [Discord community](https://discord.gg/bYqAp4ayYh)

## License

MIT - see [LICENSE](./LICENSE).
