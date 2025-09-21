import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";

type MysteryTipEntry = {
  id: string;
  text: string;
  normalizedText: string;
  count: number;
  createdAt: string;
  updatedAt: string;
};

const UPDATED_AT_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "–";
  return UPDATED_AT_FORMATTER.format(date);
}

export function MysteryTipsTable({ tips }: { tips: MysteryTipEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Community-Tipps im Überblick</CardTitle>
        <Text variant="small" tone="muted">
          Sortiert nach Häufigkeit. Mehrfach abgegebene oder ähnliche Tipps werden zusammengefasst.
        </Text>
      </CardHeader>
      <CardContent>
        {tips.length === 0 ? (
          <Text variant="small" tone="muted">
            Es wurden noch keine Tipps abgegeben.
          </Text>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Tipp</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Normalisierte Form</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Häufigkeit</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Zuletzt aktualisiert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {tips.map((tip) => (
                  <tr key={tip.id} className="bg-background/60">
                    <td className="px-3 py-2 align-top font-medium text-foreground">{tip.text}</td>
                    <td className="px-3 py-2 align-top text-muted-foreground">{tip.normalizedText}</td>
                    <td className="px-3 py-2 align-top font-semibold text-foreground">{tip.count}</td>
                    <td className="px-3 py-2 align-top text-muted-foreground">{formatTimestamp(tip.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
