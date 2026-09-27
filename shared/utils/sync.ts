/**
 * The largest content of a synchronization locker (encrypted, in base64url),
 * checked by the devices before sending and by the server: well within the
 * 2 MB a D1 row may hold. The bookmarks within the limits of the application
 * weigh about half of it.
 */
export const MAX_LOCKER_BLOB_LENGTH = 1_000_000;
