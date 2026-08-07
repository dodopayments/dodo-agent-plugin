// @dodopayments/opencode-plugin
// Registers Dodo Payments skills and MCP servers via OpenCode's `config` hook.
// @see https://opencode.ai/docs/plugins

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {import("@opencode-ai/plugin").Plugin} Plugin
 */

// OpenCode scans six fixed skill locations, none inside an installed package,
// so a bundled skills/ directory is never found on its own. Must resolve from
// import.meta.url, not the consumer's node_modules: OpenCode installs plugins
// with Bun into ~/.cache/opencode/node_modules/.
// @see https://opencode.ai/docs/skills
const SKILLS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "skills");

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
        config.skills ??= {};
        config.skills.paths ??= [];
        if (!config.skills.paths.includes(SKILLS_DIR)) {
            config.skills.paths.push(SKILLS_DIR);
        }

        config.mcp ??= {};
        for (const [name, entry] of Object.entries(DODO_MCP_SERVERS)) {
            if (isDisabled(DISABLE_FLAGS[name])) continue;
            config.mcp[name] ??= entry;
        }
    },
});

// Skills need the v2 registration API as well: on some OpenCode versions the
// skill index is built before v1 `config` hooks run, so the mutation above is
// applied too late and the bundled skills never appear. Registering through
// `skill.transform` is how OpenCode registers its own built-in skills.
export const skills = {
    id: "dodopayments-skills",
    setup: async (context) => {
        await context.skill.transform((draft) => {
            draft.source({ type: "directory", path: SKILLS_DIR });
        });
    },
};

export default dodopayments;
