// Scores the raw responses: top-1/top-3 hit rate, MRR@5, tokens per response and latency.
import fs from 'node:fs';
import path from 'node:path';

const questions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));
const rawPath = process.argv[2] ?? 'raw.json';
const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const tok = (s) => Math.ceil(s.length / 4);
const norm = (u) => '/' + u.replace(/^https:\/\/docs\.dodopayments\.com\/?/, '').replace(/^\//, '').split('#')[0].replace(/\.md$/, '').replace(/\/$/, '');

function blocks(server, text) {
  if (server === 'knowledge') {
    return text.split(/\n-{20,}\n/).slice(1).map((b) => {
      const m = b.match(/Source: (\S+)/);
      return m ? { page: norm(m[1]), text: b } : null;
    }).filter(Boolean);
  }
  return text.split(/(?=^Title: )/m).map((b) => {
    const m = b.match(/^Link: (\S+)/m);
    return m ? { page: norm(m[1]), text: b } : null;
  }).filter(Boolean);
}

function uniquePages(bs) {
  return [...new Set(bs.map((b) => b.page))];
}

// Hybrid: alternate knowledge and Mintlify results, skip pages already taken, keep 5 blocks.
function hybrid(kb, mb) {
  const picked = [];
  const seen = new Set();
  for (let i = 0; picked.length < 5 && (i < kb.length || i < mb.length); i++) {
    for (const b of [kb[i], mb[i]]) {
      if (b && !seen.has(b.page) && picked.length < 5) {
        seen.add(b.page);
        picked.push(b);
      }
    }
  }
  return picked;
}

const variants = { knowledge: [], mintlify: [], 'mintlify top-5': [], hybrid: [] };
const perQ = [];
for (const q of questions) {
  const k = raw.find((r) => r.server === 'knowledge' && r.id === q.id);
  const m = raw.find((r) => r.server === 'mintlify' && r.id === q.id);
  const kb = blocks('knowledge', k.text);
  const mb = blocks('mintlify', m.text);
  const hb = hybrid(kb, mb);
  const sets = {
    knowledge: { bs: kb, tokens: tok(k.text), ms: k.ms },
    mintlify: { bs: mb, tokens: tok(m.text), ms: m.ms },
    'mintlify top-5': { bs: mb.slice(0, 5), tokens: mb.slice(0, 5).reduce((a, b) => a + tok(b.text), 0), ms: m.ms },
    hybrid: { bs: hb, tokens: hb.reduce((a, b) => a + tok(b.text), 0), ms: Math.max(k.ms, m.ms) },
  };
  const row = { id: q.id, q: q.q };
  for (const [name, s] of Object.entries(sets)) {
    // Rank is the position in the returned order, so a repeated page still takes a slot.
    const rank = s.bs.findIndex((b) => q.gold.includes(b.page)) + 1;
    const repeats = s.bs.length - uniquePages(s.bs).length;
    variants[name].push({ rank, tokens: s.tokens, ms: s.ms, results: s.bs.length, repeats });
    row[name] = { rank, top3: s.bs.slice(0, 3).map((b) => b.page) };
  }
  perQ.push(row);
}

const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const summary = {};
for (const [name, rows] of Object.entries(variants)) {
  const n = rows.length;
  summary[name] = {
    top1: `${rows.filter((r) => r.rank === 1).length}/${n}`,
    top3: `${rows.filter((r) => r.rank >= 1 && r.rank <= 3).length}/${n}`,
    top5: `${rows.filter((r) => r.rank >= 1 && r.rank <= 5).length}/${n}`,
    mrr5: (rows.reduce((a, r) => a + (r.rank >= 1 && r.rank <= 5 ? 1 / r.rank : 0), 0) / n).toFixed(2),
    tokensMedian: pct(rows.map((r) => r.tokens), 0.5),
    tokensP95: pct(rows.map((r) => r.tokens), 0.95),
    msP50: pct(rows.map((r) => r.ms), 0.5),
    msP95: pct(rows.map((r) => r.ms), 0.95),
    resultsMedian: pct(rows.map((r) => r.results), 0.5),
    repeatResults: rows.reduce((a, r) => a + r.repeats, 0),
  };
}
console.table(summary);
const misses = perQ.filter((r) => !(r.knowledge.rank >= 1 && r.knowledge.rank <= 3) || !(r.mintlify.rank >= 1 && r.mintlify.rank <= 3) || !(r.hybrid.rank >= 1 && r.hybrid.rank <= 3));
for (const r of misses) {
  console.log(`\nQ${r.id} ${r.q}`);
  for (const v of ['knowledge', 'mintlify', 'hybrid']) console.log(`  ${v.padEnd(9)} rank=${r[v].rank || '-'} ${r[v].top3.join(', ')}`);
}
// raw.json -> results.json, raw-after.json -> results-after.json, x.json -> x.results.json; never the input.
const base = path.basename(rawPath);
const outName = base.startsWith('raw') ? base.replace(/^raw/, 'results') : base.replace(/\.json$/, '') + '.results.json';
const outPath = path.join(path.dirname(rawPath), outName);
if (path.resolve(outPath) === path.resolve(rawPath)) throw new Error(`refusing to overwrite input ${rawPath}`);
fs.writeFileSync(outPath, JSON.stringify({ summary, perQ }, null, 1));
console.error(`wrote ${outPath}`);
