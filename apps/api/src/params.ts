/**
 * Reading the parameters of the requests: the contract's schemas
 * (`@bailly/api-types/params`) turn the query strings into values and reject what
 * is malformed; this module adds what depends on the API's settings (the fields
 * allowed and their defaults, the row limit), and gives the models their
 * parameters (`ApiParams`). Every refusal is a 400 with a JSON body:
 *
 *   { "error": { "message": "Invalid parameters.", "issues": [{ "path": "limit", "message": "…" }] } }
 */

import {
  entryQuery,
  lookupQuery,
  randomEntryQuery
} from "@bailly/api-types/params";
import { HTTPException } from "hono/http-exception";
import type * as z from "zod/mini";
import type {
  ApiEntryParams,
  ApiLookupParams,
  ApiRandomEntryParams,
  GreekConversionFormatKey,
  NonEmptyArray,
  QueryableFields
} from "./definitions.ts";
import { Settings } from "./Settings.ts";

type Field = keyof QueryableFields;
type Fields = NonEmptyArray<Field>;

export type ApiIssue = { path: string; message: string };

/** A 400 response with a JSON body (cf. above). */
export function badRequest(message: string, issues?: ApiIssue[]): HTTPException {
  return new HTTPException(400, {
    message,
    res: Response.json({ error: { message, ...(issues && { issues }) } }, { status: 400 })
  });
}

/** Reads `query` with `schema`, or throws a 400 listing the problems. */
function read<S extends z.ZodMiniType>(schema: S, query: Record<string, unknown>): z.output<S> {
  const result = schema.safeParse(query);
  if (result.success) return result.data;
  throw badRequest(
    "Invalid parameters.",
    result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  );
}

/** The requested fields (allowed by the settings), or the default ones. */
function fields(requested: Field[] | undefined, name = "fields"): Fields {
  const settings = Settings.getSettings();
  if (!requested) return settings.queryDefaultFields as Fields;
  if (!requested.length || !settings.checkFields(requested)) {
    throw badRequest("Invalid parameters.", [
      { path: name, message: `Expected fields among ${settings.queryAllowedFields.join(", ")}.` }
    ]);
  }
  return requested as Fields;
}

/** The row limit, within the settings' maximum. */
function limit(requested: number | undefined): number | undefined {
  const max = Settings.getSettings().queryMaxRows;
  if (requested !== undefined && requested > max) {
    throw badRequest("Invalid parameters.", [
      { path: "limit", message: `Expected at most ${max}.` }
    ]);
  }
  return requested;
}

/** The input modes of the contract, as greek-conversion names them. */
const INPUT_FORMATS: Record<string, GreekConversionFormatKey> = {
  greek: "greek",
  betacode: "beta-code",
  transliteration: "transliteration"
};

/**
 * The query of a path (an entry's URI, a lookup): decoded if it still is encoded,
 * each comma-separated part trimmed, Unicode-normalized (NFC).
 */
export function readQueryParam(param: unknown): string {
  if (Array.isArray(param)) {
    return param.map((query) => String(query).trim()).join(",").normalize();
  }
  let decoded = String(param ?? "");
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Left as it is (a literal `%`).
  }
  return decoded.split(",").map((query) => query.trim()).join(",").normalize();
}

/** `GET /entry/:uri`, and the body of `POST /entry`. */
export function entryParams(q: unknown, query: Record<string, unknown>): ApiEntryParams<Field> {
  const params = read(entryQuery, query);
  return {
    q: readQueryParam(q),
    fields: fields(params.fields),
    siblings: params.siblings ?? false,
    ...(params.siblingsFields && {
      siblingsFields: fields(params.siblingsFields, "siblingsFields")
    })
  };
}

/** `GET /entry/random`. */
export function randomEntryParams(query: Record<string, unknown>): ApiRandomEntryParams<Field> {
  const params = read(randomEntryQuery, query);
  return {
    fields: fields(params.fields),
    lengthRange: params.lengthRange ?? null,
    siblings: params.siblings ?? false,
    ...(params.siblingsFields && {
      siblingsFields: fields(params.siblingsFields, "siblingsFields")
    })
  };
}

/** `GET /lookup/:q`, and the body of `POST /lookup`. */
export function lookupParams(q: unknown, query: Record<string, unknown>): ApiLookupParams<Field> {
  const params = read(lookupQuery, query);
  return {
    q: readQueryParam(q),
    inputMode: INPUT_FORMATS[params.inputMode ?? "greek"]!,
    fields: fields(params.fields),
    morphology: params.morphology ?? false,
    caseSensitive: params.caseSensitive ?? false,
    diacriticSensitive: params.diacriticSensitive ?? false,
    limit: limit(params.limit),
    skipMorpheus: params.skipMorpheus ?? false
  };
}

/**
 * The body of a batch (`POST /entry`, `POST /lookup`, development only), read as a
 * query string: lists joined by commas, other values as strings (JSON booleans and
 * numbers included); `q` apart (a list of queries, or one comma-separated string).
 */
export function batchBody(body: unknown): { q: unknown; query: Record<string, string> } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw badRequest("Expected a JSON object.");
  }
  const { q, ...rest } = body as Record<string, unknown>;
  const query = Object.fromEntries(
    Object.entries(rest)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, Array.isArray(value) ? value.join(",") : String(value)])
  );
  return { q, query };
}
