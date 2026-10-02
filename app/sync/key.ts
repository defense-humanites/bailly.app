import { entropyToMnemonic, mnemonicToEntropy } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/french.js";

/**
 * The synchronization key: 128 random bits, shown to the user as 12 French
 * words (the BIP 39 French list: 2048 words, 11 bits each, the last word
 * carrying a 4-bit checksum that detects most typos). Each word is
 * identified by its first 4 letters, regardless of accents and case, so the
 * input can be tolerant.
 */
export const SYNC_KEY_WORD_COUNT = 12;
const SECRET_LENGTH = 16;

export class SyncKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncKeyError";
  }
}

/**
 * Lowercase letters without accents (e.g. "Élève" → "eleve").
 */
export const simplifyWord = (word: string): string =>
  word.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z]/g, "");

/**
 * The words of the list (with their accents), by their first 4 letters.
 */
const WORDS_BY_PREFIX = new Map(wordlist.map(word => [simplifyWord(word).slice(0, 4), word.normalize("NFC")]));

export function generateSecret(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(SECRET_LENGTH));
}

export function secretToWords(secret: Uint8Array): string[] {
  return entropyToMnemonic(secret, wordlist).split(" ").map(word => word.normalize("NFC"));
}

/**
 * The word of the list that an input designates: at least its first 4
 * letters, accents and case being ignored.
 */
export function resolveWord(input: string): string | null {
  const simplified = simplifyWord(input);
  if (simplified.length < 4) return null;
  const word = WORDS_BY_PREFIX.get(simplified.slice(0, 4));
  return word && simplifyWord(word).startsWith(simplified) ? word : null;
}

/**
 * The words of the list that start like an input (for suggestions).
 */
export function suggestWords(input: string, limit = 5): string[] {
  const simplified = simplifyWord(input);
  if (!simplified) return [];
  const suggestions: string[] = [];
  for (const word of WORDS_BY_PREFIX.values()) {
    if (simplifyWord(word).startsWith(simplified)) suggestions.push(word);
    if (suggestions.length >= limit) break;
  }
  return suggestions;
}

/**
 * The words of a text (e.g. pasted, with numbers, commas or line breaks).
 */
export function splitWords(text: string): string[] {
  // Composed first: an accent typed or pasted apart (e.g. from a password
  // manager) is a mark, not a letter, and would split its word.
  return text.normalize("NFC").split(/[^\p{L}\p{M}]+/u).filter(Boolean);
}

/**
 * The secret that words encode.
 * @throws {SyncKeyError} With a message for the user.
 */
export function wordsToSecret(words: string[]): Uint8Array<ArrayBuffer> {
  if (words.length !== SYNC_KEY_WORD_COUNT) {
    throw new SyncKeyError(`La clé compte douze mots (${words.length} saisis).`);
  }

  const resolved = words.map((word, i) => {
    const match = resolveWord(word);
    if (!match) throw new SyncKeyError(`Le mot n° ${i + 1} (« ${word} ») n'est pas dans la liste.`);
    return match;
  });

  try {
    return new Uint8Array(mnemonicToEntropy(resolved.join(" "), wordlist));
  } catch {
    throw new SyncKeyError("Ces douze mots ne forment pas une clé valide : vérifiez-les.");
  }
}
