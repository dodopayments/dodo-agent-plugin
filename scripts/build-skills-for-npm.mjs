#!/usr/bin/env node
import { cpSync, readdirSync, lstatSync, rmSync, mkdirSync, existsSync, readlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(ROOT, "skills");
const ACTION = process.argv[2];

if (ACTION !== "materialize" && ACTION !== "restore") {
    console.error("Usage: build-skills-for-npm.mjs <materialize|restore>");
    process.exit(1);
}

function readSymlinkEntries() {
    if (!existsSync(SKILLS_DIR)) return [];
    return readdirSync(SKILLS_DIR)
        .map((name) => ({ name, path: join(SKILLS_DIR, name) }))
        .filter((e) => lstatSync(e.path).isSymbolicLink())
        .map((e) => ({ ...e, target: readlinkSync(e.path) }));
}

function materialize() {
    const links = readSymlinkEntries();
    if (links.length === 0) {
        console.log("No symlinks in skills/ (already materialized or empty). Nothing to do.");
        return;
    }
    for (const link of links) {
        const resolvedTarget = resolve(SKILLS_DIR, link.target);
        rmSync(link.path, { force: true });
        cpSync(resolvedTarget, link.path, { recursive: true });
        console.log(`materialized: skills/${link.name}`);
    }
    console.log(`Materialized ${links.length} skill(s) as real directories for npm pack.`);
}

function restore() {
    if (!existsSync(SKILLS_DIR)) {
        console.log("skills/ missing. Recreating empty dir.");
        mkdirSync(SKILLS_DIR, { recursive: true });
    }
    rmSync(SKILLS_DIR, { recursive: true, force: true });
    mkdirSync(SKILLS_DIR, { recursive: true });
    console.log("skills/ cleared. Restore with: git checkout skills/");
}

if (ACTION === "materialize") materialize();
else restore();
