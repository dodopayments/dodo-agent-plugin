# Changelog

## 0.3.0 - 2026-04-23

### Changed

- **OpenCode: MCP servers now register automatically.** `@dodopayments/opencode-plugin` no longer requires users to paste an `mcp: { ... }` block into their `opencode.json`. The plugin now implements OpenCode's `config` plugin hook and injects `dodopayments-api` and `dodo-knowledge` into the runtime config on load. Install reduces to:

    ```jsonc
    { "plugin": ["@dodopayments/opencode-plugin"] }
    ```

    This brings OpenCode to parity with the Claude Code, Codex, and Cursor installs, all of which already auto-register MCPs.

- **User-declared MCPs win.** Registration uses nullish-assign (`??=`), so if a user declares their own entry for `dodopayments-api` or `dodo-knowledge` in `opencode.json`, their entry is preserved. This is the documented way to swap the default remote OAuth server for the local stdio `dodopayments-mcp` with a self-provided API key.

### Removed

- **Root `opencode.json`** has been removed from the repository and from the npm `files[]` array. It previously shipped as a reference snippet; the plugin's `config` hook supersedes it. Install instructions live in `README.md`.
- **`translateMcpToOpencode` translation** in `scripts/sync-manifests.mjs`. The script no longer reads `.mcp.json` or writes `opencode.json` - it now only propagates the canonical version across the four plugin manifests and the npm `package.json`.

### Migration

If you were using a prior version with the manual `mcp: { ... }` block in your `opencode.json`, you can remove that block. No other changes required. If you were using a customized `mcp.dodopayments-api` entry (e.g. pointing at the local stdio server), keep it - your entry takes precedence.

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
