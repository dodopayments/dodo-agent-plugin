# Changelog

## 0.3.2 - 2026-05-08

### Fixed

- **Codex CLI plugin still didn't appear in `/plugins` after 0.3.1.** ([#4](https://github.com/dodopayments/dodo-agent-plugin/issues/4)) The 0.3.1 marketplace pointed the plugin source at `path: "./"`. Codex's [`resolve_local_plugin_source_path`](https://github.com/openai/codex/blob/main/codex-rs/core-plugins/src/marketplace.rs) rejects this — after stripping the `./` prefix, the remainder is empty and the plugin is silently dropped (warn-logged, then skipped). The plugin must live in a non-empty subdirectory.
- **Plugin manifest paths missing the required `./` prefix.** Codex's [`resolve_manifest_path`](https://github.com/openai/codex/blob/main/codex-rs/core-plugins/src/manifest.rs) silently drops `skills` and `mcpServers` paths that don't start with `./`. The repo's `.codex-plugin/plugin.json` had `"skills": "skills/"` and `"mcpServers": ".mcp.json"`, both ignored by Codex.
- **`skills/` symlinks were dangling in Codex's clone.** `codex plugin marketplace add` does a plain `git clone` (no `--recurse-submodules`), so the existing `skills/` symlinks pointing into the empty `skills-src/` submodule resolved to nothing. Even with the marketplace fixed, no skills would have loaded.

### Added

- **`plugins/dodopayments/`** — self-contained Codex plugin bundle with real (non-symlink, non-submodule) files. Contains `.codex-plugin/plugin.json` with proper `./` paths, `.mcp.json`, and all eight `SKILL.md` files copied from `skills-src/`. This subdirectory is what `.agents/plugins/marketplace.json` now points at, and it's what Codex actually loads.
- **`scripts/bundle-codex-plugin.mjs`** — generates `plugins/dodopayments/` from canonical sources (`.codex-plugin/plugin.json`, `.mcp.json`, `skills-src/dodo-payments/`). Supports `--check` for CI drift detection. Wired into `scripts/sync-manifests.mjs` so version bumps and bundle refreshes happen together.

### Changed

- **`.agents/plugins/marketplace.json`**: source path moved from `./` to `./plugins/dodopayments`.
- **`.codex-plugin/plugin.json`** (root): `skills` and `mcpServers` paths now use the required `./` prefix.
- **`scripts/sync-manifests.mjs`**: now runs `bundle-codex-plugin.mjs` after the version sync, so the bundle stays in lockstep with the canonical manifests.

### Migration

If you ran `codex plugin marketplace add dodopayments/dodo-agent-plugin` before this release and the plugin did not appear in `/plugins`, refresh the marketplace cache:

```bash
codex plugin marketplace upgrade dodopayments
```

If the plugin still doesn't show up after upgrading, remove and re-add the marketplace:

```bash
codex plugin marketplace remove dodopayments
codex plugin marketplace add dodopayments/dodo-agent-plugin
```

Then open `codex`, run `/plugins`, switch to the **Dodo Payments** marketplace, and install the **dodopayments** plugin.

## 0.3.1 - 2026-05-08

### Fixed

- **Codex CLI install was broken on two levels.** ([#4](https://github.com/dodopayments/dodo-agent-plugin/issues/4))
    1. The README told users to run `codex plugin install dodopayments@dodopayments`, which is not a real Codex subcommand. Codex CLI 0.129+ only exposes `codex plugin marketplace {add,upgrade,remove}`; actual plugin installation happens via the `/plugins` slash command inside the Codex TUI.
    2. After `codex plugin marketplace add` succeeded, the plugin still did not appear in `/plugins`. The repo only shipped a Claude-Code-style manifest at `.claude-plugin/marketplace.json`. Codex prefers `.agents/plugins/marketplace.json` with its own schema (object-form `source`, required `policy` and `category` fields). The Claude-Code-shaped manifest was not a valid alternate layout for our split (`.codex-plugin/plugin.json` lives in a separate directory from `.claude-plugin/`).

### Added

- **`.agents/plugins/marketplace.json`** — canonical Codex marketplace manifest pointing the `dodopayments` plugin at the repo root, where `.codex-plugin/plugin.json` already lives. Schema follows the official Codex spec with `policy.installation: AVAILABLE`, `policy.authentication: ON_INSTALL`, and `category: Developer Tools`.

### Changed

- **README Codex section** rewritten to reflect the actual two-step install flow (`codex plugin marketplace add` from the shell, then `/plugins` from inside the TUI). Includes a `codex plugin marketplace upgrade dodopayments` hint for users who registered the marketplace before this fix.

### Migration

If you ran `codex plugin marketplace add dodopayments/dodo-agent-plugin` before this release and the plugin did not appear in `/plugins`, refresh the marketplace cache:

```bash
codex plugin marketplace upgrade dodopayments
```

Then open `codex`, run `/plugins`, switch to the **Dodo Payments** marketplace, and install the **dodopayments** plugin.

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
