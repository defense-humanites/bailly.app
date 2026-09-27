import type { IDBPObjectStore, StoreNames } from "idb";
import {
  attempt,
  Idb,
  IdbError,
  IdbMetaKey,
  IdbStore,
  type BaillyDB,
  type IdbResult,
  type IdbTagCreation,
  type IdbTagWithKey,
} from "./Idb";
import { comparableTagName, entryTombstone, orderTags, tagTombstone, type TagKey, type TagOrder, type TagRecord } from "./merge";
import { randomUuid } from "./random";
import { Color, type ColorKey } from "~/enums";
import { pickRandom } from "~/helpers";

export type TagColorKey = Exclude<ColorKey, "Yellow">;
type TagsStore = IDBPObjectStore<BaillyDB, ArrayLike<StoreNames<BaillyDB>>, IdbStore.Tags, "readwrite">;

const toTagWithKey = ({ key, name, description, color, createdAt, legacyKey }: TagRecord): IdbTagWithKey => ({
  key,
  name,
  description,
  color,
  createdAt,
  ...(legacyKey === undefined ? {} : { legacyKey }),
});

/**
 * A collection of methods for managing tags.
 * @remarks Deleted tags leave a tombstone (cf. `merge.ts`), ignored when
 * reading. Their order is a single record (`IdbMetaKey.TagOrder`), written
 * when the user arranges them; the tags it does not list come first.
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

    if (comparableTagName(trimmed) === "favoris") {
      throw new IdbError("Ce nom est réservé à la liste des favoris.");
    }

    return trimmed;
  }

  /**
   * The existing (not deleted) tags of a store, within a transaction.
   */
  static async #liveTags(store: Pick<TagsStore, "getAll">): Promise<TagRecord[]> {
    return (await store.getAll()).filter(tag => !tag.deleted);
  }

  /**
   * Checks that no other existing tag has the same name.
   * @param tags The existing tags.
   * @param name A given tag name.
   * @param exceptKey The key of the tag being renamed (it is ignored).
   * @throws {IdbError} If the name is already used (case and diacritics are ignored).
   */
  static #assertAvailableName(tags: TagRecord[], name: string, exceptKey?: TagKey): void {
    const comparableName = comparableTagName(name);
    const homonym = tags.find(tag => tag.key !== exceptKey && comparableTagName(tag.name) === comparableName);
    if (homonym) {
      throw new IdbError(`L'étiquette « ${homonym.name} » existe déjà.`);
    }
  }

  /**
   * Creates a tag, placed first (the order does not list it yet).
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
      const tx = db.transaction([IdbStore.Tags, IdbStore.Meta], "readwrite");
      const store = tx.objectStore(IdbStore.Tags);

      const tags = await this.#liveTags(store);
      if (tags.length >= Idb.config.maxTags) {
        throw new IdbError("Le nombre maximal d'étiquettes a été atteint.");
      }

      this.#assertAvailableName(tags, name);

      const stamp = await Idb.stamp(tx.objectStore(IdbStore.Meta));
      const tag: TagRecord = {
        key: randomUuid(),
        name,
        description: data.description?.trim() ?? "",
        color,
        createdAt: stamp,
        updatedAt: stamp,
      };
      await store.put(tag);
      await tx.done;

      return toTagWithKey(tag);
    });
  }

  /**
   * Updates a tag.
   * @param tagKey The key of the tag to update.
   * @param data The new tag data. Omitted (or invalid) optional values are kept.
   * @returns The updated tag with its key.
   */
  static async update(
    tagKey: TagKey,
    data: IdbTagCreation,
  ): Promise<IdbResult<IdbTagWithKey>> {
    return attempt(async () => {
      const name = this.#validateName(data.name);

      const db = await Idb.getIndexedDB();
      const tx = db.transaction([IdbStore.Tags, IdbStore.Meta], "readwrite");
      const store = tx.objectStore(IdbStore.Tags);

      const tags = await this.#liveTags(store);
      const storedTag = tags.find(tag => tag.key === tagKey);
      if (!storedTag) {
        throw new IdbError("L'étiquette à modifier n'existe pas.");
      }

      this.#assertAvailableName(tags, name, tagKey);

      const tag: TagRecord = {
        ...storedTag,
        name,
        description: data.description?.trim() ?? storedTag.description,
        color: IdbTags.isColorKey(data.color) ? data.color : storedTag.color,
        updatedAt: await Idb.stamp(tx.objectStore(IdbStore.Meta)),
      };
      await store.put(tag);
      await tx.done;

      return toTagWithKey(tag);
    });
  }

  /**
   * Gets a tag by its (exact) name.
   * @returns The tag with its key, or `null`.
   */
  static async get(name: string): Promise<IdbTagWithKey | null> {
    const db = await Idb.getIndexedDB();
    const tag = (await db.getAll(IdbStore.Tags)).find(tag => !tag.deleted && tag.name === name);
    return tag ? toTagWithKey(tag) : null;
  }

  /**
   * Gets all the tags, in the user's order.
   * @returns The tags with their keys.
   */
  static async getAll(): Promise<IdbTagWithKey[]> {
    const db = await Idb.getIndexedDB();
    const tx = db.transaction([IdbStore.Tags, IdbStore.Meta]);
    const [tags, order] = await Promise.all([
      this.#liveTags(tx.objectStore(IdbStore.Tags)),
      Idb.getMeta(tx.objectStore(IdbStore.Meta), IdbMetaKey.TagOrder),
    ]);
    await tx.done;

    return orderTags(tags, order ?? null).map(toTagWithKey);
  }

  /**
   * Returns all the distinct `Color` enum keys (e.g. 'Blue') that are already
   * used by the existing tags — sorted by tag position.
   */
  static async getUsedColorKeys(): Promise<ColorKey[]> {
    return [...new Set((await this.getAll()).map(tag => tag.color))];
  }

  /**
   * Gets the tags to which an entry belongs, in the user's order.
   * @param uri The URI of the entry.
   * @returns The tags with their keys, or `null` if there are none.
   */
  static async getEntryTags(uri: string): Promise<IdbTagWithKey[] | null> {
    const db = await Idb.getIndexedDB();
    const records = await db.getAllFromIndex(IdbStore.Tagged, "uri", uri);
    const tagKeys = new Set(records.filter(record => !record.deleted).map(record => record.tagKey));

    const tags = (await this.getAll()).filter(tag => tagKeys.has(tag.key));
    return tags.length ? tags : null;
  }

  /**
   * Gets the keys of the tags to which an entry belongs, in the user's order.
   * @param uri The URI of the entry.
   * @returns The tag keys, or `null` if there are none.
   */
  static async getEntryTagKeys(uri: string): Promise<TagKey[] | null> {
    return (await this.getEntryTags(uri))?.map(tag => tag.key) ?? null;
  }

  /**
   * Removes a tag and detaches its entries.
   * @param tagKey The key of the tag to remove.
   */
  static async remove(tagKey: TagKey): Promise<IdbResult> {
    return attempt(async () => {
      const db = await Idb.getIndexedDB();
      const tx = db.transaction([IdbStore.Tags, IdbStore.Tagged, IdbStore.Meta], "readwrite");
      const tags = tx.objectStore(IdbStore.Tags);

      const tag = await tags.get(tagKey);
      if (!tag || tag.deleted) {
        throw new IdbError("L'étiquette à supprimer n'existe pas.");
      }

      const updatedAt = await Idb.stamp(tx.objectStore(IdbStore.Meta));
      await tags.put(tagTombstone(tag, updatedAt));

      const tagged = tx.objectStore(IdbStore.Tagged);
      for (const record of await tagged.index("tagKey").getAll(tagKey)) {
        if (!record.deleted) await tagged.put(entryTombstone(record, updatedAt));
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
  static async reorder(orderedKeys: TagKey[]): Promise<IdbResult<IdbTagWithKey[]>> {
    return attempt(async () => {
      const db = await Idb.getIndexedDB();
      const tx = db.transaction([IdbStore.Tags, IdbStore.Meta], "readwrite");
      const meta = tx.objectStore(IdbStore.Meta);

      const tags = await this.#liveTags(tx.objectStore(IdbStore.Tags));
      const storedKeys = new Set(tags.map(tag => tag.key));
      if (
        orderedKeys.length !== storedKeys.size
        || new Set(orderedKeys).size !== orderedKeys.length
        || !orderedKeys.every(key => storedKeys.has(key))
      ) {
        // E.g. a tag added or removed meanwhile, by a synchronization.
        throw new IdbError("Les étiquettes ont changé entre-temps : réessayez.");
      }

      const order: TagOrder = { keys: [...orderedKeys], updatedAt: await Idb.stamp(meta) };
      await meta.put(order, IdbMetaKey.TagOrder);
      await tx.done;

      return orderTags(tags, order).map(toTagWithKey);
    });
  }
}
