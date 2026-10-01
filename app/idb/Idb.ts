import { openDB, type DBSchema, type IDBPDatabase, type IDBPObjectStore, type IDBPTransaction, type StoreNames } from "idb";
import type { Entry, EntryData } from "#shared/types/api";
import type { PartialExcept } from "~/types";
import { maxStamp, nextStamp, type Stamp } from "./clock";
import type { StarredRecord, TaggedRecord, TagKey, TagOrder, TagRecord } from "./merge";
import type { PreferenceRecord } from "./preferenceRecords";
import { randomNodeId, randomUuid } from "./random";
import { IdbTags, type TagColorKey } from "./IdbTags";

/**
 * An error whose message is meant for the user (invalid data, limits…).
 */
export class IdbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdbError";
  }
}

export type IdbSuccess<T> = { state: "success"; data: T };
export type IdbFailure = { state: "error"; message: string };
/**
 * The result of an `Idb` operation that may fail for an expected reason,
 * which `message` explains to the user.
 */
export type IdbResult<T = undefined> = IdbSuccess<T> | IdbFailure;

/**
 * Runs an operation and turns its outcome into an `IdbResult`.
 * @remarks `IdbError` messages are meant for the user; other errors (e.g. a
 * failing browser storage) are logged and replaced by a generic message.
 */
export async function attempt<T>(operation: () => Promise<T>): Promise<IdbResult<T>> {
  try {
    return { state: "success", data: await operation() };
  } catch (error: unknown) {
    if (error instanceof IdbError) return { state: "error", message: error.message };

    console.error(error);
    return {
      state: "error",
      message: "Une erreur est survenue lors de l'accès aux données enregistrées dans le navigateur.",
    };
  }
}

/**
 * A flat entry with selected fields.
 */
export type IdbEntry = Pick<EntryData, "word" | "uri" | "excerpt">;
/**
 * A given entry with selected fields that may have children.
 */
export type IdbEntryCreation = Entry<"word" | "uri" | "excerpt">;
/**
 * An `IdbEntry` with the key of its associated tag.
 */
export type IdbTagged = IdbEntry & { tagKey: TagKey };
/**
 * A tag used to identify collections of entries.
 */
export type IdbTag = {
  name: string;
  description: string;
  color: TagColorKey;
};
/**
 * A given tag containing at least a name.
 */
export type IdbTagCreation = PartialExcept<IdbTag, "name">;
/**
 * An `IdbTag` with its key.
 */
export type IdbTagWithKey = IdbTag & {
  key: TagKey;
  createdAt: Stamp;
  /**
   * The key of the tag before the migration to UUIDs (cf. `TagRecord`).
   */
  legacyKey?: number;
};

export enum IdbStore {
  History = "history",
  Starred = "starred",
  Tagged = "tagged",
  Tags = "tags",
  Meta = "meta",
  Excerpts = "excerpts",
}

/**
 * The excerpt of a bookmarked entry, kept on this device (`IdbStore.Excerpts`).
 * @remarks Not part of the bookmarks as merged and synchronized (cf.
 * `merge.ts`): added with a bookmark on this device, or fetched from the API
 * for a bookmark received without it; forgotten once no bookmark refers to
 * the entry (cf. `IdbBookmarks.compact`).
 */
export type IdbExcerpt = {
  uri: string;
  excerpt: string;
};

/**
 * The keys of the `meta` store.
 */
export enum IdbMetaKey {
  /**
   * The latest stamp issued or observed on this device (cf. `clock.ts`).
   */
  Clock = "clock",
  /**
   * The id of this device, in the stamps it issues.
   */
  Node = "node",
  /**
   * The order of the tags (`TagOrder`).
   */
  TagOrder = "tagOrder",
  /**
   * The synchronization settings (`IdbSyncConfig`), if enabled.
   */
  Sync = "sync",
  /**
   * The records of the synchronizable preferences set on this device, with
   * the stamps of their changes (cf. `IdbPreferences`); their values are
   * applied from the preferences cookie.
   */
  Preferences = "preferences",
}

/**
 * The synchronization settings of this device.
 */
export type IdbSyncConfig = {
  /**
   * The synchronization key (16 bytes, base64url), from which the locker id,
   * the access token and the encryption key are derived.
   */
  secret: string;
  /**
   * The date of the latest successful synchronization (ms).
   */
  lastSyncedAt: number | null;
};

type IdbMetaValues = {
  [IdbMetaKey.Clock]: Stamp;
  [IdbMetaKey.Node]: string;
  [IdbMetaKey.TagOrder]: TagOrder;
  [IdbMetaKey.Sync]: IdbSyncConfig;
  [IdbMetaKey.Preferences]: PreferenceRecord[];
};

