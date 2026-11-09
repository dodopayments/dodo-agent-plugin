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
    const t0 = performance.now();
    let text = '';
    let error = null;
    try {
      const res = await client.callTool({ name: s.tool, arguments: s.args(item.q) });
      text = (res.content ?? []).map((c) => c.text ?? '').join('\n');
      if (res.isError) error = text.slice(0, 200);
    } catch (e) {
      error = String(e).slice(0, 200);
    }
    const ms = Math.round(performance.now() - t0);
    out.push({ server: name, id: item.id, ms, error, text });
    process.stderr.write(`${name} q${item.id} ${ms}ms${error ? ' ERROR ' + error : ''}\n`);
  }
  await client.close();
}
fs.writeFileSync(only ? `raw-${only}.json` : 'raw.json', JSON.stringify(out, null, 1));
