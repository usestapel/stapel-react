/** SHA-256 hex via WebCrypto — user ids are hashed before any provider sees them. */
export async function sha256Hex(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "[stapel analytics] crypto.subtle is unavailable; cannot hash user ids"
    );
  }
  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
