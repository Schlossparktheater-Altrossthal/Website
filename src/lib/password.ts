type BcryptModule = {
  hash(data: string, salt: string | number): Promise<string>;
  compare(data: string, encrypted: string): Promise<boolean>;
};

let cachedBcrypt: BcryptModule | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBcryptModule(value: unknown): value is BcryptModule {
  return (
    isRecord(value) &&
    typeof value.hash === "function" &&
    typeof value.compare === "function"
  );
}

async function loadBcrypt(): Promise<BcryptModule> {
  if (cachedBcrypt) return cachedBcrypt;

  const imported = (await import("bcryptjs")) as unknown;
  const candidate = isRecord(imported) && "default" in imported ? imported.default : imported;

  if (!isBcryptModule(candidate)) {
    throw new Error("Ungültiges bcryptjs-Modul geladen");
  }

  cachedBcrypt = candidate;
  return cachedBcrypt;
}

export async function hashPassword(password: string) {
  const bcrypt = await loadBcrypt();
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  const bcrypt = await loadBcrypt();
  return bcrypt.compare(password, hash);
}
