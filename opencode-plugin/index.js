// @dodopayments/opencode-plugin
//
// Registers the Dodo Payments MCP servers via OpenCode's `config` plugin
// hook so users do not need to paste an `mcp: { ... }` block into their
// `opencode.json`. The bundled skills/ directory is auto-discovered by
// OpenCode separately.
//
// @see https://opencode.ai/docs/plugins
// @see https://docs.dodopayments.com/developer-resources/agent-skills

/**
 * @typedef {import("@opencode-ai/plugin").Plugin} Plugin
 */

// OpenCode loads the user's opencode.json before invoking plugin `config`
// hooks on the same mutable config object. Nullish-assign (`??=`) therefore
// lets a user override any entry here by declaring the same key in their
// own opencode.json - e.g. swapping the default remote OAuth server for the
// local stdio `dodopayments-mcp` with their own API key.
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

/** @type {Plugin} */
const dodopayments = async () => ({
    config: async (config) => {
        config.mcp ??= {};
        for (const [name, entry] of Object.entries(DODO_MCP_SERVERS)) {
            config.mcp[name] ??= entry;
        }
    },
});

export default dodopayments;
