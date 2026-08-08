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
import { dirname, join, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

/**
 * The expected skill set is an explicit list in .skills-source.json, not a
 * magic number: an upstream addition or removal then shows up as a reviewable
 * diff in that file, while an unintended drop still fails the build.
 */
const EXPECTED_SKILL_NAMES = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", ".skills-source.json"), "utf8"),
).skills;

/** True when `child` is inside `parent`, by path boundary rather than string prefix. */
const contains = (parent, child) => {
    const rel = relative(parent, child);
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
};

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
    const missing = EXPECTED_SKILL_NAMES.filter((s) => !dirs.includes(s));
    const unexpected = dirs.filter((s) => !EXPECTED_SKILL_NAMES.includes(s));
    check(
        `skills/ matches the ${EXPECTED_SKILL_NAMES.length} skills declared in .skills-source.json`,
        missing.length === 0 && unexpected.length === 0,
        [
            missing.length ? `missing: ${missing.join(", ")}` : "",
            unexpected.length ? `undeclared: ${unexpected.join(", ")}` : "",
        ]
            .filter(Boolean)
            .join(" | "),
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
        check(`skills/${skill} stays inside the plugin root`, contains(resolve(ROOT), realpathSync(skillPath)));

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

/**
 * The OpenCode plugin registers MCP servers programmatically, in OpenCode's own
 * config shape (`type: "local"`, `command: [...]`), so it is hand-written rather
 * than emitted by build.mjs -- which means `--check` cannot see it drift. It is
 * also the only MCP registration path OpenCode users get: they never read
 * .mcp.json. A transport or hostname change applied to the generated artifacts
 * but not here leaves that one client pointed at a stale endpoint, silently.
 *
 * Bind the two together: the set of Dodo endpoint URLs referenced by the plugin
 * must equal the canonical set. Transport-agnostic on purpose -- the bridge is
 * an OpenCode-side detail, the endpoint is not.
 */
// Match the apex domain or a true subdomain. A bare endsWith would also accept
// `notdodopayments.com`, which would let a typo'd host register as canonical.
const APEX = "dodopayments.com";
const isDodoHost = (host) => host === APEX || host.endsWith(`.${APEX}`);

const dodoUrlsIn = (text) =>
    new Set(
        [...text.matchAll(/https:\/\/([A-Za-z0-9.-]+)(\/[^\s"'`,)]*)?/g)]
            .filter((m) => isDodoHost(m[1].toLowerCase()))
            .map((m) => `https://${m[1]}${m[2] ?? ""}`),
    );

const canonicalUrls = dodoUrlsIn(JSON.stringify(mcp.mcpServers));

// Drive the real `config` hook rather than scanning the source: a URL sitting in
// a comment would satisfy a text scan while the shipped config stayed stale.
// The disable flags are cleared first so a developer's shell cannot make this
// pass by registering fewer servers.
const savedFlags = {};
for (const flag of ["DODO_DISABLE_API_MCP", "DODO_DISABLE_KNOWLEDGE_MCP"]) {
    savedFlags[flag] = process.env[flag];
    delete process.env[flag];
}

const opencodeModule = await import(
    pathToFileURL(join(ROOT, "opencode-plugin/index.js")).href
);
const registered = {};
await (await opencodeModule.default()).config(registered);

for (const [flag, value] of Object.entries(savedFlags)) {
    if (value !== undefined) process.env[flag] = value;
}

// OpenCode's loader iterates Object.values(mod) and throws on any non-function
// export, silently skipping the whole plugin -- MCP servers included.
check(
    "opencode-plugin/index.js exports nothing but its default function",
    Object.keys(opencodeModule).length === 1 && typeof opencodeModule.default === "function",
    Object.keys(opencodeModule).join(", "),
);
check(
    "opencode-plugin registers the same server names as mcp.json",
    JSON.stringify(Object.keys(registered.mcp ?? {}).sort()) ===
        JSON.stringify(Object.keys(mcp.mcpServers).sort()),
    Object.keys(registered.mcp ?? {}).join(", "),
);

const opencodeUrls = dodoUrlsIn(JSON.stringify(registered.mcp ?? {}));
const missingInOpencode = [...canonicalUrls].filter((u) => !opencodeUrls.has(u));
const staleInOpencode = [...opencodeUrls].filter((u) => !canonicalUrls.has(u));
check(
    "opencode-plugin registers exactly the canonical mcp.json endpoints",
    missingInOpencode.length === 0 && staleInOpencode.length === 0,
    [
        missingInOpencode.length ? `missing: ${missingInOpencode.join(", ")}` : "",
        staleInOpencode.length ? `stale: ${staleInOpencode.join(", ")}` : "",
    ]
        .filter(Boolean)
        .join(" | "),
);

/**
 * The endpoint gate above compares URLs, so it cannot see prose. Migrating the
 * transports left user-visible text behind twice -- the Claude Code config UI
 * still called the default a "remote SSE server", and the README said both
 * servers were wired through mcp-remote, which is now true only of the
 * generated compatibility manifests.
 *
 * Assert the narrow, self-adjusting form: if no canonical server actually uses
 * the `sse` transport, no user-facing text may describe one. Scoped to the
 * surfaces a user reads -- this file legitimately names `sse` as a spec variant.
 */
const canonicalTransports = new Set(Object.values(mcp.mcpServers).map((s) => s.type));
if (!canonicalTransports.has("sse")) {
    for (const rel of ["README.md", "overlays/claude.json"]) {
        const hits = readFileSync(join(ROOT, rel), "utf8")
            .split("\n")
            .map((line, i) => [i + 1, line])
            .filter(([, line]) => /\bSSE\b/.test(line));
        check(
            `${rel} describes no SSE server (canonical uses ${[...canonicalTransports].join(", ")})`,
            hits.length === 0,
            hits.map(([n]) => `line ${n}`).join(", "),
        );
    }
}

check("no leftover skills-src submodule", !existsSync(join(ROOT, ".gitmodules")));

// --------------------------------------------------------------------- report
if (failures.length > 0) {
    console.error(`FAIL  ${failures.length} of ${checks.length} conformance checks\n`);
    for (const f of failures) console.error(`  x ${f}`);
    console.error("");
    process.exit(1);
}

console.log(`PASS  ${checks.length} conformance checks (Agent Plugins ${SPEC})`);
console.log(
    `      ${EXPECTED_SKILL_NAMES.length} skills, ${Object.keys(mcp.mcpServers).length} MCP servers, v${plugin.version}`,
);
