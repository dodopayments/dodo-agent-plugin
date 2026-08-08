# Plan: Adopt Agent Plugins v1.0.0 + Expand Provider Support

**Repo:** `dodopayments/dodo-agent-plugin` (currently v0.4.0)
**Target spec:** [Agent Plugins 1.0.0](https://agent-plugins.org/specification) (`agentplugins/agent-plugins-spec`)
**Effort:** Large (3d+), decomposed into 5 independently shippable releases
**Status:** In flight. v0.5.0 implemented in [PR #13](https://github.com/dodopayments/dodo-agent-plugin/pull/13). Experiment results are recorded inline in §4.

---

## 0. TL;DR

Make the **repo root the Agent Plugin**: add a spec-conformant root `plugin.json` + `mcp.json`, and **vendor the 17 skills as real files** (dropping the `skills-src` submodule + symlink farm). Everything provider-specific becomes a *generated* artifact from that canonical source.

Three things this buys, in order of value:

1. **Fixes two live bugs.** The documented Cursor install ships **zero working skills today** (bare `git clone` → 17 dangling symlinks into an uncloned submodule). The OpenCode npm package may have shipped zero skills for four releases (needs Experiment A).
2. **Three providers become free.** Codex CLI, VS Code/GitHub Copilot, and Kiro read the spec natively. VS Code/Copilot is the single largest distribution win in this plan and costs verification only.
3. **Collapses 3 sync scripts → 1 generator** with real CI drift + conformance gating.

The migration is **mostly additive**. The hard parts are not the spec — they are (a) the pre-existing breakage, and (b) the spec's **silent-failure semantics**: a broken `skills/` directory is non-fatal, so the plugin installs cleanly, MCP servers work, and the entire payload is just *gone* with no error. Every skills-touching change needs a **positive** CI assertion.

**Already-shipped spec violation:** `"enabled": true` in `.mcp.json` is not a member of the spec's closed `stdio` server union (`additionalProperties: false`; only `type`/`command`/`args`/`env`/`cwd`). Copying `.mcp.json` → `mcp.json` verbatim would ship a broken MCP config on day one.

---

## 1. Current State (verified inventory)

| Surface | Path | Role |
|---|---|---|
| Claude Code manifest | `.claude-plugin/plugin.json` | **Canonical version source today.** Has `userConfig` (3 secret fields) |
| Claude marketplace | `.claude-plugin/marketplace.json` | `plugins[0].source: "./"` (repo root) |
| Codex manifest | `.codex-plugin/plugin.json` | `skills: "./skills/"`, `mcpServers: "./.mcp.json"`, rich `interface` block |
| Cursor manifest | `.cursor-plugin/plugin.json` | `skills: "skills/"` (**no** `./` prefix) |
| Codex marketplace | `.agents/plugins/marketplace.json` | 3rd schema: `source:{source:"local",path:"./plugins/dodopayments"}`, `policy{}` |
| Codex bundle | `plugins/dodopayments/**` | **Generated + git-committed.** Real copies of 17 skills + `.mcp.json` + manifest |
| Skills | `skills/*` | **17 symlinks** → `../skills-src/dodo-payments/<name>` |
| Skills source | `skills-src/` | **Git submodule** → `dodopayments/skills` @ `8d6ccd9` |
| MCP config | `.mcp.json` | 2 servers, `type:"stdio"` + `npx mcp-remote`, `enabled:true` |
| OpenCode plugin | `opencode-plugin/index.js` | **Programmatic** MCP registration, different shape (`type:"local"`, `command:[...]`) |
| npm | `package.json` | `prepack` materializes symlinks, `postpack` deletes + `git checkout skills/` |
| Scripts | `scripts/{sync-manifests,bundle-codex-plugin,build-skills-for-npm}.mjs` | 3 scripts |
| CI | `.github/workflows/publish-opencode.yml` | npm publish only; `--check` gates **release only**, not PRs |

**Skill frontmatter is already portable:** only `name` + `description` (upstream CI warns on any other key). One exception: `skills/best-practices/SKILL.md` declares `name: dodo-best-practices` — **verified mismatch with its directory name**.

---

## 2. Target State

```text
dodo-agent-plugin/                    ← the plugin root IS the repo root
├── plugin.json                       ← NEW, canonical, hand-authored
├── mcp.json                          ← NEW, canonical, hand-authored
├── skills/                           ← VENDORED real dirs (17), no symlinks
│   └── <name>/SKILL.md
├── assets/icon.svg
│
├── overlays/                         ← NEW: tiny provider-extras, hand-authored
│   ├── claude.json                   (userConfig only)
│   └── cursor.json                   (path-prefix quirks)
│
├── .claude-plugin/{plugin,marketplace}.json   ← GENERATED (compat)
├── .cursor-plugin/plugin.json                 ← GENERATED (compat, pending E-E)
├── .agents/plugins/marketplace.json           ← GENERATED (Codex marketplace)
├── .mcp.json                                  ← GENERATED from mcp.json (compat)
├── opencode-plugin/index.js                   ← hand-authored (outside spec)
│
├── scripts/build.mjs                 ← ONE generator (replaces 3)
├── scripts/conformance.mjs           ← NEW spec validator
└── .skills-source.json               ← NEW: pinned upstream SHA
```

**Deleted by end state:** `skills-src/` submodule, `plugins/dodopayments/**`, `.codex-plugin/`, `scripts/build-skills-for-npm.mjs`, `scripts/sync-manifests.mjs`, `scripts/bundle-codex-plugin.mjs`, `prepack`/`postpack` hooks.

---

## 3. Architectural Decisions

### D1 — Vendor the skills. Drop the submodule. **[Decided: Vendor]**

`skills/` becomes 17 real, git-tracked directories. `dodopayments/skills` remains the *content* source of truth; this repo becomes a pinned **distribution** of it.

**Why:**
- Agent Plugins distribution is "git clone the repo." Nobody passes `--recurse-submodules`. Symlinks dangle → skills vanish → and per spec failure boundaries this is **non-fatal**, so it fails silently.
- **This is a live bug, not a hypothetical.** README's Cursor install is a bare `git clone` into `~/.cursor/plugins/local/`. That install ships 17 dangling symlinks *today*, independent of this migration.
- Symlinks collide with spec containment rules. Whether a client resolves, rejects, or ignores `skills/x → ../skills-src/...` is undefined per-client. Don't make the payload depend on undefined behavior.
- Deletes `build-skills-for-npm.mjs` and the fragile `prepack`/`postpack` + `git checkout skills/` dance — including its worst mode, where a failed publish leaves a mutated working tree and `git checkout` runs against dirty state.

**Upstream flow (replaces `git submodule update --remote`):**
Scheduled + `repository_dispatch` CI job → clone upstream at ref → sync `dodo-payments/*` → `skills/` → record SHA in `.skills-source.json` → **open a PR**. Staleness becomes a visible open PR instead of invisible drift.

**Trade accepted:** lose submodule provenance; regain it via recorded SHA + reviewable diff.

---

### D2 — `plugins/dodopayments/` can die, but **one release later than deletion feels safe**

Both original justifications weaken **asymmetrically**:
- **(a) submodule-not-cloned** → fully dissolved by D1. ✅
- **(b) Codex marketplace rejects `source.path: "./"`** → **does NOT automatically dissolve.** Codex#35105 changes the *plugin loader*, not necessarily the *marketplace manifest validator*. Separate code paths — do not conflate.

**Hypothesis to test (E-C):** the rejection may concern the literal string `"./"` vs `"."` (trailing-slash normalization), not self-reference. The repo already navigates this inconsistency by hand — `.cursor-plugin/` omits `./`, `.codex-plugin/` includes it.

**Rollback risk:** low on content, **real on marketplace cache**. Users who ran `codex plugin marketplace add` hold a cached manifest pointing at `./plugins/dodopayments`. Changing the path requires `codex plugin marketplace upgrade dodopayments` — a remedy the README already documents (precedent exists).

**Rule: do NOT change `source.path` and delete the directory in the same release.** Change path in release N (directory still present + valid), delete in N+1.

---

### D3 — Repo root IS the plugin root. **Do not move it.** **[Decided: keep at root]**

- The closed schema constrains `plugin.json` **only**. It says nothing about siblings. `scripts/`, `.github/`, `README.md`, `package.json` at root are **not violations** — no client enumerates the root and rejects unknowns. "Spec cleanliness" here is aesthetic, not normative.
- The two rules that actually bind — containment, and `skills/` immediate-children-only — are trivially satisfied at root.
- Claude marketplace already ships `source: "./"` **and is installed in the field**. Moving the root breaks every existing Claude install's update path for zero functional gain.
- npm is neutral (`files:` already whitelists explicitly).
- `assets/icon.svg` (referenced from the Codex `interface` block) resolves relative to plugin root — correct and contained at root, a path-rewrite chore in a subdir.

The only argument for a subdir is the Codex marketplace `"./"` question — a single-provider workaround that must not dictate canonical layout. If `"."` genuinely fails, the fallback is a **thin pointer directory**, not a duplicated bundle.

---

### D4 — `userConfig` / secrets: **delete from the portable surface. Never fake it in `extensions`.**

- The default path needs **no credentials at all** — `dodo-knowledge` is unauthenticated; `dodopayments-api` uses browser OAuth. This is not a secrets-architecture problem; it's an advanced-mode **documentation** problem affecting a small minority. Optimize for the 95%.
- **Do NOT invent `extensions["com.dodopayments"].userConfig`.** Every client ignores it, it will *look* like it works, and it will be actively wrong when v1.1 ships a real mechanism. `FUTURE_CONSIDERATIONS.md` deferring secrets is a signal to wait, not to freelance.
- Keep `userConfig` in the **generated** `.claude-plugin/plugin.json` only. Claude users keep their exact current UX.
- Portable local-stdio guidance is one paragraph of docs: export the key in your shell, declare `dodopayments-api` in your own client config. That is already how the documented OpenCode override works.

**Per-MCP enable/disable:** no portable mechanism exists; don't pretend otherwise. Document per-client (`claude mcp disable`, VS Code UI, project-level override). Keep OpenCode's env kill-switches — that's the npm plugin, outside the spec's jurisdiction.

**What legitimately migrates:** the Codex `interface` block (`composerIcon`, `displayName`, `defaultPrompt[]`) → `extensions["com.openai"]`. Non-secret UI metadata is exactly this namespace's purpose, and Codex#35105 reads it there.

---

### D5 — `mcp.json` is canonical; `.mcp.json` is **generated from it**

**Direction is the whole decision.** Generating `mcp.json` from `.mcp.json` guarantees leaking legacy keys (`enabled`) into the spec file. Always generate legacy *from* canonical.

- Duplication cost is trivial (2 servers, ~20 lines); `--check` handles drift.
- **Nothing breaks for existing users.** Claude/Cursor keep reading `.mcp.json`; VS Code ignores `.mcp.json` and reads `mcp.json`. Both additive.
- **Hazard: double-registration on Codex**, which has native root support *and* a `.codex-plugin/` overlay whose `mcpServers` points at `./.mcp.json`. Precedence is unspecified (Experiment E-D). If it double-registers, **delete `.codex-plugin/` in the same release that adds root `mcp.json`.**

---

### D6 — One generator. Canonical source = **the spec-shaped root files themselves**

**Reject the neutral-meta-file design.** If root `plugin.json` were generated, the file that *is* the contract — the one a human opens first, the one a future official validator runs against — becomes a build artifact you cannot hand-fix. That inverts the spec's premise.

| Layer | Files | Authored? |
|---|---|---|
| **Canonical** | `plugin.json`, `mcp.json` | Hand-authored. `plugin.json` becomes the **version source of truth** (flip from `.claude-plugin/plugin.json`) |
| **Overlays** | `overlays/claude.json` (userConfig), `overlays/cursor.json` (path quirks) | Hand-authored, tiny, provider-extras only |
| **Emitted** | `.claude-plugin/*`, `.cursor-plugin/*`, `.mcp.json`, `.agents/plugins/marketplace.json`, `package.json` version | Generated |

Codex needs **no overlay** once `interface` lives in `extensions["com.openai"]`.

**Scripts 3 → 1:** `sync-manifests` + `bundle-codex-plugin` collapse into `scripts/build.mjs [--check]`. `build-skills-for-npm` dies with D1.

---

### D7 — Provider tier list (gate: *does the client have a real on-demand skill primitive?*)

Without one, 17 skills become either a giant always-on rules file or nothing.

**Tier S — do now, ~free with the migration**
1. **VS Code / GitHub Copilot** — best value/effort in the entire plan by a wide margin. Falls out of root `plugin.json` + `mcp.json` + `skills/`. Enormous distribution. Cost: verification only.
2. **Codex CLI** — existing target, gets *simpler* (native root support).
3. **Cursor** — existing target; keep `.cursor-plugin/` as belt-and-braces until E-E confirms root detection.

**Tier A — small deliberate effort**
4. **Kiro / AWS** — native v1 + `dev.kiro/` extension namespace. One `extensions` block + testing. Modest audience, genuinely cheap.
5. **OpenCode** — already shipped. The work here is a **fix**, not an addition (see E-A).

**Tier B — only on real user demand**
6. **Gemini CLI** — easy manifest, but **no SKILL.md concept at all**. Ship **MCP-only** and say so plainly; `dodo-knowledge` alone covers a real fraction of the skills' value and self-updates.
7. **Amazon Q CLI** — same shape, smaller audience.

**Tier F — explicitly DO NOT DO**
- **Windsurf, Cline, Continue, Zed, Amp, Factory Droid.** Bespoke config each, no on-demand skill primitive, and the only skills path is an always-on rules file. 17 skills flattened is tens of thousands of tokens of permanent context — it measurably degrades agent quality and makes the plugin look bad. Plus N manifests × every release, forever, for marginal installs.
- **Build NO "flatten skills into AGENTS.md/rules" emitter for any client.** Most tempting, most damaging item on the list. For coverage there, ship a one-page doc: *"point your client at the `dodo-knowledge` MCP."* One line of config, zero context cost, always current.
- **Devin** — an importer of other tools' formats, not a target. Nothing to do.

> **Meta-point:** the marginal value of client #6 is far below the marginal value of skills *actually loading* on clients #1–5. **Fix correctness before breadth.**

---

### D8 — Evaluate native `sse` / `streamable-http` transports (drop the `mcp-remote` shim?)

Both servers are **remote endpoints wrapped in `npx mcp-remote`** — a bridge that exists for stdio-only clients and for OAuth brokering. Spec v1 has **native** `sse` and `streamable-http` transports:

```jsonc
"dodopayments-api":  { "type": "sse",             "url": "https://mcp.dodopayments.com/sse" }
"dodo-knowledge":    { "type": "streamable-http", "url": "https://knowledge.dodopayments.com/mcp" }
```

**Upside:** removes an `npx` subprocess + Node dependency + cold-start latency per server, per session.
**Risk:** spec v1 has **no portable OAuth story** — auth is entirely client-managed, and an auth failure is a *connection* failure. `mcp-remote` currently brokers the browser OAuth flow for `dodopayments-api`.
**Also:** `sse` support is **OPTIONAL** for conformant clients; `streamable-http` is not. If `mcp.dodopayments.com` can serve Streamable HTTP, prefer it over legacy `sse`.

**Recommendation:** keep `stdio` + `mcp-remote` as the default in v0.6.0 (zero-risk parity), and run **Experiment E-G** in the verification window. If native remote transports authenticate cleanly on VS Code + Codex, switch in v0.8.0 and keep `stdio` only in the generated legacy `.mcp.json`.

> **Superseded — E-G ran early and passed, so this shipped in v0.5.0, not v0.8.0.** Both endpoints serve Streamable HTTP, and the shim turned out to *suppress* the auth model rather than broker it, which inverted the risk this recommendation was hedging against. Canonical `mcp.json` uses `streamable-http` for both servers; no `sse` entry ships. See the E-G result in §4.

---

## 4. Pre-Flight Experiments (blocking — run before/within the verification window)

Every experiment below is **falsifiable**: it has a command, steps, and a binary PASS/FAIL criterion. Record the outcome inline in the Result column and commit this file.

> **Shared harness.** Unless stated otherwise, work from a scratch clone so no experiment mutates the real repo:
> ```bash
> export EXP=$(mktemp -d) && git clone https://github.com/dodopayments/dodo-agent-plugin "$EXP/repo" && cd "$EXP/repo"
> ```
> "17 skills" always means the 17 directory names listed in `skills/`. "2 MCPs" always means `dodopayments-api` + `dodo-knowledge`.

---

### E-A — Does OpenCode discover skills from the npm package's `skills/` dir? · **P0**

**Gates:** what vendoring must produce (v0.5.0 scope). Package README claims auto-discovery from `skills/`; OpenCode docs say it discovers `.claude/skills/` + `.agents/skills/` — **neither exists in this repo**. If the README is wrong, OpenCode users have had **zero skills for 4 releases**.

```bash
# 1. Build the package exactly as published
cd "$EXP/repo" && git submodule update --init --recursive
npm pack                                    # → dodopayments-opencode-plugin-0.4.0.tgz

# 2. Confirm skills are real files inside the tarball (not dangling symlinks)
tar -tzf dodopayments-opencode-plugin-*.tgz | grep -c 'package/skills/.*/SKILL\.md'
tar -tzf dodopayments-opencode-plugin-*.tgz | grep 'package/skills/' | head -5

# 3. Install into a scratch OpenCode project
mkdir -p "$EXP/oc" && cd "$EXP/oc"
npm init -y && npm install "$EXP/repo"/dodopayments-opencode-plugin-*.tgz
cat > opencode.json <<'JSON'
{ "$schema": "https://opencode.ai/config.json", "plugin": ["@dodopayments/opencode-plugin"] }
JSON

# 4. Ask the agent to enumerate skills
opencode run "List every skill you have available by name. Output only names, one per line."
```

| Check | Expected (PASS) |
|---|---|
| Step 2 count | `17` |
| Step 2 paths | real file entries, no `->` symlink indirection |
| Step 4 output | contains all 17 skill names, incl. `dodo-best-practices` |
| MCP presence | `opencode` starts with `dodopayments-api` + `dodo-knowledge` registered |

**FAIL ⇒** OpenCode cannot see `skills/`. Remediation (decide before v0.5.0): either (a) also emit `.agents/skills/<name>/SKILL.md` copies into the npm payload, or (b) drop `skills/` from `files:` and switch OpenCode guidance to a clone-based install. **Record which.**

**Result:** ☑ **FAIL — confirmed live production bug.** 17 `SKILL.md` present in `node_modules`, OpenCode discovered **0** (isolated `HOME`; only its builtin `customize-opencode`). Plugin itself loaded fine — `dodo-knowledge_search_docs` MCP tool was registered — so this is skill *discovery*, not plugin loading. An earlier run showing 8 skills was contaminated by the global Claude plugin install.
**Root cause:** OpenCode scans six fixed locations, none inside an installed package. Setting `config.skills.paths` from the plugin's `config` hook does **not** work on 1.18.13 (skill index is built before plugin config hooks run; MCP works because it is lazy). The v2 `skill.transform` named export was also not picked up.
**Remediation shipped:** plugin registers via both the `config` hook and v2 `skill.transform` (forward-compatible), and the README documents the `skills.paths` entry. **Verified: all 17 skills load.**

---

### E-B — Is `enabled` legal in spec `mcp.json`? · **P0 (5 min)**

**Gates:** whether the very first `mcp.json` ships broken. **Pre-answered from the published schema: NO.**

```bash
curl -s https://agent-plugins.org/schemas/1.0.0/mcp.schema.json -o /tmp/mcp.schema.json
jq '.["$defs"].stdioServer.additionalProperties, ($.["$defs"].stdioServer.properties | keys)' /tmp/mcp.schema.json

# Empirically validate the exact file we intend to ship
npx -y ajv-cli validate --spec=draft2020 -s /tmp/mcp.schema.json -d mcp.json
```

| Check | Expected (PASS = confirm the key is illegal) |
|---|---|
| `additionalProperties` | `false` |
| `properties` keys | exactly `["args","command","cwd","env","type"]` — **no `enabled`** |
| `ajv` on `mcp.json` **with** `enabled` | **invalid** (proves the hazard is real) |
| `ajv` on `mcp.json` **without** `enabled` | **valid** (proves §6.2 is correct) |

**Action regardless of result:** ship `mcp.json` without `enabled`; keep `enabled:true` only in the generated legacy `.mcp.json`. Wire the `ajv` invocation into `scripts/conformance.mjs`.

**Result:** ☑ **CONFIRMED ILLEGAL.** `stdioServer` is `additionalProperties: false` with properties exactly `["args","command","cwd","env","type"]`. ajv against the published schema: with `enabled` → **invalid** (`must match exactly one schema in oneOf`); without → **valid**. Copying `.mcp.json` verbatim would have silently skipped **both** servers. Shipped: `enabled` exists only in the generated legacy `.mcp.json`.

---

### E-C — Does Codex accept marketplace `source.path: "."`? · **P1**

**Gates:** deletion of `plugins/dodopayments/` (D2). Tests the trailing-slash hypothesis (`"./"` vs `"."`), not just self-reference.

```bash
# Scratch fork with vendored skills + root plugin.json/mcp.json (v0.6.0 tag state)
cd "$EXP/repo" && git checkout v0.6.0
jq '.plugins[0].source.path = "."' .agents/plugins/marketplace.json > /tmp/m.json \
  && mv /tmp/m.json .agents/plugins/marketplace.json
git add -A && git commit -m "exp: self-referencing marketplace path" && git push fork HEAD:exp-c

codex plugin marketplace add <your-fork>/dodo-agent-plugin
codex   # → /plugins → Dodo Payments → install
```

| Check | Expected (PASS) |
|---|---|
| `marketplace add` | exits 0, no schema/path validation error |
| `/plugins` listing | plugin **Dodo Payments** appears and is installable |
| Post-install skills | **17** discoverable |
| Post-install MCPs | **2** registered |

**Repeat as an upgrade** from an install created against the *old* `./plugins/dodopayments` path, running `codex plugin marketplace upgrade dodopayments` — assert it converges to 17 skills / 2 MCPs.

**FAIL ⇒** keep a **thin pointer directory** at `plugins/dodopayments/` (manifest only, **no duplicated skills**); do **not** restore the full bundle. Also retry with `"./"` and with the field omitted to isolate the cause.

**Result:** ☑ **`"."` OK — bundle is unnecessary on Codex 0.147.0.** With `source.path: "."` and `plugins/dodopayments/` deleted entirely: `marketplace add` accepted the self-referencing path, `plugin add` installed `0.5.0`, installed root had **17 skills / 0 symlinks**, and `codex mcp list` showed **2 servers**.
**Not acted on. Version floor now measured — and it is too young to prune.**

The self-referencing marketplace path and the root-manifest loader are **two separate PRs that landed five weeks apart**, and the integration needs both:

| Capability | PR | First stable release |
|---|---|---|
| marketplace `source.path: "."` resolves to repo root | [#28771](https://github.com/openai/codex/pull/28771) | **0.142.0** (2026-06-22) |
| root `plugin.json` (Agent Plugins `$schema`) loader | [#35105](https://github.com/openai/codex/pull/35105) | **0.146.0** (2026-07-29) |

Combined floor: **>= 0.146.0**, which was ten days old when this was measured.

Two assumptions in the original framing were wrong:
- `source.path: "."` was **not** always accepted. Before #28771 the resolver did an unconditional `strip_prefix("./")`, so `"."` failed the prefix check and `"./"` stripped to empty and hit an emptiness check — **both rejected**.
- Codex does **not** broadly auto-update. The hourly update loop is scoped to managed installs; `npm`/`brew` users upgrade manually, and upstream documents no minimum-supported-version policy.

So the bundle is what keeps the plugin working for anyone who has not updated in roughly two weeks. Revisit once 0.146+ adoption is safe to assume; keep the path change and the directory deletion in separate releases regardless, because of cached marketplace manifests.

Separately confirmed: `.codex-plugin/plugin.json` is still read as a fallback overlay by #35105, so retaining it is correct rather than merely harmless.

---

### E-D — Does Codex double-register MCPs when root `mcp.json` + `.codex-plugin/` overlay coexist? · **P1**

**Gates:** whether `.codex-plugin/` must be deleted in v0.6.0 rather than v0.8.0 (D5).

```bash
cd "$EXP/repo" && git checkout v0.6.0   # both root mcp.json AND .codex-plugin/ present
codex plugin marketplace add <your-fork>/dodo-agent-plugin && codex   # install via /plugins

# Enumerate registered servers + tool namespaces
codex   # then: /mcp
```

| Check | Expected (PASS) |
|---|---|
| `/mcp` server list | exactly **2** entries — not 4, no `dodopayments-api (2)` |
| Tool names | no duplicate/suffixed tool namespaces |
| Startup log | no "already registered" / "duplicate server" warnings |

**FAIL ⇒** move the `.codex-plugin/` deletion **forward into v0.6.0** and re-run E-C/E-D on that state. Record observed precedence (root wins / overlay wins / both load).

**Result:** ☑ **2 servers — no double-registration.** Installed from this PR's state (bundle present, root `mcp.json` *and* `.codex-plugin/` overlay both present). `codex mcp list` returned exactly `dodo-knowledge` + `dodopayments-api`, not 4, no suffixed namespaces. Codex injected `PLUGIN_ROOT`/`PLUGIN_DATA` — Agent Plugins v1 spec variables — confirming it loaded the **root `plugin.json`**, not the legacy overlay. Installed root: 17 skills, 0 symlinks. `.codex-plugin/` therefore does **not** need to die immediately; it can be pruned alongside the bundle.

---

### E-E — Does Cursor auto-detect root `plugin.json` + `$schema`? · **P2**

**Gates:** whether Cursor is Tier S or a permanent maintenance item (one extra emitter).

```bash
# Install root-spec-only: temporarily hide the Cursor-native manifest
cd "$EXP/repo" && git checkout v0.6.0 && mv .cursor-plugin .cursor-plugin.off
cp -R "$EXP/repo" ~/.cursor/plugins/local/dodo-agent-plugin-exp
# Restart Cursor, then in chat: "List every Dodo Payments skill available to you."
```

| Check | Expected (PASS) |
|---|---|
| Skills visible with `.cursor-plugin/` **hidden** | 17 |
| MCPs registered | 2 |
| Control run (restore `.cursor-plugin/`) | 17 skills — proves the harness itself works |

**FAIL ⇒** Cursor is **not** Tier S. Keep generating `.cursor-plugin/plugin.json` indefinitely (cost: one emitter, already planned in §7.1). Not a blocker for any release.

**Result:** ◐ **Structurally verified; runtime blocked on GUI.** Cloned into `~/.cursor/plugins/local/` (then removed): 17 real skills, 0 symlinks, `.cursor-plugin/plugin.json` well-formed (`skills: "skills/"`, `mcpServers: ".mcp.json"`), root `plugin.json` schema-valid. Cannot assert root-manifest auto-detection headlessly — the `cursor` CLI is only an editor launcher. **Needs a human.** `.cursor-plugin/` is generated regardless, so Cursor works either way; this experiment only decides whether that emitter can eventually be dropped.

---

### E-F — Does VS Code / GitHub Copilot load this repo as an Agent Plugin? · **P1**

**Gates:** confirms the largest free-distribution win in the plan is real.

```bash
cd "$EXP/repo" && git checkout v0.6.0
# VS Code: Extensions view → @agentPlugins  (or Chat gear → Plugins → Load from folder)
code --install-plugin-dir "$EXP/repo"   # if unavailable, use the Chat > Plugins UI path
```

| Check | Expected (PASS) |
|---|---|
| Plugin detected as **Agent Plugins 1.0** | yes (not "Copilot" or "Claude" fallback format) |
| Skills listed | 17 |
| MCP servers | 2, from root `mcp.json` (**not** `.mcp.json` — VS Code ignores the dotted variant for Agent Plugins packages) |
| Chat smoke test | "Set up Dodo Payments webhook handlers in Next.js" loads `webhook-integration` |

**FAIL ⇒** capture the VS Code detection reason (Output → GitHub Copilot Chat). Most likely causes: `$schema` const mismatch, or a `skills/` entry that is not an immediate child directory.

**Result:** ◐ **Structurally verified; runtime blocked on GUI.** Root `plugin.json` and `mcp.json` validate against the **published** schemas via ajv, skills are immediate children of `skills/` with zero symlinks, and a bare clone resolves all 17. Cannot assert VS Code's format detection headlessly — `code chat` opens a window; there is no `--plugin-dir` equivalent. **Needs a human.** This is the largest claimed distribution win in the plan, so verify before announcing.

---

### E-G — Do native `sse` / `streamable-http` transports authenticate cleanly? · **P2**

**Gates:** D8 — dropping the `npx mcp-remote` shim in v0.8.0.

```bash
# Probe what each endpoint actually speaks before committing to a transport
curl -sI -H 'Accept: text/event-stream' https://mcp.dodopayments.com/sse
curl -sI -X POST -H 'Accept: application/json, text/event-stream' \
     -H 'Content-Type: application/json' https://knowledge.dodopayments.com/mcp

# Then swap mcp.json to native transports and reinstall on VS Code + Codex
```
```jsonc
"dodopayments-api": { "type": "sse",             "url": "https://mcp.dodopayments.com/sse" },
"dodo-knowledge":   { "type": "streamable-http", "url": "https://knowledge.dodopayments.com/mcp" }
```

| Check | Expected (PASS) |
|---|---|
| `dodo-knowledge` | connects with **no** OAuth prompt; a search tool call returns results |
| `dodopayments-api` | triggers a **browser OAuth flow handled by the client**, then tool calls succeed |
| Both, on **VS Code and Codex** | pass independently |
| Cold-start latency | ≤ the `mcp-remote` baseline |

**PASS ⇒** adopt in v0.8.0; keep `stdio` + `mcp-remote` only in the generated legacy `.mcp.json`.
**FAIL (any client) ⇒** keep `stdio` + `mcp-remote` in canonical `mcp.json`. Prefer `streamable-http` over legacy `sse` where supported — `sse` support is **OPTIONAL** for conformant clients.

**Result:** ☑ **ADOPTED — brought forward into v0.5.0.** Both endpoints speak Streamable HTTP natively, so the `sse` half of this experiment was moot and both servers went to `streamable-http`:

```
knowledge.dodopayments.com/mcp   200, initialize returns serverInfo, no auth
mcp.dodopayments.com/mcp         401 + WWW-Authenticate: Bearer, resource_metadata=
                                 /.well-known/oauth-protected-resource/mcp
                                 both OAuth discovery endpoints 200
```

The shim was **hiding** the auth model rather than brokering it: through `mcp-remote` Codex reported both servers as `Auth: Unsupported`; natively it reports `Not logged in` and offers `codex mcp login`. That inverted D8's stated risk — native transport surfaced auth, the bridge suppressed it — so there was no reason to hold this for v0.8.0.

`streamable-http` is REQUIRED for conformant clients where `sse` is OPTIONAL, so no legacy `sse` entry ships anywhere. The bridge is retained in the **generated** `.mcp.json` for Claude Code and Cursor, and in `opencode-plugin/index.js` for OpenCode, both pointed at the same canonical endpoints.

**Regression found while shipping this:** `opencode-plugin/index.js` is hand-written (OpenCode has its own config shape), so `build.mjs --check` does not cover it, and the first cut of this change moved the generated artifacts to `/mcp` while leaving the OpenCode plugin on `/sse`. Since OpenCode users never read `.mcp.json`, that path was the only one they get. Fixed, and `scripts/conformance.mjs` now asserts the plugin's endpoint set equals the canonical set so generated-vs-hand-written drift fails the build.

---

## 5. Release Sequence

Each step is independently shippable and revertible.

### v0.5.0 — Vendor skills, drop submodule *(purely additive; fixes the live Cursor bug)*

**Entry gate:** E-A resolved and recorded (it changes what vendoring must produce).

- [ ] Fix `best-practices` → `dodo-best-practices` **upstream** in `dodopayments/skills` (rename the directory to match frontmatter). **Do not rename at copy time** — that creates silent divergence from the source repo.
- [ ] Copy `skills-src/dodo-payments/*` → `skills/` as real dirs; commit. Remove symlinks.
- [ ] `git submodule deinit skills-src` + remove from `.gitmodules`; delete `skills-src/`.
- [ ] Delete `scripts/build-skills-for-npm.mjs`; remove `prepack`/`postpack` from `package.json`.
- [ ] Add `.skills-source.json` recording upstream SHA.
- [ ] Add upstream-sync CI job (schedule + `repository_dispatch` → opens PR).
- [ ] If E-A failed: apply the recorded remediation (`.agents/skills/` copies **or** clone-based OpenCode guidance).

**Acceptance — all must pass:**
```bash
# A1 no symlinks remain, 17 real skill dirs, each with SKILL.md
find skills -maxdepth 1 -mindepth 1 -type l | wc -l          # → 0
find skills -maxdepth 1 -mindepth 1 -type d | wc -l          # → 17
find skills -maxdepth 2 -name SKILL.md -type f | wc -l       # → 17

# A2 every frontmatter name equals its directory name
for d in skills/*/; do n=$(basename "$d"); \
  f=$(awk '/^name:/{print $2; exit}' "$d/SKILL.md"); \
  [ "$n" = "$f" ] || echo "MISMATCH $n != $f"; done            # → no output

# A3 the previously-broken bare clone now works
git clone https://github.com/dodopayments/dodo-agent-plugin /tmp/bare && \
  find /tmp/bare/skills -maxdepth 2 -name SKILL.md | wc -l    # → 17  (was 0)

# A4 no submodule left
git submodule status | wc -l                                  # → 0
test ! -e .gitmodules && echo ok

# A5 npm payload intact without pack hooks
npm pack && tar -tzf dodopayments-opencode-plugin-*.tgz | grep -c 'skills/.*SKILL\.md'   # → 17
git status --porcelain                                        # → empty (no mutated tree)
```
**Manual QA:** install on Cursor via the README's documented `git clone` and confirm **17** skills — the bug this release fixes.

---

### v0.6.0 — Add spec files alongside everything *(additive; remove nothing)*
- [ ] Add root `plugin.json` (§6.1) and `mcp.json` (§6.2). `enabled` **omitted**.
- [ ] Move Codex `interface` → `extensions["com.openai"]` in root `plugin.json`.
- [ ] Flip **version source of truth** to root `plugin.json`; update `sync-manifests.mjs` accordingly.
- [ ] Add `scripts/conformance.mjs` (§7.2).
- [ ] Run `--check` + conformance **on every PR**, not just release.

**Acceptance — all must pass:**
```bash
# B1 both canonical files validate against the published schemas
curl -s https://agent-plugins.org/schemas/1.0.0/plugin.schema.json -o /tmp/p.json
curl -s https://agent-plugins.org/schemas/1.0.0/mcp.schema.json    -o /tmp/m.json
npx -y ajv-cli validate --spec=draft2020 -s /tmp/p.json -d plugin.json   # → valid
npx -y ajv-cli validate --spec=draft2020 -s /tmp/m.json -d mcp.json     # → valid

# B2 $schema versions match across the two files
test "$(jq -r '."$schema"' plugin.json | grep -o '1\.0\.0')" = \
     "$(jq -r '."$schema"' mcp.json    | grep -o '1\.0\.0')" && echo ok

# B3 no forbidden top-level keys leaked in
jq -r 'keys[]' plugin.json | grep -Ex 'skills|mcpServers|hooks|userConfig|agents|commands'  # → no output

# B4 version is consistent everywhere the generator owns
node scripts/conformance.mjs && node scripts/sync-manifests.mjs --check   # → exit 0

# B5 legacy consumers unchanged
git diff v0.5.0 --stat -- .mcp.json .claude-plugin .cursor-plugin        # → no unintended drift
```
**Manual QA:** Claude Code + Codex + Cursor each still show **17 skills / 2 MCPs** (no regression), and VS Code detects the package as **Agent Plugins 1.0** (E-F).
**Result:** valid Agent Plugin *and* still a valid Claude/Cursor/Codex plugin.

---

### Verification window *(no release)*
- [ ] Run **E-C, E-D, E-E, E-F, E-G** against the `v0.6.0` tag.
- [ ] Record every Result line in §4 and commit this file.

**Exit gate:** E-C and E-D have recorded outcomes (they gate v0.8.0 scope). E-E/E-F/E-G may remain open — they change scope, not safety.

---

### v0.7.0 — Consolidate the generator *(no user-visible change)*
- [ ] Write `scripts/build.mjs`; emit all legacy manifests from canonical + overlays.
- [ ] Add `overlays/claude.json`, `overlays/cursor.json`.
- [ ] Delete `sync-manifests.mjs` + `bundle-codex-plugin.mjs`.

**Acceptance — the generator must be provably equivalent to what it replaces:**
```bash
# C1 byte-identical output vs. the previous release's committed artifacts
git checkout v0.6.0 -- .claude-plugin .cursor-plugin .mcp.json .agents && cp -R . /tmp/before
node scripts/build.mjs
git diff --stat -- .claude-plugin .cursor-plugin .mcp.json .agents      # → empty (except version bump)

# C2 --check is a true drift gate: mutate, expect failure, restore
jq '.version="9.9.9"' package.json > /tmp/p && mv /tmp/p package.json
node scripts/build.mjs --check                                          # → exit 1  (MUST fail)
git checkout package.json && node scripts/build.mjs --check             # → exit 0

# C3 old scripts are gone and unreferenced
test ! -e scripts/sync-manifests.mjs && test ! -e scripts/bundle-codex-plugin.mjs
grep -rn "sync-manifests\|bundle-codex-plugin" --include='*.json' --include='*.yml' . # → no output
```

---

### v0.8.0 — Prune *(breaking; gated on verification window)*
- [ ] Delete `.codex-plugin/` — **pull forward into v0.6.0 if E-D showed double-registration**.
- [ ] Repoint Codex marketplace `source.path` per the E-C result.
- [ ] Delete `plugins/dodopayments/` — **only if the path change shipped in a prior release** (D2).
- [x] ~~If E-G passed: switch `mcp.json` to native `sse`/`streamable-http`.~~ **Done in v0.5.0** — E-G passed early; both servers use `streamable-http`.
- [ ] **Release notes lead with `codex plugin marketplace upgrade dodopayments`.**

**Acceptance — all must pass:**
```bash
# D1 no dangling references to deleted paths
grep -rn "plugins/dodopayments\|\.codex-plugin" --include='*.json' --include='*.md' \
     --include='*.mjs' --include='*.yml' . | grep -v CHANGELOG    # → no output
node scripts/build.mjs --check && node scripts/conformance.mjs    # → exit 0
```
**Manual QA — the upgrade path is the actual risk, so test it explicitly:**
1. From a machine with the **pre-v0.8.0** marketplace already installed, run `codex plugin marketplace upgrade dodopayments` → assert **17 skills / 2 MCPs**.
2. From a **clean** machine, `codex plugin marketplace add` → install → assert **17 skills / 2 MCPs**.
3. Re-verify Claude Code and Cursor are unaffected (**17 / 2** each).

**Rollback:** revert the release commit and re-publish; `plugins/dodopayments/` returns from git history. Users on the new path recover with one `marketplace upgrade`.

---

### v1.0.0 — Breadth
- [ ] Kiro `dev.kiro/` extension namespace.
- [ ] Gemini CLI, MCP-only (`gemini-extension.json`), documented as MCP-only.
- [ ] Rewrite README install matrix; add "other clients → use `dodo-knowledge` MCP" page.
- [ ] Announce.

**Acceptance:**
```bash
node scripts/conformance.mjs                                     # → exit 0
jq -e '.extensions["dev.kiro"] | type == "object"' plugin.json    # → true
npx -y ajv-cli validate --spec=draft2020 -s /tmp/p.json -d plugin.json  # → still valid
```
**Manual QA:** Kiro loads the plugin as a Power with **17** skills; Gemini CLI registers **2** MCP servers (skills correctly absent — Gemini has no SKILL.md primitive, and the README says so); every README install path executed verbatim on a clean machine yields its documented result.

---

## 6. Canonical File Specifications

### 6.1 `plugin.json` (root, hand-authored)

```jsonc
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "dodopayments",
  "version": "0.6.0",
  "description": "Dodo Payments integration skills and MCP servers for AI coding agents.",
  "author": { "name": "Dodo Payments", "email": "support@dodopayments.com" },
  "homepage": "https://docs.dodopayments.com",
  "repository": "https://github.com/dodopayments/dodo-agent-plugin",
  "license": "MIT",
  "keywords": ["dodopayments", "payments", "billing", "subscriptions", "mcp", "skills"],
  "extensions": {
    "com.openai": {
      "interface": {
        "composerIcon": "./assets/icon.svg",
        "displayName": "Dodo Payments",
        "shortDescription": "Payments, billing, subscriptions - integrated into Codex.",
        "longDescription": "...",
        "developerName": "Dodo Payments",
        "category": "Developer Tools",
        "defaultPrompt": ["...", "...", "..."]
      }
    }
  }
}
```

**Constraint notes:**
- `$schema` and `name` are the **only required** fields; both are **fatal** if missing/malformed (whole plugin rejected).
- `name: "dodopayments"` satisfies `^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$`. ✅
- Schema is **closed** — no `skills`, `mcpServers`, `hooks`, `userConfig`, or `displayName` at top level.
- `author` sub-object permits **only** `name`/`email`/`url`.
- Per-provider keywords (`claude-code`, `codex`, `cursor`) drop from canonical; re-added per-provider by the generator if desired.

### 6.2 `mcp.json` (root, hand-authored)

> **Shipped shape differs — this block is the plan-time target.** E-G passed early, so both servers ship as native `streamable-http` against `/mcp` rather than the `stdio` + `mcp-remote` shown here. The `enabled`/`$schema`/single-token constraints below all still apply. See the E-G result in §4 for the shipped file.

```jsonc
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "dodopayments-api": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "https://mcp.dodopayments.com/sse"]
    },
    "dodo-knowledge": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "https://knowledge.dodopayments.com/mcp"]
    }
  }
}
```

**Deltas from current `.mcp.json`:**
- `enabled: true` **removed** — not in the closed `stdio` union; would silently skip the entry.
- `$schema` added and **must exactly match** `plugin.json`'s spec version, forever (mismatch disables MCP entirely, though skills still load).
- `command` must stay a **single token** — no shell strings, no interpolation.
- See **D8/E-G** for the native-remote-transport variant.

---

## 7. Build & CI Design

### 7.1 `scripts/build.mjs [--check]`

```
INPUTS   plugin.json (canonical, incl. version)
         mcp.json    (canonical)
         overlays/{claude,cursor}.json
         skills/     (vendored, read-only to the generator)

EMITS    .claude-plugin/plugin.json        = canonical ∖ {$schema,extensions} + overlays/claude.json
         .claude-plugin/marketplace.json   = version + description + keywords
         .cursor-plugin/plugin.json        = canonical + overlays/cursor.json (path quirks)
         .agents/plugins/marketplace.json  = version + source.path
         .mcp.json                         = mcp.json ∖ {$schema} + {enabled:true} per server
         package.json                      = version only

--check  regenerate into a temp dir, diff against committed, exit 1 on any difference
```

### 7.2 `scripts/conformance.mjs` — **the highest-ROI addition in this plan**

No official validator ships (`FUTURE_CONSIDERATIONS.md` defers it), and the spec's failure semantics are **silent**. ~50 lines of assertions:

- `plugin.json` keys ⊆ `{$schema,name,version,description,author,homepage,repository,license,keywords,extensions}`
- `name` matches the spec regex; length ≤ 64
- `$schema` const **identical** across `plugin.json` and `mcp.json`
- `author` keys ⊆ `{name,email,url}`
- **`skills/` contains exactly 17 entries, all directories, each with a regular-file `SKILL.md`, ZERO symlinks**
- Each `SKILL.md` frontmatter `name` **equals its directory name**
- Every `mcp.json` server object's keys ⊆ the allowed set for its `type`
- No path in the package escapes the plugin root

> The **"exactly 17" positive assertion** matters more than every negative check combined — silent skill loss is the one failure mode nothing else detects.

### 7.3 CI gates

| Gate | Trigger today | Trigger after |
|---|---|---|
| `build.mjs --check` | release only | **every PR** + release |
| `conformance.mjs` | — | **every PR** + release |
| `npm pack --dry-run` | release | unchanged |
| Upstream skills sync | manual `git submodule update --remote` | scheduled job → **opens PR** |

---

## 8. Risk Register

| # | Risk | Class | Mitigation |
|---|---|---|---|
| R1 | Skills silently stop loading (spec non-fatal semantics) | **Silently breaking** | `conformance.mjs` "exactly 17" positive assertion; manual smoke test per client per release |
| R2 | `enabled` in `mcp.json` skips server entries | Shipped-broken | E-B; drop the key (§6.2) |
| R3 | Codex marketplace cache pins old `source.path` | Breaking | Split path-change and directory-deletion across 2 releases; release notes lead with `marketplace upgrade` |
| R4 | Codex double-registers MCPs (root + overlay) | Breaking | E-D; delete `.codex-plugin/` in the same release if confirmed |
| R5 | OpenCode npm package ships undiscoverable skills | **Possible live bug** | E-A (P0) before v0.5.0 |
| R6 | Cursor never adds root `plugin.json` detection | Maintenance | Keep generated `.cursor-plugin/` indefinitely; cost is one emitter |
| R7 | `best-practices` dir/frontmatter mismatch breaks a strict client | Breaking | Fix upstream during v0.5.0; conformance assertion prevents regression |
| R8 | `$schema` version drift between `plugin.json` and `mcp.json` | Breaking (disables MCP) | Both values live in the generator; schema bumps are deliberate releases with a client-compat decision, never drive-by edits |
| R9 | Vendored skills drift from upstream | Staleness | `.skills-source.json` + scheduled sync PR makes drift visible |
| R10 | Older clients reject a newer `$schema` const | Compat | Spec forbids implicit version matching; treat any bump as a release decision |

---

## 9. Corrections to the Existing Repo (independent of migration)

1. **README is factually wrong about Cursor.** It claims skills load from `.claude/skills/` "via Claude Code compat" — `.claude/` **does not exist** in this repo, and `.cursor-plugin/plugin.json` says `skills: "skills/"`. Combined with the submodule, the documented Cursor install ships **zero working skills today**.
2. **`"enabled": true` in `.mcp.json` already violates the spec's closed server union.** Harmless for current Claude/Cursor consumers; fatal-per-entry the moment it's copied into `mcp.json`.
3. **`best-practices` / `dodo-best-practices` is a real risk, not a legacy quirk.** Under the spec, `skills/` immediate children are the unit and clients differ on whether identity comes from directory name or frontmatter — divergence is already observable (Claude surfaces `dodopayments:dodo-best-practices`, the directory is `best-practices`). Fix **upstream**.
4. **`glama.json`** carries no version field (`$schema` + `maintainers` only) — confirmed out of scope for the generator.
5. **npm package and Agent Plugin become two artifacts sharing one version.** If E-A fails, the npm `skills/` payload is dead weight; the honest fix is `.agents/skills/` copies or clone-based OpenCode guidance. **Decide before v0.5.0 ships.**

---

## 10. Open Decisions (need sign-off)

> **Execution is gated here by design.** Q1–Q4 change the shape of v0.5.0/v0.6.0 and must be answered before the first commit. Q5 is deferrable to the verification window. **Q6 is the critical path** — E-A is P0 and blocks v0.5.0, and no experiment can run without a named owner holding real installs of Codex, Cursor, VS Code, and OpenCode.
>
> Record answers inline in the Recommendation column and change this document's Status to `Approved` before starting work.

| # | Decision | Recommendation |
|---|---|---|
| **Q1** | Vendor skills + drop the `skills-src` submodule? Changes the content-ownership model. | **Yes** — fixes a live bug; upstream stays source of truth via sync PRs |
| **Q2** | Confirm provider scope: add **VS Code/Copilot + Kiro** (Tier S/A), defer Gemini/Amazon Q, and **explicitly decline** Windsurf/Cline/Continue/Zed/Amp/Droid? | **Yes** — decline Tier F on the record |
| **Q3** | Flip version source of truth `.claude-plugin/plugin.json` → root `plugin.json`? | **Yes** |
| **Q4** | Accept a 5-release rollout (v0.5.0 → v1.0.0), or compress into fewer, riskier releases? | **5 releases** — the Codex marketplace cache alone forces a 2-release split |
| **Q5** | Pursue D8 (drop `mcp-remote`, use native `sse`/`streamable-http`)? | ~~Test in the verification window, adopt in v0.8.0 only if E-G passes~~ → **Settled: adopted in v0.5.0.** E-G ran early and passed; both servers use `streamable-http`, the bridge survives only in generated legacy configs |
| **Q6** | Who runs the empirical matrix (E-A…E-G)? Needs real installs of Codex, Cursor, VS Code, OpenCode. | Needs an owner — **this is the critical path** |
```
