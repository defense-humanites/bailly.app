/**
 * The largest content of a synchronization locker (encrypted, in base64url),
 * checked by the devices before sending and by the server. The bookmarks at
 * the limits of the application weigh about 140 KB (measured with real
 * entries and French names and descriptions at their longest; 150 KB with
 * 500 recent tombstones; the older tombstones are left out first beyond the
 * limit, cf. `lockerBlob`): room is left for the tombstones, and little for
 * an abuse (cf. `audit-abus-casiers.md`).
 */
export const MAX_LOCKER_BLOB_LENGTH = 300_000;
