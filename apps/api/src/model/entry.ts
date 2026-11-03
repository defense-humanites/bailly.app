import { reencode } from "@humanities/greek-conversion";
import type { Dictionary } from "../db/dictionary.ts";
import type {
  ApiEntryParams,
  ApiEntryResponse,
  DatabaseEntry,
  Entry,
  PartialExcept,
  QueryableFields
} from "../definitions.ts";
import { Settings } from "../Settings.ts";

/**
 * Normalize a malformed URI (e.g. "hódos" or "hēmera" for "hodos" and "hêmera").
 * @param q A query string.
 */
function normalizeUri(q: string): string {
  return reencode(q, "transliteration", {
    removeDiacritics: true,
    orthography: {
      longVowels: "circumflex"
    }
  });
}

/**
 * @param siblingsFields The fields of the siblings (with `siblings`), `fields` by
 *   default. A page usually needs the whole entry, but only a preview of its
 *   siblings (e.g. `word`, `uri` and `excerpt`, without `htmlDefinition`).
 */
export async function getEntry<
  K extends keyof QueryableFields,
  S extends keyof QueryableFields = K
>(
  db: Dictionary,
  {
    q,
    fields,
    siblings: getSiblings,
    siblingsFields
  }: ApiEntryParams<K, S>
): Promise<ApiEntryResponse<K, S>> {
  const settings = Settings.getSettings();
  const fieldsStr: string = fields.join(", ");

  // Remove from the query any trailing substring starting with a hash.
  q = q.replace(/#\d?$/, "");

  // The entry can be either a single word or 2+ words ending with a hash and a number.
  const entriesSql = `
    SELECT orderedID, ${!fieldsStr.includes("word") ? `word, ${fieldsStr}` : fieldsStr}
    FROM bailly
    WHERE uri = ?1
    OR uri GLOB ?2
  `;

  // The URI as is first, then its normalized form if it matches nothing: both in
  // one batch (one round trip on D1), the second read being a few rows at most.
  const normalizedQ = normalizeUri(q);
  const [asIs, normalized = []] = await db.batch<
    PartialExcept<DatabaseEntry, "orderedID" | "word">
  >(
    [q, ...(normalizedQ !== q ? [normalizedQ] : [])].map((uri) => ({
      sql: entriesSql,
      params: [uri, `${uri}#?`]
    }))
  );
  const data = asIs!.length ? asIs! : normalized;

  if (!data.length) {
    return {
      data: {
        version: settings.dbVersion,
        entry: {} as Entry<K>,
        siblings: {}
      }
    };
  }

  let entry: PartialExcept<
    Entry<"orderedID" | "word">,
    "orderedID" | "word" | "children"
  >;
  if (data.length > 1) {
    // Create a common entry and place the actual entries as children.
    entry = { ...data[0] };

    fields.forEach((field) => (entry[field] = ""));

    entry.orderedID = data[0].orderedID;
    entry.word = data[0].word;
    entry.uri = data[0].uri?.replace(/#\d$/, "");
    entry.children = data;
  } else {
    entry = data[0] ?? {};
  }

  if (!getSiblings || !entry.orderedID) {
    const narrowedEntry = (({ orderedID, ...props }) => {
      return {
        ...props,
        children: entry.children?.map((child) =>
          (({ orderedID, ...props }) => props)(child)
        )
      };
    })(entry);

    return {
      data: {
        version: settings.dbVersion,
        entry: narrowedEntry as Entry<K>,
        siblings: {}
      }
    };
  }

  const siblingsSql = `
    SELECT orderedID, ${(siblingsFields ?? fields).join(", ")}
    FROM bailly
    WHERE orderedID = ?1
    OR orderedID = ?2
  `;

  const nextSiblingID = Array.isArray(entry.children)
    ? entry.orderedID + entry.children.length
    : entry.orderedID + 1;

  const siblings = await db.all<PartialExcept<DatabaseEntry, "orderedID">>(
    siblingsSql,
    [entry.orderedID - 1, nextSiblingID]
  );

  let previousEntry: Partial<Entry> = {};
  let nextEntry: Partial<Entry> = {};

  if (siblings.length === 1) {
    switch (siblings[0].orderedID) {
      case entry.orderedID - 1:
        previousEntry = siblings[0];
        break;
      case nextSiblingID:
        nextEntry = siblings[0];
        break;
    }
  } else {
    previousEntry = siblings[0];
    nextEntry = siblings[1];
  }

  for (const entry of [previousEntry, nextEntry]) {
    entry.uri = entry.uri?.replace(/#\d$/, "");
    delete entry.orderedID;
  }

  const narrowedEntry = (({ orderedID, ...props }) => {
    return {
      ...props,
      children: entry.children?.map((child) =>
        (({ orderedID, ...props }) => props)(child)
      )
    };
  })(entry);

  return {
    data: {
      version: settings.dbVersion,
      entry: narrowedEntry as Entry<K>,
      siblings: {
        previous: previousEntry as Entry<S>,
        next: nextEntry as Entry<S>
      }
    }
  };
}
