import { readLocker } from "../../lib/lockers";

/**
 * Reads a synchronization locker: `{ version, blob }`; 404 if it does not
 * exist (or the token is wrong); 410 if a device deleted it.
 */
export default defineEventHandler(async (event) => {
  const { id, tokenHash } = await lockerRequest(event);
  const result = await readLocker(useLockersDatabase(), id, tokenHash);

  if (result.state === "missing") throw createError({ statusCode: 404 });
  if (result.state === "deleted") throw createError({ statusCode: 410 });
  return { version: result.version, blob: result.blob };
});
