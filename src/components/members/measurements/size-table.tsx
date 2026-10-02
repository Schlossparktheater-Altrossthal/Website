"use client";

import { useState } from "react";

import { SizeDialog } from "@/components/members/measurements/size-dialog";
import {
  SIZE_CATEGORY_LABELS,
  sizeCategoryEnum,
  type SizeCategory,
  type SizeEntry,
} from "@/data/sizes";
import { getUserDisplayName } from "@/lib/names";

export type SizeTableMember = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  sizes: SizeEntry[];
};

/** Konfektionsgrößen des Ensembles: Kategorien als Zeilen, Personen als Spalten. */
export function SizeTable({ members: initialMembers }: { members: SizeTableMember[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [editing, setEditing] = useState<{ memberId: string; category: SizeCategory } | null>(null);
  const editingMember = editing ? members.find((member) => member.id === editing.memberId) : null;

  const update = (memberId: string, change: (sizes: SizeEntry[]) => SizeEntry[]) =>
    setMembers((prev) =>
      prev.map((member) =>
        member.id === memberId ? { ...member, sizes: change(member.sizes) } : member,
      ),
    );

  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-3 sm:p-4">
      <header className="space-y-0.5">
        <h2 className="text-sm font-semibold">Konfektionsgrößen</h2>
        <p className="text-xs text-muted-foreground">
          Für Einkauf, Leihe und Fundus. Feld antippen zum Eintragen oder Ändern.
        </p>
      </header>
      {members.length ? (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                  Größe
                </th>
                {members.map((member) => (
                  <th
                    key={member.id}
                    className="min-w-[96px] border-l border-border/60 px-2 py-2 text-left text-xs font-semibold"
                  >
                    <span className="block max-w-[140px] truncate">
                      {getUserDisplayName(member)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sizeCategoryEnum.options.map((category) => (
                <tr key={category} className="border-t border-border/60">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 whitespace-nowrap border-t border-border/60 bg-card px-2 py-1.5 text-left font-medium"
                  >
                    {SIZE_CATEGORY_LABELS[category]}
                  </th>
                  {members.map((member) => {
                    const entry = member.sizes.find((size) => size.category === category);
                    return (
                      <td key={member.id} className="border-l border-t border-border/60 p-0.5">
                        <button
                          type="button"
                          onClick={() => setEditing({ memberId: member.id, category })}
                          title={entry?.note ?? undefined}
                          className="flex min-h-10 w-full flex-col justify-center rounded-md px-2 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {entry ? (
                            <>
                              <span className="font-semibold">{entry.size}</span>
                              {entry.note ? (
                                <span className="truncate text-[10px] text-muted-foreground">
                                  {entry.note}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-3 text-center text-sm text-muted-foreground">
          Noch niemand in einer Rolle besetzt.
        </p>
      )}
      <SizeDialog
        category={editing?.category ?? null}
        entry={editingMember?.sizes.find((size) => size.category === editing?.category) ?? null}
        userId={editing?.memberId}
        personName={editingMember ? getUserDisplayName(editingMember) : undefined}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          if (editing) {
            update(editing.memberId, (sizes) => [
              ...sizes.filter((size) => size.category !== saved.category),
              saved,
            ]);
          }
          setEditing(null);
        }}
        onDeleted={(category) => {
          if (editing) {
            update(editing.memberId, (sizes) => sizes.filter((size) => size.category !== category));
          }
          setEditing(null);
        }}
      />
    </section>
  );
}
