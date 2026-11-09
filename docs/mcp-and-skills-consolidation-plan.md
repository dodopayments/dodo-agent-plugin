# Plan: one MCP server and one skill

Status: draft for review. Owners: TBD.

## Why

A merchant in China reported that our agent plugin takes up too much of the agent's context and is hard for agents to use correctly. More developers now integrate Dodo through Claude Code, Cursor and Codex. When the plugin takes up context, the agent writes worse integrations, and some developers uninstall the plugin to get the context back.

We checked the report against plugin v0.6.3, `dodopayments/skills` at 8ed38e7 and `dodopayments-cli` v3.1.0:

- **18 skills.** Their 18 descriptions (about 6.4k characters, around 1.6k tokens) load into every session. The skills overlap: checkout and mobile-checkout, credit and usage billing, framework-adapters and better-auth. `dodo-best-practices` repeats parts of the others.
- **Three docs search surfaces, two of which are in the plugin.** The plugin ships `dodopayments-api` and `dodo-knowledge`. Each has a tool named `search_docs`, and the two return different things. Mintlify also serves a third docs MCP at `docs.dodopayments.com/mcp` that we don't document.
- **The CLI is not ready for agents.** Checkout is interactive only. There are no subscription or usage-event commands and no JSON output. This is out of scope here and is a separate roadmap item.

## Decisions

| Topic | Decision |
|---|---|
| Number of MCP servers in the plugin | One: `mcp.dodopayments.com/mcp` |
| Server name in the plugin | Rename `dodopayments-api` to `dodopayments` |
| Docs without signing in | Yes. Docs tools work without sign-in. `execute` starts OAuth the first time an agent calls it |
| Tool set | Same split as Polar: `search` (API and SDK methods), `search_docs` (guides), `read_docs_page`, `execute`, `feedback` |
| Guide search backend | Chosen by evaluation (see the evaluation section): `dodo-knowledge` (Pinecone), Mintlify, or both combined |
| `knowledge.dodopayments.com` | Stays online. It becomes the backend behind the new server and a public docs-only address |
| Copied from Polar | The `feedback` tool and a single MCP docs page |
| Skills | One `dodo-payments` skill with an index SKILL.md and reference files, following Anthropic's skill authoring guidelines |
| Release | MCP and skills changes ship in the same plugin release, so users migrate once |

## Comparison with Polar

Polar's setup is described at https://polar.sh/docs/integrate/mcp.

| | Polar | Dodo today |
|---|---|---|
| Servers | 1, plus a separate sandbox address | 2 in the plugin, 3 public |
| Tools | `search`, `execute`, `search_docs`, `read_docs_page`, `feedback` | API server: `execute`, `search_docs` (SDK methods only). Knowledge server: `search_docs` (guides) |
| Docs without signing in | No. The whole server returns 401 | Yes, through `dodo-knowledge` |
| Full page read | `read_docs_page` | None in the plugin |
| Read-only | `?readonly=true` | Scopes chosen on the consent page |
| Telemetry | Documented, with `intent`, `feedback` and `?telemetry=false` | `execute` has an `intent` field, but nothing is documented |

Measured on 2026-11-09:

| | Tools | `tools/list` size |
|---|---|---|
| `dodo-knowledge` | 1 | about 180 tokens |
| `docs.dodopayments.com/mcp` (Mintlify) | 3 | about 1,500 tokens |
| `dodopayments-api` | 2 | about 600 tokens plus about 230 for instructions (estimated from source, because the list needs sign-in) |

We sent the same 8 integration questions to both no-sign-in docs servers:

| | `dodo-knowledge` | Mintlify |
|---|---|---|
| Size of each response | 1.3k–2.2k tokens | 4.8k–9.6k tokens |
| Relevance | 2 misses of 8 | Relevant every time, with links to the exact section |
| Speed | Slower (p50 1.25 s on a warm connection) | Faster (p50 0.72 s) |

The misses were "verify webhook signature in Next.js" and "refund partial payment". Eight questions is a spot check. The 30-question run below is the one to use.

## Target state

**Plugin MCP config, the same for every client:**

```json
{ "mcpServers": { "dodopayments": { "type": "http", "url": "https://mcp.dodopayments.com/mcp" } } }
```

**Tools on `mcp.dodopayments.com/mcp`:**

