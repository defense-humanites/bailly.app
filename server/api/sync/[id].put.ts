import { isValidBlob, MAX_BLOB_LENGTH, purgeLockers, writeLocker } from "../../lib/lockers";

/**
 * Writes a synchronization locker (`{ version, blob }`, `version` being the
 * version read, `0` to create it): `{ version }`, the new version; 412 with
 * the current version if it changed since (the device merges it first); 404
 * if it does not exist (or the token is wrong); 410 if a device deleted it.
 */
export default defineEventHandler(async (event) => {
  const { id, tokenHash } = await lockerRequest(event);

  if (Number(getRequestHeader(event, "content-length") ?? 0) > MAX_BLOB_LENGTH + 1_000) {
    throw createError({ statusCode: 413 });
  }
  const body = await readBody<{ version?: unknown; blob?: unknown } | null>(event);
  const version = body?.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0 || !isValidBlob(body?.blob)) {
    throw createError({ statusCode: 400 });
  }

  const db = useLockersDatabase();
  const result = await writeLocker(db, id, tokenHash, version, body.blob);

  switch (result.state) {
    case "written":
      // Now and then, the idle lockers are purged.
      if (Math.random() < 0.01) await purgeLockers(db);
      return { version: result.version };
    case "conflict":
      throw createError({ statusCode: 412, data: { version: result.version } });
    case "deleted":
      throw createError({ statusCode: 410 });
    case "missing":
      throw createError({ statusCode: 404 });
  }
});
