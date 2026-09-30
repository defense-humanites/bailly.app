#!/usr/bin/env python3
"""
Checks the subset of Brill (cf. `scripts/subset-fonts.sh`) against the
dictionary's characters: lists those that the full font draws but its subset
no longer does (they would fall back to IFAOGrec or the system's font).

Usage: scripts/check-brill-coverage.py <the API's database, e.g. bailly-rev4.db>

Every text column of every table is read. Requires fontTools
(`pip install fonttools brotli`).
"""

import sqlite3
import sys
import unicodedata
from pathlib import Path

from fontTools.ttLib import TTFont

FONTS = Path(__file__).resolve().parent.parent / "app/assets/fonts/Brill"

if len(sys.argv) != 2:
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

missing = 0
for face in ("Roman", "Italic", "Bold", "BoldItalic"):
    full = set(TTFont(FONTS / f"Brill-{face}.woff2").getBestCmap())
    subset = set(TTFont(FONTS / f"Brill-{face}.subset.woff2").getBestCmap())
    dropped = sorted(char for char in used if ord(char) in full and ord(char) not in subset)
    missing += len(dropped)
    print(f"Brill-{face}: {len(dropped)} character(s) of the dictionary dropped by the subset")
    for char in dropped:
        print(f"  U+{ord(char):04X} {unicodedata.name(char, '?')} ({used[char]} occurrence(s))")

print(f"{len(used)} distinct characters in the dictionary.")
sys.exit(1 if missing else 0)
