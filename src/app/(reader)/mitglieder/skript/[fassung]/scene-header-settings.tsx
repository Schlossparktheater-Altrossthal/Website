"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import {
  SCENE_HEADER_ITEMS,
  SCENE_HEADER_ITEM_HINTS,
  SCENE_HEADER_ITEM_LABELS,
  type SceneHeaderItem,
  type SceneHeaderMode,
} from "@/lib/skript/scene-header";

import type { Settings } from "../shared";

/** Einstellungen des Szenenkopfs (docs/Plan/skript-ansicht-plan.md). */
export function SceneHeaderSettings({
  settings,
  update,
}: {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}) {
  const config = settings.sceneHeader;
  const set = (patch: Partial<Settings["sceneHeader"]>) =>
    update({ sceneHeader: { ...config, ...patch } });
  const toggle = (item: SceneHeaderItem, on: boolean) =>
    set({
      items: SCENE_HEADER_ITEMS.filter((entry) =>
        entry === item ? on : config.items.includes(entry),
      ),
    });

  return (
    <div className="space-y-2">
      <SegmentedControl<SceneHeaderMode>
        aria-label="Szenenkopf"
        fullWidth
        value={config.mode}
        onValueChange={(mode) => set({ mode })}
        options={[
          { value: "off", label: "Aus" },
          { value: "compact", label: "Eine Zeile" },
          { value: "card", label: "Aufgeklappt" },
        ]}
      />
      {config.mode !== "off" ? (
        <>
          <p className="text-xs text-muted-foreground">
            Antippen klappt den Kopf einer Szene auf oder zu.
          </p>
          <ul className="divide-y divide-border/60">
            {SCENE_HEADER_ITEMS.map((item) => (
              <li key={item}>
                <label className="flex min-h-11 items-center justify-between gap-3 py-1">
                  <span className="min-w-0">
                    <span className="block">{SCENE_HEADER_ITEM_LABELS[item]}</span>
                    <span className="block text-xs text-muted-foreground">
                      {SCENE_HEADER_ITEM_HINTS[item]}
                    </span>
                  </span>
                  <Switch
                    checked={config.items.includes(item)}
                    onCheckedChange={(on) => toggle(item, on)}
                    aria-label={`${SCENE_HEADER_ITEM_LABELS[item]} im Szenenkopf`}
                  />
                </label>
              </li>
            ))}
          </ul>
          <label className="flex min-h-11 items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block">Nur in meinen Szenen</span>
              <span className="block text-xs text-muted-foreground">
                Wo keine der gewählten Rollen spricht, bleibt nur die Überschrift
              </span>
            </span>
            <Switch
              checked={config.onlyMine}
              onCheckedChange={(onlyMine) => set({ onlyMine })}
              aria-label="Szenenkopf nur in meinen Szenen"
            />
          </label>
        </>
      ) : null}
    </div>
  );
}
