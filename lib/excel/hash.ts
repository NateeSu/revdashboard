function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: ArrayBuffer | string): Promise<string> {
  const data = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}
