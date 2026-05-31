import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_HEX = process.env.SECRET_KEY ?? "";

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error(
      "SECRET_KEY env var must be a 64-character hex string (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(KEY_HEX, "hex");
}

/**
 * Encrypt a plaintext string. Returns "<iv_hex>:<tag_hex>:<ciphertext_hex>".
 * Returns null if value is null/undefined.
 */
export function encrypt(value: string | null | undefined): string | null {
  if (value == null) return null;
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt fields on a product record that contain encrypted secrets.
 * Returns a new object with jiraApiToken and confluenceToken decrypted.
 */
export function decryptProduct<
  T extends { jiraApiToken?: string | null; confluenceToken?: string | null },
>(product: T): T {
  return {
    ...product,
    jiraApiToken: decrypt(product.jiraApiToken),
    confluenceToken: decrypt(product.confluenceToken),
  };
}

/**
 * Decrypt a value produced by encrypt(). Returns null if value is null.
 * Throws if the ciphertext is tampered with (GCM auth tag mismatch).
 */
export function decrypt(value: string | null | undefined): string | null {
  if (value == null) return null;
  // If it doesn't look like our format, assume it's a legacy plaintext value
  // and return as-is so existing records don't break on first read.
  const parts = value.split(":");
  if (parts.length !== 3) return value;
  const [ivHex, tagHex, dataHex] = parts;
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
