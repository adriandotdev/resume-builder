import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson, fromBase64, isEncrypted, toBase64, validatePassphrase } from "@/lib/crypto";
import { makeBundle, isBundle } from "@/lib/versions";
import { createSampleDoc } from "@/lib/sample";
import { parseImport } from "@/lib/importFile";

// Low iteration count keeps the suite fast; the default is covered by one test below.
const FAST = 100_000;

describe("encrypted backup", () => {
  it("round-trips a bundle and imports it through the normal pipeline", async () => {
    const bundle = makeBundle([{ id: "v1", name: "Frontend", doc: createSampleDoc() }]);
    const env = await encryptJson(JSON.stringify(bundle), "correct horse", FAST);
    expect(isEncrypted(env)).toBe(true);
    const res = await decryptJson(env, "correct horse");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const raw = JSON.parse(res.plain);
    expect(isBundle(raw)).toBe(true);
    const parsed = parseImport(raw, "x");
    expect(parsed.ok && parsed.versions[0].name).toBe("Frontend");
  });

  it("does not leak the plaintext into the file", async () => {
    const env = await encryptJson(JSON.stringify({ secret: "Elena Marchetti" }), "passphrase1", FAST);
    expect(JSON.stringify(env)).not.toContain("Elena");
  });

  it("rejects a wrong passphrase", async () => {
    const env = await encryptJson("{}", "right-passphrase", FAST);
    expect(await decryptJson(env, "wrong-passphrase")).toEqual({ ok: false, reason: "wrong-passphrase" });
  });

  it("rejects tampered ciphertext", async () => {
    const env = await encryptJson("{\"a\":1}", "passphrase1", FAST);
    const bytes = fromBase64(env.ciphertext)!;
    bytes[0] ^= 1;
    expect((await decryptJson({ ...env, ciphertext: toBase64(bytes) }, "passphrase1")).ok).toBe(false);
  });

  it("uses a fresh salt and iv each time", async () => {
    const a = await encryptJson("{}", "passphrase1", FAST);
    const b = await encryptJson("{}", "passphrase1", FAST);
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.iv).not.toBe(b.cipher.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("treats equivalent Unicode forms of a passphrase as the same", async () => {
    const env = await encryptJson("{}", "café-pass", FAST);
    expect((await decryptJson(env, "café-pass")).ok).toBe(true);
  });

  it("uses the default work factor", async () => {
    const env = await encryptJson("{}", "passphrase1");
    expect(env.kdf.iterations).toBe(600_000);
    expect((await decryptJson(env, "passphrase1")).ok).toBe(true);
  }, 20_000);

  it("isEncrypted rejects bad shapes and out-of-range work factors", async () => {
    const env = await encryptJson("{}", "passphrase1", FAST);
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted({})).toBe(false);
    expect(isEncrypted({ ...env, v: 2 })).toBe(false);
    expect(isEncrypted({ ...env, kdf: { ...env.kdf, iterations: 1 } })).toBe(false);
    expect(isEncrypted({ ...env, kdf: { ...env.kdf, iterations: 1e9 } })).toBe(false);
    expect(isEncrypted({ ...env, kdf: { ...env.kdf, salt: "AAAA" } })).toBe(false);
    expect(isEncrypted({ ...env, cipher: { ...env.cipher, iv: "not base64!" } })).toBe(false);
    expect(isEncrypted({ ...env, ciphertext: "" })).toBe(false);
    expect(isEncrypted(makeBundle([]))).toBe(false);
  });

  it("is not mistaken for a bundle or a resume", async () => {
    const env = await encryptJson("{}", "passphrase1", FAST);
    expect(isBundle(env)).toBe(false);
    expect(parseImport(env, "x").ok).toBe(false);
  });

  it("validatePassphrase checks length first, then the repeat", () => {
    expect(validatePassphrase("short", "short")).toHaveLength(1);
    expect(validatePassphrase("long enough", "different")[0]).toMatch(/match/);
    expect(validatePassphrase("long enough", "long enough")).toEqual([]);
  });
});
