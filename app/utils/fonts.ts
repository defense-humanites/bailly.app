import type { ReadingWeight } from "~/utils/preferences";

/**
 * The fonts that can be chosen to read the entries (cf. the `readingFont`
 * preference). They replace the serif font across the application (`--font-serif`,
 * cf. `root.css` and `fonts.css`), IFAOGrec remaining the fallback for the
 * rare Greek characters and the private use area.
 */
export const READING_FONTS = {
  brill: {
    label: "Brill",
    files: { normal: "/fonts/Brill/Brill-Roman.woff2", bold: "/fonts/Brill/Brill-Bold.woff2" },
  },
  didot: {
    label: "GFS Didot",
    files: { normal: "/fonts/GFS_Didot/GFS_Didot-Roman.woff2", bold: "/fonts/GFS_Didot/GFS_Didot-Bold.woff2" },
  },
  neohellenic: {
    label: "GFS Neohellenic",
    files: { normal: "/fonts/GFS_NeoHellenic/GFS_NeoHellenic-Roman.woff2", bold: "/fonts/GFS_NeoHellenic/GFS_NeoHellenic-Bold.woff2" },
  },
} as const satisfies Record<string, { label: string; files: Record<ReadingWeight, string> }>;

export type ReadingFont = keyof typeof READING_FONTS;
