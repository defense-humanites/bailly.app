import { Idb, IdbStore, type IdbEntryCreation, type IdbResult, type IdbTagCreation } from "../app/idb/Idb";

/**
 * Clears all the Idb stores and reverts the default `Idb` settings.
 * @remarks Called after each test (cf. `test/setup.unit.ts`).
 */
export const clearIdb = async (): Promise<void> => {
  const db = await Idb.getIndexedDB();
  await Promise.all(Object.values(IdbStore).map(store => db.clear(store)));
  Idb.configure();
};

export const success = (result: IdbResult<unknown>): boolean => result.state === "success";
export const error = (result: IdbResult<unknown>): boolean => result.state === "error";

/**
 * Returns the data of a successful result.
 * @throws If the result is an error.
 */
export const unwrap = <T>(result: IdbResult<T>): T => {
  if (result.state === "error") throw new Error(`Unexpected error: ${result.message}`);
  return result.data;
};

/**
 * Passes an invalid value where a typed one is expected, to test the
 * runtime validation.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- An unchecked cast is the point.
export const invalid = <T>(value: unknown): T => value as T;

export const entries: { [key in "rhinokeros" | "alopex"]: IdbEntryCreation; } = {
  rhinokeros: {
    word: "ῥινόκερως",
    uri: "rhinokerôs",
    excerpt: "ῥινό·κερως, ωτος (ὁ) [ῑ] rhinocéros, animal avec une corne sur le nez, Str. 774 ; El. N.A. 17, 44 ; Callix. (Ath. 201c). Étym. ῥίς, κέρας.",
  },
  alopex: {
    word: "ἀλώπηξ",
    uri: "alôpêx",
    excerpt: "ἀλώπηξ, εκος (ἡ) [ᾰ] I renard, Hdt. 2, 67 ; Arstt. H.A. 8, 28, 7, etc. ; c. symbole de ruse (cf. franç. un fin renard) DL. 2, 73 ; p. opp. au lion (s…",
  },
};

export const tags: { [key in "banquet" | "theetete"]: IdbTagCreation } = {
  banquet: {
    name: "Banquet",
    description: "De l'amour",
    color: "Rose",
  },
  theetete: {
    name: "Théétète",
    color: "Blue",
  },
};
