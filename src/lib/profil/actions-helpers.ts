import { cookies } from "next/headers";

const BASE_URL = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function authorizedFetch(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const headers = new Headers(init.headers ?? {});
  headers.set("accept", "application/json");

  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  const body = init.body;
  if (body && !(body instanceof FormData)) {
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
  }

  return fetch(`${BASE_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers,
  });
}
