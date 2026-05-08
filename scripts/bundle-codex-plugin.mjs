#!/usr/bin/env node
/**
 * Materialize the Codex plugin bundle at `plugins/dodopayments/`.
 *
 * Codex's `codex plugin marketplace add` does a plain `git clone` of this repo
 * (no `--recurse-submodules`) into `~/.codex/.tmp/marketplaces/dodopayments/`.
 * That means:
 *   - The `skills/` symlinks at the repo root resolve to nothing (the
 *     `skills-src/` submodule is empty).
 *   - The marketplace at `.agents/plugins/marketplace.json` must point to a
 *     subdirectory that contains real files for everything the plugin needs.
 *
 * Codex also forbids:
 *   - Marketplace `source.path` of `"./"` (must be a subdirectory).
 *   - Plugin manifest paths that don't start with `./`.
 *
 * This script writes the real files Codex needs into `plugins/dodopayments/`,
 * sourced from the same canonical inputs the other plugin targets use:
 *   - `.codex-plugin/plugin.json`  (manifest skeleton, paths rewritten to `./`)
 *   - `.mcp.json`                  (copied verbatim)
 *   - `skills-src/dodo-payments/<skill>/`  (each skill copied as real files)
 *
 * Run with `--check` in CI to verify the bundle is in sync with sources.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, statSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_MODE = process.argv.includes("--check");

const SOURCE_PLUGIN_MANIFEST = ".codex-plugin/plugin.json";
const SOURCE_MCP = ".mcp.json";
const SOURCE_SKILLS_DIR = "skills-src/dodo-payments";

const BUNDLE_DIR = "plugins/dodopayments";
const BUNDLE_PLUGIN_MANIFEST = `${BUNDLE_DIR}/.codex-plugin/plugin.json`;
const BUNDLE_MCP = `${BUNDLE_DIR}/.mcp.json`;
const BUNDLE_SKILLS_DIR = `${BUNDLE_DIR}/skills`;

function readJson(relPath) {
    return JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));
}

function readText(relPath) {
    return readFileSync(join(ROOT, relPath), "utf8");
}

function ensureDir(absPath) {
    mkdirSync(absPath, { recursive: true });
}

function listSkillNames() {
    const absSrc = join(ROOT, SOURCE_SKILLS_DIR);
    if (!existsSync(absSrc)) {
        throw new Error(
            `${SOURCE_SKILLS_DIR} not found. Initialize the skills submodule with: git submodule update --init --recursive`,
        );
    }
    return readdirSync(absSrc).filter((name) => {
        const skillDir = join(absSrc, name);
        return statSync(skillDir).isDirectory() && existsSync(join(skillDir, "SKILL.md"));
    });
}

function buildBundlePluginManifest() {
    const source = readJson(SOURCE_PLUGIN_MANIFEST);
    // Rewrite paths to be Codex-compliant: must start with `./` and resolve
    // relative to the plugin root (the bundle dir).
    const bundle = {
        ...source,
        skills: "./skills/",
        mcpServers: "./.mcp.json",
    };
    return JSON.stringify(bundle, null, 4) + "\n";
}

function diffOrWriteText(relPath, expected) {
    const abs = join(ROOT, relPath);
    if (CHECK_MODE) {
        if (!existsSync(abs)) {
            throw new Error(`${relPath} missing. Run \`node scripts/bundle-codex-plugin.mjs\` to generate it.`);
        }
        const current = readFileSync(abs, "utf8");
        if (current !== expected) {
            throw new Error(
                `${relPath} is out of sync with its source. Run \`node scripts/bundle-codex-plugin.mjs\` to refresh.`,
            );
        }
        return;
    }
    ensureDir(dirname(abs));
    writeFileSync(abs, expected);
}

function diffOrCopyFile(srcRel, dstRel) {
    const expected = readText(srcRel);
    diffOrWriteText(dstRel, expected);
}

function diffOrCopySkill(name) {
    const srcAbs = join(ROOT, SOURCE_SKILLS_DIR, name);
    const dstAbs = join(ROOT, BUNDLE_SKILLS_DIR, name);

    if (CHECK_MODE) {
        if (!existsSync(dstAbs)) {
            throw new Error(
                `${relative(ROOT, dstAbs)} missing. Run \`node scripts/bundle-codex-plugin.mjs\` to generate it.`,
            );
        }
        // Compare file by file recursively.
        compareDirsRecursive(srcAbs, dstAbs);
        return;
    }

    rmSync(dstAbs, { recursive: true, force: true });
    cpSync(srcAbs, dstAbs, { recursive: true, dereference: true });
}

function compareDirsRecursive(srcAbs, dstAbs) {
    const srcEntries = readdirSync(srcAbs).sort();
    const dstEntries = readdirSync(dstAbs).sort();
    if (srcEntries.length !== dstEntries.length || srcEntries.some((e, i) => e !== dstEntries[i])) {
        throw new Error(
            `${relative(ROOT, dstAbs)} entries differ from ${relative(ROOT, srcAbs)}. Run \`node scripts/bundle-codex-plugin.mjs\` to refresh.`,
        );
    }
    for (const entry of srcEntries) {
        const sChild = join(srcAbs, entry);
        const dChild = join(dstAbs, entry);
        const sStat = statSync(sChild);
        const dStat = statSync(dChild);
        if (sStat.isDirectory() && dStat.isDirectory()) {
            compareDirsRecursive(sChild, dChild);
        } else if (sStat.isFile() && dStat.isFile()) {
            const sBuf = readFileSync(sChild);
            const dBuf = readFileSync(dChild);
            if (!sBuf.equals(dBuf)) {
                throw new Error(
                    `${relative(ROOT, dChild)} differs from ${relative(ROOT, sChild)}. Run \`node scripts/bundle-codex-plugin.mjs\` to refresh.`,
                );
            }
        } else {
            throw new Error(
                `${relative(ROOT, dChild)} type differs from ${relative(ROOT, sChild)}. Run \`node scripts/bundle-codex-plugin.mjs\` to refresh.`,
            );
        }
    }
}

function pruneStaleSkills(currentNames) {
    if (CHECK_MODE) {
        const dstSkillsAbs = join(ROOT, BUNDLE_SKILLS_DIR);
        if (!existsSync(dstSkillsAbs)) return;
        const present = readdirSync(dstSkillsAbs);
        const stale = present.filter((n) => !currentNames.includes(n));
        if (stale.length > 0) {
            throw new Error(
                `${BUNDLE_SKILLS_DIR} contains stale entries: ${stale.join(", ")}. Run \`node scripts/bundle-codex-plugin.mjs\` to refresh.`,
            );
        }
        return;
    }
    const dstSkillsAbs = join(ROOT, BUNDLE_SKILLS_DIR);
    if (!existsSync(dstSkillsAbs)) {
        ensureDir(dstSkillsAbs);
        return;
    }
    for (const entry of readdirSync(dstSkillsAbs)) {
        if (!currentNames.includes(entry)) {
            rmSync(join(dstSkillsAbs, entry), { recursive: true, force: true });
        }
    }
}

function main() {
    const skillNames = listSkillNames();
    if (skillNames.length === 0) {
        throw new Error(`No skills found in ${SOURCE_SKILLS_DIR}.`);
    }

    pruneStaleSkills(skillNames);

    diffOrWriteText(BUNDLE_PLUGIN_MANIFEST, buildBundlePluginManifest());
    diffOrCopyFile(SOURCE_MCP, BUNDLE_MCP);
    for (const name of skillNames) {
        diffOrCopySkill(name);
    }

    if (CHECK_MODE) {
        console.log(`Codex bundle in sync. Skills: ${skillNames.length}.`);
    } else {
        console.log(`Codex bundle written to ${BUNDLE_DIR}/. Skills: ${skillNames.length}.`);
    }
}

try {
    main();
} catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
}
