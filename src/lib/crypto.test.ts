import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decrypt, decryptProduct, encrypt } from "./crypto";

const KEY = "a".repeat(64);

describe("encrypt / decrypt", () => {
  beforeEach(() => {
    process.env.SECRET_KEY = KEY;
  });

  afterEach(() => {
    delete process.env.SECRET_KEY;
  });

  it("round-trips a value", () => {
    const token = "jira-api-token-12345";
    expect(decrypt(encrypt(token))).toBe(token);
  });

  it("produces different ciphertext each time, so equal secrets aren't linkable", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("passes null and undefined straight through", () => {
    expect(encrypt(null)).toBeNull();
    expect(encrypt(undefined)).toBeNull();
    expect(decrypt(null)).toBeNull();
    expect(decrypt(undefined)).toBeNull();
  });

  it("handles empty strings and non-ASCII text", () => {
    expect(decrypt(encrypt(""))).toBe("");
    expect(decrypt(encrypt("café ☕ 秘密"))).toBe("café ☕ 秘密");
  });

  it("rejects ciphertext whose payload was altered", () => {
    const parts = encrypt("secret")!.split(":");
    // Flip the last hex digit of the ciphertext.
    const lastChar = parts[2].slice(-1);
    parts[2] = parts[2].slice(0, -1) + (lastChar === "0" ? "1" : "0");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  it("rejects ciphertext re-signed with a different auth tag", () => {
    const parts = encrypt("secret")!.split(":");
    parts[1] = "0".repeat(parts[1].length);
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  it("returns legacy plaintext unchanged so pre-encryption rows still read", () => {
    expect(decrypt("plain-old-token")).toBe("plain-old-token");
  });

  it("refuses to run without a valid 32-byte key", () => {
    delete process.env.SECRET_KEY;
    expect(() => encrypt("x")).toThrow(/SECRET_KEY/);

    process.env.SECRET_KEY = "tooshort";
    expect(() => encrypt("x")).toThrow(/64-character/);
  });

  it("cannot be decrypted with a different key", () => {
    const ciphertext = encrypt("secret")!;
    process.env.SECRET_KEY = "b".repeat(64);
    expect(() => decrypt(ciphertext)).toThrow();
  });
});

describe("decryptProduct", () => {
  beforeEach(() => {
    process.env.SECRET_KEY = KEY;
  });

  afterEach(() => {
    delete process.env.SECRET_KEY;
  });

  it("decrypts both credential fields and leaves everything else alone", () => {
    const stored = {
      id: "prod_1",
      name: "Checkout",
      jiraApiToken: encrypt("jira-secret"),
      confluenceToken: encrypt("confluence-secret"),
    };

    expect(decryptProduct(stored)).toEqual({
      id: "prod_1",
      name: "Checkout",
      jiraApiToken: "jira-secret",
      confluenceToken: "confluence-secret",
    });
  });

  it("tolerates products with no credentials configured", () => {
    expect(decryptProduct({ jiraApiToken: null, confluenceToken: null })).toEqual({
      jiraApiToken: null,
      confluenceToken: null,
    });
  });
});
