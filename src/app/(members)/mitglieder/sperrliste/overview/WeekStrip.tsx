import React, { useMemo } from "react";

// Dummy-Typen, später anpassen
export function WeekStrip({ people, dayCols, holidays, onJump }: { people: any[]; dayCols: any[]; holidays: any[]; onJump: (n: number) => void }) {
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
    <div className="overflow-x-auto">
      <div className="flex gap-2">
        {buckets.map((d, idx) => (
          <button key={idx} onClick={() => onJump(d.dc.n)} className="rounded-lg border px-3 py-2">
            <div>{d.dc.label} {d.dc.n}</div>
            <div className="flex gap-1 text-xs">
              <span className="text-green-600">{d.can.length} frei</span>
              <span className="text-orange-600">{d.limited.length} begrenzt</span>
              <span className="text-red-600">{d.blocked.length} gesperrt</span>
            </div>
            {d.holiday && <div className="text-blue-600 text-xs">{d.holidayLabel || d.holidayType}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
