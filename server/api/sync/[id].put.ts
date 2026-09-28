import { isValidBlob, MAX_BLOB_LENGTH, purgeLockers, SERIES_CREATIONS, writeCharge, writeLocker } from "../../lib/lockers";
import { chargeBudget, secondsUntilTomorrow } from "../../lib/syncBudget";

/**
 * Writes a synchronization locker (`{ version, blob }`, `version` being the
 * version read, `0` to create it or fill it again once emptied): `{ version }`,
 * the new version; 412 with the current version if it changed since (the
 * device merges it first); 404 if it does not exist (or the token is wrong);
 * 410 if a device deleted it; 429 with `data.reason: "daily-budget"` if the
 * address of the client sent too much today, `"server-budget"` if all the
 * addresses together did (cf. `syncBudget.ts`), with `Retry-After`.
 */
export default defineEventHandler(async (event) => {
  const { id, tokenHash } = await lockerRequest(event);

  // Read with a limit, whatever the `Content-Length` says.
  const body = await readBoundedJson(event, MAX_BLOB_LENGTH + 1_000) as { version?: unknown; blob?: unknown } | null;
  const version = body?.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0 || !isValidBlob(body?.blob)) {
    throw createError({ statusCode: 400 });
  }

  const db = useLockersDatabase();
  const { dailyBytes, dailyCreations, dailyGrowth, dailyTotal, dailyTotalEstablished, addressSecret } = useRuntimeConfig(event).sync;
  let series = false;
  if (dailyBytes > 0 || dailyCreations > 0 || dailyGrowth > 0 || dailyTotal > 0 || dailyTotalEstablished > 0) {
    // Counted before the write: a write refused afterwards (e.g. a conflict)
    // still counts, which only matters to a script.
    const charge = await writeCharge(db, id, tokenHash, version, body.blob);
    const limits = {
      bytes: dailyBytes,
      creations: dailyCreations,
      growth: dailyGrowth,
      total: dailyTotal,
      totalEstablished: dailyTotalEstablished,
      secret: addressSecret,
    };
    const budget = await chargeBudget(db, requestAddress(event), charge, limits);
    if (!budget.fits) {
      setResponseHeader(event, "Retry-After", secondsUntilTomorrow());
      throw createError({
        statusCode: 429,
        statusMessage: "Too Many Requests",
        data: { reason: budget.scope === "server" ? "server-budget" : "daily-budget" },
      });
    }
    // Beyond the first lockers created by the address today (cf. `purgeLockers`).
    series = budget.creations > SERIES_CREATIONS;
  }

  const result = await writeLocker(db, id, tokenHash, version, body.blob, Date.now(), { series });

  switch (result.state) {
    case "written":
      // Now and then, the lockers are purged, after the response if the
      // platform allows it (the budgets are, once a day, by `chargeBudget`).
      if (Math.random() < 0.01) {
        const purge = purgeLockers(db).catch((e: unknown) => {
          console.error("Purge of the lockers failed", e);
        });
        if (typeof event.waitUntil === "function") event.waitUntil(purge);
        else await purge;
      }
      return { version: result.version };
    case "conflict":
      throw createError({ statusCode: 412, data: { version: result.version } });
    case "deleted":
      throw createError({ statusCode: 410 });
    case "missing":
      throw createError({ statusCode: 404 });
  }
});
