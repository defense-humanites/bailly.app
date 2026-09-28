/**
 * The largest content of a synchronization locker (encrypted, in base64url),
 * checked by the devices before sending and by the server. The bookmarks at
 * the limits of the application weigh about 210 KB (measured with poorly
 * compressible names): room is left for the tombstones, and little for an
 * abuse (cf. `audit-abus-casiers.md`).
 */
export const MAX_LOCKER_BLOB_LENGTH = 500_000;
