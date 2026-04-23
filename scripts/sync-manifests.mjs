#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_MODE = process.argv.includes("--check");

const CLAUDE_MANIFEST = ".claude-plugin/plugin.json";
const CURSOR_MANIFEST = ".cursor-plugin/plugin.json";
const CODEX_MANIFEST = ".codex-plugin/plugin.json";
const CLAUDE_MARKETPLACE = ".claude-plugin/marketplace.json";
const PACKAGE_JSON = "package.json";
const MCP_JSON = ".mcp.json";
const OPENCODE_JSON = "opencode.json";

function readJson(relPath) {
    return JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));
}

function writeJson(relPath, value) {
    const serialized = JSON.stringify(value, null, 4) + "\n";
    if (CHECK_MODE) {
        const current = readFileSync(join(ROOT, relPath), "utf8");
        if (current !== serialized) {
            throw new Error(`${relPath} is out of sync. Run \`node scripts/sync-manifests.mjs\` to fix.`);
        }
        return;
    }
    writeFileSync(join(ROOT, relPath), serialized);
}

function translateMcpToOpencode(mcpServers) {
    const out = {};
    for (const [name, entry] of Object.entries(mcpServers)) {
        if (entry.url) {
            const remote = { type: "remote", url: entry.url, enabled: true };
            if (entry.headers) remote.headers = entry.headers;
            out[name] = remote;
            continue;
        }
        const command = entry.command
            ? (Array.isArray(entry.command) ? [...entry.command, ...(entry.args ?? [])] : [entry.command, ...(entry.args ?? [])])
            : (entry.args ?? []);
        const local = { type: "local", command, enabled: true };
        if (entry.env) local.environment = entry.env;
        out[name] = local;
    }
    return out;
}

function main() {
    const claude = readJson(CLAUDE_MANIFEST);
    const canonicalVersion = claude.version;
    if (typeof canonicalVersion !== "string" || !canonicalVersion) {
        throw new Error(`Canonical version missing from ${CLAUDE_MANIFEST}`);
    }

    const cursor = readJson(CURSOR_MANIFEST);
    cursor.version = canonicalVersion;
    writeJson(CURSOR_MANIFEST, cursor);

    const codex = readJson(CODEX_MANIFEST);
    codex.version = canonicalVersion;
    writeJson(CODEX_MANIFEST, codex);

    const pkg = readJson(PACKAGE_JSON);
    pkg.version = canonicalVersion;
    writeJson(PACKAGE_JSON, pkg);

    const marketplace = readJson(CLAUDE_MARKETPLACE);
    marketplace.metadata = marketplace.metadata ?? {};
    marketplace.metadata.version = canonicalVersion;
    writeJson(CLAUDE_MARKETPLACE, marketplace);

    const mcp = readJson(MCP_JSON);
    const opencode = readJson(OPENCODE_JSON);
    opencode.mcp = translateMcpToOpencode(mcp.mcpServers ?? {});
    writeJson(OPENCODE_JSON, opencode);

    if (CHECK_MODE) {
        console.log(`All in sync at version ${canonicalVersion}.`);
    } else {
        console.log(`Synced to version ${canonicalVersion}.`);
    }
}

try {
    main();
} catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
}
