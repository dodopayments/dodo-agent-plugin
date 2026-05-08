// @dodopayments/opencode-plugin
// Registers Dodo Payments MCP servers via OpenCode's `config` hook.
// @see https://opencode.ai/docs/plugins

/**
 * @typedef {import("@opencode-ai/plugin").Plugin} Plugin
 */

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
