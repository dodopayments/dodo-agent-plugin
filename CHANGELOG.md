# Changelog

## 0.2.0 - 2026-04-23

### Renamed

- **Repository renamed from `dodo-claude-plugin` to `dodo-agent-plugin`** to reflect that this plugin now serves four AI coding agents (Claude Code, Codex, Cursor, OpenCode), not just Claude Code.
- **GitHub's automatic redirect keeps the old URL working**, but the new URL is canonical.
- **If you installed via `claude plugins marketplace add dodopayments/dodo-claude-plugin`**, re-add with the new URL when convenient: `claude plugins marketplace add dodopayments/dodo-agent-plugin`. Existing installations keep working via the redirect; no urgent action required.

### Added

- **Codex CLI support** via new `.codex-plugin/plugin.json` manifest. Install with `codex plugin marketplace add dodopayments/dodo-agent-plugin`. Codex also natively reads the existing `.claude-plugin/marketplace.json`, so this repo serves both editors from one marketplace file.
- **Cursor support** via new `.cursor-plugin/plugin.json` manifest. Cursor auto-discovers the bundled skills from `.claude/skills/` (Claude Code compatibility) and reads `.mcp.json` as-is.
- **OpenCode support** via new npm package [`@dodopayments/opencode-plugin`](https://www.npmjs.com/package/@dodopayments/opencode-plugin). Install by adding to `opencode.json` - see README for the config snippet.
- `opencode.json` reference config - users paste it into their own config.
- `opencode-plugin/` - OpenCode plugin entry point (`index.js` registers no runtime hooks; the package's value is the bundled `skills/` and documented MCP server snippets).
- `scripts/sync-manifests.mjs` - single command that keeps version numbers in sync across all four manifests and regenerates the OpenCode MCP block from the shared `.mcp.json`. Run with `--check` in CI.
- `scripts/build-skills-for-npm.mjs` - materializes the `skills/` symlinks into real directories for `npm pack` (via `prepack`), then restores the symlinks afterward (via `postpack`). Required because npm does not follow symlinks in the tarball.
- `.github/workflows/publish-opencode.yml` - publishes `@dodopayments/opencode-plugin` to npm with provenance on every GitHub Release. Supports manual `workflow_dispatch` with dry-run mode for testing.
- `For maintainers` section in the README covering npm scope ownership, `NPM_TOKEN` setup, and the release workflow.

### Changed

- All four plugin manifests bumped to `0.2.0` (`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.cursor-plugin/plugin.json`, `.codex-plugin/plugin.json`) plus the new `package.json`.
- `repository` URL updated to `dodopayments/dodo-agent-plugin` in all manifests.
- README rewritten: retitled to "Dodo Payments Agent Plugin", added install sections for Codex/Cursor/OpenCode, added a prominent rename callout pointing here.

### Unchanged

- The plugin's internal name stays `dodopayments` (so install commands still use `@dodopayments`).
- The eight bundled skills are untouched (skills-src submodule is unchanged).
- The two MCP servers and their configurations are untouched.
- The Claude Code install flow works identically to 0.1.0, aside from the new repo name in the URL.

## 0.1.0 - 2026-04-21

Initial release.

- Eight Dodo Payments agent skills bundled via the `dodopayments/skills` submodule: `best-practices`, `checkout-integration`, `subscription-integration`, `webhook-integration`, `usage-based-billing`, `credit-based-billing`, `license-keys`, `billing-sdk`.
- `dodopayments-api` MCP server (remote SSE via `mcp-remote`) pre-registered for live API access.
- `dodo-knowledge` MCP server (remote HTTP via `mcp-remote`) pre-registered for on-demand docs lookup.
- Optional `userConfig` for users who switch the API MCP to local stdio (`dodopayments-mcp`).
