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

  describe("backward compatibility with legacy AES-256-CBC ciphertexts", () => {
    it("decrypts a value encrypted with the old CBC format (no gcm: prefix)", () => {
      // Generado una sola vez con la MISMA ENCRYPTION_KEY de vitest.setup.ts
      // (Buffer.alloc(32, 7)) usando el algoritmo viejo (aes-256-cbc, IV de
      // 16 bytes, sin auth tag) — simula una contraseña SMTP que ya estaba
      // guardada en la BD antes de migrar a AES-256-GCM.
      const legacyCiphertext =
        "03030303030303030303030303030303:51565171855243d41fa11833e51101dfffc790af086ce99af7fb9ffb8ada5f28";
      expect(decrypt(legacyCiphertext)).toBe("legacy-secret-value");
    });

    it("new encrypt() output uses the gcm: prefix, not the legacy format", () => {
      expect(encrypt("hello")).toMatch(/^gcm:/);
    });

    it("isEncrypted recognizes both the legacy CBC format and the new GCM format", () => {
      const legacyCiphertext =
        "03030303030303030303030303030303:51565171855243d41fa11833e51101dfffc790af086ce99af7fb9ffb8ada5f28";
      expect(isEncrypted(legacyCiphertext)).toBe(true);
      expect(isEncrypted(encrypt("hello"))).toBe(true);
    });
  });
});
