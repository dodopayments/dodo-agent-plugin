"""Scores each run: agent usage from events.jsonl, static checks on the code, typecheck result from Coder."""
import json, os, re, glob

EVENTS = json.load(open('webhook-events.json'))  # valid event names, taken from the installed SDK
rows = []
for d in sorted(glob.glob('runs/*')):
    rid = os.path.basename(d)
    steps, tools, text = [], [], ''
    for line in open(f'{d}/events.jsonl'):
        e = json.loads(line)
        p = e.get('part', {})
        if p.get('type') == 'step-finish':
            steps.append(p)
        if p.get('type') == 'tool':
            tools.append((p['tool'], (p.get('state') or {}).get('input') or {}))
    t0 = steps[0]['tokens'] if steps else {}
    base = t0.get('input', 0) + t0.get('cache', {}).get('write', 0) + t0.get('cache', {}).get('read', 0)
    code = ''
    for f in glob.glob(f'{d}/**/*.ts', recursive=True) + glob.glob(f'{d}/**/*.tsx', recursive=True):
        if '/node_modules/' in f or '/.opencode/' in f:
            continue
        code += open(f).read() + '\n'
    names = sorted(set(re.findall(r"""['"`]((?:payment|subscription|refund|dispute|license_key|credit|entitlement_grant|payout|abandoned_checkout|dunning)\.[a-z_]+)['"`]""", code)))
    tc = open(f'{d}/typecheck.txt').read() if os.path.exists(f'{d}/typecheck.txt') else 'not run'
    rows.append({
        'run': rid,
        'seconds': int(open(f'{d}/seconds.txt').read()) if os.path.exists(f'{d}/seconds.txt') else None,
        'steps': len(steps),
        'base_context_tokens': base,
        'tokens_processed': sum(s['tokens'].get('total', 0) for s in steps),
        'output_tokens': sum(s['tokens'].get('output', 0) + s['tokens'].get('reasoning', 0) for s in steps),
        'cost_usd': round(sum(s.get('cost', 0) for s in steps), 3),
        'skills': [i.get('name') for t, i in tools if t == 'skill'],
        'mcp_calls': [t for t, _ in tools if 'dodo' in t],
        'typecheck': 'pass' if tc.strip() == 'PASS' else ('not run' if tc == 'not run' else 'FAIL'),
        'typecheck_errors': len(re.findall(r'error TS\d+', tc)),
        'verifies_webhook': bool(re.search(r'webhooks\.unwrap\(|\.verify\(', code)) if rid.startswith(('t1', 't2')) else None,
        'raw_body': bool(re.search(r'express\.raw\(|req\.text\(\)|request\.text\(\)|arrayBuffer\(\)|verify:\s*\([^)]*buf', code)) if rid.startswith(('t1', 't2')) else None,
        'test_mode': 'test_mode' in code,
        'event_names': names,
        'invalid_event_names': [n for n in names if n not in EVENTS],
    })
json.dump(rows, open('scores.json', 'w'), indent=1)
for r in rows:
    print(json.dumps(r))
