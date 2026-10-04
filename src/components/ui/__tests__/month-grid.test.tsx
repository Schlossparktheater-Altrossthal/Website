// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MonthGrid } from "../month-grid";

function Harness({ onSelect = vi.fn() }: { onSelect?: (key: string) => void }) {
  const [month, setMonth] = React.useState(new Date(2026, 9, 1));
  return (
    <MonthGrid
      month={month}
      selectedKey="2026-10-14"
      onMonthChange={setMonth}
      onSelect={onSelect}
      getDayState={(key) => ({ disabled: key === "2026-10-15" })}
    />
  );
}

const cell = (key: string) => document.querySelector<HTMLElement>(`[data-date="${key}"]`)!;

describe("MonthGrid Tastatur", () => {
  it("hat genau einen Tab-Stopp auf dem gewählten Tag", () => {
    render(<Harness />);
    const tabbable = document.querySelectorAll('[data-date][tabindex="0"]');
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveAttribute("data-date", "2026-10-14");
  });

  it("bewegt den Fokus mit Pfeilen, Pos1/Ende und über gesperrte Tage", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    cell("2026-10-14").focus();
    await user.keyboard("{ArrowRight}");
    expect(cell("2026-10-15")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(cell("2026-10-22")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(cell("2026-10-19")).toHaveFocus();
    await user.keyboard("{End}");
    expect(cell("2026-10-25")).toHaveFocus();
  });

  it("wechselt mit Bild↓ und über den Monatsrand den Monat", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    cell("2026-10-14").focus();
    await user.keyboard("{PageDown}");
    expect(screen.getByRole("grid")).toHaveAccessibleName("November 2026");
    expect(cell("2026-11-14")).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(screen.getByRole("grid")).toHaveAccessibleName("Oktober 2026");
    expect(cell("2026-10-31")).toHaveFocus();
  });

  it("wählt mit Enter, aber nicht auf gesperrten Tagen", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    cell("2026-10-14").focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("2026-10-14", expect.any(Date));
    await user.keyboard("{ArrowRight}{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
