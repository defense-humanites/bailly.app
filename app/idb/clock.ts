/**
 * A hybrid logical clock (HLC): stamps that follow the wall clock, but never
 * go backwards and always exceed the stamps already observed (e.g. merged
 * from another device), even if the device's clock is behind.
 * @remarks A stamp is a string whose lexicographic order is its temporal
 * order: the time in milliseconds (13 digits), a counter (4 base-36 digits)
 * for stamps within the same millisecond, and the id of the device that
 * issued it, which breaks the remaining ties.
 */
export type Stamp = string;

const STAMP_PATTERN = /^(\d{13})-([0-9a-z]{4})-([0-9a-z]+)$/;

type ParsedStamp = { time: number; counter: number; node: string };

/**
 * The greatest counter of a stamp (`zzzz`).
 */
const MAX_COUNTER = 36 ** 4 - 1;

export function formatStamp({ time, counter, node }: ParsedStamp): Stamp {
  return `${String(time).padStart(13, "0")}-${counter.toString(36).padStart(4, "0")}-${node}`;
}

/**
 * Parses a stamp.
 * @returns The stamp's parts, or `null` if it is invalid.
 */
export function parseStamp(stamp: unknown): ParsedStamp | null {
  if (typeof stamp !== "string") return null;
  const match = STAMP_PATTERN.exec(stamp);
  if (!match) return null;
  return { time: Number(match[1]), counter: parseInt(match[2]!, 36), node: match[3]! };
}

export function isStamp(value: unknown): value is Stamp {
  return parseStamp(value) !== null;
}

/**
 * Issues a new stamp, later than `last` (the latest stamp issued or observed
 * on this device).
 * @param last The latest stamp, if any.
 * @param node The id of this device.
 * @param now The current time (defaults to the wall clock).
 */
export function nextStamp(last: Stamp | undefined, node: string, now: number = Date.now()): Stamp {
  const previous = parseStamp(last);
  if (!previous || now > previous.time) return formatStamp({ time: now, counter: 0, node });
  // The counter full (4 digits): the next millisecond, so that the stamp
  // stays valid (e.g. after a stamp observed with the greatest counter).
  if (previous.counter >= MAX_COUNTER) return formatStamp({ time: previous.time + 1, counter: 0, node });
  return formatStamp({ time: previous.time, counter: previous.counter + 1, node });
}

/**
 * The latest of stamps (`undefined` if there are none).
 */
export function maxStamp(...stamps: (Stamp | undefined)[]): Stamp | undefined {
  let max: Stamp | undefined;
  for (const stamp of stamps) {
    if (stamp !== undefined && (max === undefined || stamp > max)) max = stamp;
  }
  return max;
}

/**
 * The time (in milliseconds) of a stamp, or `NaN` if it is invalid.
 */
export function stampTime(stamp: Stamp): number {
  return parseStamp(stamp)?.time ?? Number.NaN;
}
