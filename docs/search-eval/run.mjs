// Runs every question against both docs MCP servers over one connection each and saves raw responses.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import fs from 'node:fs';

const questions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));
const only = process.argv[2] ? Number(process.argv[2]) : undefined;

const servers = {
  knowledge: { url: 'https://knowledge.dodopayments.com/mcp', tool: 'search_docs', args: (q) => ({ query: q, limit: 5 }) },
  mintlify: { url: 'https://docs.dodopayments.com/mcp', tool: 'search_dodo_payments_documentation', args: (q) => ({ query: q }) },
};

async function connect(url) {
  const client = new Client({ name: 'dodo-bench', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  return client;
}

const out = [];
for (const [name, s] of Object.entries(servers)) {
  const client = await connect(s.url);
  // One warm-up call so the first measured call does not pay cold-start cost.
  await client.callTool({ name: s.tool, arguments: s.args('dodo payments') });
  for (const item of questions) {
    if (only && item.id !== only) continue;
    // One retry on a failed call; `attempts` records it and `ms` times the last attempt.
    let text = '';
    let error = null;
    let ms = 0;
    let attempts = 0;
    do {
      attempts++;
      error = null;
      const t0 = performance.now();
      try {
        const res = await client.callTool({ name: s.tool, arguments: s.args(item.q) });
        text = (res.content ?? []).map((c) => c.text ?? '').join('\n');
        if (res.isError) error = text.slice(0, 200);
      } catch (e) {
        error = String(e).slice(0, 200);
      }
      ms = Math.round(performance.now() - t0);
    } while (error && attempts < 2);
    out.push({ server: name, id: item.id, ms, attempts, error, text });
    process.stderr.write(`${name} q${item.id} ${ms}ms${error ? ' ERROR ' + error : ''}\n`);
  }
  await client.close();
}
// RAW_OUT sets the output file, so a later run can sit next to the baseline.
fs.writeFileSync(only ? `raw-${only}.json` : process.env.RAW_OUT ?? 'raw.json', JSON.stringify(out, null, 1));
