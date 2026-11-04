import bookBold from "~/assets/fonts/Gentium/BaillyBook-Bold.subset.woff2";
import bookItalic from "~/assets/fonts/Gentium/BaillyBook-Italic.subset.woff2";
import bookMedium from "~/assets/fonts/Gentium/BaillyBook-Medium.subset.woff2";
import bookMediumItalic from "~/assets/fonts/Gentium/BaillyBook-MediumItalic.subset.woff2";
import bookRegular from "~/assets/fonts/Gentium/BaillyBook-Regular.subset.woff2";
import artemisiaBold from "~/assets/fonts/GFS_Artemisia/GFS_Artemisia-Bold.woff2";
import artemisiaBoldItalic from "~/assets/fonts/GFS_Artemisia/GFS_Artemisia-BoldItalic.woff2";
import artemisiaItalic from "~/assets/fonts/GFS_Artemisia/GFS_Artemisia-Italic.woff2";
import artemisiaRoman from "~/assets/fonts/GFS_Artemisia/GFS_Artemisia-Roman.woff2";
import bodoniBold from "~/assets/fonts/GFS_Bodoni/GFS_Bodoni-Bold.woff2";
import bodoniBoldItalic from "~/assets/fonts/GFS_Bodoni/GFS_Bodoni-BoldItalic.woff2";
import bodoniItalic from "~/assets/fonts/GFS_Bodoni/GFS_Bodoni-Italic.woff2";
import bodoniRoman from "~/assets/fonts/GFS_Bodoni/GFS_Bodoni-Roman.woff2";
import didotBold from "~/assets/fonts/GFS_Didot/GFS_Didot-Bold.woff2";
import didotBoldItalic from "~/assets/fonts/GFS_Didot/GFS_Didot-BoldItalic.woff2";
import didotItalic from "~/assets/fonts/GFS_Didot/GFS_Didot-Italic.woff2";
import didotRoman from "~/assets/fonts/GFS_Didot/GFS_Didot-Roman.woff2";
import neohellenicBold from "~/assets/fonts/GFS_NeoHellenic/GFS_NeoHellenic-Bold.woff2";
import neohellenicBoldItalic from "~/assets/fonts/GFS_NeoHellenic/GFS_NeoHellenic-BoldItalic.woff2";
import neohellenicItalic from "~/assets/fonts/GFS_NeoHellenic/GFS_NeoHellenic-Italic.woff2";
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
 * `fonts.css` (the same URLs, versioned by Vite), preloaded (cf. `app.vue`):
 * the face of the entries' text for each weight of the `readingWeight`
 * preference (`text`), its italic (`italic`), and the bold face (`bold`,
 * the headwords, the titles). Bailly Book's text « appuyé » has a face of
 * its own, Medium, between its Regular and its Bold; the others have two
 * weights only, their text « appuyé » in their bold face.
 */
export const READING_FONTS = {
  // A subset of Gentium Book Plus, renamed as its license requires (cf.
  // `scripts/subset-fonts.sh`, the README).
  book: {
    label: "Bailly Book",
    text: { normal: path(bookRegular), bold: path(bookMedium) },
    italic: { normal: path(bookItalic), bold: path(bookMediumItalic) },
    bold: path(bookBold),
  },
  didot: {
    label: "GFS Didot",
    text: { normal: path(didotRoman), bold: path(didotBold) },
    italic: { normal: path(didotItalic), bold: path(didotBoldItalic) },
    bold: path(didotBold),
  },
  artemisia: {
    label: "GFS Artemisia",
    text: { normal: path(artemisiaRoman), bold: path(artemisiaBold) },
    italic: { normal: path(artemisiaItalic), bold: path(artemisiaBoldItalic) },
    bold: path(artemisiaBold),
  },
  bodoni: {
    label: "GFS Bodoni",
    text: { normal: path(bodoniRoman), bold: path(bodoniBold) },
    italic: { normal: path(bodoniItalic), bold: path(bodoniBoldItalic) },
    bold: path(bodoniBold),
  },
  neohellenic: {
    label: "GFS NeoHellenic",
    text: { normal: path(neohellenicRoman), bold: path(neohellenicBold) },
    italic: { normal: path(neohellenicItalic), bold: path(neohellenicBoldItalic) },
    bold: path(neohellenicBold),
  },
} as const satisfies Record<string, { label: string; text: Record<ReadingWeight, string>; italic: Record<ReadingWeight, string>; bold: string }>;

export type ReadingFont = keyof typeof READING_FONTS;

/**
 * The family of the reading font chosen, as `fonts.css` names it: the first
 * of `--font-serif` (the next ones, IFAOGrec…, are its fallbacks, which
 * `document.fonts.load` would fetch too). In the browser only.
 */
export function readingFamily(): string | undefined {
  return getComputedStyle(document.documentElement).getPropertyValue("--font-serif").split(",")[0]?.trim() || undefined;
}

/**
 * The weight of the entries' text (`--reading-font-weight`, cf. `root.css`:
 * 400, or 500 or 700 for the text « appuyé »), for `document.fonts.load`. In
 * the browser only.
 */
export function readingTextWeight(): string {
  return getComputedStyle(document.documentElement).getPropertyValue("--reading-font-weight").trim() || "400";
}
