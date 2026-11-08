import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Dictionary } from "./db/dictionary.ts";
import { logger } from "./logger.ts";
import { getEntry } from "./model/entry.ts";
import { getForm } from "./model/form.ts";
import {
  ExcerptsParamError,
  getExcerpts,
  parseExcerptsUris
} from "./model/excerpts.ts";
import { getEntries } from "./model/lookup.ts";
import { getRandomEntry } from "./model/randomEntry.ts";
import type { Morpheus } from "./Morpheus.ts";
import {
  badRequest,
  batchBody,
  entryParams,
  formParams,
  lookupParams,
  randomEntryParams
} from "./params.ts";
import { Settings } from "./Settings.ts";

/**
 * The `Cache-Control` of the responses that depend only on the request and on the
 * dictionary (lookups, entries, excerpts): a day, then a week served while revalidated.
 * Browsers keep them, and so does the Worker's cache (Workers Cache, cf. `cache` in
 * `wrangler.jsonc`), whose entries also belong to a version of the Worker: a new
 * revision of the dictionary, which comes with a deployment, starts from an empty one.
 */
export const CACHEABLE = "public, max-age=86400, stale-while-revalidate=604800";

/** What the routes need, given by the entry point (Node.js server, Worker, tests). */
export type AppDependencies = {
  dictionary: Dictionary;
  morpheus: Morpheus;
  /**
   * The batch routes (`POST /entry`, `POST /lookup`), used by the data converter
   * against a local server: by default, in development only (`API_ENV`).
   */
  batches?: boolean;
};

/**
 * The HTTP application, independent of the platform: the entry points bind it to a
 * server (`node.ts`) or export it as the Worker's handler (`worker.ts`), with the
 * dictionary and the analyzer of their platform. `Settings.configure()` must have
 * run before the first request.
 */
export function createApp({
  dictionary: db,
  morpheus,
  batches = Settings.getSettings().isDevEnv
}: AppDependencies): Hono {
  const app = new Hono();

  app.use(cors());
  app.use(logger());
  app.use(secureHeaders());

  // Nothing else is kept by a cache: random draws, errors (thrown before a route sets
  // its header), unknown paths. Explicit, since a cache may otherwise give a response
  // without `Cache-Control` a heuristic freshness.
  app.use(async (c, next) => {
    await next();
    if (!c.res.headers.has("Cache-Control")) c.header("Cache-Control", "no-store");
  });

  app.get("/", (c) => {
    return c.json("OK");
  });

  app.get("/entry/random", async (c) => {
    const params = randomEntryParams(c.req.query());
    const entry = await getRandomEntry(db, params);

    return c.json({
      data: {
        $query: params,
        ...entry.data
      }
    });
  });

  app.get("/entry/:uri", async (c) => {
    const params = entryParams(c.req.param("uri"), c.req.query());
    const entry = await getEntry(db, params);

    c.header("Cache-Control", CACHEABLE);

    return c.json({
      data: {
        $query: params,
        ...entry.data
      }
    });
  });

  // Excerpts of a list of entries (e.g. synchronized bookmarks); fixed fields.
  app.get("/entries/excerpts", async (c) => {
    let uris: string[];

    try {
      uris = parseExcerptsUris(c.req.query("uris"));
    } catch (error) {
      if (error instanceof ExcerptsParamError) {
        throw badRequest(error.message);
      }
      throw error;
    }

    const excerpts = await getExcerpts(db, uris);

    c.header("Cache-Control", CACHEABLE);

    return c.json(excerpts);
  });

  // The entries a form may belong to, found by the dictionary's data (cf.
  // `model/form.ts`): the front end's page of a form.
  app.get("/form/:form", async (c) => {
    const params = formParams(c.req.param("form"), c.req.query());
    const form = await getForm(db, morpheus, params);

    c.header("Cache-Control", CACHEABLE);

    return c.json({
      data: {
        $query: params,
        ...form.data
      }
    });
  });

  app.get("/lookup/:q", async (c) => {
    const params = lookupParams(c.req.param("q"), c.req.query());
    const entries = await getEntries(db, morpheus, params);

    c.header("Cache-Control", CACHEABLE);

    return c.json({
      data: {
        $query: params,
        ...entries.data
      }
    });
  });

  // Batches (development only: the data converter, against a local server); a body
  // like a query string (cf. `batchBody()`), `q` a list or a comma-separated string.
  if (batches) {
    const batch = (q: string): string[] => {
      const queries = q.split(",");
      const settings = Settings.getSettings();
      console.info(`🚀 Batching ${queries.length.toLocaleString()} queries...`);
      if (queries.length > settings.queryMaxBatchSize) {
        throw badRequest("Maximum batch size exceeded.");
      }
      return queries;
    };

    app.post("/entry", async (c) => {
      const { q, query } = batchBody(await c.req.json().catch(() => undefined));
      const params = entryParams(q, query);
      const responses = await Promise.all(
        batch(params.q).map((query) => getEntry(db, { ...params, q: query }))
      );

      return c.json({ $query: params, count: responses.length, queries: responses });
    });

    app.post("/lookup", async (c) => {
      const { q, query } = batchBody(await c.req.json().catch(() => undefined));
      const params = lookupParams(q, query);
      const responses = await Promise.all(
        batch(params.q).map((query) => getEntries(db, morpheus, { ...params, q: query }))
      );

      return c.json({ $query: params, count: responses.length, queries: responses });
    });
  }

  return app;
}
