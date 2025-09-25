// @vitest-environment jsdom

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createProductionActionMock } = vi.hoisted(() => ({
  createProductionActionMock: vi.fn(),
}));

const { toastMock } = vi.hoisted(() => {
  const base = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() });
  return { toastMock: base };
});

vi.mock("../actions", () => ({
  createProductionAction: createProductionActionMock,
  setActiveProductionAction: vi.fn(),
  clearActiveProductionAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

import { CreateProductionForm } from "../production-forms-client";

describe("CreateProductionForm", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React?: typeof React }).React = React;
    vi.clearAllMocks();
  });

  it("surfaces validation errors from the server action", async () => {
    createProductionActionMock.mockResolvedValueOnce({ ok: false as const, error: "Bitte gib ein Jahr an." });
    const user = userEvent.setup();

    render(
      <CreateProductionForm
        redirectPath="/mitglieder/produktionen"
        suggestedYear={2025}
        shouldSetActiveByDefault={false}
      />,
    );

    const submitButton = screen.getByRole("button", { name: "Produktion erstellen" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Bitte gib ein Jahr an.");
    });

    expect(toastMock.error).toHaveBeenCalledWith("Bitte gib ein Jahr an.");
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});
