import type { IDBPCursorWithValue } from "idb";
import {
  Idb,
  IdbResponse,
  IdbStore,
  type BaillyDB,
  type IdbTagCreation,
  type IdbTag,
  type IdbTagged,
  type IdbTagWithKey,
} from "./Idb";
import { Color, LocalStorageKey, type ColorKey } from "~/enums";
import { pickRandomEnumKey } from "~/helpers";

export type TagColorKey = Exclude<ColorKey, "Yellow">;
type TagOrder = "position" | "insertion";

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
   * Picks a color taking into account those already used.
   * @returns A `Color` enum key that is part of the `TagColorKey` type.
   */
  static async pickColor(): Promise<TagColorKey> {
    /**
     * Retrieve the used color keys from `IndexedDB`, then make sure that each color
     * is present in the `Color` enum, considering that the latter may have changed
     * since the insertion or an error may have entered `IndexedDB`.
     */
    const usedColorKeys = (await this.getUsedColorKeys()).filter(el =>
      (this.colorKeys as ColorKey[]).includes(el),
    );
    /**
     * Check if the length of the legitimate keys retrieved from `IndexedDB`
     * and the length of the filtered enum keys coincide, so that there is no
     * color left.
     */
    const colorsExhausted: boolean
      = usedColorKeys.length === this.colorKeys.length;
    /**
     * Exclude some colors from picking. See the comments below.
     */
    const filter: ColorKey[] = (() => {
      // If no color remains, exclude those used by the first half of the tags.
      const keys: ColorKey[] = colorsExhausted
        ? usedColorKeys.slice(0, usedColorKeys.length / 2)
        : usedColorKeys;

      // Exclude the `Yellow` `ColorKey` which is reserved for starred entries.
      keys.push("Yellow");

      return keys;
    })();

    return pickRandomEnumKey(Color, filter);
  }

  static async #buildIdbTag(tag: IdbTagCreation): Promise<IdbTag> {
    const newTag: IdbTag = {
      name: tag.name.trim(),
      description: tag.description?.trim() ?? "",
      color: tag.color && Color[tag.color] ? tag.color : await this.pickColor(),
      position: 1,
    };

    if (!newTag.name.length) {
      throw new Error("Une étiquette doit être nommée.");
    }

    if (newTag.name.toLowerCase() === "favoris") {
      throw new Error("Ce nom est réservé à la liste des favoris.");
    }

    return newTag;
  }

  /**
   * Checks if a tag name exists.
   * @remarks If a tag key is passed, this method will ignore any matching entry.
   * @param name A given tag name.
   * @param tagKey The primary key that supposedly belongs to the given tag name.
   * @returns The existing name, otherwise `undefined`.
   */
  static async #isExistingTagName(
    name: string,
    tagKey?: number,
  ): Promise<string | undefined> {
    const makeComparable = (input: string): string =>
      input.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

    const comparableName: string = makeComparable(name);

    return (await this.getAll()).find(
      tag => makeComparable(tag.name) === comparableName && tag.key !== tagKey,
    )?.name;
  }

  static async add(data: IdbTagCreation): Promise<IdbResponse<IdbTagWithKey>> {
    try {
      const { name, description, color, position }: IdbTag
        = await this.#buildIdbTag(data);

      // Avoid giving an existing name.
      const nameExists = await this.#isExistingTagName(name);
      if (nameExists) {
        throw new Error(`L'étiquette "${nameExists}" existe déjà.`);
      }

      const db = await Idb.getIndexedDB();
      const tx = db.transaction(IdbStore.Tags, "readwrite");

      const countTags = await tx.store.count();
      if (countTags >= Idb.config.maxTags) {
        throw new Error(`Le nombre maximal d'étiquettes a été atteint.`);
      }

      const tagKeysByPosition = await tx.store.index("position").getAllKeys();
      const newTagKey = await tx.store.add({
        name,
        description,
        color,
        position,
      });
      const newTag = await tx.store.get(newTagKey);
      await tx.done;

      if (!newTag) {
        throw new Error(
          "Une erreur est survenue lors de la création de l'étiquette.",
        );
      }

      await this.reorder([newTagKey, ...tagKeysByPosition], {
        setFirstAsCurrent: true,
      });

      return new IdbResponse("success", {
        data: {
          ...newTag,
          key: newTagKey,
        },
      });
    } catch (error: unknown) {
      return IdbResponse.defaultError(error);
    }
  }

  static async update(
    tagKey: number,
    data: IdbTagCreation,
  ): Promise<IdbResponse<IdbTagWithKey>> {
    try {
      const { name, description, color }: IdbTag = await this.#buildIdbTag(
        data,
      );

      // Avoid giving an existing name.
      const nameExists = await this.#isExistingTagName(name, tagKey);
      if (nameExists) {
        throw new Error(`L'étiquette "${nameExists}" existe déjà.`);
      }

      const db = await Idb.getIndexedDB();
      const tx = db.transaction(IdbStore.Tags, "readwrite");

      // Check if the tag exists as `db.put()` would create a new tag otherwise.
      const storedTag = await tx.store.get(tagKey);
      if (storedTag) {
        await tx.store.put({ ...storedTag, name, description, color }, tagKey);
        const updatedTag = (await tx.store.get(tagKey)) ?? ({} as IdbTag);
        await tx.done;

        return new IdbResponse("success", {
          data: {
            ...updatedTag,
            key: tagKey,
          },
        });
      } else {
        throw new Error("L'étiquette n'a pas pu être mise à jour.");
      }
    } catch (error: unknown) {
      return IdbResponse.defaultError(error);
    }
  }

  static async get(name: string): Promise<IdbTagWithKey | null> {
    const db = await Idb.getIndexedDB();

    const tx = db.transaction(IdbStore.Tags);
    const key = await tx.store.index("name").getKey(name);
    const tag = await tx.store.index("name").get(name);
    await tx.done;

    return key && tag ? { key: key, ...tag } : null;
  }

  static async getAll(opts?: { orderBy: TagOrder }): Promise<IdbTagWithKey[]> {
    const db = await Idb.getIndexedDB();
    const tx = db.transaction(IdbStore.Tags);

    let cursor: IDBPCursorWithValue<
      BaillyDB,
      [IdbStore.Tags],
      IdbStore.Tags
    > | null;
    switch (opts?.orderBy) {
      case "insertion":
        cursor = await tx.store.openCursor();
        break;
      case "position":
      default:
        cursor = await tx.store.index("position").openCursor();
        break;
    }

    const keys: number[] = [];
    const tags: IdbTag[] = [];
    while (cursor) {
      keys.push(cursor.primaryKey);
      tags.push(cursor.value);
      cursor = await cursor.continue();
    }
    await tx.done;

    return tags.map((item, i) => ({ key: keys[i]!, ...item }));
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
   * Retrieves the current tag by its key.
   * @returns The current tag and its key if found, otherwise `null`;
   * @remarks The current tag key is supposed to exist in `LocalStorage` (cf. `getCurrentKey()`).
   */
  static async getCurrent(): Promise<IdbTagWithKey | null> {
    const currentTagKey = this.getCurrentKey();

    let tag: IdbTag | undefined;
    if (currentTagKey) {
      const db = await Idb.getIndexedDB();
      tag = await db.get(IdbStore.Tags, currentTagKey);
    }

    return tag ? { key: Number(currentTagKey), ...tag } : null;
  }

  /**
   * Retrieves the current tag key in `LocalStorage`.
   * @returns The current tag key if found, otherwise `null`.
   */
  static getCurrentKey(): number | null {
    const currentTagKey: string | null = localStorage.getItem(
      LocalStorageKey.CurrentTagKey,
    );

    return currentTagKey ? Number(currentTagKey) : null;
  }

  static async getEntryTags(uri: string): Promise<IdbTagWithKey[] | null> {
    const db = await Idb.getIndexedDB();

    const tagKeys = await this.getEntryTagKeys(uri);
    if (!tagKeys) return null;

    const tags: IdbTagWithKey[] = [];
    const tx = db.transaction(IdbStore.Tags);
    for (const tagKey of tagKeys) {
      const tag = await tx.store.get(tagKey);
      if (tag) tags.push({ key: tagKey, ...tag });
    }
    await tx.done;

    return tags.length ? tags : null;
  }

  static async getEntryTagKeys(uri: string): Promise<number[] | null> {
    const db = await Idb.getIndexedDB();
    const entries: IdbTagged[] = await db.getAllFromIndex(
      IdbStore.Tagged,
      "uri",
      uri,
    );

    return entries.length ? entries.map(entry => entry.tagKey) : null;
  }

  static async remove(tagKey: number): Promise<IdbResponse> {
    try {
      const db = await Idb.getIndexedDB();
      const tx = db.transaction(IdbStore.Tags, "readwrite");

      const tag = await tx.store.get(IDBKeyRange.only(tagKey));
      if (!tag) throw new Error("L'étiquette à supprimer n'existe pas.");

      await tx.store.delete(tagKey);
      await tx.done;

      // Set the first tag (if it exists) as the new current tag if there
      // is none (normally, if deleting the tag invalidated it).
      if (!(await this.getCurrent())) {
        const cursor = await db
          .transaction(IdbStore.Tags)
          .store.index("position")
          .openCursor();
        const firstTagKey = cursor?.primaryKey;
        if (firstTagKey) {
          localStorage.setItem(
            LocalStorageKey.CurrentTagKey,
            String(firstTagKey),
          );
        }
      }

      return new IdbResponse("success", {});
    } catch (error: unknown) {
      return IdbResponse.defaultError(error);
    }
  }

  /**
   * Reorders the existing tags.
   * @param orderedKeys A list of keys that must include all values stored in the database.
   * @param opts An optional configuration object.
   * @param opts.setFirstAsCurrent Update the tag marked as current.
   * @returns A response object.
   */

  static async reorder(
    orderedKeys: number[],
    opts?: {
      setFirstAsCurrent: boolean;
    },
  ): Promise<IdbResponse<IdbTagWithKey[]>> {
    try {
      if (!orderedKeys[0]) {
        throw new Error("An empty key array was passed.");
      }

      const db = await Idb.getIndexedDB();

      const tags = await this.getAll({ orderBy: "position" });
      const tagKeys = tags.map(el => el.key);

      if (
        orderedKeys.length !== tagKeys.length
        || !orderedKeys.every(el => tagKeys.includes(el))
      ) {
        throw new Error(
          "The keys passed and those stored in IndexedDB do not match "
          + "(no data has been modified).",
        );
      }

      const tx = db.transaction(IdbStore.Tags, "readwrite");
      for (const [i, key] of orderedKeys.entries()) {
        const tagIndex = tags.findIndex(el => el.key === key);
        if (tags[tagIndex]) {
          try {
            const newPos: number = i + 1;
            await tx.store.put({ ...tags[tagIndex], position: newPos }, key);
            tags[tagIndex].position = newPos;
          } catch (error: unknown) {
            throw new Error(
              error instanceof Error ? error.message : String(error),
            );
          }
        } else {
          throw new Error(
            "The keys passed and those stored in IndexedDB do not match "
            + "(note that some data has already been modified).",
          );
        }
      }
      await tx.done;

      if (opts?.setFirstAsCurrent) await this.setCurrent(orderedKeys[0]);
      return new IdbResponse("success", {
        data: tags,
      });
    } catch (error: unknown) {
      return IdbResponse.defaultError(error);
    }
  }

  static async setCurrent(tagKey: number): Promise<IdbResponse> {
    try {
      const db = await Idb.getIndexedDB();
      const keyExists = await db.getKey(IdbStore.Tags, tagKey);

      if (keyExists) {
        localStorage.setItem(LocalStorageKey.CurrentTagKey, String(tagKey));
        return new IdbResponse("success", {});
      } else {
        throw new Error(
          "L'étiquette sélectionnée n'a pas pu être promue "
          + "en tant qu'étiquette courante.",
        );
      }
    } catch (error: unknown) {
      return IdbResponse.defaultError(error);
    }
  }
}
