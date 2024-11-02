import { AdditionalChar, KeyType, toTransliteration } from "greek-conversion";
import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { logger } from "@hono/hono/logger";
import { secureHeaders } from "@hono/hono/secure-headers";
import { Database } from "./Database.ts";
import { setParams } from "./helpers.ts";
import { getEntry } from "./model/entry.ts";
import { getEntries } from "./model/lookup.ts";
import { getRandomEntry } from "./model/randomEntry.ts";
import { Morpheus } from "./Morpheus.ts";
import { Settings } from "./Settings.ts";

if (Deno.env.get("NODE_ENV") === "development") {
  console.warn("⚠️ The development mode is active.");
}

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

app.get("/lookup/:q", async (c) => {
  const q = c.req.param("q");
  const { inputMode, fields, morphology, caseSensitive, limit, skipMorpheus } =
    c.req.query();
  const params = setParams({
    q,
    inputMode,
    fields,
    morphology,
    caseSensitive,
    limit,
    skipMorpheus
  });
  const entries = await getEntries(params);
  return c.json(entries);
});

Deno.serve({ port: settings.port }, app.fetch);

console.info("🐎 The API is running.");
