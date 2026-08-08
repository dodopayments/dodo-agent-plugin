# Changelog

## 0.5.0 - 2026-08-07

Adopts the [Agent Plugins 1.0.0](https://agent-plugins.org/specification) specification and makes every provider-specific manifest a generated artifact of one canonical source. Two defects found during the migration were already shipping.

### Fixed

- **The documented Cursor install shipped zero working skills.** `skills/` was seventeen symlinks into the `skills-src` git submodule, and distribution is a plain `git clone`, which does not fetch submodules. A bare clone of `0.4.0` yields 0 resolvable `SKILL.md` files and 17 dangling symlinks. Skills are now vendored as real files: the same clone yields 17 and 0. **If you installed Cursor from a clone before 0.5.0, re-clone.**
- **The OpenCode package shipped skills nothing could discover.** OpenCode scans six fixed locations, none inside an installed package, so users got MCP servers and no skills. `skills.paths` in your own `opencode.json` is now documented and verified; see the [package README](./opencode-plugin/README.md). Setting `config.skills` from the plugin's `config` hook is not a substitute — the skill index is built before `config` hooks run. The plugin module also exports nothing but its default function: OpenCode's loader throws `Plugin export is not a function` on any non-function named export and silently skips the whole plugin, MCP servers included.
- **`enabled` was not a legal key in a spec `mcp.json`.** The Agent Plugins server union is closed (`additionalProperties: false`), so a stray key silently skips the entire server entry. Copying `.mcp.json` verbatim would have disabled both servers. `enabled` now exists only in the generated legacy `.mcp.json`, which Claude Code and Cursor still read.

### Added

- **Root `plugin.json` and `mcp.json`**, conforming to Agent Plugins 1.0.0. Clients with native support — Codex CLI, VS Code / GitHub Copilot, Kiro — load the plugin directly. Verified on Codex 0.147.0: seventeen skills, two MCP servers, with `PLUGIN_ROOT`/`PLUGIN_DATA` injected per spec.
- **Kiro support** via the `dev.kiro` extension namespace in `plugin.json`, which is what the spec's reverse-domain namespaces are for.
- **Gemini CLI support** via a generated `gemini-extension.json` — **MCP servers only**. Gemini has no agent-skill primitive, so the seventeen skills are not available there and both the manifest description and the README say so rather than implying parity.
- **`scripts/conformance.mjs`**, a spec validator. The specification ships none and its failure semantics are silent, so this asserts the expected skill set explicitly (from `.skills-source.json`) rather than trusting that a passing install means a working one.
- **`Verify` workflow** running artifact-drift and conformance checks on every pull request, not only on release, plus live JSON Schema validation against the published schemas.
- **`sync-skills` workflow** re-syncing `skills/` from upstream weekly and opening a pull request, so staleness is visible instead of silent.
- **`.skills-source.json`** recording upstream provenance, the declared skill set, and any local transforms.

### Changed

- **`plugin.json` is now the version source of truth**, replacing `.claude-plugin/plugin.json`. Every provider manifest is generated from it.
- **Three scripts collapse into one.** `scripts/build.mjs` (with `--check`) replaces `sync-manifests.mjs`, `bundle-codex-plugin.mjs`, and `build-skills-for-npm.mjs`.
- **The `skills-src` submodule is gone.** Skills are vendored; upstream remains the content owner via the sync workflow.
- **`npm pack` no longer mutates the working tree.** The `prepack`/`postpack` + `git checkout skills/` dance is removed.
- **Codex `interface` metadata moved into `extensions["com.openai"]`**, which is what the spec's extension namespaces are for.
- **`skills/best-practices` renamed to `skills/dodo-best-practices`** to match its frontmatter `name`, since the spec keys skills by directory. The user-visible skill name is unchanged. Recorded as a declared transform in `.skills-source.json`, and fixed at the source in [dodopayments/skills#7](https://github.com/dodopayments/skills/pull/7) so the transform can eventually be dropped.
- **MCP servers now use native `streamable-http`** in `mcp.json` instead of wrapping remote endpoints in the `npx mcp-remote` stdio bridge. Both endpoints serve Streamable HTTP directly, and `dodopayments-api` advertises standard OAuth discovery, so clients broker auth themselves. This removes an `npx` subprocess and its cold start per server, per session. On Codex the shim actually hid the auth model — servers reported `Auth: Unsupported` through `mcp-remote` but report `Not logged in` natively, with `codex mcp login` available. The generated `.mcp.json` that Claude Code and Cursor read still uses the `mcp-remote` bridge, derived from the same URLs so the two cannot drift.

### Notes

`plugins/dodopayments/` and `.codex-plugin/` are retained, deliberately.

Codex reads the root manifest natively and the generated bundle is now valid in both formats. Deleting it is verified to work — with `source.path: "."` and the bundle removed entirely, Codex 0.147.0 installs seventeen skills and two MCP servers. It is still the wrong move today:

- Root `plugin.json` support ([openai/codex#35105](https://github.com/openai/codex/pull/35105)) first shipped stable in **0.146.0 on 2026-07-29**, one release cycle before this changelog entry.
- A self-referencing marketplace `source.path` was **never** accepted before **0.142.0** ([openai/codex#28771](https://github.com/openai/codex/pull/28771)); both `"."` and `"./"` were rejected outright before it.
- Codex auto-updates only managed installs. Standard `npm`/`brew` installs require an explicit upgrade, and upstream documents no minimum-supported-version policy.

So the bundle is what keeps the plugin working for anyone who has not updated in the last couple of weeks. It stays until 0.146+ adoption is safe to assume, and even then the `source.path` change and the directory deletion must land in separate releases, because users who ran `codex plugin marketplace add` hold a cached manifest and need `codex plugin marketplace upgrade`.

## 0.4.0 - 2026-08-01

### Added

- **Nine new agent skills**, bringing the bundle from eight to seventeen: `framework-adapters`, `product-catalog-management`, `customer-management`, `refunds-and-disputes`, `discounts-and-promotions`, `localized-pricing`, `mobile-checkout`, `testing-and-go-live`, `better-auth-integration`. Symlinked in `skills/` and materialized into `plugins/dodopayments/skills/` by the existing bundler.

### Changed

- **`skills-src` submodule bumped** to pick up [dodopayments/skills#6](https://github.com/dodopayments/skills/pull/6), which rewrote all eight existing skills against the current API and added the nine above.
- **README** now lists all seventeen skills grouped by task, and the version badge (stale at `0.2.0`) tracks the canonical manifest version again.
- **Codex marketplace listing** (`.codex-plugin/plugin.json` `longDescription`) and the **npm package README** (`opencode-plugin/README.md`) no longer advertise "eight skills"; both now describe the seventeen shipped.

### Fixed

Carried in from the skills submodule — these were shipping broken guidance to agents:

- **`api.dodopayments.com` has no DNS record.** The base URL in `best-practices` was unreachable; corrected to `live.dodopayments.com` / `test.dodopayments.com`.
- **Webhook signature verification could never succeed.** Hand-rolled HMAC in four languages signed `timestamp.payload`, omitting `webhook-id`. Dodo follows the Standard Webhooks spec (`webhook-id.webhook-timestamp.body`). Replaced with `client.webhooks.unwrap()` / the `standardwebhooks` library.
- **Wrong SDK surface**: `customers.createPortalSession()` does not exist, deprecated `payments.create()` was taught for new integrations, `sk_test_`/`sk_live_` key prefixes are Stripe's format (Dodo issues `dodo_test_`/`dodo_live_`), and a nonexistent "publishable key" invited leaking a secret key client-side.
- **Unsafe payment logic**: `dispute.accepted` was treated as a win that restored customer access (it means the merchant conceded), and subscription cancellation revoked every license key a customer owned, including keys for unrelated products.
- **Access control that silently no-opped**: `licenseKeys.update()` was sent a nonexistent `status` field instead of `disabled`, and subscription webhook handlers read `data.customer_id` where the payload nests the customer — passing `undefined` to every grant and revoke call.
- **Framework adapter examples**: `@dodopayments/express` exports `checkoutHandler`, not `Checkout`; `@dodopayments/fastify` returns `{ getHandler, postHandler }` rather than a callable; `@dodopayments/nuxt` auto-imports its handlers and exports only the Nuxt module from its root. `environment` was passed unnarrowed in every adapter, which does not type-check against the SDK's literal union.
- **Non-TypeScript examples**: the Go webhook handler called a nonexistent `option.WithEnvironment` and used the wrong `Unwrap` signature; the Python client was constructed with an unnarrowed env var that raises `ValueError` at startup; the Go quick-start called `os.Getenv` without importing `os`.
- **CLI documentation**: `dodo wh listen` was described as a tunnel that prints a public URL (it is an outbound relay that prints none), and `dodo wh trigger` payloads were not documented as unsigned — contradicting the adjacent instruction to always verify signatures.

### Enforcement

The submodule now carries CI that compiles every published example against the real SDKs, so the corrections above cannot silently regress: 217 TypeScript blocks (including the `@dodopayments/*` adapters), Go via `go build` against `dodopayments-go`, and Python via pyright. Structural rules cover hostnames, key prefixes, hand-rolled webhook HMAC, and manifest/README/frontmatter agreement.

## 0.3.3 - 2026-05-08

### Added

- **Per-MCP enable/disable toggles for OpenCode.** The npm plugin now reads two environment variables before registering each MCP:
  - `DODO_DISABLE_API_MCP=1` skips registering `dodopayments-api`.
  - `DODO_DISABLE_KNOWLEDGE_MCP=1` skips registering `dodo-knowledge`.

  Truthy values: `1`, `true`, `yes`, `on` (case-insensitive). Both unset = both registered (prior default behavior preserved). Env vars chosen over an `opencode.json` config block because OpenCode's top-level config schema is strict and rejects unknown keys ([anomalyco/opencode#9161](https://github.com/anomalyco/opencode/issues/9161)).
- **Explicit `"enabled": true` on every MCP entry in `.mcp.json`** (Claude Code / Codex / Cursor bundle). Gives users a clear field to flip to `false` in their own override `.mcp.json` to disable an individual server. This is the supported path until per-MCP plugin toggles land upstream ([anthropics/claude-code#27105](https://github.com/anthropics/claude-code/issues/27105), [#46373](https://github.com/anthropics/claude-code/issues/46373), [#50826](https://github.com/anthropics/claude-code/issues/50826)).
- **README sections** documenting the new toggles for all four clients (Claude Code, Codex CLI, Cursor, OpenCode), plus an env-var table in `opencode-plugin/README.md`.

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
