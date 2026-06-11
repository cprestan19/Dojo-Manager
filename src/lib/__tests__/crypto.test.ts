import { describe, it, expect } from "vitest";
import { encrypt, decrypt, isEncrypted } from "@/lib/crypto";

describe("crypto", () => {
  it("returns empty string for empty input", () => {
    expect(encrypt("")).toBe("");
    expect(decrypt("")).toBe("");
  });

  it("encrypts and decrypts a round trip", () => {
    const plain = "super-secret-password";
    const enc = encrypt(plain);
    expect(enc).not.toBe(plain);
    expect(decrypt(enc)).toBe(plain);
  });

  it("produces a different ciphertext on each call (random IV)", () => {
    const plain = "same-input";
    expect(encrypt(plain)).not.toBe(encrypt(plain));
  });

  describe("isEncrypted", () => {
    it("recognizes the iv:ciphertext hex format", () => {
      expect(isEncrypted(encrypt("hello"))).toBe(true);
    });

    it("rejects plain text", () => {
      expect(isEncrypted("plain-text-value")).toBe(false);
      expect(isEncrypted("••••••••")).toBe(false);
    });

    it("returns empty string for malformed ciphertext", () => {
      expect(decrypt("not-a-valid-format")).toBe("");
      expect(decrypt("onlyone:")).toBe("");
    });
  });
});
