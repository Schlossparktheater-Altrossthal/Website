"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FaqEditor } from "@/components/website-content/faq-editor";
import { ParagraphsEditor } from "@/components/website-content/paragraphs-editor";
import { StatsEditor } from "@/components/website-content/stats-editor";
import { MilestonesEditor } from "@/components/website-content/milestones-editor";
import { IconItemsEditor } from "@/components/website-content/icon-items-editor";
import type {
  FaqContent,
  IconItemsContent,
  MilestonesContent,
  ParagraphsContent,
  StatsContent,
  WebsiteContentId,
} from "@/lib/website-content-schemas";

type InitialData = {
  faq: FaqContent;
  schulkatzeIntro: ParagraphsContent;
  ueberUnsIntro: ParagraphsContent;
  ueberUnsStats: StatsContent;
  ueberUnsMilestones: MilestonesContent;
  ueberUnsSignature: IconItemsContent;
  ueberUnsValues: IconItemsContent;
  ueberUnsTrades: IconItemsContent;
};

type Props = {
  ids: Record<string, WebsiteContentId>;
  initialData: InitialData;
  defaults: InitialData;
};

export function ContentManager({ ids, initialData }: Props) {
  return (
    <Tabs defaultValue="home" className="space-y-6">
      <TabsList>
        <TabsTrigger value="home">Startseite</TabsTrigger>
        <TabsTrigger value="schulkatze">Schulkatze</TabsTrigger>
        <TabsTrigger value="ueber-uns">Über uns</TabsTrigger>
      </TabsList>

      {/* ── Startseite ───────────────────────────────────────────── */}
      <TabsContent value="home" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>FAQ</CardTitle>
          </CardHeader>
          <CardContent>
            <FaqEditor contentId={ids.HOME_FAQ} initialContent={initialData.faq} />
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Schulkatze ──────────────────────────────────────────── */}
      <TabsContent value="schulkatze" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Einleitungstext</CardTitle>
          </CardHeader>
          <CardContent>
            <ParagraphsEditor contentId={ids.SCHULKATZE_INTRO} initialContent={initialData.schulkatzeIntro} />
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Über uns ─────────────────────────────────────────────── */}
      <TabsContent value="ueber-uns" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Einleitungstext</CardTitle>
          </CardHeader>
          <CardContent>
            <ParagraphsEditor contentId={ids.UEBER_UNS_INTRO} initialContent={initialData.ueberUnsIntro} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kennzahlen</CardTitle>
          </CardHeader>
          <CardContent>
            <StatsEditor contentId={ids.UEBER_UNS_STATS} initialContent={initialData.ueberUnsStats} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meilensteine</CardTitle>
          </CardHeader>
          <CardContent>
            <MilestonesEditor contentId={ids.UEBER_UNS_MILESTONES} initialContent={initialData.ueberUnsMilestones} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Signature-Elemente</CardTitle>
          </CardHeader>
          <CardContent>
            <IconItemsEditor contentId={ids.UEBER_UNS_SIGNATURE} initialContent={initialData.ueberUnsSignature} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unsere Werte</CardTitle>
          </CardHeader>
          <CardContent>
            <IconItemsEditor contentId={ids.UEBER_UNS_VALUES} initialContent={initialData.ueberUnsValues} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gewerke</CardTitle>
          </CardHeader>
          <CardContent>
            <IconItemsEditor contentId={ids.UEBER_UNS_TRADES} initialContent={initialData.ueberUnsTrades} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
