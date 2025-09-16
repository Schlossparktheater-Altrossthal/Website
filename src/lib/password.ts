export async function getBcrypt() {
  const mod = await import("bcryptjs");
  return (mod as any).default ?? mod;
}

export async function hashPassword(password: string) {
  const bcrypt = await getBcrypt();
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  const bcrypt = await getBcrypt();
  return bcrypt.compare(password, hash);
}
