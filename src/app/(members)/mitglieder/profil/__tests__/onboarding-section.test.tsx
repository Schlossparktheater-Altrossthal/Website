// @vitest-environment jsdom

import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OnboardingSectionProps } from "../profile-client";
import { OnboardingSection } from "../profile-client";

const { successMock, errorMock } = vi.hoisted(() => ({
  successMock: vi.fn(),
  errorMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: successMock,
    error: errorMock,
  },
}));

function createProps(overrides: Partial<OnboardingSectionProps> = {}): OnboardingSectionProps {
  const defaultOnWhatsAppVisit = vi
    .fn<NonNullable<OnboardingSectionProps["onWhatsAppVisit"]>>()
    .mockResolvedValue({ visitedAt: new Date().toISOString(), alreadyVisited: false });

  return {
    onboarding: null,
    onOnboardingChange: vi.fn(),
    whatsappLink: "https://example.com",
    whatsappVisitedAt: null,
    onWhatsAppVisit: defaultOnWhatsAppVisit,
    dietaryPreference: { label: null, strictnessLabel: null },
    ...overrides,
  };
}

describe("OnboardingSection WhatsApp callout", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React?: typeof React }).React = React;
    vi.clearAllMocks();
  });

  it("renders pending WhatsApp callout when visit is missing", () => {
    render(<OnboardingSection {...createProps()} />);

    expect(screen.getByText("WhatsApp-Onboarding steht noch aus.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WhatsApp öffnen" })).toBeEnabled();
  });

  it("renders confirmed WhatsApp callout when visit timestamp exists", () => {
    const visitedAt = "2025-01-02T00:00:00.000Z";
    render(<OnboardingSection {...createProps({ whatsappVisitedAt: visitedAt })} />);

    expect(screen.getByText(/WhatsApp-Onboarding bestätigt/)).toBeInTheDocument();
  });

  it("triggers the visit handler when CTA is clicked", async () => {
    const onWhatsAppVisit = vi
      .fn<NonNullable<OnboardingSectionProps["onWhatsAppVisit"]>>()
      .mockResolvedValue({ visitedAt: "2025-01-02T00:00:00.000Z", alreadyVisited: false });

    render(<OnboardingSection {...createProps({ onWhatsAppVisit })} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "WhatsApp öffnen" }));

    expect(onWhatsAppVisit).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(successMock).toHaveBeenCalledWith("WhatsApp-Besuch vermerkt");
    });
  });

  it("shows an error toast when the visit handler rejects", async () => {
    const onWhatsAppVisit = vi
      .fn<NonNullable<OnboardingSectionProps["onWhatsAppVisit"]>>()
      .mockRejectedValue(new Error("Fehler"));

    render(<OnboardingSection {...createProps({ onWhatsAppVisit })} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "WhatsApp öffnen" }));

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Fehler");
    });
  });
});
