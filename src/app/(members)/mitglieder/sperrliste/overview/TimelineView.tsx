import React from "react";

import type { DayColumn, OverviewPerson } from "./types";

type TimelineViewProps = {
  people: OverviewPerson[];
  dayCols: DayColumn[];
  highlightedDay: number | null;
  setHighlightedDay: (day: number | null) => void;
};

export function TimelineView({ people, dayCols, highlightedDay, setHighlightedDay }: TimelineViewProps) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {dayCols.map((day) => (
          <button
            key={day.key}
            onClick={() => setHighlightedDay(day.n)}
            className={`rounded-full px-3 py-2 ${highlightedDay === day.n ? "bg-blue-200" : "bg-gray-100"}`}
          >
            {day.label} {day.n}
          </button>
        ))}
      </div>
      <div className="grid gap-2">
        {people.map((person) => (
          <div key={person.id} className="rounded-lg border p-2">
            <div className="mb-1 font-bold">{person.name}</div>
            <div className="flex gap-1">
              {person.days.map((cell, index) => (
                <span
                  key={`${person.id}-${person.days[index].dayKey}`}
                  className={`rounded px-2 py-1 ${
                    cell.type === "block"
                      ? "bg-red-100"
                      : cell.type === "limited"
                        ? "bg-orange-100"
                        : cell.type === "preferred"
                          ? "bg-green-100"
                          : "bg-gray-100"
                  }`}
                >
                  {cell.label || cell.type}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
