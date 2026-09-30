import type { ReadingSize } from "~/utils/preferences";

/**
 * The text sizes of the reading sizes, in px (cf. `--reading-font-size`).
 */
const READING_SIZE_PX: Record<ReadingSize, number> = { small: 14, normal: 15.5, large: 17, larger: 18.5 };

/**
 * About a desktop screen of definition at the normal size (measured: 681
 * characters take 392 px at the normal size, in the reading width). The area of the
 * text grows with the square of its size.
 */
const LONG_DEFINITION_LENGTH = 1200;

/**
 * The length of a definition's text (its HTML without its tags).
 */
export function definitionLength(html: string): number {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().length;
}

/**
 * Whether a definition is long: taller than about a desktop screen, at the
 * chosen reading size. Known by the server (no measure in the browser).
 */
export function isLongDefinition(length: number, readingSize: ReadingSize): boolean {
  return length > LONG_DEFINITION_LENGTH * (READING_SIZE_PX.normal / READING_SIZE_PX[readingSize]) ** 2;
}
