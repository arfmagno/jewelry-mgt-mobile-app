/**
 * ULID: 48-bit timestamp + 80 bits of randomness, Crockford base32 (26 chars).
 * Sortable by creation time and safe to generate offline on any device.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export type RandomBytes = (length: number) => Uint8Array;

const defaultRandom: RandomBytes = (length) => {
  const bytes = new Uint8Array(length);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) return c.getRandomValues(bytes);
  for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
};

export function createUlid(random: RandomBytes = defaultRandom, now: () => number = Date.now) {
  return (): string => {
    let time = now();
    let timePart = "";
    for (let i = 0; i < 10; i++) {
      timePart = ALPHABET[time % 32] + timePart;
      time = Math.floor(time / 32);
    }
    const bytes = random(16);
    let randPart = "";
    for (let i = 0; i < 16; i++) randPart += ALPHABET[bytes[i]! % 32];
    return timePart + randPart;
  };
}

export const ulid = createUlid();
