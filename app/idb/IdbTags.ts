import type { IDBPObjectStore } from "idb";
import {
  attempt,
  Idb,
  IdbError,
  IdbStore,
  type BaillyDB,
  type IdbResult,
  type IdbTag,
  type IdbTagCreation,
  type IdbTagged,
  type IdbTagWithKey,
} from "./Idb";
import { Color, type ColorKey } from "~/enums";
import { pickRandom } from "~/helpers";

export type TagColorKey = Exclude<ColorKey, "Yellow">;
type TagOrder = "position" | "insertion";
type TagsStore = IDBPObjectStore<BaillyDB, IdbStore[], IdbStore.Tags, "readwrite">;

/**
 * Makes tag names comparable regardless of case and diacritics.
 */
const comparable = (name: string): string =>
  name.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

/**
 * A collection of methods for managing tags.
 */
export class IdbTags {
  /**
   * Valid tag colors are the keys from the `Color` enum except `Yellow` which
   * is for favorites.
   */
  static readonly colorKeys = Object.keys(Color).filter(
    el => el !== "Yellow",
  ) as TagColorKey[];

  /**
   * Checks that a value is a valid tag color key (at runtime, values may come
   * from outdated or corrupted data).
   */
  static isColorKey(value: unknown): value is TagColorKey {
    return IdbTags.colorKeys.includes(value as TagColorKey);
  }

  /**
   * Picks a color taking into account those already used.
   * @returns A `Color` enum key that is part of the `TagColorKey` type.
   */
  static async pickColor(): Promise<TagColorKey> {
    // Keep only valid keys: the `Color` enum may have changed since the
    // insertion, or invalid data may have entered IndexedDB.
    const usedColorKeys = (await this.getUsedColorKeys()).filter(el =>
      IdbTags.isColorKey(el),
    );

    // If no color remains, only exclude those used by the first half of the
    // tags (sorted by position).
    const colorsExhausted = usedColorKeys.length === this.colorKeys.length;
    const excluded = colorsExhausted
      ? usedColorKeys.slice(0, Math.floor(usedColorKeys.length / 2))
      : usedColorKeys;

    return pickRandom(this.colorKeys, excluded);
  }

  /**
   * Validates and normalizes a tag name.
   * @throws {IdbError} If the name is empty or reserved.
   */
  static #validateName(name: unknown): string {
    const trimmed = typeof name === "string" ? name.trim() : "";

    if (!trimmed.length) {
      throw new IdbError("Une étiquette doit être nommée.");
    }

    if (comparable(trimmed) === "favoris") {
      throw new IdbError("Ce nom est réservé à la liste des favoris.");
    }

