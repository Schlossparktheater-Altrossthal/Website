import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthentikApiError,
  ensureAuthentikUser,
  setAuthentikPassword,
  type AuthentikUser,
} from "@/lib/authentik/client";

const managedUser: AuthentikUser = {
  pk: 7,
  uid: "abc123",
  username: "anna@example.org",
  name: "Anna",
  email: "anna@example.org",
  is_active: true,
  path: "mitgliederbereich",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("authentik client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv("AUTHENTIK_URL", "https://auth.example.org");
    vi.stubEnv("AUTHENTIK_API_TOKEN", "token");
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("returns an existing account found by email", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [managedUser] }));

    const user = await ensureAuthentikUser({
      userId: "u1",
      email: "Anna@Example.org",
      name: "Anna",
    });

    expect(user.uid).toBe("abc123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/api/v3/core/users/");
    expect(url.searchParams.get("email")).toBe("anna@example.org");
  });

  it("creates a managed account when none exists", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse(managedUser, 201));

    await ensureAuthentikUser({ userId: "u1", email: "anna@example.org", name: "Anna" });

    const [, init] = fetchMock.mock.calls[1] ?? [];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      username: "anna@example.org",
      email: "anna@example.org",
      path: "mitgliederbereich",
      attributes: { mitgliederbereich: { userId: "u1" } },
    });
  });

  it("never sets passwords on accounts outside the managed path", async () => {
    await expect(
      setAuthentikPassword({ ...managedUser, path: "users" }, "geheim-123"),
    ).rejects.toBeInstanceOf(AuthentikApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces API errors with status", async () => {
    fetchMock.mockResolvedValueOnce(new Response("forbidden", { status: 403 }));
    await expect(setAuthentikPassword(managedUser, "geheim-123")).rejects.toMatchObject({
      status: 403,
    });
  });
});
