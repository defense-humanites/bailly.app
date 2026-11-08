/**
 * The schemas that read the parameters of the API's requests (query strings, and
 * the bodies of the batches): they turn the strings of the wire into the values of
 * the contract's parameter types (`EntryParams`, `LookupParams`…), and reject what
 * is malformed. A separate entry point (`@bailly/api-types/params`), so that the
 * front end, which imports only types, never bundles Zod.
 *
 * Rules (decided on 8 November 2026): a malformed value is an error (400), never
 * replaced by a default; booleans are `true`, `false`, `1`, `0`, or an empty value
 * (`?morphology`, true); unknown parameters are ignored. What depends on the API's
 * settings (fields allowed, row limit, batch size) is checked by the API itself.
 *
 * Zod Mini (`zod/mini`): its functional API keeps the Worker's cold starts short.
 */

import * as z from "zod/mini";
import {
  ENTRY_FIELDS,
  INPUT_MODES,
  type EntryField,
  type EntryParams,
  type FormParams,
  type LookupParams,
  type RandomEntryParams
} from "./index.ts";

/** A boolean: `true`, `false`, `1`, `0`, or an empty value (true). */
const booleanParam = z.pipe(
  z.enum(["true", "false", "1", "0", ""], {
    error: "Expected true, false, 1, 0 or nothing."
  }),
  z.transform((value) => value !== "false" && value !== "0")
);

/** A comma-separated list of entry fields (spaces ignored), at least one. */
const fieldsParam = z.pipe(
  z.pipe(
    z.string(),
    z.transform((value) => value.replace(/\s/g, "").split(","))
  ),
  z.array(
    z.enum(ENTRY_FIELDS, { error: `Expected fields among ${ENTRY_FIELDS.join(", ")}.` })
  )
);

/** A positive integer. */
const positiveIntegerParam = z.pipe(
  z.string().check(z.regex(/^[1-9]\d*$/, { error: "Expected a positive integer." })),
  z.transform(Number)
);

/** One or two non-negative integers, comma-separated, as an ascending range. */
const rangeParam = z.pipe(
  z.string().check(
    z.regex(/^\d+(,\d+)?$/, { error: "Expected one or two integers, comma-separated." })
  ),
  z.transform((value) => {
    const [min, max] = value.split(",").map(Number).sort((a, b) => a - b) as [
      number,
      number?
    ];
    return max === undefined ? ([min] as [number, number?]) : ([min, max] as [number, number?]);
  })
);

/** `GET /entry/:uri` (the URI is in the path). */
export const entryQuery = z.object({
  fields: z.optional(fieldsParam),
  siblings: z.optional(booleanParam),
  siblingsFields: z.optional(fieldsParam)
});

/** `GET /entry/random`. */
export const randomEntryQuery = z.object({
  fields: z.optional(fieldsParam),
  lengthRange: z.optional(rangeParam),
  siblings: z.optional(booleanParam),
  siblingsFields: z.optional(fieldsParam)
});

/** `GET /form/:form` (the form is in the path). */
export const formQuery = z.object({
  fields: z.optional(fieldsParam)
});

/** `GET /lookup/:q` (the query is in the path). */
export const lookupQuery = z.object({
  fields: z.optional(fieldsParam),
  inputMode: z.optional(
    z.enum(INPUT_MODES, { error: `Expected an input mode among ${INPUT_MODES.join(", ")}.` })
  ),
  morphology: z.optional(booleanParam),
  caseSensitive: z.optional(booleanParam),
  diacriticSensitive: z.optional(booleanParam),
  limit: z.optional(positiveIntegerParam),
  skipMorpheus: z.optional(booleanParam)
});

/** The parameters of the contract, as the schemas read them. */
export type EntryQuery = z.output<typeof entryQuery>;
export type RandomEntryQuery = z.output<typeof randomEntryQuery>;
export type FormQuery = z.output<typeof formQuery>;
export type LookupQuery = z.output<typeof lookupQuery>;

/*
 * What the front end sends (the contract's parameter types) must be what the
 * schemas read: checked at compile time, both ways but for `fields`, which the
 * contract requires and the API defaults.
 */
type Fits<A, B> = [A] extends [B] ? true : false;
type Reads<P, Q> = Fits<Omit<P, "fields"> & { fields?: EntryField[] }, Q> & Fits<Q, Omit<P, "fields"> & { fields?: EntryField[] }>;
const checks: [
  Reads<EntryParams<EntryField>, EntryQuery>,
  Reads<RandomEntryParams<EntryField>, RandomEntryQuery>,
  Reads<FormParams<EntryField>, FormQuery>,
  Reads<LookupParams<EntryField>, LookupQuery>
] = [true, true, true, true];
void checks;
