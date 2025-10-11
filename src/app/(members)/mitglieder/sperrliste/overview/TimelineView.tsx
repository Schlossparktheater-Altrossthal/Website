import React, { useMemo } from "react";

export function TimelineView({ people, dayCols, holidays, highlightedDay, setHighlightedDay }: {
  people: any[];
  dayCols: any[];
  holidays: any[];
  highlightedDay: number | null;
  setHighlightedDay: (n: number) => void;
}) {
  // Portierung der Logik aus Spielplatz
  function selectDayBuckets(people: any[], dayCols: any[], holidays: any[]) {
    return dayCols.map((dc, idx) => {
      const entries = people.map((p) => ({ person: p, cell: p.days[idx] }));
      const can = entries.filter((e) => e.cell.type === "preferred" || e.cell.type === "free");
      const limited = entries.filter((e) => e.cell.type === "limited");
      const blocked = entries.filter((e) => e.cell.type === "block");
      const holidayInfo = holidays.find((h: any) => h.dayIndex === idx);
      const holiday = !!holidayInfo;
      const holidayLabel = holidayInfo?.label;
      const holidayType = holidayInfo?.type || "vacation";
      const isPublicHoliday = holidayInfo?.type === "holiday" || holidayInfo?.isHoliday;
      return { dc, can, limited, blocked, holiday, holidayLabel, holidayType, isPublicHoliday };
    });
  }
  const buckets = useMemo(() => selectDayBuckets(people, dayCols, holidays), [people, dayCols, holidays]);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {dayCols.map((d, idx) => (
          <button key={idx} onClick={() => setHighlightedDay(d.n)} className={`rounded-full px-3 py-2 ${highlightedDay === d.n ? 'bg-blue-200' : 'bg-gray-100'}`}>{d.label} {d.n}</button>
        ))}
      </div>
      <div className="grid gap-2">
        {people.map((p, idx) => (
          <div key={idx} className="border rounded-lg p-2">
            <div className="font-bold mb-1">{p.name}</div>
            <div className="flex gap-1">
              {p.days.map((cell: any, i: number) => (
                <span key={i} className={`px-2 py-1 rounded ${cell.type === 'block' ? 'bg-red-100' : cell.type === 'limited' ? 'bg-orange-100' : cell.type === 'preferred' ? 'bg-green-100' : 'bg-gray-100'}`}>{cell.label || cell.type}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
