import { hasRole, requireAuth } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Settings, Plus, Eye } from "lucide-react";

const uiElements = [
  { type: "Button", variant: "primary", purpose: "Primäre Aktion", usages: ["Szenen > add", "Produktionen > speichern", "Mitglieder > erstellen"] },
  { type: "Button", variant: "outline", purpose: "Sekundäre Aktion", usages: ["Szenen > edit", "Website & Theme > Umbenennen"] },
  { type: "Button", variant: "destructive", purpose: "Lösch-Aktion", usages: ["Szenen > delete", "Dateien > entfernen", "Theme-Verwaltung > Theme löschen"] },
  { type: "Toggle", variant: "switch", purpose: "Status umschalten", usages: ["Seitensteuerung > Seite aktivieren", "Wartungsmodus"] },
] as const;

const iconUsages = [
  { Icon: Pencil, name: "Pencil", purpose: "Bearbeiten", usages: ["Szenen", "Mitgliederverwaltung", "Dokumente"] },
  { Icon: Trash2, name: "Trash2", purpose: "Löschen", usages: ["Szenen", "Dateimanager", "Theme-Verwaltung"] },
  { Icon: Settings, name: "Settings", purpose: "Einstellungen", usages: ["Seitensteuerung", "Server-Einstellungen", "Website & Theme"] },
] as const;

export default async function PagesUiOverviewPage() {
  const session = await requireAuth();
  if (!hasRole(session.user, "owner") && !hasRole(session.user, "admin")) {
    redirect("/mitglieder");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">UI</h1>
      <Tabs defaultValue="elements" className="space-y-4">
        <TabsList>
          <TabsTrigger value="elements">Elemente</TabsTrigger>
          <TabsTrigger value="icons">Icons</TabsTrigger>
        </TabsList>

        <TabsContent value="elements">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Typ</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Funktion</TableHead>
                <TableHead>Nutzungen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uiElements.map((entry) => (
                <TableRow key={`${entry.type}-${entry.variant}`}>
                  <TableCell>{entry.type}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{entry.variant}</Badge>
                  </TableCell>
                  <TableCell>{entry.purpose}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {entry.usages.map((usage) => (
                        <Badge key={usage} variant="secondary">{usage}</Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="icons">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aussehen</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Funktion</TableHead>
                <TableHead>Nutzungen</TableHead>
                <TableHead>Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {iconUsages.map(({ Icon, name, purpose, usages }) => (
                <TableRow key={name}>
                  <TableCell><Icon className="h-4 w-4" aria-hidden /></TableCell>
                  <TableCell>{name}</TableCell>
                  <TableCell>{purpose}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {usages.map((usage) => <Badge key={usage} variant="secondary">{usage}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline"><Eye className="mr-1 h-4 w-4" />Verwendungen</Button>
                      <Button size="sm"><Plus className="mr-1 h-4 w-4" />Icon ersetzen</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
