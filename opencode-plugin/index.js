// @dodopayments/opencode-plugin
// Registers Dodo Payments MCP servers via OpenCode's `config` hook.
// @see https://opencode.ai/docs/plugins

/**
 * @typedef {import("@opencode-ai/plugin").Plugin} Plugin
 */

// This module must export NOTHING but the default function. OpenCode's loader
// falls through to `getLegacyPlugins(mod)`, which iterates `Object.values(mod)`
// and throws `Plugin export is not a function` on any non-function export. The
// failure is swallowed: the plugin is skipped entirely and the MCP servers
// below silently vanish. Verified on 1.18.15 - adding a single named object
// export drops both servers.
//
// To re-verify that claim, overwrite the module inside OpenCode's own package
// cache (~/.cache/opencode/packages/.../node_modules/@dodopayments/...).
// Editing this checkout, or the project's node_modules, proves nothing:
// OpenCode resolves the package from that cache and keeps running whatever the
// registry last published. It does so silently, so the run still looks valid -
// this has already invalidated two separate bisections of the bug above.
//
// Skills are pointed at via `skills.paths` in the user's own opencode.json -
// see this package's README. Setting `config.skills` from this hook is not a
// substitute: it never registered skills on any tested version, because the
// skill index is built before `config` hooks run.
//
// Nullish-assign (`??=`) lets users override any entry by declaring the
// same MCP key in their own opencode.json.
const DODO_MCP_SERVERS = {
    "dodopayments-api": {
        type: "local",
        command: ["npx", "-y", "mcp-remote@latest", "https://mcp.dodopayments.com/sse"],
        enabled: true,
    },
    "dodo-knowledge": {
        type: "local",
        command: ["npx", "-y", "mcp-remote@latest", "https://knowledge.dodopayments.com/mcp"],
        enabled: true,
    },
};

// Env vars chosen over opencode.json config because OpenCode's top-level
// schema is strict and rejects unknown keys (anomalyco/opencode#9161).
const DISABLE_FLAGS = {
    "dodopayments-api": "DODO_DISABLE_API_MCP",
    "dodo-knowledge": "DODO_DISABLE_KNOWLEDGE_MCP",
};

const TRUTHY = new Set(["1", "true", "yes", "on"]);

function isDisabled(envVarName) {
    const raw = process.env[envVarName];
    if (raw === undefined || raw === null || raw === "") return false;
    return TRUTHY.has(String(raw).trim().toLowerCase());
}

/** @type {Plugin} */
const dodopayments = async () => ({
    config: async (config) => {
        config.mcp ??= {};
        for (const [name, entry] of Object.entries(DODO_MCP_SERVERS)) {
            if (isDisabled(DISABLE_FLAGS[name])) continue;
            config.mcp[name] ??= entry;
        }
    },
});

export default dodopayments;
