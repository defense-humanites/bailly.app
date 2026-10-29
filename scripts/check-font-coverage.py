#!/usr/bin/env python3
"""
Checks fonts against the dictionary's characters: lists, for each font file,
those it does not draw (they fall back to IFAOGrec, for Greek and the private
use area, then to the system's font). Useful to evaluate a reading font.

Usage: scripts/check-font-coverage.py <the API's database, e.g. bailly-rev4.db> <font file>…

A font served in several files (cf. `scripts/subset-fonts.sh`: the common
characters, `*.subset.woff2`, and the rare ones, `*.extra.woff2`, which the
browser combines through `unicode-range`) is checked as one: a
`*.subset.woff2` with its `*.extra.woff2` beside it, or files joined by `+`
(`a.woff2+b.woff2`).

Every text column of every table is read. The private use area (drawn by
IFAOGrec, for which those characters were encoded) and the control
characters are left out. Requires fontTools (`pip install fonttools brotli`).
"""

import sqlite3
import sys
import unicodedata
from pathlib import Path

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

def files(argument: str) -> list[str]:
    """The files of a font: joined by `+`, or a subset with its extra file."""
    if "+" in argument:
        return argument.split("+")
    extra = Path(argument.replace(".subset.", ".extra."))
    return [argument, str(extra)] if ".subset." in argument and extra.exists() else [argument]


missing = 0
for argument in sys.argv[2:]:
    paths = files(argument)
    cmap = set().union(*(TTFont(path).getBestCmap() for path in paths))
    absent = [char for char in relevant if ord(char) not in cmap]
    missing += len(absent)
    print(f"{' + '.join(paths)}: {len(absent)} of the dictionary's {len(relevant)} characters not drawn")
    for char in absent:
        print(f"  U+{ord(char):04X} {unicodedata.name(char, '?')} ({used[char]} occurrence(s))")

print(f"{len(used)} distinct characters in the dictionary.")
sys.exit(1 if missing else 0)
