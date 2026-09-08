import { reencode } from "@humanities/greek-conversion";
import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { HTTPException } from "@hono/hono/http-exception";
import { secureHeaders } from "@hono/hono/secure-headers";
import { Database } from "./Database.ts";
import { setParams } from "./helpers.ts";
import { getEntry } from "./model/entry.ts";
import { getEntries } from "./model/lookup.ts";
import { getRandomEntry } from "./model/randomEntry.ts";
import { Morpheus } from "./Morpheus.ts";
import { logger } from "./logger.ts";
import { Settings } from "./Settings.ts";
import type {
  ApiEntryParams,
  ApiLookupParams,
  ApiRandomEntryParams,
  QueryableFields
} from "./definitions.ts";

const settings = Settings.getSettings();

await Database.getConnection();
await Morpheus.getMorpheus();

export const app = new Hono();

app.use(cors());
app.use(logger());
app.use(secureHeaders());

app.get("/", (c) => {
  return c.json("OK");
});

app.get("/entry/random", async (c) => {
  const params = setParams<ApiRandomEntryParams<keyof QueryableFields>>({
    ...c.req.query()
  });

  delete params.q;

  const entry = await getRandomEntry(params);

  return c.json({
    data: {
      $query: params,
      ...entry.data
    }
  });
});

/**
 * Handle malformed URIs smoothly.
 * @param q A query string.
 */
function formatEntryQuery(q: string): string {
  return reencode(q, "transliteration", {
    removeDiacritics: true,
    orthography: {
      longVowels: "circumflex"
    }
  });
}

app.get("/entry/:uri", async (c) => {
  const q = c.req.param("uri");
  const params = setParams<ApiEntryParams<keyof QueryableFields>>({
    ...c.req.query(),
    q
  });
  const entry = await getEntry({ ...params, q: formatEntryQuery(params.q) });

  return c.json({
    data: {
      $query: params,
      ...entry.data
    }
  });
});

// For batch requests.
app.post("/entry", async (c) => {
  const params = setParams<ApiEntryParams<keyof QueryableFields>>(await c.req.json());
  const queries: string[] = params.q.split(",");

  if (queries.length > 1) {
    if (settings.isDevEnv) {
      console.info(
        `%c🚀 Batching ${queries.length.toLocaleString()} queries...`,
        "font-weight:bold;color:mediumPurple"
      );
      console.info(queries);
    }

    if (queries.length > settings.queryMaxBatchSize) {
      throw new HTTPException(400, { message: "Maximum batch size exceeded" });
    }
  }

  const responses = await Promise.all(
    queries.map((query) => getEntry({ ...params, q: formatEntryQuery(query) }))
  );

  return c.json({
    $query: params,
    count: responses.length,
    queries: responses
  });
});

app.get("/lookup/:q", async (c) => {
  const q = c.req.param("q");
  const params = setParams<ApiLookupParams<keyof QueryableFields>>({
    ...c.req.query(),
    q
  });
  const entries = await getEntries(params);

  return c.json({
    data: {
      $query: params,
      ...entries.data
    }
  });
});

// For batch requests.
app.post("/lookup", async (c) => {
  const params = setParams<ApiLookupParams<keyof QueryableFields>>(await c.req.json());
  const queries: string[] = params.q.split(",");

  if (queries.length > 1) {
    if (settings.isDevEnv) {
      console.info(
        `%c🚀 Batching ${queries.length.toLocaleString()} queries...`,
        "font-weight:bold;color:mediumPurple"
      );
      //console.info(queries);
    }

    if (queries.length > settings.queryMaxBatchSize) {
      throw new HTTPException(400, { message: "Maximum batch size exceeded" });
    }
  }

  const responses = await Promise.all(
    queries.map((query) => getEntries({ ...params, q: query }))
  );

  return c.json({
    $query: params ?? {},
    count: responses.length,
    queries: responses
  });
});

Deno.serve({ port: settings.port }, app.fetch);

console.info(
  `%c🐎 The API is running...${settings.isDevEnv ? " %c(🚧 development mode)" : ""}`,
  "font-weight:bold;color:cyan",
  ...(settings.isDevEnv ? ["font-weight:bold;color:yellow"] : [])
);
