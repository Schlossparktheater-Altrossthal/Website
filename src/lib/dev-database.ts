const DATABASE_URL_ENV = "DATABASE_URL";

function getDatabaseUrl(): string | null {
  const raw = process.env[DATABASE_URL_ENV];
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

export function isDatabaseConfigured(): boolean {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    return false;
  }

  try {
    // Validate the connection string for obvious mistakes without opening a connection.
    new URL(connectionString);
    return true;
  } catch (error) {
    console.warn("[dev-database] Invalid DATABASE_URL configured", error);
    return false;
  }
}

function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

export function databaseEnabled(): boolean {
  if (isProductionEnvironment()) {
    return true;
  }
  return isDatabaseConfigured();
}
