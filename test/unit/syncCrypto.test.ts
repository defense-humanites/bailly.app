// @vitest-environment node
import { expect, test } from "vitest";
import { decryptText, deriveCredentials, encryptText } from "../../app/sync/crypto";

const secret = new Uint8Array(16).fill(7);

test("credentials are derived deterministically from the secret", async () => {
  const a = await deriveCredentials(secret);
  const b = await deriveCredentials(new Uint8Array(16).fill(7));
  const c = await deriveCredentials(new Uint8Array(16).fill(8));

  expect(a.lockerId).toMatch(/^[\w-]{22}$/);
  expect(a.token).toMatch(/^[\w-]{43}$/);
  expect([a.lockerId, a.token]).toEqual([b.lockerId, b.token]);
  expect(c.lockerId).not.toBe(a.lockerId);
  expect(a.token).not.toContain(a.lockerId);
  expect(a.key.extractable).toBe(false);
});

test("a text encrypted with the key decrypts with it only", async () => {
  const credentials = await deriveCredentials(secret);
  const text = JSON.stringify({ excerpt: "λόγος, ου (ὁ) parole ".repeat(200) });

  const blob = await encryptText(text, credentials);
  expect(blob).toMatch(/^[\w-]+$/);
  expect(blob.length).toBeLessThan(text.length / 4); // Compressed.
  expect(await decryptText(blob, credentials)).toBe(text);

  // Two encryptions differ (random IV).
  expect(await encryptText(text, credentials)).not.toBe(blob);

  const other = await deriveCredentials(new Uint8Array(16).fill(8));
  await expect(decryptText(blob, other)).rejects.toThrow();
  // Nor with the right key in another locker (authenticated locker id).
  await expect(decryptText(blob, { ...credentials, lockerId: other.lockerId })).rejects.toThrow();
});

test("the encoding byte is authenticated", async () => {
  const credentials = await deriveCredentials(secret);
  const blob = await encryptText("λόγος", credentials);
  const bytes = Uint8Array.from(atob(blob.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  expect(bytes[0]).toBe(3); // Compressed, authenticated.

  // Changed by the server: the decryption fails.
  for (const encoding of [0, 1, 2]) {
    bytes[0] = encoding;
    const tampered = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await expect(decryptText(tampered, credentials)).rejects.toThrow();
  }
});
