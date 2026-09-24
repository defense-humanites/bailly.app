import { reencode } from "@humanities/greek-conversion";
import { Database } from "../Database.ts";
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

export async function getEntry<K extends keyof QueryableFields>({
  q,
  fields,
  siblings: getSiblings
}: ApiEntryParams<K>): Promise<ApiEntryResponse<K>> {
  const db = await Database.getConnection();
  const settings = Settings.getSettings();
  const fieldsStr: string = fields.join(", ");

  // Remove from the query any trailing substring starting with a hash.
  q = q.replace(/#\d?$/, "");

  // The entry can be either a single word or 2+ words ending with a hash and a number.
  const entriesSql = `
    SELECT orderedID, ${!fieldsStr.includes("word") ? `word, ${fieldsStr}` : fieldsStr}
    FROM bailly
    WHERE uri = $q
    OR uri GLOB $qHashNumber
  `;

  const entriesStmt = db.prepare(entriesSql);
  const fetchEntries = (q: string) =>
    <PartialExcept<DatabaseEntry, "orderedID" | "word">[]> (
      entriesStmt.all({ $q: q, $qHashNumber: `${q}#?` })
    );

  // Try the URI as is first, then its normalized form if it matches nothing.
  let data = fetchEntries(q);
  if (!data.length) {
    const normalizedQ = normalizeUri(q);
    if (normalizedQ !== q) data = fetchEntries(normalizedQ);
  }

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
    SELECT orderedID, ${fieldsStr}
    FROM bailly
    WHERE orderedID = $previousID
    OR orderedID = $nextID
  `;

  const nextSiblingID = Array.isArray(entry.children)
    ? entry.orderedID + entry.children.length
    : entry.orderedID + 1;

  const siblingsParams = {
    $previousID: entry.orderedID - 1,
    $nextID: nextSiblingID
  };

  const siblings = <PartialExcept<DatabaseEntry, "orderedID">[]> (
    db.prepare(siblingsSql).all(siblingsParams)
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
        previous: previousEntry as Entry<K>,
        next: nextEntry as Entry<K>
      }
    }
  };
}
