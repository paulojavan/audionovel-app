import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const PASSWORD_HASH_PREFIX = "scrypt";
const SALT_BYTES = 16;
const KEY_BYTES = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_BYTES).toString("base64url");
  const key = (await scryptAsync(password, salt, KEY_BYTES)) as Buffer;

  return `${PASSWORD_HASH_PREFIX}$${salt}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [prefix, salt, hash] = storedHash.split("$");

  if (prefix !== PASSWORD_HASH_PREFIX || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "base64url");
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