    return trimmed;
  }

  /**
   * Checks, within a transaction, that no other tag has the same name.
   * @param store The tags store of the ongoing transaction.
   * @param name A given tag name.
   * @param exceptKey The key of the tag being renamed (it is ignored).
   * @throws {IdbError} If the name is already used (case and diacritics are ignored).
   */
  static async #assertAvailableName(
    store: TagsStore,
    name: string,
    exceptKey?: number,
  ): Promise<void> {
    const comparableName = comparable(name);

    for await (const cursor of store) {
      if (cursor.primaryKey !== exceptKey && comparable(cursor.value.name) === comparableName) {
        throw new IdbError(`L'étiquette « ${cursor.value.name} » existe déjà.`);
      }
    }
  }

  /**
   * Creates a tag, placed first.
   * @param data The tag data. If no valid color is given, one is picked.
   * @returns The created tag with its key.
   */
  static async add(data: IdbTagCreation): Promise<IdbResult<IdbTagWithKey>> {
    return attempt(async () => {
      const name = this.#validateName(data.name);
      // Pick the color before the transaction: awaiting anything else than
      // IndexedDB requests would commit it.
      const color = IdbTags.isColorKey(data.color) ? data.color : await this.pickColor();

      const db = await Idb.getIndexedDB();
      const tx = db.transaction(IdbStore.Tags, "readwrite");

      if ((await tx.store.count()) >= Idb.config.maxTags) {
        throw new IdbError("Le nombre maximal d'étiquettes a été atteint.");
      }

      await this.#assertAvailableName(tx.store, name);

      // Make room for the new tag.
      for await (const cursor of tx.store) {
        await cursor.update({ ...cursor.value, position: cursor.value.position + 1 });
      }

      const tag: IdbTag = {
        name,
        description: data.description?.trim() ?? "",
        color,
        position: 1,
      };
      const key = await tx.store.add(tag);
      await tx.done;

      return { ...tag, key };
    });
  }

  /**
   * Updates a tag.
   * @param tagKey The key of the tag to update.
   * @param data The new tag data. Omitted (or invalid) optional values are kept.
   * @returns The updated tag with its key.
   */
  static async update(
    tagKey: number,
    data: IdbTagCreation,
  ): Promise<IdbResult<IdbTagWithKey>> {
    return attempt(async () => {
      const name = this.#validateName(data.name);

      const db = await Idb.getIndexedDB();
      const tx = db.transaction(IdbStore.Tags, "readwrite");

      const storedTag = await tx.store.get(tagKey);
      if (!storedTag) {
        throw new IdbError("L'étiquette à modifier n'existe pas.");
      }

      await this.#assertAvailableName(tx.store, name, tagKey);

      const tag: IdbTag = {
        ...storedTag,
        name,
        description: data.description?.trim() ?? storedTag.description,
        color: IdbTags.isColorKey(data.color) ? data.color : storedTag.color,
      };
      await tx.store.put(tag, tagKey);
      await tx.done;

      return { ...tag, key: tagKey };
    });
  }

  /**
   * Gets a tag by its (exact) name.
   * @returns The tag with its key, or `null`.
   */
  static async get(name: string): Promise<IdbTagWithKey | null> {
    const db = await Idb.getIndexedDB();
    const tx = db.transaction(IdbStore.Tags);
    const cursor = await tx.store.index("name").openCursor(name);
    await tx.done;

    return cursor ? { ...cursor.value, key: cursor.primaryKey } : null;
  }

  /**
   * Gets all the tags.
   * @param opts.orderBy Sort by `position` (default) or by `insertion`.
   * @returns The tags with their keys.
   */
  static async getAll(opts?: { orderBy: TagOrder }): Promise<IdbTagWithKey[]> {
    const db = await Idb.getIndexedDB();
    const tx = db.transaction(IdbStore.Tags);
    const source = opts?.orderBy === "insertion" ? tx.store : tx.store.index("position");

    const tags: IdbTagWithKey[] = [];
    for await (const cursor of source.iterate()) {
      tags.push({ ...cursor.value, key: cursor.primaryKey });
    }
    await tx.done;

    return tags;
  }

  /**
   * Returns all the distinct `Color` enum keys (e.g. 'Blue') that are already
   * used by the existing tags — sorted by tag position.
   */
  static async getUsedColorKeys(): Promise<ColorKey[]> {
    const db = await Idb.getIndexedDB();
    const tx = db.transaction(IdbStore.Tags);
    const idx = tx.store.index("position+color");

    const keys: ColorKey[] = [];
    for await (const cursor of idx.iterate()) {
      keys.push(cursor.value.color);
    }
    await tx.done;

    return [...new Set(keys)];
  }

  /**
   * Gets the tags to which an entry belongs.
   * @param uri The URI of the entry.
   * @returns The tags with their keys, or `null` if there are none.
   */
  static async getEntryTags(uri: string): Promise<IdbTagWithKey[] | null> {
    const db = await Idb.getIndexedDB();

    const tagKeys = await this.getEntryTagKeys(uri);
    if (!tagKeys) return null;

    const tags: IdbTagWithKey[] = [];
    const tx = db.transaction(IdbStore.Tags);
    for (const tagKey of tagKeys) {
      const tag = await tx.store.get(tagKey);
      if (tag) tags.push({ ...tag, key: tagKey });
    }
    await tx.done;

    return tags.length ? tags : null;
  }

  /**
   * Gets the keys of the tags to which an entry belongs.
   * @param uri The URI of the entry.
   * @returns The tag keys, or `null` if there are none.
   */
  static async getEntryTagKeys(uri: string): Promise<number[] | null> {
    const db = await Idb.getIndexedDB();
    const entries: IdbTagged[] = await db.getAllFromIndex(
      IdbStore.Tagged,
      "uri",
      uri,
    );

    return entries.length ? entries.map(entry => entry.tagKey) : null;
  }

  /**
   * Removes a tag and detaches its entries.
   * @param tagKey The primary key of the tag to remove.
   */
  static async remove(tagKey: number): Promise<IdbResult> {
    return attempt(async () => {
      const db = await Idb.getIndexedDB();
      const tx = db.transaction([IdbStore.Tags, IdbStore.Tagged], "readwrite");
      const tags = tx.objectStore(IdbStore.Tags);

      if ((await tags.getKey(tagKey)) === undefined) {
        throw new IdbError("L'étiquette à supprimer n'existe pas.");
      }

      await tags.delete(tagKey);

      const tagged = tx.objectStore(IdbStore.Tagged).index("tagKey");
      for await (const cursor of tagged.iterate(tagKey)) {
        await cursor.delete();
      }

      await tx.done;

      return undefined;
    });
  }

  /**
   * Reorders the existing tags.
   * @param orderedKeys All the tag keys, in the new order.
   * @returns The tags with their keys, in the new order.
   */
  static async reorder(orderedKeys: number[]): Promise<IdbResult<IdbTagWithKey[]>> {
    return attempt(async () => {
      const db = await Idb.getIndexedDB();
      const tx = db.transaction(IdbStore.Tags, "readwrite");

      const storedKeys = await tx.store.getAllKeys();
      if (
        orderedKeys.length !== storedKeys.length
        || new Set(orderedKeys).size !== orderedKeys.length
        || !orderedKeys.every(key => storedKeys.includes(key))
      ) {
        throw new Error(
          "The keys passed and those stored in IndexedDB do not match "
          + "(no data has been modified).",
        );
      }

      const tags: IdbTagWithKey[] = [];
      for (const [i, key] of orderedKeys.entries()) {
        const storedTag = await tx.store.get(key);
        if (!storedTag) throw new Error(`Tag ${key} disappeared during the reordering.`);

        const tag: IdbTag = { ...storedTag, position: i + 1 };
        await tx.store.put(tag, key);
        tags.push({ ...tag, key });
      }
      await tx.done;

      return tags;
    });
  }
}
