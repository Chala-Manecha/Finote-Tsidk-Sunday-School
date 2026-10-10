"""Supabase (pg_safeupdate) refuses UPDATE/DELETE without WHERE inside functions called from the API.
Fails if the latest definition of any function contains one."""
import glob, re, sys

latest = {}
for f in sorted(glob.glob('supabase/migrations/*.sql')):
    s = open(f).read()
    for m in re.finditer(r'create\s+or\s+replace\s+function\s+([\w.]+)\s*\(.*?\$\$(.*?)\$\$', s, re.S | re.I):
        latest[m.group(1)] = (f, m.group(2))

bad = []
for name, (f, body) in latest.items():
    for m in re.finditer(r'\b(update\s+[\w.]+\s+set\b|delete\s+from\s+[\w.]+)(.*?);', body, re.S | re.I):
        if not re.search(r'\bwhere\b', m.group(2), re.I):
            bad.append(f'{f}: {name}: {m.group(0)[:90]!r}')
if bad:
    print('UPDATE/DELETE without WHERE (fails on Supabase):', *bad, sep='\n  ')
    sys.exit(1)
print('safeupdate lint OK')
