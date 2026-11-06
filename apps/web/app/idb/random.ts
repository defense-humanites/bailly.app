/**
 * Random identifiers.
 * @remarks `crypto.getRandomValues` rather than `crypto.randomUUID`, which
 * browsers only expose in secure contexts (not on a local network address
 * over HTTP, e.g. when testing on a phone).
 */
const hex = (bytes: Uint8Array): string =>
  Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");

/**
 * A random (version 4) UUID.
 */
export function randomUuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const h = hex(bytes);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * A short random id (8 hexadecimal characters), e.g. to identify a device.
 */
export function randomNodeId(): string {
  return hex(crypto.getRandomValues(new Uint8Array(4)));
}