| Tool | Sign-in | Backend |
|---|---|---|
| `search` | Not needed | The SDK method index already built into the Worker (today's `search_docs`, renamed) |
| `search_docs` | Not needed | The winner of the evaluation, reached through a Cloudflare service binding |
| `read_docs_page` | Not needed | Markdown of the page (`docs.dodopayments.com/<path>.md`) |
| `feedback` | Not needed | Logged to our telemetry, after removing identifiers |
| `execute` | Required | Unchanged. Without a session it returns 401 and `WWW-Authenticate`, which makes the client start OAuth |

**Plugin skills:**

```
skills/dodo-payments/
  SKILL.md                  # index: about 100 lines
  references/
    checkout.md             # hosted checkout, payment links, overlay checkout
    mobile-checkout.md
    subscriptions.md
    webhooks.md
    usage-billing.md
    credits.md
    license-keys.md
    products.md
    discounts.md
    localized-pricing.md
    customers.md
    refunds-disputes.md
    framework-adapters.md
    better-auth.md
    billing-sdk.md
    testing-go-live.md
    mcp.md                  # replaces the dodo-mcp-usage skill
```

## Workstream A: MCP server (`dodopayments-typescript`)

This work goes in `packages/mcp-server/cloudflare-worker`. We write those files ourselves. Don't edit `packages/mcp-server/src/*` because Stainless generates it and overwrites it on every regeneration.

1. **No-sign-in tier.**
   - `src/index.ts`: for an unsigned `/mcp` request, return a session with no account instead of a 401.
   - `src/mcp.ts` `toolsFor()`: list all five tools.
   - The no-account path must never create an API client.
   - Unsigned `execute` returns 401 with `WWW-Authenticate: Bearer resource_metadata=...`.
2. **Tools.**
   - `search`: today's `docsSearch` handler under the new name.
   - `search_docs` and `read_docs_page`: new, in our own code.
   - `feedback`: new. It removes emails, IDs and keys before logging. Copy Polar's redaction approach.
   - Cap each response at about 2k tokens and allow a `limit` argument.
3. **Service binding.** Bind the Worker to `dodo-knowledge-mcp` and call `/search`. Traffic stays inside Cloudflare, so the 300/min per-IP rule on the knowledge host doesn't apply. If the backend is down, `search` still works.
4. **Server instructions and descriptions.** Rewrite them for five tools. Say which tools need sign-in.
5. **Rate limit for unsigned traffic** (`infra`, `dodopayments-com.tfvars`). Add a rule for unsigned `POST /mcp`, because every query costs Pinecone and OpenAI calls.
6. **Tests.**
   - Unsigned `tools/list` returns all five tools.
   - Unsigned `execute` returns 401 with the header.
   - Signed-in behaviour is unchanged.
   - `search_docs` falls back when its backend is down.
   - The redaction in `feedback` works.

## Workstream B: skills (`dodopayments/skills`, copied into the plugin)

Rules, from Anthropic's skill authoring best practices (https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices):

- **Description.** One description of 1,024 characters or less, written in the third person, that says what the skill does and when to use it. Include the trigger words agents will see in the task: Dodo Payments, checkout, subscription, webhook, `dodopayments` SDK, metered billing, license keys.
- **SKILL.md.** Stay well under the 500-line limit. Target about 100 lines, as the merchant asked. SKILL.md holds the overview and the index of reference files, and nothing else.
- **One level of references.** Link every reference file directly from SKILL.md. Today 7 skills have their own `references/` folder (26 files, about 2.5k lines). If we merge them without changes they become two levels deep, which the guide says to avoid. Merge each one into its topic file, or link it directly from SKILL.md.
- **Contents list.** Every reference file over 100 lines starts with a contents list. Today none of the 26 files has one.
- **Consistent words.** Pick one word for each concept and use it everywhere: "checkout session", not a mix with "payment link" or "checkout"; "webhook", not "event". The overlapping skills mix them today.
- **One default.** Give one recommended way to do each thing, plus an exception where needed. Don't list options.
- **Nothing that goes out of date.** No dates and no "new in vX". Old patterns go in a separate "Old patterns" section.
- **Evaluations first.** Before rewriting, collect baseline results (see the evaluation section). Test with Haiku, Sonnet and Opus.

The SKILL.md index contains:

1. When to use the skill, and the standard path: create a checkout session, then handle the webhook, then grant access.
2. Client setup and test mode vs live mode, in about 15 lines.
3. Safety rules that must never be broken:
   - Verify webhook signatures on the raw body.
   - Use test mode until go-live.
   - Never put API keys in client code.
   - Confirm before any write in live mode.
4. A routing table from task to reference file.
5. MCP use: call `search_docs` before writing code, `search` before `execute`, and `execute` for account actions.

Content changes:

- `dodo-best-practices` becomes SKILL.md and is cut down hard.
- `dodo-mcp-usage` becomes `references/mcp.md` and is rewritten for the one server.
- Remove sections duplicated across skills.
- Fix the CLI sign-in text in places that describe pasting an API key (the CLI README is wrong as well).

## Workstream C: plugin release (`dodo-agent-plugin`)

1. Point `.skills-source.json` at the single `dodo-payments` skill, then run `scripts/build.mjs` to regenerate the provider copies (`plugins/dodopayments`, `providers/junie`, `providers/antigravity`).
2. Replace both server entries with one `dodopayments` entry in:
   - `.mcp.json`, `mcp.json`
   - `plugins/dodopayments/*`
   - `gemini-extension.json`
   - `.muse-plugin/plugin.json`
   - `providers/*`
   - `opencode-plugin/index.js`
3. Environment variables:
   - `DODO_DISABLE_KNOWLEDGE_MCP` is still accepted but does nothing. Note this in the changelog.
   - `DODO_DISABLE_API_MCP` turns off the single server.
4. `conformance.mjs` must fail if:
   - there is more than one server;
   - the old names come back;
   - a SKILL.md is over 150 lines;
   - a reference file over 100 lines has no contents list;
   - a description is over 1,024 characters.
5. Update the README, `opencode-plugin/README.md` and `docs/clients/*.md`.
   - Grok and the xAI API can now use `mcp.dodopayments.com` without sign-in.
6. Changelog: this is a breaking change, so release it as 0.7.0.
   - The rename from `dodopayments-api` to `dodopayments` means some clients ask users to sign in again.
   - Explain the new sign-in command for each client: `/mcp` in Claude Code, `codex mcp login dodopayments`, `opencode mcp auth dodopayments`.
   - Users who added `dodo-knowledge` by hand will see duplicate docs results until they remove it.

## Workstream D: public docs

1. Write one MCP page in `dodo-docs` (`developer-resources/mcp-server.mdx`), modelled on Polar's:
   - setup tabs for each client;
   - how code mode works;
   - which tools work without sign-in;
   - the list of operations;
   - a short telemetry and feedback section.
2. In `introduction.mdx` (15 languages), `llms.txt` and `llms-full.txt`, recommend the one server.
   - Keep `knowledge.dodopayments.com` in one short section as the docs-only address that needs no account.
3. Mintlify docs MCP (`docs.dodopayments.com/mcp`):
   - Leave it on, and link it from nothing.
   - Decide its future after the evaluation. If Mintlify wins as the backend, it keeps serving traffic.
4. Update the skills table in `developer-resources/agent-skills`.

## Evaluation (needed before the backend choice and before the skills release)

1. **Search: about 30 real integration questions.**
   - Take them from support tickets and from the docs topics people ask about most.
   - Run each question on three backends: `dodo-knowledge`, Mintlify, and both combined (our ranking plus Mintlify's section links).
   - Measure:
     - top-3 hit rate, judged against the correct docs page;
     - tokens per response;
     - p50 and p95 latency.
   - Choose the backend with the best hit rate that stays within the 2k-token cap.
   - **First run, 2026-11-09:** see "Search evaluation results" below. Result: combine both backends, after fixing the problems found in `dodo-knowledge`.
2. **Skills: about 10 integration tasks in fresh projects.** Examples:
   - Next.js checkout plus webhook;
   - an Express subscription with a plan change;
   - usage metering;
   - license keys in a CLI.
   - Run each task in three setups: no plugin, the current plugin, and the new plugin, with Haiku, Sonnet and Opus.
   - Score:
     - whether the code builds;
     - whether the webhook signature is verified;
     - whether field and event names are correct;
     - whether test mode is used;
     - tokens used.
   - Ship when the new plugin scores at least as well as the current one and uses fewer tokens.

## Search evaluation results (2026-11-09)

Setup:

- **Questions and correct pages:** 30 questions across 18 topics. For each one, the correct page or pages were taken from the docs index (`_llms/en/docs.txt`) before any search ran.
- **Running the queries:** one MCP connection to each server, with a warm-up call first, run from India.
- **Combined method:** simulated offline. It takes results from `dodo-knowledge` and Mintlify in turn, skips pages already taken, and keeps 5 results.
- **Files:** questions, harness and raw scores are in [`search-eval/`](search-eval/). Run `node run.mjs && node score.mjs` to repeat it.

| Backend | Top-1 | Top-3 | MRR@5 | Tokens (median / p95) | Latency (p50 / p95) |
|---|---|---|---|---|---|
| `dodo-knowledge` (5 results) | 24/30 | 27/30 | 0.85 | 1.4k / 2.1k | 1.25 s / 2.6 s |
| Mintlify (10 results) | 20/30 | 27/30 | 0.79 | 8.4k / 11.8k | 0.72 s / 1.0 s |
| Mintlify, first 5 results only | 20/30 | 27/30 | 0.79 | 3.1k / 6.9k | 0.72 s / 1.0 s |
| **Combined** | **24/30** | **29/30** | **0.87** | 2.3k / 6.9k | both calls run at once, so the slower of the two |

Problems found in `dodo-knowledge`:

- **Half its results repeat a page.** 73 of the 150 results returned were a page already in the same response. For example, "change plan with proration" filled all 5 results from a single page. If we fetch more results and remove repeats before returning 5, the top-3 score should rise at no extra token cost.
- **The `api-reference/` folder is never indexed.** `config.yaml` skips that whole folder ("parsed via OpenAPI source"). The OpenAPI step does not cover the hand-written pages there, such as `error-codes`, `introduction` and `transaction-failures`. This is why it missed "API error codes".
- **It gives its own SDK pages less weight than the SDK GitHub READMEs.** For "install the Python SDK" it returned the GitHub README instead of `/developer-resources/sdks/python`.
- **The cancellation question was missed by both.** For "cancel subscription at end of billing period", neither backend ranked the API page first. Mintlify had `features/subscription` at rank 3. This is likely a gap in the docs content, not in search.

Problems found in Mintlify:

- **It returns 10 large results.** Even limited to the first 5, the p95 is 6.9k tokens. The combined backend must cap each result at about 400 tokens to stay under the 2k cap.
- **Its ranking is weaker on guides.** It gave changelog pages and `billing-deconstructions` higher ranks than the actual guides ("cancel subscription", "LLM token billing").

Decision for workstream A:

- **Backend.** `search_docs` uses both backends combined, called in parallel through the service binding. Each result is capped at about 400 tokens, and the response at 5 results and 2k tokens.
- **Fixes to `dodo-knowledge`, made before the merge:**
  - remove repeated pages from the results;
  - index the MDX pages in `api-reference/`;
  - give docs pages more weight than GitHub READMEs.
- **Then re-run** this evaluation, plus 30 new questions drawn from support tickets, so we don't tune to this question set.

Limits of this run:

- One run only.
- The correct-page sets were written by one person.
- The combined result is simulated, not a live implementation.
- Latency was measured from a single location.

## Order of work

| Phase | Work | Takes |
|---|---|---|
| 0 | Client test: deploy the no-sign-in tier to `*.workers.dev`. In Claude Code, Cursor, Codex, OpenCode, Gemini CLI and VS Code, check two things: whether a 401 from `execute` starts OAuth, and whether a client accepts a server that never returns 401. Record the results. | 1–2 days |
| 1 | Search evaluation, and the skills baseline using the current plugin | 2–3 days, run in parallel with phase 0 |
| 2 | Workstream A, behind a flag | about 1 week |
| 2 | Workstream B, running alongside | about 1 week |
| 3 | Skills evaluation of the new plugin, then fixes | 2–3 days |
| 4 | Workstream C (0.7.0) and workstream D | 2–3 days |
| 5 | Watch the metrics for 2 weeks | — |

**If phase 0 fails** (some client never starts OAuth after a 401), `execute` returns a 401 plus a text message with that client's sign-in command. If several major clients fail, go back to requiring sign-in for the whole server, as Polar does, and keep `knowledge.dodopayments.com` as the documented docs-only server.

## Metrics

- Tokens that the plugin keeps in context all the time, before and after. Target: about 1.8k → under 300 (skill description plus `tools/list`).
- Number of plugin sessions on `knowledge.dodopayments.com`, which should trend to zero.
- Unsigned vs signed sessions on `mcp.dodopayments.com`, and how many unsigned sessions later sign in.
- `feedback` submissions, read weekly.
- Plugin uninstalls, where the platform reports them.

## Risks

- **Clients that handle a 401 in the middle of a session badly.** Covered by phase 0 and its fallback.
- **Cost and abuse of unsigned traffic.** Covered by the rate limit, the response cap and the Cloudflare rules.
- **The rename forces some users to sign in again.** Covered in the changelog and the client docs.
- **The local stdio package is not covered.** `dodopayments-mcp`, generated by Stainless, keeps only the SDK index. Users who run it with their own API key don't get guide search. Track this separately (Stainless configuration).
- **Removing content from the skills.** Merging can drop useful details. The skills evaluation and a reviewer for each reference file guard against this.

## Out of scope

- Making the CLI usable by agents: flag-based checkout, subscription and usage commands, `--json`. This is a separate roadmap item.
- `?readonly=true`, a telemetry opt-out, and a separate sandbox address. Possible later work.
