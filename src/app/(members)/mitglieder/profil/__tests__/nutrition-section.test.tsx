// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OnboardingProfile } from "../profile-shared";
import { NutritionSection } from "../sections/nutrition-section";

const mocks = vi.hoisted(() => ({
  upsertAllergy: vi.fn(),
  deleteAllergy: vi.fn(),
  upsertAversion: vi.fn(),
  deleteAversion: vi.fn(),
  saveDietary: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../actions/allergies", () => ({
  upsertAllergyAction: mocks.upsertAllergy,
  deleteAllergyAction: mocks.deleteAllergy,
}));
vi.mock("../actions/aversions", () => ({
  upsertAversionAction: mocks.upsertAversion,
  deleteAversionAction: mocks.deleteAversion,
}));
vi.mock("../actions/dietary", () => ({ saveDietaryPreferenceAction: mocks.saveDietary }));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

// Radix misst seine Popups; ohne ResizeObserver bricht das Rendern im jsdom ab.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
Element.prototype.scrollIntoView = vi.fn();

const onboarding: OnboardingProfile = {
  focus: "acting",
  background: null,
  backgroundClass: null,
  education: {
    educationCategory: null,
    educationSchoolName: null,
    educationClassName: null,
    educationWorkDescription: null,
    educationUniversityName: null,
    educationOtherDescription: null,
  },
  notes: null,
  memberSinceYear: null,
  dietaryPreference: "Allesesser",
  dietaryPreferenceVariant: null,
  dietaryPreferenceStrictness: "Nicht relevant",
  whatsappLinkVisitedAt: null,
  updatedAt: null,
  preferences: [],
  show: null,
  whatsappLink: null,
};

function renderSection(overrides: Partial<React.ComponentProps<typeof NutritionSection>> = {}) {
  const onAllergiesChange = vi.fn();
  const onAversionsChange = vi.fn();
  const onDietaryUpdated = vi.fn();
  render(
    <NutritionSection
      onboarding={onboarding}
      allergies={[]}
      onAllergiesChange={onAllergiesChange}
      aversions={[]}
      onAversionsChange={onAversionsChange}
      onDietaryUpdated={onDietaryUpdated}
      {...overrides}
    />,
  );
  return { onAllergiesChange, onAversionsChange, onDietaryUpdated };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NutritionSection", () => {
  it("zeigt die drei Karten mit ihren Leerzuständen", () => {
    renderSection();

    expect(screen.getByRole("heading", { name: "Ernährungsstil" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Abneigungen & Besonderheiten" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Allergien & Unverträglichkeiten" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Keine Besonderheiten hinterlegt.")).toBeInTheDocument();
    expect(screen.getByText("Keine Allergien hinterlegt.")).toBeInTheDocument();
  });

  it("zeigt die Unterform nur bei vegetarischem Stil", () => {
    renderSection({
      onboarding: { ...onboarding, dietaryPreference: "Vegetarisch" },
    });
    expect(screen.getByText("Unterform")).toBeInTheDocument();
  });

  it("blendet die Unterform bei Allesesser aus", () => {
    renderSection();
    expect(screen.queryByText("Unterform")).not.toBeInTheDocument();
  });

  it("listet Besonderheiten mit Notiz auf", () => {
    renderSection({
      aversions: [
        { id: "av-1", label: "Keine Pilze", note: "auch keine Trüffel", updatedAt: null },
      ],
    });

    expect(screen.getByText("Keine Pilze")).toBeInTheDocument();
    expect(screen.getByText("auch keine Trüffel")).toBeInTheDocument();
  });

  it("listet Allergien mit Art, Schweregrad und Spuren-Hinweis auf", () => {
    renderSection({
      allergies: [
        {
          id: "al-1",
          allergen: "Erdnüsse",
          kind: "ALLERGY",
          level: "LETHAL",
          tracesOk: false,
          diagnosed: true,
          symptoms: "Atemnot",
          treatment: "Adrenalin",
          note: null,
          updatedAt: null,
        },
      ],
    });

    const entry = screen.getByText("Erdnüsse").closest("li");
    expect(entry).not.toBeNull();
    const badges = within(entry as HTMLElement);
    expect(badges.getByText("Allergie")).toBeInTheDocument();
    expect(badges.getByText("Lebensbedrohlich")).toBeInTheDocument();
    expect(badges.getByText("Keine Spuren")).toBeInTheDocument();
  });

  it("verlangt ein Allergen, bevor gespeichert wird", async () => {
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: /Allergie/ }));
    const dialog = await screen.findByRole("dialog");
    // Regression: mit `PopoverTrigger` bekam das Feld `type="button"` und war nicht beschreibbar.
    expect(dialog.querySelector("#allergen")?.getAttribute("type")).not.toBe("button");
    fireEvent.submit(dialog.querySelector("form")!);

    expect(await screen.findByText("Bitte gib ein Allergen an.")).toBeInTheDocument();
    expect(mocks.upsertAllergy).not.toHaveBeenCalled();
  });

  it("legt eine Besonderheit an und meldet sie nach oben", async () => {
    mocks.upsertAversion.mockResolvedValue({
      ok: true,
      data: { aversion: { id: "av-1", label: "Keine Pilze", note: null, updatedAt: null } },
    });
    const { onAversionsChange } = renderSection();

    fireEvent.click(screen.getByRole("button", { name: /Besonderheit/ }));
    const dialog = await screen.findByRole("dialog");
    const labelField = dialog.querySelector<HTMLInputElement>("#aversion-label")!;
    fireEvent.change(labelField, { target: { value: "  Keine Pilze  " } });
    fireEvent.submit(dialog.querySelector("form")!);

    await waitFor(() =>
      expect(mocks.upsertAversion).toHaveBeenCalledWith({ label: "Keine Pilze", note: null }),
    );
    expect(onAversionsChange).toHaveBeenCalledWith([
      { id: "av-1", label: "Keine Pilze", note: null, updatedAt: null },
    ]);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Besonderheit gespeichert");
  });

  it("weist eine zu kurze Besonderheit ab", async () => {
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: /Besonderheit/ }));
    const dialog = await screen.findByRole("dialog");
    const labelField = dialog.querySelector<HTMLInputElement>("#aversion-label")!;
    fireEvent.change(labelField, { target: { value: "x" } });
    fireEvent.submit(dialog.querySelector("form")!);

    expect(await screen.findByText("Bitte gib eine Besonderheit an.")).toBeInTheDocument();
    expect(mocks.upsertAversion).not.toHaveBeenCalled();
  });
});
