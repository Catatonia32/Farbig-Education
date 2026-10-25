import "server-only";
import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

const KEY_LENGTH = 64;
const PARAMS = { N: 16384, r: 8, p: 1 };

function derive(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

// Format: scrypt$N$r$p$salt(base64)$hash(base64)
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, {
    ...PARAMS,
    maxmem: 256 * PARAMS.N * PARAMS.r,
  });

  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");

  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);

  // Batasi parameter agar nilai yang dirusak tidak bisa membebani server.
  const validParams =
    Number.isSafeInteger(N) &&
    Number.isSafeInteger(r) &&
    Number.isSafeInteger(p) &&
    N >= 2 &&
    N <= 65536 &&
    (N & (N - 1)) === 0 &&
    r >= 1 &&
    r <= 16 &&
    p >= 1 &&
    p <= 4;

  if (!validParams) return false;

  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");

  if (salt.length === 0 || expected.length === 0) return false;

  try {
    const actual = await derive(password, salt, expected.length, {
      N,
      r,
      p,
      maxmem: 256 * N * r,
    });

    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

// Dipanggil saat email tidak ditemukan, supaya waktu responsnya
// sama dengan email yang ada (mencegah penebakan email terdaftar).
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await dummyHash);
}
