import { describe, expect, it } from "vitest";

import {
  computeDedupeKey,
  normalizeOccurredAt,
  serializeScanEventForPayload,
  serializeTicketForPayload,
  TicketCheckInError,
} from "@/lib/tickets/service";
import { TicketStatus } from "@prisma/client";

describe("ticket service helpers", () => {
  it("normalizes missing occurredAt to a current timestamp", () => {
    const before = Date.now();
    const result = normalizeOccurredAt();
    const after = Date.now();

    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });

  it("throws a TicketCheckInError for invalid occurredAt values", () => {
    expect(() => normalizeOccurredAt("not-a-date")).toThrow(TicketCheckInError);
  });

  it("keeps provided dedupe keys and trims whitespace", () => {
    expect(computeDedupeKey("abc", "  ticket:abc   ")).toBe("ticket:abc");
  });

  it("falls back to ticket-based dedupe keys when missing", () => {
    expect(computeDedupeKey("xyz")).toBe("ticket:xyz");
  });

  it("serializes tickets into payload-friendly records", () => {
    const updatedAt = new Date("2025-01-01T12:00:00.000Z");
    const ticket = {
      id: "ticket-1",
      code: "CODE-1",
      status: TicketStatus.checked_in,
      eventId: "event-1",
      holderName: null,
      createdAt: new Date("2024-12-31T12:00:00.000Z"),
      updatedAt,
    };

    expect(serializeTicketForPayload(ticket)).toEqual({
      id: "ticket-1",
      code: "CODE-1",
      status: TicketStatus.checked_in,
      eventId: "event-1",
      updatedAt: updatedAt.toISOString(),
    });
  });

  it("serializes scan events and omits optional fields when absent", () => {
    const occurredAt = new Date("2025-01-02T12:00:00.000Z");
    const scanEvent = {
      id: "scan-1",
      ticketId: "ticket-1",
      code: "CODE-1",
      statusBefore: TicketStatus.unused,
      statusAfter: TicketStatus.checked_in,
      source: null,
      occurredAt,
      dedupeKey: null,
      serverSeq: 10,
      processedAt: null,
      provisional: false,
      clientId: null,
      clientMutationId: null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    };

    expect(serializeScanEventForPayload(scanEvent)).toEqual({
      id: "scan-1",
      ticketId: "ticket-1",
      code: "CODE-1",
      statusBefore: TicketStatus.unused,
      statusAfter: TicketStatus.checked_in,
      occurredAt: occurredAt.toISOString(),
      provisional: false,
    });
  });

  it("includes optional metadata in scan event payloads when present", () => {
    const occurredAt = new Date("2025-01-03T12:00:00.000Z");
    const processedAt = new Date("2025-01-03T12:05:00.000Z");
    const scanEvent = {
      id: "scan-2",
      ticketId: "ticket-2",
      code: "CODE-2",
      statusBefore: TicketStatus.unused,
      statusAfter: TicketStatus.checked_in,
      source: "scanner",
      occurredAt,
      dedupeKey: "ticket:ticket-2",
      serverSeq: 11,
      processedAt,
      provisional: false,
      clientId: "scanner",
      clientMutationId: "mutation-1",
      createdAt: occurredAt,
      updatedAt: occurredAt,
    };

    expect(serializeScanEventForPayload(scanEvent)).toEqual({
      id: "scan-2",
      ticketId: "ticket-2",
      code: "CODE-2",
      statusBefore: TicketStatus.unused,
      statusAfter: TicketStatus.checked_in,
      occurredAt: occurredAt.toISOString(),
      provisional: false,
      processedAt: processedAt.toISOString(),
      source: "scanner",
      dedupeKey: "ticket:ticket-2",
    });
  });
});
