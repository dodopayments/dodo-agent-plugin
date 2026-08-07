#!/usr/bin/env node
/**
 * Single generator for every provider-specific artifact.
 *
 * Canonical, hand-authored source:
 *   plugin.json          Agent Plugins v1.0.0 manifest (also the version source of truth)
 *   mcp.json             Agent Plugins v1.0.0 MCP config
 *   overlays/*.json      per-provider extras that the closed spec schema cannot hold
 *
 * Generated (never hand-edit):
 *   .claude-plugin/plugin.json        .claude-plugin/marketplace.json
 *   .cursor-plugin/plugin.json        .agents/plugins/marketplace.json
 *   .mcp.json                         package.json (version field only)
 *
 * Usage:
 *   node scripts/build.mjs            write artifacts
 *   node scripts/build.mjs --check    verify artifacts match canonical source, exit 1 on drift
 *
 * @see https://agent-plugins.org/specification
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

/**
 * Codex's `plugin marketplace add` performs a plain `git clone` and its
 * marketplace schema has historically rejected a self-referencing source path,
 * so Codex is served from a materialized bundle rather than the repo root.
 */
const BUNDLE = "plugins/dodopayments";

const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));

/** Match the repo's existing formatting: 4-space indent, trailing newline. */
const serialize = (value) => `${JSON.stringify(value, null, 4)}\n`;

/** Strip the `//` comment convention used in overlay/provenance files. */
const stripComments = ({ "//": _comment, ...rest }) => rest;

const plugin = read("plugin.json");
const mcp = read("mcp.json");
const overlays = {
    claude: stripComments(read("overlays/claude.json")),
    cursor: stripComments(read("overlays/cursor.json")),
};

const { version, name, author, homepage, repository, license } = plugin;

/**
 * Codex UI metadata lives in the spec's extension namespace. Fail loudly rather
 * than emitting manifests with `undefined` fields if it is ever removed.
 */
function codexInterface() {
    const value = plugin.extensions?.["com.openai"]?.interface;
    if (!value) {
        console.error('plugin.json is missing extensions["com.openai"].interface, which the Codex manifests require.');
        process.exit(1);
    }
    return value;
}

/** Spec-only fields that must never leak into a legacy provider manifest. */
const portableBase = () => {
    const { $schema, extensions, keywords, ...rest } = plugin;
    return rest;
};

/** Provider manifests historically carry a provider tag in keywords. */
const keywordsFor = (tag) => {
    const base = plugin.keywords.filter((k) => k !== "mcp" && k !== "skills");
    return [...base, tag, "mcp", "skills"];
};

/**
 * Claude Code and Cursor read `.mcp.json` and honour an `enabled` flag.
 * `enabled` is NOT a member of the Agent Plugins closed server union
 * (verified: `additionalProperties: false` on every transport variant), and a
 * stray key silently skips the entire server entry. It therefore exists only
 * in this legacy projection, never in the canonical mcp.json.
 */
function legacyMcpConfig() {
    return {
        mcpServers: Object.fromEntries(
            Object.entries(mcp.mcpServers).map(([serverName, server]) => [
                serverName,
                { ...server, enabled: true },
            ]),
        ),
    };
}

/**
 * Legacy Codex overlay. Emitted at the repo root AND inside the bundle so both
 * Codex entry points report the same version; the root copy previously had no
 * generator and silently drifted a release behind.
 */
function codexManifest() {
    return {
        ...portableBase(),
        description: "Dodo Payments tools for Codex: integration skills + API/docs MCP servers.",
        keywords: keywordsFor("codex"),
        skills: "./skills/",
        mcpServers: "./.mcp.json",
        interface: codexInterface(),
    };
}