/**
 * The schema (version 4).
 * @remarks The bookmarks are versioned records (cf. `merge.ts`): a deletion
 * leaves a tombstone, and every change is stamped.
 */
export interface BaillyDB extends DBSchema {
  [IdbStore.History]: {
    key: number;
    value: IdbEntry;
    indexes: {
      uri: string;
    };
  };
  [IdbStore.Starred]: {
    key: string;
    value: StarredRecord;
  };
  [IdbStore.Tagged]: {
    key: [TagKey, string];
    value: TaggedRecord;
    indexes: {
      uri: string;
      tagKey: TagKey;
    };
  };
  [IdbStore.Tags]: {
    key: TagKey;
    value: TagRecord;
  };
  [IdbStore.Meta]: {
    key: string;
    value: IdbMetaValues[IdbMetaKey];
  };
  [IdbStore.Excerpts]: {
    key: string;
    value: IdbExcerpt;
  };
}

/**
 * The stores of the bookmarks (the history is kept apart).
 */
export const BOOKMARKS_STORES = [IdbStore.Starred, IdbStore.Tagged, IdbStore.Tags, IdbStore.Meta, IdbStore.Excerpts] as const;

/**
 * The `meta` store within a read-write transaction.
 */
export type IdbMetaStore = IDBPObjectStore<BaillyDB, ArrayLike<StoreNames<BaillyDB>>, IdbStore.Meta, "readwrite">;

const IDB_NAME = "bailly";
/**
 * The current schema version.
 * @remarks Versions 1 and 2 were used by the previous (Astro) application;
 * version 3 had numeric (auto-incremented) keys and no stamps.
 */
const IDB_VERSION = 5;

type IdbConfig = {
  searchHistoryLength: number;
  tagMaxItems: number;
  maxTags: number;
};

const IDB_DEFAULT_CONFIG: Readonly<IdbConfig> = {
  searchHistoryLength: 60,
  tagMaxItems: 100,
  maxTags: 50,
};

/**
 * The version 3 records, as migrated.
 */
type LegacyEntry = { word: string; uri: string; excerpt: string };
type LegacyTag = { name: string; description?: string; color: TagColorKey; position: number };
type LegacyData = {
  tags: { key: number; value: LegacyTag }[];
  tagged: (LegacyEntry & { tagKey: number })[];
  starred: LegacyEntry[];
};

type UpgradeTransaction = IDBPTransaction<BaillyDB, StoreNames<BaillyDB>[], "versionchange">;

/**
 * Reads the version 3 bookmarks.
 */
async function readLegacyData(transaction: UpgradeTransaction): Promise<LegacyData> {
  // The stores still have their version 3 shape: they are read untyped.
  const store = (name: string) => transaction.objectStore(name as IdbStore.Tags);
  const tagKeys = (await store(IdbStore.Tags).getAllKeys()) as unknown as number[];
  const tagValues = (await store(IdbStore.Tags).getAll()) as unknown as LegacyTag[];

  return {
    tags: tagKeys.map((key, i) => ({ key, value: tagValues[i]! })),
    tagged: (await store(IdbStore.Tagged).getAll()) as unknown as LegacyData["tagged"],
    starred: (await store(IdbStore.Starred).getAll()) as unknown as LegacyEntry[],
  };
}

/**
 * Writes the version 3 bookmarks in the version 4 stores: the tags get a
 * UUID (keeping their former key, cf. `TagRecord.legacyKey`), their order
 * becomes the `tagOrder` record, every record is stamped, and the excerpts
 * are kept apart (`IdbStore.Excerpts`).
 */
