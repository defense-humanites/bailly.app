#!/bin/sh
#
# Subsets the two fonts downloaded by (almost) every visit (cf.
# `app/assets/css/fonts.css`), served as `*.subset.woff2`; the full fonts are
# kept next to them, as the sources of this script.
#
# - Inter, the interface's font, covers Cyrillic, Vietnamese, IPA and hundreds
#   of alternates in the private use area, which the application never shows.
#   Its subset keeps the Latin scripts of Western and Central Europe, the Greek
#   (polytonic included: the search bar, the bookmarks), the combining
#   diacritics, the punctuation and the usual symbols, with all its OpenType
#   features and its variation axes. Roman: 346 KB -> 237 KB.
#
# - Brill, the default reading font, covers many scripts and notations of
#   scholarly publishing. Its subset keeps the Latin scripts (with the
#   extended blocks, for transliterations), the Greek, Coptic, the ancient
#   Greek numbers and musical notation, the combining diacritics, the
#   punctuation and the symbols, and the Cyrillic р and с (U+0440, U+0441),
#   which the dictionary uses by mistake (14 times: probably for a Latin p or
#   c, or a Greek ρ or ϲ; to correct in the data); it drops Cyrillic otherwise,
#   the phonetic extensions,
#   the medievalist Latin blocks, the enclosed alphanumerics and the
#   mathematical alphabets. Brill has no character in the private use area:
#   the dictionary's are drawn by IFAOGrec, for which they were encoded. Only
#   the OpenType features the application uses are kept (the default ones,
#   small capitals, numerals, case forms), not the stylistic sets. Roman:
#   343 KB -> 198 KB. A character dropped here falls back to IFAOGrec, then to
#   the system's serif font: check the dictionary's characters against the
#   subset after a change (cf. `scripts/check-brill-coverage.py`).
#
# The other fonts are served as they are: GFS Didot and GFS Neohellenic are
# light and their names reserved (a modified version would have to be
# renamed), and IFAOGrec is only downloaded for the rare characters that need
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
  subset "$FONTS/Inter_Variable/Inter_Variable-$face" "$INTER" --layout-features='*'
done

BRILL="U+0000-036F,U+0370-03FF,U+0440-0441,U+1DC0-1DFF,U+1E00-1EFF,U+1F00-1FFF,U+2000-20FF,U+2100-218F,U+2190-23FF,U+25A0-27BF,U+2C80-2CFF,U+2E00-2E7F,U+FB00-FB06,U+FEFF,U+FFFD,U+10100-1018F,U+1D200-1D24F"
for face in Roman Italic Bold BoldItalic; do
  subset "$FONTS/Brill/Brill-$face" "$BRILL" --layout-features+=smcp,c2sc,tnum,lnum,case
done
