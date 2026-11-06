/**
 * The narrow no-break space (U+202F), between the groups of three digits.
 */
const NARROW_NO_BREAK_SPACE = " ";

/**
 * Writes an integer the French way: its digits in groups of three from the
 * right, separated by a narrow no-break space (e.g. `1 234`, `12 345`).
 * @remarks Rather than `Intl.NumberFormat`, whose separator depends on the
 * browser's locale data (a no-break space in older ones), and which would
 * render differently on the server.
 * @example formatCount(1234) // "1 234"
 */
export function formatCount(count: number): string {
  return String(Math.trunc(count)).replace(/\B(?=(\d{3})+$)/g, NARROW_NO_BREAK_SPACE);
}