async function writeMigratedData(transaction: UpgradeTransaction, legacy: LegacyData): Promise<void> {
  const node = randomNodeId();
  let clock: Stamp | undefined;
  const stamp = (): Stamp => (clock = nextStamp(clock, node));

  // Stamped in insertion order (the former keys were auto-incremented).
  const tags = [...legacy.tags].sort((a, b) => a.key - b.key).map(({ key, value }) => {
    const createdAt = stamp();
    const record: TagRecord = {
      key: randomUuid(),
      name: IdbTags.clampName(value.name),
      description: typeof value.description === "string" ? IdbTags.clampDescription(value.description) : "",
      // A color that is not valid anymore gets the one an import or a
      // synchronization would give it (cf. `transfer.ts`), so that the tag
      // looks the same everywhere.
      color: IdbTags.isColorKey(value.color) ? value.color : IdbTags.colorKeys[0]!,
      createdAt,
      updatedAt: createdAt,
      legacyKey: key,
    };
    return { record, position: value.position };
  });
  const newKeys = new Map(tags.map(({ record }) => [record.legacyKey!, record.key]));

  const tagStore = transaction.objectStore(IdbStore.Tags);
  for (const { record } of tags) await tagStore.put(record);

  const excerpts = new Map<string, string>();

  const taggedStore = transaction.objectStore(IdbStore.Tagged);
  for (const { tagKey, word, uri, excerpt } of legacy.tagged) {
    const key = newKeys.get(tagKey);
    if (key === undefined) continue;
    await taggedStore.put({ tagKey: key, word, uri, updatedAt: stamp() });
    if (excerpt) excerpts.set(uri, excerpt);
  }

  const starredStore = transaction.objectStore(IdbStore.Starred);
  for (const { word, uri, excerpt } of legacy.starred) {
    await starredStore.put({ word, uri, updatedAt: stamp() });
    if (excerpt) excerpts.set(uri, excerpt);
  }

  const excerptStore = transaction.objectStore(IdbStore.Excerpts);
  for (const [uri, excerpt] of excerpts) await excerptStore.put({ uri, excerpt });

  const meta = transaction.objectStore(IdbStore.Meta);
  if (tags.length) {
    const order: TagOrder = {
      keys: [...tags].sort((a, b) => a.position - b.position).map(({ record }) => record.key),
      updatedAt: stamp(),
    };
    await meta.put(order, IdbMetaKey.TagOrder);
  }
  await meta.put(node, IdbMetaKey.Node);
  if (clock) await meta.put(clock, IdbMetaKey.Clock);
}

/**
 * Creates the version 4 stores of the bookmarks, migrating the version 3
 * ones if needed.
 */
async function upgradeToV4(db: IDBPDatabase<BaillyDB>, oldVersion: number, transaction: UpgradeTransaction): Promise<void> {
  let legacy: LegacyData | undefined;
  if (oldVersion === 3) {
    legacy = await readLegacyData(transaction);
    for (const name of [IdbStore.Starred, IdbStore.Tagged, IdbStore.Tags]) db.deleteObjectStore(name);
  }

  db.createObjectStore(IdbStore.Starred, { keyPath: "uri" });

  const tagged = db.createObjectStore(IdbStore.Tagged, { keyPath: ["tagKey", "uri"] });
  tagged.createIndex("uri", "uri");
  tagged.createIndex("tagKey", "tagKey");

  db.createObjectStore(IdbStore.Tags, { keyPath: "key" });
  db.createObjectStore(IdbStore.Meta);
  db.createObjectStore(IdbStore.Excerpts, { keyPath: "uri" });

  if (legacy) await writeMigratedData(transaction, legacy);
}

export class Idb {
  /**
   * The pending or opened connection.
   * @remarks The promise (rather than the connection) is cached so that
   * concurrent calls share a single connection.
   */
  static #db: Promise<IDBPDatabase<BaillyDB>> | undefined;
  static #config: IdbConfig | undefined;
  static #blockedHandler: (() => void) | undefined;

  /**
   * Sets what to do when the upgrade of the database waits for another tab
   * to close it (e.g. telling the user).
   */
  static onBlocked(handler: () => void): void {
    Idb.#blockedHandler = handler;
  }

  static get config(): IdbConfig {
    if (Idb.#config === undefined) {
      Idb.#config = { ...IDB_DEFAULT_CONFIG };
      console.warn(
        "`Idb.config` was read before `Idb.configure` was called, so default values were applied:",
        Idb.#config,
      );
    }
    return Idb.#config;
  }

  private constructor() {}

  /**
   * Sets the configuration.
   * @param opts Values overriding the defaults. Values that are not positive
   * integers (e.g. `NaN` from a missing environment variable) are ignored.
   */
  static configure(opts: Partial<IdbConfig> = {}): void {
    const config: IdbConfig = { ...IDB_DEFAULT_CONFIG };

    for (const key of Object.keys(config) as (keyof IdbConfig)[]) {
      const value = opts[key];
      if (value === undefined) continue;
      if (Number.isInteger(value) && value > 0) {
        config[key] = value;
      } else {
        console.warn(`Invalid \`Idb\` setting \`${key}\` (${value}), the default value applies.`);
      }
    }

    Idb.#config = config;
  }

