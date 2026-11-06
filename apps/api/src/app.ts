import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { Dictionary } from "./db/dictionary.ts";
import { setParams } from "./helpers.ts";
import { logger } from "./logger.ts";
import { getEntry } from "./model/entry.ts";
import {
  ExcerptsParamError,
  getExcerpts,
  parseExcerptsUris
} from "./model/excerpts.ts";
import { getEntries } from "./model/lookup.ts";
import { getRandomEntry } from "./model/randomEntry.ts";
import type { Morpheus } from "./Morpheus.ts";
import { Settings } from "./Settings.ts";
import type {
  ApiEntryParams,
  ApiLookupParams,
  ApiRandomEntryParams,
  QueryableFields
} from "./definitions.ts";

/** What the routes need, given by the entry point (Node.js server, Worker, tests). */
export type AppDependencies = {
  dictionary: Dictionary;
  morpheus: Morpheus;
};

/**
 * The HTTP application, independent of the platform: the entry points bind it to a
 * server (`node.ts`) or export it as the Worker's handler (`worker.ts`), with the
 * dictionary and the analyzer of their platform. `Settings.configure()` must have
 * run before the first request.
 */
export function createApp({ dictionary: db, morpheus }: AppDependencies): Hono {
  const app = new Hono();

  app.use(cors());
  app.use(logger());
  app.use(secureHeaders());

  app.get("/", (c) => {
    return c.json("OK");
  });

  app.get("/entry/random", async (c) => {
    // `setParams()` always sets `q`, which is irrelevant here.
    const params = setParams<
      ApiRandomEntryParams<keyof QueryableFields> & { q?: string }
    >({
      ...c.req.query()
    });

    delete params.q;

    const entry = await getRandomEntry(db, params);

    return c.json({
      data: {
        $query: params,
        ...entry.data
      }
    });
  });

  app.get("/entry/:uri", async (c) => {
    const q = c.req.param("uri");
    const params = setParams<ApiEntryParams<keyof QueryableFields>>({
      ...c.req.query(),
      q
    });
    const entry = await getEntry(db, params);

    return c.json({
      data: {
        $query: params,
        ...entry.data
      }
    });
  });

  // For batch requests.
  app.post("/entry", async (c) => {
    const settings = Settings.getSettings();
    const params = setParams<ApiEntryParams<keyof QueryableFields>>(
      await c.req.json()
    );
    const queries: string[] = params.q.split(",");

    if (queries.length > 1) {
      if (settings.isDevEnv) {
        console.info(`🚀 Batching ${queries.length.toLocaleString()} queries...`);
        console.info(queries);
      }

      if (queries.length > settings.queryMaxBatchSize) {
        throw new HTTPException(400, { message: "Maximum batch size exceeded" });
      }
    }

    const responses = await Promise.all(
      queries.map((query) => getEntry(db, { ...params, q: query }))
    );

    return c.json({
      $query: params,
      count: responses.length,
      queries: responses
    });
  });

  // Excerpts of a list of entries (e.g. synchronized bookmarks); fixed fields.
  app.get("/entries/excerpts", async (c) => {
    let uris: string[];

    try {
      uris = parseExcerptsUris(c.req.query("uris"));
    } catch (error) {
      if (error instanceof ExcerptsParamError) {
        throw new HTTPException(400, { message: error.message });
      }
      throw error;
    }

    const excerpts = await getExcerpts(db, uris);

    // The dictionary rarely changes: the same batch can be served by a cache.
    c.header("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");

    return c.json(excerpts);
  });

  app.get("/lookup/:q", async (c) => {
    const q = c.req.param("q");
    const params = setParams<ApiLookupParams<keyof QueryableFields>>({
      ...c.req.query(),
      q
    });
    const entries = await getEntries(db, morpheus, params);

    return c.json({
      data: {
        $query: params,
        ...entries.data
      }
    });
  });

  // For batch requests.
  app.post("/lookup", async (c) => {
    const settings = Settings.getSettings();
    const params = setParams<ApiLookupParams<keyof QueryableFields>>(
      await c.req.json()
    );
    const queries: string[] = params.q.split(",");

    if (queries.length > 1) {
      if (settings.isDevEnv) {
        console.info(`🚀 Batching ${queries.length.toLocaleString()} queries...`);
      }

      if (queries.length > settings.queryMaxBatchSize) {
        throw new HTTPException(400, { message: "Maximum batch size exceeded" });
      }
    }

    const responses = await Promise.all(
      queries.map((query) => getEntries(db, morpheus, { ...params, q: query }))
    );

    return c.json({
      $query: params ?? {},
      count: responses.length,
      queries: responses
    });
  });

  return app;
}
