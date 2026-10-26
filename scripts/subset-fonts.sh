#!/bin/sh
#
# Subsets the fonts downloaded by (almost) every visit (cf.
# `app/assets/css/fonts.css`), served as `*.subset.woff2`; the full fonts are
# kept next to them, as the sources of this script.
#
# - Inter, the interface's font, covers Cyrillic, Vietnamese, IPA and hundreds
#   of alternates in the private use area, which the application never shows.
#   Its subset keeps the Latin scripts of Western and Central Europe, the Greek
#   (polytonic included: the search bar, the bookmarks), the combining
#   diacritics, the punctuation and the usual symbols. Its weight axis is
#   limited to the weights the interface uses (400 to 700, `font-normal` to
#   `font-bold`), its optical size axis kept (Inter is drawn tighter above
#   14 px: titles, but also the 16-20 px text); only the OpenType features
#   the browsers apply by default are kept, with the tabular numerals
#   (`tabular-nums`) and the case forms. Roman: 346 KB -> about 142 KB.
#
# - Gentium Book Plus (SIL), the default reading font, covers many scripts.
#   Its subset keeps the Latin scripts (with the extended blocks, for
#   transliterations), the Greek, the combining diacritics, the punctuation
#   and the symbols, and the Cyrillic р and с (U+0440, U+0441), which the
#   dictionary uses by mistake (14 times; to correct in the data); only the
#   OpenType features the application uses are kept (the default ones, small
#   capitals, numerals, case forms). A subset is a modified version, and
#   "Gentium" and "SIL" are Reserved Font Names (OFL): the subset is renamed
#   « Bailly Book » in its `name` table (and in the CSS), and says what it
#   derives from. A character dropped here falls back to IFAOGrec, then to
#   the system's serif font: check the dictionary's characters after a change
#   (`scripts/check-font-coverage.py`).
#
# The other reading fonts are served as they are: GFS Didot and GFS Neohellenic are
# (as GFS Artemisia and GFS Bodoni) light and their names reserved (a modified
# version would have to be renamed), and IFAOGrec is only downloaded for the rare characters that need
# it.
#
# Each subset is split in two files (cf. `fonts.css`): `*.subset.woff2`, the
# characters of nearly every page (Latin to Latin Extended-A, Greek and Greek
# Extended, the combining diacritics, the general punctuation, the super- and
# subscripts; for Inter, the symbols of the interface: ↵ and ⇧ of the
# keyboard keys, the arrows, the euro sign, ✓ and ✗), and `*.extra.woff2`,
# the rare ones, which a browser only downloads for a page that has some
# (`unicode-range`). Measured on 400 random entries of the dictionary: two
# use a character of the second file (₂ before this split, now in the first;
# ǵ). The first files weigh about a third of the former subsets (Gentium's
# rare blocks, e.g. Latin Extended Additional, hold most of its glyphs).
#
# Requires fontTools with Brotli (`pip install fonttools brotli`).
set -e
FONTS="$(dirname "$0")/../app/assets/fonts"

# <source> <output> <unicodes> [pyftsubset options]
subset() {
  src=$1; out=$2; unicodes=$3; shift 3
  pyftsubset "$src" --unicodes="$unicodes" --flavor=woff2 --output-file="$out" "$@"
  echo "$out: $(wc -c < "$src") -> $(wc -c < "$out") bytes"
}

# The ranges of the two files of each font (cf. `fonts.css`, which repeats
# them in `unicode-range`).
INTER="U+0000-017F,U+0300-036F,U+0370-03FF,U+1F00-1FFF,U+2000-206F,U+2070-209F,U+20AC,U+2190-2193,U+21B5,U+21E7,U+2713,U+2717,U+FEFF,U+FFFD"
INTER_EXTRA="U+0180-024F,U+02B0-02FF,U+20A0-20AB,U+20AD-20CF,U+2100-218F,U+2194-21B4,U+21B6-21E6,U+21E8-21FF,U+2200-22FF,U+2300-23FF,U+25A0-25FF,U+FB01-FB02"
BOOK="U+0000-017F,U+0300-036F,U+0370-03FF,U+1F00-1FFF,U+2000-206F,U+2070-209F,U+FEFF,U+FFFD"
BOOK_EXTRA="U+0180-02FF,U+0440-0441,U+1DC0-1DFF,U+1E00-1EFF,U+20A0-20FF,U+2100-218F,U+2190-23FF,U+25A0-27BF,U+2C80-2CFF,U+2E00-2E7F,U+FB00-FB06,U+10100-1018F,U+1D200-1D24F"

for face in Roman Italic; do
  file="$FONTS/Inter_Variable/Inter_Variable-$face"
  # The weights beyond the interface's dropped first (cf. `fonts.css`).
  fonttools varLib.instancer "$file.woff2" wght=400:700 --output="$file.wght.woff2"
  subset "$file.wght.woff2" "$file.subset.woff2" "$INTER" --layout-features+=tnum,case
  subset "$file.wght.woff2" "$file.extra.woff2" "$INTER_EXTRA" --layout-features+=tnum,case
  rm "$file.wght.woff2"
done

for face in Roman Italic Bold BoldItalic; do
  src="$FONTS/Gentium_Book_Plus/GentiumBookPlus-$face.woff2"
  for part in subset extra; do
    out="$FONTS/Gentium_Book_Plus/BaillyBook-$face.$part.woff2"
    if [ $part = subset ]; then unicodes=$BOOK; else unicodes=$BOOK_EXTRA; fi
    subset "$src" "$out" "$unicodes" --layout-features+=smcp,c2sc,tnum,lnum,onum,case --name-IDs='*'
    # Renamed (the Reserved Font Names "Gentium" and "SIL" left out of its
    # names), the copyright and the license kept.
    python3 - "$out" <<'EOF'
import sys
from fontTools.ttLib import TTFont
path = sys.argv[1]
font = TTFont(path)
name = font["name"]
for record in list(name.names):
    if record.nameID in (0, 13, 14):
        continue
    text = record.toUnicode().replace("Gentium Book Plus", "Bailly Book").replace("GentiumBookPlus", "BaillyBook")
    if "Gentium" in text or "SIL" in text:
        name.removeNames(nameID=record.nameID, platformID=record.platformID, platEncID=record.platEncID, langID=record.langID)
    else:
        record.string = text
name.setName(f"Bailly Book {name.getDebugName(2)}: {name.getDebugName(5)}", 3, 3, 1, 0x409)
name.setName("Bailly Book: a subset of Gentium Book Plus (SIL International), renamed as the SIL Open Font License requires.", 10, 3, 1, 0x409)
font.save(path)
EOF
  done
done
