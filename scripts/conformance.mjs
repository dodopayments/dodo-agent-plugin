#!/usr/bin/env node
/**
 * Agent Plugins v1.0.0 conformance validator.
 *
 * The spec ships no official linter, and its failure semantics are SILENT:
 * a malformed `skills/` directory is non-fatal, so the plugin installs
 * cleanly, MCP servers connect, and the entire skill payload is simply
 * absent with no error surfaced to the user.
 *
 * The single most valuable assertion here is therefore a POSITIVE one:
 * "exactly N skills, all real directories, zero symlinks".
 *
 * @see https://agent-plugins.org/specification
 */

import { readFileSync, readdirSync, lstatSync, existsSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = "1.0.0";
const PLUGIN_SCHEMA = `https://agent-plugins.org/schemas/${SPEC}/plugin.schema.json`;
const MCP_SCHEMA = `https://agent-plugins.org/schemas/${SPEC}/mcp.schema.json`;

/** Closed key sets, transcribed from the published JSON Schemas. */
const PLUGIN_KEYS = new Set([
    "$schema", "name", "version", "description", "author",
    "homepage", "repository", "license", "keywords", "extensions",
]);
const AUTHOR_KEYS = new Set(["name", "email", "url"]);
const SERVER_KEYS = {
    stdio: new Set(["type", "command", "args", "env", "cwd"]),
    "streamable-http": new Set(["type", "url", "headers"]),
    sse: new Set(["type", "url", "headers"]),
};
const NAME_RE = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const RESERVED_ENV = new Set(["PLUGIN_ROOT", "PLUGIN_DATA"]);

/** Expected skill count. A drop here is the silent failure this file exists to catch. */
const EXPECTED_SKILLS = 17;

const failures = [];
const checks = [];

const check = (label, condition, detail = "") => {
    checks.push(label);
    if (!condition) failures.push(detail ? `${label}: ${detail}` : label);
};

const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));

// ---------------------------------------------------------------- plugin.json
const plugin = read("plugin.json");

check("plugin.json declares the v1.0.0 $schema", plugin.$schema === PLUGIN_SCHEMA, plugin.$schema);
check("plugin.json has a name", typeof plugin.name === "string" && plugin.name.length > 0);
check("plugin.json name matches the spec regex", NAME_RE.test(plugin.name ?? ""), plugin.name);
check("plugin.json name is <= 64 chars", (plugin.name ?? "").length <= 64);

const strayPluginKeys = Object.keys(plugin).filter((k) => !PLUGIN_KEYS.has(k));
check("plugin.json has no keys outside the closed schema", strayPluginKeys.length === 0, strayPluginKeys.join(", "));

if (plugin.author) {
    const strayAuthor = Object.keys(plugin.author).filter((k) => !AUTHOR_KEYS.has(k));
    check("plugin.json author has only name/email/url", strayAuthor.length === 0, strayAuthor.join(", "));
}

if (plugin.extensions !== undefined) {
    check("plugin.json extensions is an object", typeof plugin.extensions === "object" && !Array.isArray(plugin.extensions));
    for (const [ns, value] of Object.entries(plugin.extensions ?? {})) {
        check(`extensions["${ns}"] is an object`, typeof value === "object" && value !== null && !Array.isArray(value));
        check(`extensions["${ns}"] uses reverse-domain naming`, ns.includes("."), ns);
    }
}

// ------------------------------------------------------------------- mcp.json
const mcp = read("mcp.json");

check("mcp.json declares the v1.0.0 $schema", mcp.$schema === MCP_SCHEMA, mcp.$schema);
check(
    "mcp.json $schema version matches plugin.json (mismatch disables MCP entirely)",
    mcp.$schema?.includes(SPEC) && plugin.$schema?.includes(SPEC),
);

const mcpStray = Object.keys(mcp).filter((k) => k !== "$schema" && k !== "mcpServers");
check("mcp.json has no keys outside $schema/mcpServers", mcpStray.length === 0, mcpStray.join(", "));

