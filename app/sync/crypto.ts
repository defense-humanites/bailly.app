import { fromBase64url, toBase64url } from "./base64url";

/**
 * What a device derives from the synchronization key (HKDF-SHA-256): the id
 * of its locker on the server, the token that authorizes its access (the
 * server keeps only a hash of it), and the key that encrypts the bookmarks
 * (AES-GCM, non-extractable). The server never sees the key itself, so it
 * cannot read the bookmarks.
 */
export type SyncCredentials = {
  lockerId: string;
  token: string;
  key: CryptoKey;
};

const encoder = new TextEncoder();
const SALT = encoder.encode("bailly.app bookmarks sync v1");

export async function deriveCredentials(secret: Uint8Array<ArrayBuffer>): Promise<SyncCredentials> {
  const base = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveBits", "deriveKey"]);
  const params = (info: string): HkdfParams => ({ name: "HKDF", hash: "SHA-256", salt: SALT, info: encoder.encode(info) });

  const [lockerId, token, key] = await Promise.all([
    crypto.subtle.deriveBits(params("locker id"), base, 128),
    crypto.subtle.deriveBits(params("access token"), base, 256),
    crypto.subtle.deriveKey(params("encryption key"), base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]),
  ]);

  return { lockerId: toBase64url(new Uint8Array(lockerId)), token: toBase64url(new Uint8Array(token)), key };
}

/**
 * The first byte of an encrypted blob: how its content is encoded.
 */
enum Encoding {
  Raw = 0,
  Gzip = 1,
}

const IV_LENGTH = 12;

async function transform(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const output = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
}

/**
 * Compresses (where supported) then encrypts a text.
 * @returns The blob (encoding, IV and ciphertext), in base64url.
 */
export async function encryptText(text: string, { key, lockerId }: SyncCredentials): Promise<string> {
  const plain = encoder.encode(text);
  const gzip = typeof CompressionStream !== "undefined";
  const content = gzip ? await transform(plain, new CompressionStream("gzip")) : plain;

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  // The locker id is authenticated: a blob cannot be moved to another locker.
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(lockerId) }, key, content);

  const blob = new Uint8Array(1 + IV_LENGTH + ciphertext.byteLength);
  blob[0] = gzip ? Encoding.Gzip : Encoding.Raw;
  blob.set(iv, 1);
  blob.set(new Uint8Array(ciphertext), 1 + IV_LENGTH);
  return toBase64url(blob);
}

/**
 * Decrypts a blob made by `encryptText`.
 * @throws If the blob is invalid or was encrypted with another key.
 */
export async function decryptText(blob: string, { key, lockerId }: SyncCredentials): Promise<string> {
  const bytes = fromBase64url(blob);
  const encoding = bytes[0];
  const iv = bytes.slice(1, 1 + IV_LENGTH);
  const content = new Uint8Array(await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(lockerId) },
    key,
    bytes.slice(1 + IV_LENGTH),
  ));

  const plain = encoding === Encoding.Gzip ? await transform(content, new DecompressionStream("gzip")) : content;
  return new TextDecoder().decode(plain);
}
