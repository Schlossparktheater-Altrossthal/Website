// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MonthGrid } from "../month-grid";

function MultiHarness({ onSelect = vi.fn() }: { onSelect?: (key: string) => void }) {
  const [keys, setKeys] = React.useState<Set<string> | null>(null);
  return (
    <>
      <output data-testid="keys">{keys ? [...keys].sort().join(",") : "aus"}</output>
      <MonthGrid
        month={new Date(2026, 9, 1)}
        selectedKey="2026-10-14"
        onSelect={onSelect}
        multiSelect={{ keys, onChange: setKeys, isSelectable: (key) => key >= "2026-10-05" }}
        getDayState={() => ({})}
      />
    </>
  );
}

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

describe("MonthGrid Mehrfachauswahl", () => {
  const keys = () => screen.getByTestId("keys").textContent;

  it("startet mit Strg-Klick inklusive des gewählten Tages und schaltet dann per Klick um", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<MultiHarness onSelect={onSelect} />);
    await user.keyboard("{Control>}");
    await user.click(cell("2026-10-16"));
    await user.keyboard("{/Control}");
    expect(keys()).toBe("2026-10-14,2026-10-16");
    await user.click(cell("2026-10-14"));
    expect(keys()).toBe("2026-10-16");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("wählt mit Shift-Klick einen Zeitraum ohne nicht wählbare Tage", async () => {
    const user = userEvent.setup();
    render(<MultiHarness />);
    await user.click(cell("2026-10-06"));
    await user.keyboard("{Shift>}");
    await user.click(cell("2026-10-03"));
    await user.keyboard("{/Shift}");
    expect(keys()).toBe("2026-10-05,2026-10-06");
  });

  it("erweitert mit Shift+Pfeil und beendet mit Esc", async () => {
    const user = userEvent.setup();
    render(<MultiHarness />);
    cell("2026-10-14").focus();
    await user.keyboard("{Shift>}{ArrowRight}{ArrowRight}{/Shift}");
    expect(keys()).toBe("2026-10-14,2026-10-15,2026-10-16");
    await user.keyboard("{Escape}");
    expect(keys()).toBe("aus");
  });
});