for (const [serverName, server] of Object.entries(mcp.mcpServers ?? {})) {
    const allowed = SERVER_KEYS[server.type];
    check(`mcp.json "${serverName}" declares a supported transport`, Boolean(allowed), server.type);
    if (!allowed) continue;

    const stray = Object.keys(server).filter((k) => !allowed.has(k));
    check(
        `mcp.json "${serverName}" has no keys outside the ${server.type} union`,
        stray.length === 0,
        // `enabled` is the specific trap: legal in legacy .mcp.json, fatal here.
        stray.length ? `${stray.join(", ")} (a stray key silently skips this server)` : "",
    );

    if (server.type === "stdio") {
        check(`mcp.json "${serverName}" command is a single token`, !/\s/.test(server.command ?? ""), server.command);
        const reserved = Object.keys(server.env ?? {}).filter((k) => RESERVED_ENV.has(k));
        check(`mcp.json "${serverName}" env does not shadow PLUGIN_ROOT/PLUGIN_DATA`, reserved.length === 0, reserved.join(", "));
    } else {
        const url = server.url ?? "";
        const loopback = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url);
        check(`mcp.json "${serverName}" uses HTTPS (or loopback)`, url.startsWith("https://") || loopback, url);
        check(`mcp.json "${serverName}" url has no fragment or userinfo`, !url.includes("#") && !/^https?:\/\/[^/]*@/.test(url), url);
    }
}

// --------------------------------------------------------------------- skills
const skillsDir = join(ROOT, "skills");
check("skills/ exists", existsSync(skillsDir));

if (existsSync(skillsDir)) {
    const entries = readdirSync(skillsDir);
    const symlinks = entries.filter((e) => lstatSync(join(skillsDir, e)).isSymbolicLink());
    const dirs = entries.filter((e) => lstatSync(join(skillsDir, e)).isDirectory() && !symlinks.includes(e));

    // The load-bearing assertion. Silent skill loss is undetectable any other way.
    check(
        `skills/ contains exactly ${EXPECTED_SKILLS} skills`,
        dirs.length === EXPECTED_SKILLS,
        `found ${dirs.length}`,
    );
    check(
        "skills/ contains zero symlinks (a plain git clone must resolve them)",
        symlinks.length === 0,
        symlinks.join(", "),
    );

    for (const skill of dirs) {
        const skillPath = join(skillsDir, skill);
        const manifest = join(skillPath, "SKILL.md");

        check(`skills/${skill}/SKILL.md exists as a regular file`, existsSync(manifest) && lstatSync(manifest).isFile());
        if (!existsSync(manifest)) continue;

        // Containment: nothing may resolve outside the plugin root.
        check(`skills/${skill} stays inside the plugin root`, realpathSync(skillPath).startsWith(resolve(ROOT)));

        const body = readFileSync(manifest, "utf8");
        const frontmatter = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        check(`skills/${skill}/SKILL.md has YAML frontmatter`, Boolean(frontmatter));
        if (!frontmatter) continue;

        const nameField = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
        const descField = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();

        check(`skills/${skill} frontmatter name matches its directory`, nameField === skill, `name: ${nameField}`);
        check(`skills/${skill} frontmatter name matches the spec regex`, NAME_RE.test(nameField ?? ""), nameField);
        check(`skills/${skill} has a description`, Boolean(descField));
        check(`skills/${skill} description is <= 1024 chars`, (descField ?? "").length <= 1024);
    }

    // Immediate children only: a nested SKILL.md is never discovered by clients.
    for (const skill of dirs) {
        const nested = join(skillsDir, skill, "skills");
        check(`skills/${skill} does not nest a skills/ directory`, !existsSync(nested));
    }
}

// ------------------------------------------------------------- cross-artifact
const pkg = read("package.json");
check("package.json version matches plugin.json", pkg.version === plugin.version, `${pkg.version} vs ${plugin.version}`);

const claudeManifest = read(".claude-plugin/plugin.json");
check("legacy .claude-plugin/plugin.json version matches", claudeManifest.version === plugin.version);

const legacyMcp = read(".mcp.json");
check(
    "legacy .mcp.json exposes the same server names as mcp.json",
    JSON.stringify(Object.keys(legacyMcp.mcpServers).sort()) ===
        JSON.stringify(Object.keys(mcp.mcpServers).sort()),
);

check("no leftover skills-src submodule", !existsSync(join(ROOT, ".gitmodules")));

// --------------------------------------------------------------------- report
if (failures.length > 0) {
    console.error(`FAIL  ${failures.length} of ${checks.length} conformance checks\n`);
    for (const f of failures) console.error(`  x ${f}`);
    console.error("");
    process.exit(1);
}

console.log(`PASS  ${checks.length} conformance checks (Agent Plugins ${SPEC})`);
console.log(`      ${EXPECTED_SKILLS} skills, ${Object.keys(mcp.mcpServers).length} MCP servers, v${plugin.version}`);
