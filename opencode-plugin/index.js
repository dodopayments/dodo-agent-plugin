// @dodopayments/opencode-plugin
//
// OpenCode plugin entry point for Dodo Payments.
//
// This plugin exists to make `@dodopayments/opencode-plugin` installable
// from npm so users can reference it in their `opencode.json` "plugin" array.
// It registers no runtime hooks - the value of this package is:
//
//   1. The bundled skills/ directory (OpenCode auto-discovers SKILL.md files
//      from installed packages, so the 8 Dodo Payments skills become
//      available once this package is installed).
//
//   2. The documented .mcp.json and opencode.json reference snippets, so
//      users know exactly which MCP servers to add to their config.
//
// If future versions of this plugin need runtime behavior (e.g. injecting
// Dodo-specific tools, hooking chat.message, etc.), add them to the returned
// Hooks object. All Hooks fields are optional - see @opencode-ai/plugin types.
//
// @see https://opencode.ai/docs/plugins
// @see https://docs.dodopayments.com/developer-resources/agent-skills

/**
 * @typedef {import("@opencode-ai/plugin").Plugin} Plugin
 */

/** @type {Plugin} */
const dodopayments = async () => ({});

export default dodopayments;
