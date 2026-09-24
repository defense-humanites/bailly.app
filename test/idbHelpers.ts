import {Idb, IdbEntryCreation, IdbResponse, IdbStore, IdbTagCreation} from "../app/idb/Idb";

/**
 * Clears all the Idb stores.
 * @remrks Call this function at the end of each test to isolate IndexedDB interactions.
 */
export const clearIdb = () => {
  Object.values(IdbStore).forEach(async (store) =>
    (await Idb.getIndexedDB()).clear(store)
  );
  Idb.configure(); // Revert defaults.
}

export const success = (response: IdbResponse) => response.state === "success";
export const error = (response: IdbResponse) => response.state === "error";

export const entries: { [key in "rhinokeros" | "alopex"]: IdbEntryCreation; } = {
  "rhinokeros": {
    word: "ῥινόκερως",
    uri: "rhinokerôs",
    excerpt: "ῥινό·κερως, ωτος (ὁ) [ῑ] rhinocéros, animal avec une corne sur le nez, Str. 774 ; El. N.A. 17, 44 ; Callix. (Ath. 201c). Étym. ῥίς, κέρας."
  },
  "alopex": {
    word: "ἀλώπηξ",
    uri: "alôpêx",
    excerpt: "ἀλώπηξ, εκος (ἡ) [ᾰ] I renard, Hdt. 2, 67 ; Arstt. H.A. 8, 28, 7, etc. ; c. symbole de ruse (cf. franç. un fin renard) DL. 2, 73 ; p. opp. au lion (s…"
  }
};

export const tags: { [key in "banquet" | "theetete"]: IdbTagCreation } = {
  "banquet": {
    name: "Banquet",
    description: "De l'amour",
    color: "Rose",
  },
  "theetete": {
    name: "Théétète",
    color: "Blue",
  }
};