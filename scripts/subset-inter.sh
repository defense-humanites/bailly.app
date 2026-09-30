#!/bin/sh
#
# Subsets Inter, the interface's font (cf. `app/assets/css/fonts.css`): the
# full font covers Cyrillic, Vietnamese, IPA and hundreds of alternates in the
# private use area, which the application never shows; its subset keeps the
# Latin scripts of Western and Central Europe, the Greek (polytonic included:
# the search bar, the bookmarks), the combining diacritics, the punctuation and
# the usual symbols, with all the OpenType features and the variation axes.
# About a third lighter (Roman: 346 KB -> 237 KB; Italic: 381 KB -> 264 KB).
#
# Inter is under the SIL Open Font License, without reserved font name: its
# subset may keep its name. The other fonts are served as they are: Brill's
# license forbids modifying it, GFS Didot and GFS Neohellenic are light and
# their names reserved (a modified version would have to be renamed), and
# IFAOGrec is only downloaded for the rare characters that need it.
#
# Requires fontTools with Brotli (`pip install fonttools brotli`). Run it again
# after updating the full font (`Inter_Variable-*.woff2`).
set -e
cd "$(dirname "$0")/../app/assets/fonts/Inter_Variable"

UNICODES="U+0000-024F,U+02B0-036F,U+0370-03FF,U+1F00-1FFF,U+2000-206F,U+2070-209F,U+20A0-20CF,U+2100-218F,U+2190-21FF,U+2200-22FF,U+2300-23FF,U+25A0-25FF,U+2713,U+2717,U+FB01-FB02,U+FEFF,U+FFFD"

for face in Roman Italic; do
  pyftsubset "Inter_Variable-$face.woff2" \
    --unicodes="$UNICODES" \
    --layout-features='*' \
    --flavor=woff2 \
    --output-file="Inter_Variable-$face.subset.woff2"
  echo "Inter_Variable-$face.subset.woff2: $(wc -c < "Inter_Variable-$face.subset.woff2") bytes"
done
