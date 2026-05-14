import { hasRole, requireAuth } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, Settings } from "lucide-react";

const buttonVariants = ["primary","secondary","accent","outline","ghost","subtle","destructive","success","info"] as const;

export default async function PagesUiOverviewPage() {
  const session = await requireAuth();
  if (!hasRole(session.user, "owner") && !hasRole(session.user, "admin")) redirect("/mitglieder");
  return <div className="space-y-6"><h1 className="text-3xl font-semibold tracking-tight">UI</h1><Tabs defaultValue="buttons"><TabsList><TabsTrigger value="buttons">Buttons</TabsTrigger><TabsTrigger value="icons">Icons</TabsTrigger></TabsList><TabsContent value="buttons"><Table><TableHeader><TableRow><TableHead>Aussehen</TableHead><TableHead>Name</TableHead><TableHead>Funktion</TableHead></TableRow></TableHeader><TableBody>{buttonVariants.map((v)=><TableRow key={v}><TableCell><Button variant={v}>{v}</Button></TableCell><TableCell>{v}</TableCell><TableCell>Standardvariante {v}</TableCell></TableRow>)}</TableBody></Table></TabsContent><TabsContent value="icons"><Table><TableHeader><TableRow><TableHead>Aussehen</TableHead><TableHead>Name</TableHead><TableHead>Funktion</TableHead></TableRow></TableHeader><TableBody>{[[Pencil,'Pencil','Bearbeiten'],[Trash2,'Trash2','Löschen'],[Settings,'Settings','Einstellungen']].map(([Icon,name,label])=><TableRow key={String(name)}><TableCell><Icon className="h-4 w-4" /></TableCell><TableCell>{String(name)}</TableCell><TableCell>{String(label)}</TableCell></TableRow>)}</TableBody></Table></TabsContent></Tabs></div>;
}
