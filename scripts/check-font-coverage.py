#!/usr/bin/env python3
"""
Checks fonts against the dictionary's characters: lists, for each font file,
those it does not draw (they fall back to IFAOGrec, for Greek and the private
use area, then to the system's font). Useful to evaluate a reading font.

Usage: scripts/check-font-coverage.py <the API's database, e.g. bailly-rev4.db> <font file>…

Every text column of every table is read. The private use area (drawn by
IFAOGrec, for which those characters were encoded) and the control
characters are left out. Requires fontTools (`pip install fonttools brotli`).
"""

import sqlite3
import sys
import unicodedata

from fontTools.ttLib import TTFont

if len(sys.argv) < 3:
    sys.exit(__doc__)

db = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
used: dict[str, int] = {}
tables = [name for (name,) in db.execute("SELECT name FROM sqlite_master WHERE type = 'table'")]
for table in tables:
    columns = [row[1] for row in db.execute(f'PRAGMA table_info("{table}")')]
    for column in columns:
        for (value,) in db.execute(f'SELECT "{column}" FROM "{table}" WHERE typeof("{column}") = \'text\''):
            for char in value:
                used[char] = used.get(char, 0) + 1

relevant = sorted(
    char for char in used
    if not 0xE000 <= ord(char) <= 0xF8FF and unicodedata.category(char) not in ("Cc", "Cf")
)

missing = 0
for path in sys.argv[2:]:
    cmap = set(TTFont(path).getBestCmap())
    absent = [char for char in relevant if ord(char) not in cmap]
    missing += len(absent)
    print(f"{path}: {len(absent)} of the dictionary's {len(relevant)} characters not drawn")
    for char in absent:
        print(f"  U+{ord(char):04X} {unicodedata.name(char, '?')} ({used[char]} occurrence(s))")

print(f"{len(used)} distinct characters in the dictionary.")
sys.exit(1 if missing else 0)
