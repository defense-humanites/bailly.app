#!/bin/sh
#
# Subsets the font downloaded by every visit (cf. `app/assets/css/fonts.css`),
# served as `*.subset.woff2`; the full fonts are kept next to them, as the
# sources of this script.
#
# - Inter, the interface's font, covers Cyrillic, Vietnamese, IPA and hundreds
#   of alternates in the private use area, which the application never shows.
#   Its subset keeps the Latin scripts of Western and Central Europe, the Greek
#   (polytonic included: the search bar, the bookmarks), the combining
#   diacritics, the punctuation and the usual symbols, with all its OpenType
#   features and its variation axes. Roman: 346 KB -> 237 KB.
#
# The reading fonts are served as they are: GFS Didot and GFS Neohellenic are
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
