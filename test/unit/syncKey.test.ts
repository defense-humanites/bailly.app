import { expect, test } from "vitest";
import {
  generateSecret,
  resolveWord,
  secretToWords,
  splitWords,
  suggestWords,
  SyncKeyError,
  wordsToSecret,
} from "../../app/sync/key";

const secret = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

test("a secret is shown as 12 French words, and read back from them", () => {
  const words = secretToWords(secret);
  expect(words).toHaveLength(12);
  expect(wordsToSecret(words)).toEqual(secret);

  const random = generateSecret();
  expect(random).toHaveLength(16);
  expect(wordsToSecret(secretToWords(random))).toEqual(random);
});

test("the input is tolerant: case, accents, the first 4 letters", () => {
  expect(resolveWord("ACADÉMIE")).toBe("académie");
  expect(resolveWord("academie")).toBe("académie");
  expect(resolveWord("acad")).toBe("académie");
  expect(resolveWord("aca")).toBeNull(); // Too short to tell.
  expect(resolveWord("academix")).toBeNull();

  const words = secretToWords(secret);
  const typed = words.map(word => word.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().slice(0, 4));
  expect(wordsToSecret(typed)).toEqual(secret);
  expect(splitWords(`1. ${words[0]}, 2. ${words[1]}\n3.${words[2]}`)).toEqual(words.slice(0, 3));
});

test("suggestions", () => {
  expect(suggestWords("acc")).toEqual(["accabler", "accepter", "acclamer", "accolade", "accroche"]);
  expect(suggestWords("")).toEqual([]);
});

test("errors are explained", () => {
  const words = secretToWords(secret);
  expect(() => wordsToSecret(words.slice(0, 11))).toThrow("La clé compte douze mots (11 saisis).");
  expect(() => wordsToSecret([...words.slice(0, 11), "zzzz"])).toThrow("Le mot n° 12 (« zzzz ») n'est pas dans la liste.");

  // A wrong word, detected by the checksum.
  const wrong = [...words];
  for (const candidate of ["abaisser", "abdiquer", "abreuver", "académie", "accabler"]) {
    wrong[5] = candidate;
    try {
      wordsToSecret(wrong);
    } catch (error) {
      expect(error).toBeInstanceOf(SyncKeyError);
      expect((error as Error).message).toContain("ne forment pas une clé valide");
      return;
    }
  }
  throw new Error("No invalid combination found.");
});
