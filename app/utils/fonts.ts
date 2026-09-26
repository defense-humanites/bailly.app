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
    files: { normal: "/fonts/Brill-Roman.woff2", bold: "/fonts/Brill-Bold.woff2" },
  },
  gentium: {
    label: "Gentium Plus",
    files: { normal: "/fonts/Gentium_Plus/GentiumPlus-Regular.ttf", bold: "/fonts/Gentium_Plus/GentiumPlus-Bold.ttf" },
  },
  didot: {
    label: "GFS Didot",
    files: { normal: "/fonts/GFS_Didot/GFSDidot.otf", bold: "/fonts/GFS_Didot/GFSDidotBold.otf" },
  },
  neohellenic: {
    label: "GFS Neohellenic",
    files: { normal: "/fonts/GFS_NeoHellenic/GFSNeohellenic.otf", bold: "/fonts/GFS_NeoHellenic/GFSNeohellenicBold.otf" },
  },
} as const satisfies Record<string, { label: string; files: Record<ReadingWeight, string> }>;

export type ReadingFont = keyof typeof READING_FONTS;

/**
 * The MIME type of a font file, for its preload link.
 */
export function fontType(file: string): string {
  const extension = file.slice(file.lastIndexOf(".") + 1);
  return { woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf" }[extension] ?? "font/woff2";
}
