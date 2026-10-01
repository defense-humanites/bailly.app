import bookBold from "~/assets/fonts/Gentium_Book_Plus/BaillyBook-Bold.subset.woff2";
import bookRoman from "~/assets/fonts/Gentium_Book_Plus/BaillyBook-Roman.subset.woff2";
import artemisiaBold from "~/assets/fonts/GFS_Artemisia/GFS_Artemisia-Bold.woff2";
import artemisiaRoman from "~/assets/fonts/GFS_Artemisia/GFS_Artemisia-Roman.woff2";
import bodoniBold from "~/assets/fonts/GFS_Bodoni/GFS_Bodoni-Bold.woff2";
import bodoniRoman from "~/assets/fonts/GFS_Bodoni/GFS_Bodoni-Roman.woff2";
import didotBold from "~/assets/fonts/GFS_Didot/GFS_Didot-Bold.woff2";
import didotRoman from "~/assets/fonts/GFS_Didot/GFS_Didot-Roman.woff2";
import neohellenicBold from "~/assets/fonts/GFS_NeoHellenic/GFS_NeoHellenic-Bold.woff2";
import neohellenicRoman from "~/assets/fonts/GFS_NeoHellenic/GFS_NeoHellenic-Roman.woff2";
import type { ReadingWeight } from "~/utils/preferences";

/**
 * The path of an imported font file: Vite gives it as a path on the server
 * (`/_nuxt/…`) but as a full URL in the browser, and the preload link of the
 * page (cf. `app.vue`) must stay the same once hydrated, or it would be
 * duplicated.
 */
function path(url: string): string {
  return new URL(url, "http://localhost").pathname;
}

/**
 * The fonts that can be chosen to read the entries (cf. the `readingFont`
 * preference). They replace the serif font across the application (`--font-serif`,
 * cf. `root.css` and `fonts.css`), IFAOGrec remaining the fallback for the
 * rare Greek characters and the private use area. Their files are those of
 * `fonts.css` (the same URLs, versioned by Vite), preloaded (cf. `app.vue`).
 */
export const READING_FONTS = {
  // A subset of Gentium Book Plus, renamed as its license requires (cf.
  // `scripts/subset-fonts.sh`, the README).
  book: {
    label: "Bailly Book",
    files: { normal: path(bookRoman), bold: path(bookBold) },
  },
  didot: {
    label: "GFS Didot",
    files: { normal: path(didotRoman), bold: path(didotBold) },
  },
  artemisia: {
    label: "GFS Artemisia",
    files: { normal: path(artemisiaRoman), bold: path(artemisiaBold) },
  },
  bodoni: {
    label: "GFS Bodoni",
    files: { normal: path(bodoniRoman), bold: path(bodoniBold) },
  },
  neohellenic: {
    label: "GFS NeoHellenic",
    files: { normal: path(neohellenicRoman), bold: path(neohellenicBold) },
  },
} as const satisfies Record<string, { label: string; files: Record<ReadingWeight, string> }>;

export type ReadingFont = keyof typeof READING_FONTS;
