import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HttpError,
  extractMessage,
  extractTicketInfo,
  getErrorMessage,
  readResponseBody,
  shouldUseOfflineFallback,
} from "../scan-page-client";

describe("scan page helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("derives human readable error messages", () => {
    expect(getErrorMessage(new HttpError(503, "Service unavailable"))).toBe(
      "Service unavailable",
    );
    expect(getErrorMessage(new Error("Validation failed"))).toBe("Validation failed");
    expect(getErrorMessage(42)).toBe("42");
  });

  it("detects when offline fallback should be used", () => {
    expect(shouldUseOfflineFallback(new HttpError(500, "Server error"))).toBe(true);
    expect(shouldUseOfflineFallback(new HttpError(404, "Not found"))).toBe(false);
    expect(shouldUseOfflineFallback(new TypeError("Failed to fetch"))).toBe(true);

    const domException = new DOMException("Aborted", "AbortError");
    expect(shouldUseOfflineFallback(domException)).toBe(true);

    vi.stubGlobal("navigator", { onLine: false } as Partial<Navigator>);
    expect(shouldUseOfflineFallback(new Error("Network unstable"))).toBe(true);
  });

  it("extracts useful information from ticket payloads", () => {
    const info = extractTicketInfo({
      ticket: {
        id: "ticket-1",
        holderName: "Max Mustermann",
        eventId: "event-1",
        status: "checked_in",
      },
    });

    expect(info).toEqual({
      id: "ticket-1",
      holderName: "Max Mustermann",
      eventId: "event-1",
      status: "checked_in",
    });

    expect(extractTicketInfo({})).toBeNull();
  });

  it("reads response bodies regardless of payload type", async () => {
    const jsonResponse = new Response(JSON.stringify({ message: "ok" }), {
      headers: { "Content-Type": "application/json" },
    });
    await expect(readResponseBody(jsonResponse)).resolves.toEqual({ message: "ok" });

    const textResponse = new Response("plain text", {
      headers: { "Content-Type": "text/plain" },
    });
    await expect(readResponseBody(textResponse)).resolves.toBe("plain text");

    const emptyResponse = new Response(null);
    await expect(readResponseBody(emptyResponse)).resolves.toBeNull();
  });

  it("extracts descriptive messages from API responses", () => {
    expect(extractMessage("All good")).toBe("All good");
    expect(
      extractMessage({
        message: "Ticket gespeichert",
      }),
    ).toBe("Ticket gespeichert");
    expect(extractMessage({ detail: "Conflict" })).toBe("Conflict");
    expect(extractMessage({})).toBeNull();
  });
});
