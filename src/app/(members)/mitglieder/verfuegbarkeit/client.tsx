"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { applyTemplateForMonth, saveWeekdayTemplates, upsertMonthAvailability } from "./actions";
import { toast } from "sonner";
import { useMemo, useState } from "react";

type DayEntry = {
  date: string; // YYYY-MM-DD
  kind: "FULL_AVAILABLE" | "FULL_UNAVAILABLE" | "PARTIAL";
  from?: string;
  to?: string;
  note?: string;
};

type TemplateEntry = {
  weekday: number; // 0..6
  kind: "FULL_AVAILABLE" | "FULL_UNAVAILABLE" | "PARTIAL";
  from?: string;
  to?: string;
};

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function getMonthDays(year: number, month: number) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const list: { y: number; m: number; d: number; iso: string; wd: number }[] = [];
  for (let i = 1; i <= days; i++) {
    const dt = new Date(Date.UTC(year, month - 1, i));
    const iso = `${year}-${pad(month)}-${pad(i)}`;
    list.push({ y: year, m: month, d: i, iso, wd: dt.getUTCDay() });
  }
  const startWeekday = first.getUTCDay();
  return { days: list, startWeekday };
}

function WeekdayLabel({ wd }: { wd: number }) {
  const names = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  return <span aria-hidden className="text-xs opacity-70">{names[wd]}</span>;
}

export function ClientAvailability({
  year,
  month,
  initial,
  initialTemplates,
}: {
  year: number;
  month: number;
  initial: DayEntry[];
  initialTemplates: TemplateEntry[];
}) {
  const [entries, setEntries] = useState<Record<string, DayEntry>>(() => Object.fromEntries(initial.map((e) => [e.date, e])));
  const [templates, setTemplates] = useState<Record<number, TemplateEntry>>(() => {
    const map: Record<number, TemplateEntry> = {};
    for (const t of initialTemplates) map[t.weekday] = t;
    // ensure each weekday exists
    for (let wd = 0; wd < 7; wd++) if (!map[wd]) map[wd] = { weekday: wd, kind: "FULL_AVAILABLE" };
    return map;
  });

  const { days, startWeekday } = useMemo(() => getMonthDays(year, month), [year, month]);

  function setFor(date: string, patch: Partial<DayEntry>) {
    setEntries((prev) => ({ ...prev, [date]: { date, kind: prev[date]?.kind ?? "FULL_AVAILABLE", ...prev[date], ...patch } }));
  }
  function setTemplate(weekday: number, patch: Partial<TemplateEntry>) {
    setTemplates((prev) => ({ ...prev, [weekday]: { ...prev[weekday], ...patch, weekday } }));
  }

  async function onSave() {
    const payload: DayEntry[] = Object.values(entries);
    try {
      const res = await upsertMonthAvailability({ year, month, entries: payload });
      if (res?.ok) toast.success("Verfügbarkeit gespeichert");
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler beim Speichern");
    }
  }
  async function onApplyTemplate() {
    try {
      const res = await applyTemplateForMonth(year, month);
      if (res?.ok) toast.success("Vorlage angewendet");
      window.location.reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler beim Anwenden der Vorlage");
    }
  }
  async function onSaveTemplates() {
    try {
      const res = await saveWeekdayTemplates({ templates: Object.values(templates) });
      if (res?.ok) toast.success("Vorlagen gespeichert");
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler beim Speichern der Vorlagen");
    }
  }

  const prevLink = `?year=${month === 1 ? year - 1 : year}&month=${month === 1 ? 12 : month - 1}`;
  const nextLink = `?year=${month === 12 ? year + 1 : year}&month=${month === 12 ? 1 : month + 1}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <a className="rounded border px-2 py-1 hover:bg-accent/30" href={prevLink} aria-label="Vormonat">←</a>
        <h1 className="font-serif text-2xl">Verfügbarkeit {year}-{pad(month)}</h1>
        <a className="rounded border px-2 py-1 hover:bg-accent/30" href={nextLink} aria-label="Nächster Monat">→</a>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={onApplyTemplate}>Vorlage anwenden</Button>
          <Button onClick={onSave}>Speichern</Button>
        </div>
      </div>

      <Card className="p-3">
        <div className="grid grid-cols-7 gap-2 text-center text-sm opacity-70">
          {["So","Mo","Di","Mi","Do","Fr","Sa"].map((l) => <div key={l}>{l}</div>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {Array.from({ length: startWeekday }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map((d) => {
            const e = entries[d.iso];
            const kind = e?.kind ?? "FULL_AVAILABLE";
            const partial = kind === "PARTIAL";
            return (
              <div key={d.iso} className="rounded border p-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium text-sm">{d.d}</div>
                  <WeekdayLabel wd={d.wd} />
                </div>
                <label className="block text-xs text-left">Status</label>
                <select
                  className="w-full rounded border bg-background px-2 py-1 text-sm"
                  value={kind}
                  onChange={(ev) => setFor(d.iso, { kind: ev.target.value as DayEntry["kind"] })}
                  aria-label={`Status für ${d.iso}`}
                >
                  <option value="FULL_AVAILABLE">Verfügbar</option>
                  <option value="FULL_UNAVAILABLE">Verhindert</option>
                  <option value="PARTIAL">Teilweise</option>
                </select>
                {partial && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-left" htmlFor={`${d.iso}-from`}>Von</label>
                      <Input id={`${d.iso}-from`} type="time" value={e?.from ?? ""} onChange={(ev) => setFor(d.iso, { from: ev.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs text-left" htmlFor={`${d.iso}-to`}>Bis</label>
                      <Input id={`${d.iso}-to`} type="time" value={e?.to ?? ""} onChange={(ev) => setFor(d.iso, { to: ev.target.value })} />
                    </div>
                  </div>
                )}
                <div className="mt-2">
                  <label className="block text-xs text-left" htmlFor={`${d.iso}-note`}>Notiz</label>
                  <Input id={`${d.iso}-note`} placeholder="Notiz" value={e?.note ?? ""} onChange={(ev) => setFor(d.iso, { note: ev.target.value })} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Template Editor */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-semibold">Wochentags‑Vorlagen</h2>
          <div className="ml-auto">
            <Button variant="outline" onClick={onSaveTemplates}>Vorlagen speichern</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 7 }).map((_, wd) => {
            const t = templates[wd];
            const partial = t.kind === "PARTIAL";
            const name = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"][wd];
            return (
              <div key={wd} className="rounded border p-3">
                <div className="font-medium text-sm mb-2">{name}</div>
                <label className="block text-xs text-left">Status</label>
                <select
                  className="w-full rounded border bg-background px-2 py-1 text-sm"
                  value={t.kind}
                  onChange={(ev) => setTemplate(wd, { kind: ev.target.value as TemplateEntry["kind"] })}
                  aria-label={`Template Status ${name}`}
                >
                  <option value="FULL_AVAILABLE">Verfügbar</option>
                  <option value="FULL_UNAVAILABLE">Verhindert</option>
                  <option value="PARTIAL">Teilweise</option>
                </select>
                {partial && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-left" htmlFor={`t-${wd}-from`}>Von</label>
                      <Input id={`t-${wd}-from`} type="time" value={t.from ?? ""} onChange={(ev) => setTemplate(wd, { from: ev.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs text-left" htmlFor={`t-${wd}-to`}>Bis</label>
                      <Input id={`t-${wd}-to`} type="time" value={t.to ?? ""} onChange={(ev) => setTemplate(wd, { to: ev.target.value })} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

