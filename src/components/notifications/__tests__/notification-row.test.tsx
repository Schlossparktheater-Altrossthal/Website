// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { decideMock, toastMock } = vi.hoisted(() => ({
  decideMock: vi.fn(),
  toastMock: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

vi.mock("@/app/(members)/mitglieder/produktionen/actions/assignments", () => ({
  decideJoinRequestAction: decideMock,
}));
vi.mock("sonner", () => ({ toast: toastMock }));

import { groupInboxItems, type InboxItem } from "@/lib/notifications/inbox-shared";

import { NotificationRow } from "../notification-row";

function item(overrides: Partial<InboxItem>): InboxItem {
  return {
    id: "r1",
    notificationId: "n1",
    type: "rehearsal-attendance",
    category: "proben",
    kind: "info",
    priority: "normal",
    title: "Absage: Anna – Probe Sa",
    body: "Grund: krank",
    actionUrl: "/mitglieder/proben/e1",
    groupKey: "decline:e1",
    eventId: "e1",
    showId: null,
    actorId: null,
    data: null,
    createdAt: new Date().toISOString(),
    readAt: null,
    doneAt: null,
    archivedAt: null,
    ...overrides,
  };
}

describe("NotificationRow", () => {
  const update = vi.fn().mockResolvedValue(undefined);
  beforeEach(() => {
    update.mockClear();
    decideMock.mockReset();
  });

  it("zeigt Bündel zusammengefasst und klappt Einzelne auf", async () => {
    const [group] = groupInboxItems([
      item({ id: "r1", title: "Absage: Anna – Probe Sa" }),
      item({ id: "r2", title: "Absage: Ben – Probe Sa" }),
    ]);
    render(<NotificationRow group={group} update={update} />);

    expect(screen.getByText("2 Absagen – Probe Sa")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Alle 2 anzeigen/ }));
    expect(screen.getByText("Absage: Ben – Probe Sa")).toBeInTheDocument();
  });

  it("markiert beim Öffnen als gelesen und archiviert das ganze Bündel", async () => {
    const [group] = groupInboxItems([item({})]);
    render(<NotificationRow group={group} update={update} />);

    await userEvent.click(screen.getByRole("link"));
    expect(update).toHaveBeenCalledWith("read", { groupKeys: ["decline:e1"] });

    await userEvent.click(screen.getByRole("button", { name: "Archivieren" }));
    expect(update).toHaveBeenCalledWith("archive", { groupKeys: ["decline:e1"] });
  });

  it("nimmt Gewerke-Anfragen direkt an", async () => {
    decideMock.mockResolvedValue({ ok: true });
    const [group] = groupInboxItems([
      item({
        type: "department-request",
        category: "gewerke",
        kind: "action",
        groupKey: null,
        title: "Anfrage für Kostüm: Mia möchte mitmachen",
        data: { departmentId: "d1", requesterId: "u1" },
      }),
    ]);
    render(<NotificationRow group={group} update={update} />);

    await userEvent.click(screen.getByRole("button", { name: "Annehmen" }));
    expect(decideMock).toHaveBeenCalledWith({ departmentId: "d1", userId: "u1", accept: true });
    expect(update).toHaveBeenCalledWith("done", { ids: ["r1"] });
  });
});
