import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthentikApiError,
  deactivateAuthentikUser,
  ensureAuthentikUser,
  hasAuthentikPasswordSinceCreation,
  reconcileAuthentikUser,
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
  date_joined: "2026-09-01T10:00:00Z",
  password_change_date: "2026-09-01T10:00:01Z",
  attributes: { mitgliederbereich: { userId: "u1" } },
};

const anna = { userId: "u1", email: "anna@example.org", name: "Anna" };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestUrl(call: number) {
  return new URL(String(fetchMock.mock.calls[call]?.[0]));
}

function requestBody(call: number): unknown {
  return JSON.parse(String(fetchMock.mock.calls[call]?.[1]?.body));
}

const fetchMock = vi.fn<typeof fetch>();

describe("authentik client", () => {
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

  it("finds the account by member id before looking at the email", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [managedUser] }));

    const { user, created } = await ensureAuthentikUser(anna);

    expect(user.uid).toBe("abc123");
    expect(created).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestUrl(0).searchParams.get("attributes")).toBe(
      JSON.stringify({ mitgliederbereich__userId: "u1" }),
    );
  });

  it("falls back to the email and creates a managed account when none exists", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse(managedUser, 201));

    const { created } = await ensureAuthentikUser({ ...anna, email: "Anna@Example.org" });

    expect(created).toBe(true);
    expect(requestUrl(1).searchParams.get("email")).toBe("anna@example.org");
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe("POST");
    expect(requestBody(2)).toMatchObject({
      username: "anna@example.org",
      email: "anna@example.org",
      path: "mitgliederbereich",
      attributes: { mitgliederbereich: { userId: "u1" } },
    });
  });

  it("refuses an email match that belongs to another member", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [] })).mockResolvedValueOnce(
      jsonResponse({
        results: [{ ...managedUser, attributes: { mitgliederbereich: { userId: "u2" } } }],
      }),
    );

    await expect(ensureAuthentikUser(anna)).rejects.toBeInstanceOf(AuthentikApiError);
  });

  it("updates email, username and name after a change in the member area", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(managedUser));

    await reconcileAuthentikUser(managedUser, {
      userId: "u1",
      email: "anna.neu@example.org",
      name: "Anna Neu",
    });

    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("PATCH");
    expect(requestUrl(0).pathname).toBe("/api/v3/core/users/7/");
    expect(requestBody(0)).toEqual({
      email: "anna.neu@example.org",
      username: "anna.neu@example.org",
      name: "Anna Neu",
    });
  });

  it("leaves accounts outside the managed path untouched", async () => {
    const admin = { ...managedUser, path: "users", attributes: {} };
    await reconcileAuthentikUser(admin, { ...anna, name: "Anders" });
    await expect(setAuthentikPassword(admin, "geheim-123")).rejects.toBeInstanceOf(
      AuthentikApiError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deactivates deleted members and drops the member id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...managedUser, is_active: false }));

    await deactivateAuthentikUser(managedUser);

    expect(requestBody(0)).toEqual({
      is_active: false,
      attributes: { mitgliederbereich: { deletedUserId: "u1" } },
    });
  });

  it("detects passwords set in Authentik after the account was created", () => {
    expect(hasAuthentikPasswordSinceCreation(managedUser)).toBe(false);
    expect(
      hasAuthentikPasswordSinceCreation({
        ...managedUser,
        password_change_date: "2026-09-05T08:00:00Z",
      }),
    ).toBe(true);
    expect(hasAuthentikPasswordSinceCreation({ ...managedUser, password_change_date: null })).toBe(
      false,
    );
  });

  it("surfaces API errors with status", async () => {
    fetchMock.mockResolvedValueOnce(new Response("forbidden", { status: 403 }));
    await expect(setAuthentikPassword(managedUser, "geheim-123")).rejects.toMatchObject({
      status: 403,
    });
  });
});
