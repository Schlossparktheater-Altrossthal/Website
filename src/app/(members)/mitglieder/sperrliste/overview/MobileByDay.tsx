import React, { useMemo } from "react";

export function MobileByDay({ people, dayCols, holidays }: { people: any[]; dayCols: any[]; holidays: any[] }) {
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
      {buckets.map((d, idx) => (
        <div key={idx} className="border rounded-lg p-2">
          <div className="font-bold mb-1">{d.dc.label} {d.dc.n}</div>
          <div className="text-xs mb-2">{d.holiday ? (d.holidayLabel || d.holidayType) : null}</div>
          <div className="mb-1 text-green-700">{d.can.length} frei</div>
          <div className="mb-1 text-orange-700">{d.limited.length} begrenzt</div>
          <div className="mb-1 text-red-700">{d.blocked.length} gesperrt</div>
        </div>
      ))}
    </div>
  );
}
