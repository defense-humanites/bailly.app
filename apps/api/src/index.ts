import { AdditionalChar, KeyType, toTransliteration } from "greek-conversion";
import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { secureHeaders } from "@hono/hono/secure-headers";
import { Database } from "./Database.ts";
import { setParams } from "./helpers.ts";
import { getEntry } from "./model/entry.ts";
import { getEntries } from "./model/lookup.ts";
import { getRandomEntry } from "./model/randomEntry.ts";
import { Morpheus } from "./Morpheus.ts";
import { logger } from "./logger.ts";
import { Settings } from "./Settings.ts";
import {
  type ApiLookupResponse,
  type ApiParams,
  type QueryableFields
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
  const { fields, lengthRange } = c.req.query();
  const params = setParams({ fields, lengthRange });
  const entry = await getRandomEntry(params);
  return c.json(entry);
});

app.get("/entry/:uri", async (c) => {
  const { fields, siblings } = c.req.query();
  const params = setParams({ q: c.req.param("uri"), fields, siblings });

  // Handle malformed URIs smoothly.
  // @fixme: using option `removeDiacritics` removes dashes and
  //         this prevents access to contract verbs for example.
  params.q = toTransliteration(params.q, KeyType.TRANSLITERATION, {
    additionalChars: AdditionalChar.DIGAMMA,
    //removeDiacritics: true,
    transliterationStyle: {
      gammaNasal_n: true,
      useCxOverMacron: true
    }
  });

  const entry = await getEntry(params);
  return c.json(entry);
});

function setLookupParams(
  params: Record<string, unknown>
): ApiParams<keyof QueryableFields> {
  return setParams({
    q: params.q,
    inputMode: params.inputMode,
    fields: params.fields,
    morphology: params.morphology,
    caseSensitive: params.caseSensitive,
    limit: params.limit,
    skipMorpheus: params.skipMorpheus
  });
}

app.get("/lookup/:q", async (c) => {
  const q = c.req.param("q");
  const params = setLookupParams({ ...c.req.query(), q });
  const entries = await getEntries(params);
  return c.json(entries);
});

app.post("/lookup/batch", async (c) => {
  const params = setLookupParams(await c.req.json());
  const queries: string[] = params.q.split(",");
  const responses: ApiLookupResponse<any>[] = await Promise.all(
    queries.map((query) => getEntries({ ...params, q: query }))
  );
  return c.json(responses);
});

Deno.serve({ port: settings.port }, app.fetch);

if (Deno.env.get("DENO_ENV") === "development") {
  console.info(
    "%c🐎 The API is running... %c(🚧 development mode)",
    "font-weight:bold;color:cyan",
    "font-weight:bold;color:yellow"
  );
} else {
  console.info("%c🐎 The API is running...", "font-weight:bold;color:cyan");
}
