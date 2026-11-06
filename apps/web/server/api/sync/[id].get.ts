import { readLocker } from "../../lib/lockers";

/**
 * Reads a synchronization locker: `{ version, blob }`; 404 if it does not
 * exist (or the token is wrong); 410 if a device deleted it; 204 if it was
 * emptied (the devices fill it again, with `version: 0`).
 */
export default defineEventHandler(async (event) => {
  const { id, tokenHash } = await lockerRequest(event);
  const result = await readLocker(useLockersDatabase(), id, tokenHash);

  if (result.state === "missing") throw createError({ statusCode: 404 });
  if (result.state === "deleted") throw createError({ statusCode: 410 });
  // Emptied (cf. `purgeLockers`): the devices fill it again.
  if (result.state === "empty") {
    setResponseStatus(event, 204);
    return null;
  }
  return { version: result.version, blob: result.blob };
});
