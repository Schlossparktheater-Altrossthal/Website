import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Objektspeicher (S3-kompatibel, im Cluster RustFS). Nur clusterintern erreichbar: Uploads und
 * Downloads laufen durch die App. Konfiguration über `S3_*`-Variablen; ohne Schlüssel ist der
 * Speicher aus und Medienfunktionen melden „nicht verfügbar“.
 */
type StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  /** Nur lesend, z. B. Staging liest Dateien aus der kopierten Prod-DB. */
  fallbackBucket: string | null;
  accessKeyId: string;
  secretAccessKey: string;
};

function readConfig(): StorageConfig | null {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint,
    region: process.env.S3_REGION || "us-east-1",
    bucket,
    fallbackBucket: process.env.S3_FALLBACK_BUCKET || null,
    accessKeyId,
    secretAccessKey,
  };
}

let cached: { config: StorageConfig; client: S3Client } | null | undefined;

function storage() {
  if (cached === undefined) {
    const config = readConfig();
    cached = config
      ? {
          config,
          client: new S3Client({
            endpoint: config.endpoint,
            region: config.region,
            forcePathStyle: true,
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            },
          }),
        }
      : null;
  }
  return cached;
}

export function isStorageConfigured() {
  return storage() !== null;
}

export class StorageUnavailableError extends Error {
  constructor() {
    super("Der Medienspeicher ist nicht eingerichtet.");
  }
}

function requireStorage() {
  const current = storage();
  if (!current) throw new StorageUnavailableError();
  return current;
}

/** Bucket, in den neue Dateien geschrieben werden. */
export function writeBucket() {
  return requireStorage().config.bucket;
}

/** Darf aus diesem Bucket gelesen werden (eigener oder Fallback)? */
function readable(bucket: string) {
  const { config } = requireStorage();
  return bucket === config.bucket || bucket === config.fallbackBucket;
}

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  const { client, config } = requireStorage();
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.byteLength,
    }),
  );
  return { bucket: config.bucket, key };
}

/** Liest ein Objekt, optional nur einen Bereich (`Range: bytes=…` für Audio-Spulen). */
export async function getObject(bucket: string, key: string, range?: string | null) {
  const { client } = requireStorage();
  if (!readable(bucket)) throw new Error(`Bucket ${bucket} ist hier nicht lesbar.`);
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key, Range: range ?? undefined }),
  );
  return {
    body: result.Body?.transformToWebStream() ?? null,
    contentLength: result.ContentLength ?? null,
    contentRange: result.ContentRange ?? null,
    contentType: result.ContentType ?? null,
    etag: result.ETag ?? null,
  };
}

/** Löscht Objekte im eigenen Bucket; fremde (Fallback-)Objekte bleiben unangetastet. */
export async function deleteObjects(objects: readonly { bucket: string; key: string }[]) {
  const current = storage();
  if (!current) return;
  const keys = objects
    .filter((object) => object.bucket === current.config.bucket)
    .map((object) => ({ Key: object.key }));
  for (let index = 0; index < keys.length; index += 1000) {
    await current.client.send(
      new DeleteObjectsCommand({
        Bucket: current.config.bucket,
        Delete: { Objects: keys.slice(index, index + 1000), Quiet: true },
      }),
    );
  }
}