const artifacts = {
    // ---- Claude Code -------------------------------------------------------
    ".claude-plugin/plugin.json": {
        ...portableBase(),
        description: "Dodo Payments tools for Claude Code, including integration agent skills and the Dodo Payments API and docs MCP servers.",
        keywords: keywordsFor("claude-code"),
        ...overlays.claude,
    },

    ".claude-plugin/marketplace.json": {
        name,
        owner: { name: author.name, email: author.email },
        metadata: {
            description: "Dodo Payments plugin marketplace for Claude Code.",
            version,
        },
        plugins: [
            {
                name,
                source: "./",
                description:
                    "Dodo Payments tools for Claude Code, including integration agent skills and the Dodo Payments API and docs MCP servers.",
                author: { name: author.name, email: author.email },
                homepage,
                repository,
                license,
                keywords: keywordsFor("claude-code"),
            },
        ],
    },

    // ---- Cursor ------------------------------------------------------------
    // Cursor's native loader reads .cursor-plugin/plugin.json. Retained until
    // Cursor is confirmed to auto-detect the root Agent Plugins manifest.
    ".cursor-plugin/plugin.json": {
        ...portableBase(),
        description: "Dodo Payments tools for Cursor: integration skills + API/docs MCP servers.",
        keywords: keywordsFor("cursor"),
        ...overlays.cursor,
    },

    // ---- Codex CLI marketplace --------------------------------------------
    // Codex reads the root Agent Plugins manifest natively (openai/codex#35105),
    // but the marketplace validator is a separate code path that has historically
    // rejected a self-referencing source path. Until that is verified against a
    // real Codex install, the marketplace keeps pointing at the generated bundle.
    // See .omo/plans/agent-plugins-v1-migration.md experiments E-C / E-D.
    ".agents/plugins/marketplace.json": {
        name,
        interface: { displayName: codexInterface().displayName },
        plugins: [
            {
                name,
                source: { source: "local", path: `./${BUNDLE}` },
                policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
                category: codexInterface().category,
            },
        ],
    },

    ".codex-plugin/plugin.json": codexManifest(),

    // ---- Codex bundle ------------------------------------------------------
    // Self-contained copy so the bundle is valid whether Codex resolves it as an
    // Agent Plugin (plugin.json + mcp.json) or via the legacy overlay.
    [`${BUNDLE}/plugin.json`]: plugin,
    [`${BUNDLE}/mcp.json`]: mcp,
    [`${BUNDLE}/.mcp.json`]: legacyMcpConfig(),
    [`${BUNDLE}/.codex-plugin/plugin.json`]: codexManifest(),

    // ---- Legacy MCP config -------------------------------------------------
    ".mcp.json": legacyMcpConfig(),
};

// ---- package.json: version field only, preserve everything else ------------
const packageJson = read("package.json");
const packageJsonUpdated = { ...packageJson, version };

const targets = [
    ...Object.entries(artifacts).map(([path, value]) => [path, serialize(value)]),
    ["package.json", serialize(packageJsonUpdated)],
];

let drift = 0;

/**
 * Mirror a source tree into the bundle as real files. Symlinks are dereferenced:
 * Codex clones without submodules and clients differ on symlink handling, so the
 * bundle must never contain indirection.
 */
function syncTree(srcRel, destRel) {
    const src = join(ROOT, srcRel);
    const dest = join(ROOT, destRel);
    if (!existsSync(src)) return;

    const listFiles = (dir, base = dir) =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            const abs = join(dir, entry.name);
            return entry.isDirectory() ? listFiles(abs, base) : [relative(base, abs)];
        });

    const expected = listFiles(src);

    if (CHECK) {
        const actual = existsSync(dest) ? listFiles(dest) : [];
        const missing = expected.filter((f) => !actual.includes(f));
        const stale = actual.filter((f) => !expected.includes(f));
        // Byte comparison, not UTF-8: assets/ may hold binaries, and decoding
        // those as text collapses invalid sequences to U+FFFD, so two different
        // files can compare equal and real drift passes --check.
        const differing = expected.filter(
            (f) => actual.includes(f) && Buffer.compare(readFileSync(join(src, f)), readFileSync(join(dest, f))) !== 0,
        );
        for (const f of [...missing, ...stale, ...differing]) {
            console.error(`drift: ${destRel}/${f}`);
            drift += 1;
        }
        return;
    }

    rmSync(dest, { recursive: true, force: true });
    cpSync(src, dest, { recursive: true, dereference: true });
    console.log(`synced: ${destRel} (${expected.length} files)`);
}

for (const [rel, contents] of targets) {
    const abs = join(ROOT, rel);
    let current = null;
    try {
        current = readFileSync(abs, "utf8");
    } catch {
        // Missing file counts as drift in --check, and is created otherwise.
    }

    if (current === contents) continue;

    if (CHECK) {
        console.error(`drift: ${rel}`);
        drift += 1;
        continue;
    }

    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, contents);
    console.log(`wrote: ${rel}`);
}

syncTree("skills", `${BUNDLE}/skills`);
syncTree("assets", `${BUNDLE}/assets`);

if (CHECK) {
    if (drift > 0) {
        console.error(`\n${drift} artifact(s) out of sync. Run: node scripts/build.mjs`);
        process.exit(1);
    }
    console.log(`all generated artifacts in sync with plugin.json v${version}`);
} else {
    console.log(`\ngenerated ${targets.length} manifests + bundle from plugin.json v${version}`);
}