  static getIndexedDB(): Promise<IDBPDatabase<BaillyDB>> {
    Idb.#db ??= Idb.#open().catch((error: unknown) => {
      // Allow a later call to retry.
      Idb.#db = undefined;
      throw error;
    });

    return Idb.#db;
  }

  static #open(): Promise<IDBPDatabase<BaillyDB>> {
    return openDB<BaillyDB>(IDB_NAME, IDB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        // Versions 1 and 2 only contained stores that are no longer used.
        if (oldVersion > 0 && oldVersion < 3) {
          for (const name of Array.from(db.objectStoreNames)) {
            db.deleteObjectStore(name);
          }
        }

        if (oldVersion < 3) {
          const history = db.createObjectStore(IdbStore.History, {
            autoIncrement: true,
          });

          history.createIndex("uri", "uri");
        }

        if (oldVersion < 4) {
          // The transaction stays active while its requests are awaited; if
          // the migration fails, aborting it keeps the previous version.
          upgradeToV4(db, oldVersion, transaction).catch((error: unknown) => {
            console.error(error);
            transaction.abort();
          });
        }

        // Version 4 first had no excerpts store (test devices of the preview
        // only): added if missing.
        if (oldVersion === 4 && !db.objectStoreNames.contains(IdbStore.Excerpts)) {
          db.createObjectStore(IdbStore.Excerpts, { keyPath: "uri" });
        }

        // Future versions: add `if (oldVersion < 6) { … }` blocks here.
      },
      blocked() {
        // Another tab (e.g. of the previous version) keeps the database open
        // in an older version: the upgrade waits until it is closed.
        Idb.#blockedHandler?.();
      },
      blocking(_currentVersion, _blockedVersion, event) {
        // Another tab needs to upgrade the database: release it.
        (event.target as IDBDatabase).close();
        Idb.#db = undefined;
      },
      terminated() {
        Idb.#db = undefined;
      },
    });
  }

  /**
   * The excerpts kept for the bookmarks, by URI (cf. `IdbExcerpt`).
   */
  static async readExcerpts(store: { getAll: () => Promise<IdbExcerpt[]> }): Promise<Map<string, string>> {
    return new Map((await store.getAll()).map(({ uri, excerpt }) => [uri, excerpt]));
  }

  /**
   * Reads a value of the `meta` store.
   */
  static async getMeta<K extends IdbMetaKey>(
    store: Pick<IdbMetaStore, "get">,
    key: K,
  ): Promise<IdbMetaValues[K] | undefined> {
    return (await store.get(key)) as IdbMetaValues[K] | undefined;
  }

  /**
   * Reads a value of the `meta` store, in its own transaction.
   */
  static async readMeta<K extends IdbMetaKey>(key: K): Promise<IdbMetaValues[K] | undefined> {
    const db = await Idb.getIndexedDB();
    return (await db.get(IdbStore.Meta, key)) as IdbMetaValues[K] | undefined;
  }

  /**
   * Writes (or, with `undefined`, deletes) a value of the `meta` store.
   */
  static async writeMeta<K extends IdbMetaKey>(key: K, value: IdbMetaValues[K] | undefined): Promise<void> {
    const db = await Idb.getIndexedDB();
    if (value === undefined) await db.delete(IdbStore.Meta, key);
    else await db.put(IdbStore.Meta, value, key);
  }

  /**
   * Issues a stamp for a change made in the ongoing transaction (which must
   * include the `meta` store): the clock is kept in IndexedDB, so that the
   * tabs of a device share it.
   * @param observed A stamp to follow (e.g. the latest of a state brought
   * back, cf. `IdbBookmarks.restore`): the stamp issued is later.
   */
  static async stamp(meta: IdbMetaStore, observed?: Stamp): Promise<Stamp> {
    let node = await Idb.getMeta(meta, IdbMetaKey.Node);
    if (!node) {
      node = randomNodeId();
      await meta.put(node, IdbMetaKey.Node);
    }

    const stamp = nextStamp(maxStamp(await Idb.getMeta(meta, IdbMetaKey.Clock), observed), node);
    await meta.put(stamp, IdbMetaKey.Clock);
    return stamp;
  }

  /**
   * A helper method that takes a given entry and flatten it to satisfy the
   * shape of an `IdbEntry`.
   * @param options.requireExcerpt Whether an excerpt (or child entries) is
   * required. A bookmark may have none: not known yet (e.g. received from
   * another device, cf. `IdbExcerpt`), it is fetched later.
   */
  static buildIdbEntry(entry: IdbEntryCreation, { requireExcerpt = true } = {}): IdbEntry {
    if (!entry.word || !entry.uri || (requireExcerpt && !entry.excerpt && !entry.children?.length)) {
      throw new IdbError(
        requireExcerpt
          ? "La création de l'entrée nécessite un mot, une URI et un extrait (ou des entrées enfants)."
          : "La création de l'entrée nécessite un mot et une URI.",
      );
    }

    return {
      word: entry.word,
      uri: entry.uri,
      excerpt: (() => {
        if (entry.children?.length) {
          // Excerpts start with the word.
          return `${entry.word} (v. les ${entry.children.length} entrées)`;
        }
        return entry.excerpt;
      })(),
    };
  }
}
