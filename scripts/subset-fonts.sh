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
# Requires fontTools with Brotli (`pip install fonttools brotli`).
set -e
FONTS="$(dirname "$0")/../app/assets/fonts"

subset() { # <file> <unicodes> [pyftsubset options]
  file=$1; unicodes=$2; shift 2
  pyftsubset "$file.woff2" --unicodes="$unicodes" --flavor=woff2 --output-file="$file.subset.woff2" "$@"
  echo "$file.subset.woff2: $(wc -c < "$file.woff2") -> $(wc -c < "$file.subset.woff2") bytes"
}

INTER="U+0000-024F,U+02B0-036F,U+0370-03FF,U+1F00-1FFF,U+2000-206F,U+2070-209F,U+20A0-20CF,U+2100-218F,U+2190-21FF,U+2200-22FF,U+2300-23FF,U+25A0-25FF,U+2713,U+2717,U+FB01-FB02,U+FEFF,U+FFFD"
for face in Roman Italic; do
  file="$FONTS/Inter_Variable/Inter_Variable-$face"
  # The weights beyond the interface's dropped first (cf. `fonts.css`).
  fonttools varLib.instancer "$file.woff2" wght=400:700 --output="$file.wght.woff2"
  pyftsubset "$file.wght.woff2" --unicodes="$INTER" --layout-features+=tnum,case --flavor=woff2 --output-file="$file.subset.woff2"
  rm "$file.wght.woff2"
  echo "$file.subset.woff2: $(wc -c < "$file.woff2") -> $(wc -c < "$file.subset.woff2") bytes"
done

BOOK="U+0000-036F,U+0370-03FF,U+0440-0441,U+1DC0-1DFF,U+1E00-1EFF,U+1F00-1FFF,U+2000-20FF,U+2100-218F,U+2190-23FF,U+25A0-27BF,U+2C80-2CFF,U+2E00-2E7F,U+FB00-FB06,U+FEFF,U+FFFD,U+10100-1018F,U+1D200-1D24F"
for face in Roman Italic Bold BoldItalic; do
  subset "$FONTS/Gentium_Book_Plus/GentiumBookPlus-$face" "$BOOK" --layout-features+=smcp,c2sc,tnum,lnum,onum,case --name-IDs='*'
  out="$FONTS/Gentium_Book_Plus/BaillyBook-$face.subset.woff2"
  mv "$FONTS/Gentium_Book_Plus/GentiumBookPlus-$face.subset.woff2" "$out"
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
