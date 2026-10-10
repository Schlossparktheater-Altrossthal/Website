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
  it("zeigt Ernährungsstil und die gemeinsame Liste mit Leerzustand", () => {
    renderSection();

    expect(screen.getByRole("heading", { name: "Ernährungsstil" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Allergien & Abneigungen" })).toBeInTheDocument();
    expect(screen.getByText("Noch nichts eingetragen")).toBeInTheDocument();
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

  it("listet Abneigungen als Chip mit Stufe auf", () => {
    renderSection({
      aversions: [
        { id: "av-1", label: "Keine Pilze", note: "auch keine Trüffel", updatedAt: null },
      ],
    });

    const chip = screen.getByRole("button", { name: /Keine Pilze/ });
    expect(within(chip).getByText("Mag nicht")).toBeInTheDocument();
  });

  it("markiert lebensbedrohliche Allergien als Notfall", () => {
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

    const chip = screen.getByRole("button", { name: /Erdnüsse/ });
    expect(within(chip).getByText("Notfall")).toBeInTheDocument();
  });

  it("verlangt eine Bezeichnung, bevor gespeichert wird", async () => {
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Noch nichts eingetragen" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));

    expect(await within(dialog).findByText("Bitte angeben, worum es geht.")).toBeInTheDocument();
    expect(mocks.upsertAllergy).not.toHaveBeenCalled();
    expect(mocks.upsertAversion).not.toHaveBeenCalled();
  });

  it("legt eine Abneigung an und meldet sie nach oben", async () => {
    mocks.upsertAversion.mockResolvedValue({
      ok: true,
      data: { aversion: { id: "av-1", label: "Keine Pilze", note: null, updatedAt: null } },
    });
    const { onAversionsChange } = renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Noch nichts eingetragen" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(dialog.querySelector<HTMLInputElement>("#restriction-text")!, {
      target: { value: "Keine Pilze" },
    });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Mag ich nicht" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));

    await waitFor(() =>
      expect(mocks.upsertAversion).toHaveBeenCalledWith({ label: "Keine Pilze", note: undefined }),
    );
    expect(onAversionsChange).toHaveBeenCalledWith([
      { id: "av-1", label: "Keine Pilze", note: null, updatedAt: null },
    ]);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Gespeichert");
  });
});
