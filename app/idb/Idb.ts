import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ColorKey } from "~/enums";
import type { Entry } from "~/plugins/api";
import type { PartialExcept } from "~/types";
import type { TagColorKey } from "./IdbTags";

type IdbData = IdbEntry | IdbTagged | IdbTag | IdbTagWithKey;
type IdbState = "success" | "error";
type IdbResponseOptions<T extends IdbData | IdbData[]> = {
  message?: string;
} & ([T] extends [never] ? {} : { data: NoInfer<T> });

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
    if ("data" in opts) this.data = opts.data;
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
      "tagKey+uri": string;
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

enum IdbInfo {
  Name = "bailly",
  Version = 3,
}

type IdbConfig = {
  searchHistoryLength: number;
  tagMaxItems: number;
  maxTags: number;
};

export class Idb {
  static #instance: IDBPDatabase<BaillyDB>;
  static #config: IdbConfig;

  static get config(): IdbConfig {
    return Idb.#config;
  }

  private constructor() {}

  static configure(opts?: Partial<IdbConfig>): void {
    const defaultValues: IdbConfig = {
      searchHistoryLength: 60,
      tagMaxItems: 100,
      maxTags: 50,
    };

    if (!opts) Idb.#config = defaultValues;
    Idb.#config = Object.assign(defaultValues, opts);
  }

  static async getIndexedDB(): Promise<IDBPDatabase<BaillyDB>> {
    if (!Idb.#config) {
      Idb.configure();
      console.warn(
        "`Idb.getIndexedDB` was called before the `Idb.configure` method, so default values were applied:",
        this.#config,
      );
    }

    if (!Idb.#instance) {
      Idb.#instance = await openDB<BaillyDB>(IdbInfo.Name, IdbInfo.Version, {
        async upgrade(db, oldVersion) {
          if (oldVersion === 2) {
            db.deleteObjectStore("dictionarySlices" as IdbStore);
            db.deleteObjectStore("lastWords" as IdbStore);
          }

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
        },
      });
    }

    return Idb.#instance;
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
        "La création de l'entrée nécessite certaines valeurs manquantes."
        + [entry.word, entry.uri, entry.excerpt, entry.children?.length],
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
        return String(entry.excerpt);
      })(),
    };
  }
}
