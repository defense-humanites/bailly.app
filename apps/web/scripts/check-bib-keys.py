#!/usr/bin/env python3
"""
Checks that the entries' BibLaTeX keys (`bibKey`, app/utils/citation.ts)
are unique over the dictionary: its URIs read in the SQLite base (any
column named `uri`). Usage: scripts/check-bib-keys.py <base.sqlite>
Reports the keys shared by several URIs (none expected), then, for
information, those that differ by their case only (distinct for biber,
not for BibTeX).
"""

import re
import sqlite3
import sys
import unicodedata
from collections import Counter, defaultdict

if len(sys.argv) != 2:
    sys.exit(__doc__)

LONG = {"ê": "e:", "Ê": "E:", "ô": "o:", "Ô": "O:"}


def bib_key(uri: str) -> str:
    """As `bibKey` does (without its « bailly: » prefix)."""
    ascii_uri = re.sub("[êÊôÔ]", lambda match: LONG[match[0]], uri)
    ascii_uri = "".join(char for char in unicodedata.normalize("NFD", ascii_uri) if not unicodedata.combining(char))
    return re.sub(r"[^\w:()-]", "", ascii_uri.replace("#", "-", 1), flags=re.ASCII)


db = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
uris = set()
for (table,) in db.execute("SELECT name FROM sqlite_master WHERE type = 'table'"):
    if any(column[1] == "uri" for column in db.execute(f'PRAGMA table_info("{table}")')):
        uris.update(uri for (uri,) in db.execute(f'SELECT uri FROM "{table}" WHERE uri IS NOT NULL'))

by_key = defaultdict(set)
for uri in uris:
    by_key[bib_key(uri)].add(uri)
shared = {key: found for key, found in by_key.items() if len(found) > 1}
print(f"{len(uris)} URIs, {len(by_key)} keys; shared: {len(shared)}")
for key, found in sorted(shared.items()):
    print(f"  {key}: {', '.join(sorted(found))}")

by_case = defaultdict(set)
for key in by_key:
    by_case[key.lower()].add(key)
cased = [sorted(keys) for keys in by_case.values() if len(keys) > 1]
print(f"Differing by their case only (distinct for biber): {len(cased)}, e.g. {cased[:5]}")
dropped = Counter(char for uri in uris for char in set(re.sub(r"[\w:()#-]", "", unicodedata.normalize("NFD", uri), flags=re.ASCII)) if not unicodedata.combining(char) and char not in "êÊôÔ")
print(f"Characters dropped from the keys (URIs): {dict(dropped)}")
sys.exit(1 if shared else 0)
