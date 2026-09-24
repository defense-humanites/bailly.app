import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ColorKey } from "~/enums";
import type { Entry } from "~/plugins/api";
import type { PartialExcept } from "~/types";
import type { TagColorKey } from "./IdbTags";

type IdbData = IdbEntry | IdbTagged | IdbTag | IdbTagWithKey;
type IdbState = "success" | "error";
type IdbResponseOptions<T extends IdbData | IdbData[]> = {
  message?: string;
} & ([T] extends [never] ? unknown : { data: NoInfer<T> });

/**
 * A standard response for `Idb`-related operations.
 */
export class IdbResponse<T extends IdbData | IdbData[] = never> {
  /**
   * The resulting state of the operation.
   */
  state: IdbState;
  /**
   * An optional message to explain the current state.
   */
  message: string = "";
  /**
   * Optional (but mandatory if the generic parameter has been defined) data
   * resulting from the operation.
   */
  data: T = {} as T;

  /**
   * Constructs a response for `Idb`-related operations.
   * @param state A state representing the result of the operation.
   * @param opts An optional configuration object.
   */
  constructor(state: IdbState, opts: IdbResponseOptions<T>) {
    this.state = state;
    this.message = (() => {
      if (opts.message) return opts.message;
      else if (state === "error") return "Une erreur est survenue.";
      else return "";
    })();
    if ("data" in opts) this.data = (opts as { data: T }).data;
  }

  /**
   * A helper method that takes a value and assigns it as a `message` to an `IdbResponse`.
   * @param error Usually an `Error` object or a string. Any other type will be converted to a string.
   * @returns An `IdbResponse` whith the `status` set to error and the `message` filled.
   */
  static defaultError(error: unknown): IdbResponse {
    return new IdbResponse("error", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * A flat entry with selected fields.
 */
export type IdbEntry = Omit<Entry<"word" | "uri" | "excerpt">, "children">;
/**
 * A given entry with selected fields that may have children.
 */
export type IdbEntryCreation = Entry<"word" | "uri" | "excerpt">;
/**
 * An `IdbEntry` with the IDB primary key of its associated tag.
 */
export type IdbTagged = IdbEntry & { tagKey: number };
/**
 * A tag used to identify collections of entries.
 */
export type IdbTag = {
  name: string;
  description: string;
  color: TagColorKey;
  position: number;
};
/**
 * A given tag containing at least a name.
 */
export type IdbTagCreation = Omit<PartialExcept<IdbTag, "name">, "position">;
/**
 * An `IdbTag` with its IDB primary key.
 */
export type IdbTagWithKey = IdbTag & { key: number };

export enum IdbStore {
  History = "history",
  Starred = "starred",
  Tagged = "tagged",
  Tags = "tags",
}

export interface BaillyDB extends DBSchema {
  [IdbStore.History]: {
    key: number;
    value: IdbEntry;
    indexes: {
      uri: string;
    };
  };
  [IdbStore.Starred]: {
    key: number;
    value: IdbEntry;
    indexes: {
      uri: string;
    };
  };
  [IdbStore.Tagged]: {
    key: number;
    value: IdbTagged;
    indexes: {
      "uri": string;
      "tagKey": number;
      "tagKey+uri": [number, string];
    };
  };
  [IdbStore.Tags]: {
    key: number;
    value: IdbTag;
    indexes: {
      "name": string;
      "color": ColorKey;
      "position": number;
      "position+color": [number, ColorKey];
    };
  };
}

const IDB_NAME = "bailly";
/**
 * The current schema version.
 * @remarks Versions 1 and 2 were used by the previous (Astro) application.
 */
const IDB_VERSION = 3;

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

export class Idb {
  /**
   * The pending or opened connection.
   * @remarks The promise (rather than the connection) is cached so that
   * concurrent calls share a single connection.
   */
  static #db: Promise<IDBPDatabase<BaillyDB>> | undefined;
  static #config: IdbConfig | undefined;

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
      upgrade(db, oldVersion) {
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

          const starred = db.createObjectStore(IdbStore.Starred, {
            autoIncrement: true,
          });

          starred.createIndex("uri", "uri");

          const tagged = db.createObjectStore(IdbStore.Tagged, {
            autoIncrement: true,
          });

          tagged.createIndex("uri", "uri");
          tagged.createIndex("tagKey", "tagKey");
          tagged.createIndex("tagKey+uri", ["tagKey", "uri"], { unique: true });

          const tags = db.createObjectStore(IdbStore.Tags, {
            autoIncrement: true,
          });

          tags.createIndex("name", "name");
          tags.createIndex("color", "color");
          tags.createIndex("position", "position");
          tags.createIndex("position+color", ["position", "color"]);
        }

        // Future versions: add `if (oldVersion < 4) { … }` blocks here.
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
   * A helper method that takes a given entry and flatten it to satisfy the
   * shape of an `IdbEntry`.
   */
  static buildIdbEntry(entry: IdbEntryCreation): IdbEntry {
    if (
      !entry.word
      || !entry.uri
      || (!entry.excerpt && !entry.children?.length)
    ) {
      throw new Error(
        "La création de l'entrée nécessite un mot, une URI et un extrait "
        + "(ou des entrées enfants).",
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
