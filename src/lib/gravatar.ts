const DEFAULT_IMAGE = "mp";
const DEFAULT_RATING = "g";
const MIN_SIZE = 1;
const MAX_SIZE = 2048;

type GravatarOptions = {
  size?: number;
  defaultImage?: string;
  rating?: string;
  forceDefault?: boolean;
};

function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function leftRotate(value: number, amount: number): number {
  return ((value << amount) | (value >>> (32 - amount))) >>> 0;
}

function addUnsigned(x: number, y: number): number {
  return (x + y) >>> 0;
}

function toWordArray(input: Uint8Array): Uint32Array {
  const length = input.length;
  const bitLength = length * 8;
  const paddedLength = (((bitLength + 64) >>> 9) << 4) + 16;
  const words = new Uint32Array(paddedLength);

  for (let i = 0; i < length; i += 1) {
    words[i >> 2] |= input[i] << ((i % 4) * 8);
  }

  words[length >> 2] |= 0x80 << ((length % 4) * 8);
  words[paddedLength - 2] = bitLength;
  return words;
}

function round(
  func: (b: number, c: number, d: number) => number,
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  s: number,
  t: number,
): number {
  const sum = addUnsigned(addUnsigned(addUnsigned(a, func(b, c, d)), x), t);
  return addUnsigned(leftRotate(sum, s), b);
}

