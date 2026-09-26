"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type UrlTab = {
  value: string;
  label: string;
  /** Kleine Zahl hinter dem Label, z. B. offene Einladungen. */
  count?: number;
  content: React.ReactNode;
};

/**
 * Seitenbereiche als Tabs, deren Auswahl im URL-Parameter steht: verlinkbar und die
 * Zurück-Taste springt zum vorherigen Tab. Der erste Tab ist der Standard und erscheint
 * ohne Parameter.
 */
export function UrlTabs({
  tabs,
  param = "tab",
  initialValue,
  className,
}: {
  tabs: UrlTab[];
  param?: string;
  initialValue?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fallback = tabs[0]?.value ?? "";
  const fromUrl = searchParams.get(param) ?? initialValue;
  const [value, setValue] = useState(
    tabs.some((tab) => tab.value === fromUrl) ? (fromUrl as string) : fallback,
  );

  const handleChange = (next: string) => {
    setValue(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === fallback) params.delete(param);
    else params.set(param, next);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <Tabs value={value} onValueChange={handleChange} className={className}>
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
            {tab.count ? (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                {tab.count}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-4">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
