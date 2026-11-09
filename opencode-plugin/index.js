// @dodopayments/opencode-plugin
// Registers the Dodo Payments MCP server via OpenCode's `config` hook.
// @see https://opencode.ai/docs/plugins

/**
 * @typedef {import("@opencode-ai/plugin").Plugin} Plugin
 */

// This module must export NOTHING but the default function. OpenCode's loader
// falls through to `getLegacyPlugins(mod)`, which iterates `Object.values(mod)`
// and throws `Plugin export is not a function` on any non-function export. The
// failure is swallowed: the plugin is skipped entirely and the MCP server
// below silently vanishes. Verified on 1.18.15 - adding a single named object
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
//
// The endpoint URL below MUST match the canonical mcp.json. This file is
// hand-written rather than generated - OpenCode's config shape is its own
// (`type: "remote"`, `url`) - so `build.mjs --check` cannot cover
// it. `scripts/conformance.mjs` asserts the URL sets are identical instead.
// `type: "remote"` is OpenCode's native Streamable HTTP transport; OpenCode
// runs OAuth discovery itself when connecting returns 401 (`opencode mcp auth
// dodopayments`). It does not start OAuth after a 401 in the middle of a
// session (verified on 1.18.34), which is why the server requires sign-in at
// connect time.
const DODO_MCP_SERVERS = {
    dodopayments: {
        type: "remote",
        url: "https://mcp.dodopayments.com/mcp",
        enabled: true,
    },
};

// Env vars chosen over opencode.json config because OpenCode's top-level
// schema is strict and rejects unknown keys (anomalyco/opencode#9161).
// DODO_DISABLE_KNOWLEDGE_MCP is still accepted and does nothing: the docs
// server it used to turn off is no longer registered.
const DISABLE_FLAGS = {
    dodopayments: "DODO_DISABLE_API_MCP",
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