function md5(input: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const words = toWordArray(data);

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  const F = (x: number, y: number, z: number) => (x & y) | (~x & z);
  const G = (x: number, y: number, z: number) => (x & z) | (y & ~z);
  const H = (x: number, y: number, z: number) => x ^ y ^ z;
  const I = (x: number, y: number, z: number) => y ^ (x | ~z);

  for (let i = 0; i < words.length; i += 16) {
    const originalA = a;
    const originalB = b;
    const originalC = c;
    const originalD = d;

    // Round 1
    a = round(F, a, b, c, d, words[i + 0], 7, 0xd76aa478);
    d = round(F, d, a, b, c, words[i + 1], 12, 0xe8c7b756);
    c = round(F, c, d, a, b, words[i + 2], 17, 0x242070db);
    b = round(F, b, c, d, a, words[i + 3], 22, 0xc1bdceee);
    a = round(F, a, b, c, d, words[i + 4], 7, 0xf57c0faf);
    d = round(F, d, a, b, c, words[i + 5], 12, 0x4787c62a);
    c = round(F, c, d, a, b, words[i + 6], 17, 0xa8304613);
    b = round(F, b, c, d, a, words[i + 7], 22, 0xfd469501);
    a = round(F, a, b, c, d, words[i + 8], 7, 0x698098d8);
    d = round(F, d, a, b, c, words[i + 9], 12, 0x8b44f7af);
    c = round(F, c, d, a, b, words[i + 10], 17, 0xffff5bb1);
    b = round(F, b, c, d, a, words[i + 11], 22, 0x895cd7be);
    a = round(F, a, b, c, d, words[i + 12], 7, 0x6b901122);
    d = round(F, d, a, b, c, words[i + 13], 12, 0xfd987193);
    c = round(F, c, d, a, b, words[i + 14], 17, 0xa679438e);
    b = round(F, b, c, d, a, words[i + 15], 22, 0x49b40821);

    // Round 2
    a = round(G, a, b, c, d, words[i + 1], 5, 0xf61e2562);
    d = round(G, d, a, b, c, words[i + 6], 9, 0xc040b340);
    c = round(G, c, d, a, b, words[i + 11], 14, 0x265e5a51);
    b = round(G, b, c, d, a, words[i + 0], 20, 0xe9b6c7aa);
    a = round(G, a, b, c, d, words[i + 5], 5, 0xd62f105d);
    d = round(G, d, a, b, c, words[i + 10], 9, 0x02441453);
    c = round(G, c, d, a, b, words[i + 15], 14, 0xd8a1e681);
    b = round(G, b, c, d, a, words[i + 4], 20, 0xe7d3fbc8);
    a = round(G, a, b, c, d, words[i + 9], 5, 0x21e1cde6);
    d = round(G, d, a, b, c, words[i + 14], 9, 0xc33707d6);
    c = round(G, c, d, a, b, words[i + 3], 14, 0xf4d50d87);
    b = round(G, b, c, d, a, words[i + 8], 20, 0x455a14ed);
    a = round(G, a, b, c, d, words[i + 13], 5, 0xa9e3e905);
    d = round(G, d, a, b, c, words[i + 2], 9, 0xfcefa3f8);
    c = round(G, c, d, a, b, words[i + 7], 14, 0x676f02d9);
    b = round(G, b, c, d, a, words[i + 12], 20, 0x8d2a4c8a);

    // Round 3
    a = round(H, a, b, c, d, words[i + 5], 4, 0xfffa3942);
    d = round(H, d, a, b, c, words[i + 8], 11, 0x8771f681);
    c = round(H, c, d, a, b, words[i + 11], 16, 0x6d9d6122);
    b = round(H, b, c, d, a, words[i + 14], 23, 0xfde5380c);
    a = round(H, a, b, c, d, words[i + 1], 4, 0xa4beea44);
    d = round(H, d, a, b, c, words[i + 4], 11, 0x4bdecfa9);
    c = round(H, c, d, a, b, words[i + 7], 16, 0xf6bb4b60);
    b = round(H, b, c, d, a, words[i + 10], 23, 0xbebfbc70);
    a = round(H, a, b, c, d, words[i + 13], 4, 0x289b7ec6);
    d = round(H, d, a, b, c, words[i + 0], 11, 0xeaa127fa);
    c = round(H, c, d, a, b, words[i + 3], 16, 0xd4ef3085);
    b = round(H, b, c, d, a, words[i + 6], 23, 0x04881d05);
    a = round(H, a, b, c, d, words[i + 9], 4, 0xd9d4d039);
    d = round(H, d, a, b, c, words[i + 12], 11, 0xe6db99e5);
    c = round(H, c, d, a, b, words[i + 15], 16, 0x1fa27cf8);
    b = round(H, b, c, d, a, words[i + 2], 23, 0xc4ac5665);

    // Round 4
    a = round(I, a, b, c, d, words[i + 0], 6, 0xf4292244);
    d = round(I, d, a, b, c, words[i + 7], 10, 0x432aff97);
    c = round(I, c, d, a, b, words[i + 14], 15, 0xab9423a7);
    b = round(I, b, c, d, a, words[i + 5], 21, 0xfc93a039);
    a = round(I, a, b, c, d, words[i + 12], 6, 0x655b59c3);
    d = round(I, d, a, b, c, words[i + 3], 10, 0x8f0ccc92);
    c = round(I, c, d, a, b, words[i + 10], 15, 0xffeff47d);
    b = round(I, b, c, d, a, words[i + 1], 21, 0x85845dd1);
    a = round(I, a, b, c, d, words[i + 8], 6, 0x6fa87e4f);
    d = round(I, d, a, b, c, words[i + 15], 10, 0xfe2ce6e0);
    c = round(I, c, d, a, b, words[i + 6], 15, 0xa3014314);
    b = round(I, b, c, d, a, words[i + 13], 21, 0x4e0811a1);
    a = round(I, a, b, c, d, words[i + 4], 6, 0xf7537e82);
    d = round(I, d, a, b, c, words[i + 11], 10, 0xbd3af235);
    c = round(I, c, d, a, b, words[i + 2], 15, 0x2ad7d2bb);
    b = round(I, b, c, d, a, words[i + 9], 21, 0xeb86d391);

    a = addUnsigned(a, originalA);
    b = addUnsigned(b, originalB);
    c = addUnsigned(c, originalC);
    d = addUnsigned(d, originalD);
  }

  const toHex = (value: number) => {
    let result = "";
    for (let i = 0; i < 4; i += 1) {
      result += ((value >>> (i * 8)) & 0xff).toString(16).padStart(2, "0");
    }
    return result;
  };

  return (toHex(a) + toHex(b) + toHex(c) + toHex(d)).toLowerCase();
}

function sanitizeSize(input?: number): number {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return 0;
  }

  return Math.round(input);
}

export function getGravatarUrl(email?: string | null, options: GravatarOptions = {}): string {
  const normalizedEmail = normalizeEmail(email);
  const requestedSize = sanitizeSize(options.size);
  const size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, requestedSize || 80));
  const defaultImage = options.defaultImage ?? DEFAULT_IMAGE;
  const rating = options.rating ?? DEFAULT_RATING;
  const forceDefault = options.forceDefault ? "y" : undefined;
  const hash = normalizedEmail ? md5(normalizedEmail) : "";

  const params = new URLSearchParams({
    s: String(size),
    d: defaultImage,
    r: rating,
  });

  if (forceDefault) {
    params.set("f", forceDefault);
  }

  return `https://www.gravatar.com/avatar/${hash}?${params.toString()}`;
}

export { md5 };
