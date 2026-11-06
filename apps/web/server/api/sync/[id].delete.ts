import { deleteLocker } from "../../lib/lockers";

/**
 * Deletes the content of a synchronization locker (the other devices then
 * stop synchronizing): 204; 404 if it does not exist (or the token is wrong).
 */
export default defineEventHandler(async (event) => {
  const { id, tokenHash } = await lockerRequest(event);
  const result = await deleteLocker(useLockersDatabase(), id, tokenHash);

  if (result.state === "missing") throw createError({ statusCode: 404 });
  setResponseStatus(event, 204);
  return null;
});
