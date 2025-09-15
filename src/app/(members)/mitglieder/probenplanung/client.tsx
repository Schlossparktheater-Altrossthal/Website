"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Plus, 
  Settings, 
  Users, 
  Edit3, 
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  PlayCircle,
  Archive,
  Save,
  X
} from "lucide-react";
import { toast } from "sonner";

type RehearsalTemplate = {
  id: string;
  name: string;
  description?: string;
  weekday: number;
  startTime: string;
  endTime: string;
  location: string;
  requiredRoles: any;
  isActive: boolean;
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  validFrom?: string;
  validTo?: string;
};

type Rehearsal = {
  id: string;
  showId?: string;
  title: string;
  start: string;
  end: string;
  location: string;
  description?: string;
  requiredRoles: any;
  isFromTemplate: boolean;
  templateId?: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  status: "PLANNED" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  show?: { id: string; title?: string; year: number };
  template?: RehearsalTemplate;
  attendance: Array<{
    id: string;
    status: "yes" | "no" | "maybe";
    user: { id: string; name?: string; email?: string };
  }>;
};

type Show = {
  id: string;
  title?: string;
  year: number;
};

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

const PRIORITY_COLORS = {
  LOW: "border-blue-200 bg-blue-50",
  NORMAL: "border-gray-200 bg-gray-50", 
  HIGH: "border-amber-200 bg-amber-50",
  CRITICAL: "border-red-200 bg-red-50"
};

const STATUS_ICONS = {
  PLANNED: <Calendar className="w-4 h-4 text-blue-500" />,
  CONFIRMED: <CheckCircle className="w-4 h-4 text-green-500" />,
  CANCELLED: <XCircle className="w-4 h-4 text-red-500" />,
  COMPLETED: <Archive className="w-4 h-4 text-gray-500" />
};

export function RehearsalPlanningClient({ 
  templates: initialTemplates, 
  rehearsals: initialRehearsals,
  shows 
}: {
  templates: RehearsalTemplate[];
  rehearsals: Rehearsal[];
  shows: Show[];
}) {
  const [view, setView] = useState<"calendar" | "templates" | "list">("calendar");
  const [templates, setTemplates] = useState(initialTemplates);
  const [rehearsals, setRehearsals] = useState(initialRehearsals);
  const [editingTemplate, setEditingTemplate] = useState<RehearsalTemplate | null>(null);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    weekday: 6, // Samstag als Standard
    startTime: "14:00",
    endTime: "17:00",
    location: "Schlosspark Altroßthal",
    priority: "NORMAL" as const,
    isActive: true
  });

  // Generate upcoming rehearsals from templates
  const generateFromTemplates = async (weeksAhead = 8) => {
    try {
      const response = await fetch("/api/rehearsals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeksAhead })
      });
      
      if (response.ok) {
        toast.success("Proben aus Templates erstellt");
        window.location.reload();
      } else {
        toast.error("Fehler beim Erstellen der Proben");
      }
    } catch (error) {
      toast.error("Netzwerkfehler");
    }
  };

  // Create new template
  const createTemplate = async () => {
    try {
      const response = await fetch("/api/rehearsal-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newTemplate,
          requiredRoles: ["cast", "tech"] // Standard-Rollen
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setTemplates(prev => [...prev, result.template]);
        setShowTemplateForm(false);
        setNewTemplate({
          name: "",
          description: "",
          weekday: 6,
          startTime: "14:00",
          endTime: "17:00",
          location: "Schlosspark Altroßthal",
          priority: "NORMAL",
          isActive: true
        });
        toast.success("Template erstellt");
      } else {
        toast.error("Fehler beim Erstellen des Templates");
      }
    } catch (error) {
      toast.error("Netzwerkfehler");
    }
  };

  // Toggle template active state
  const toggleTemplate = async (templateId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/rehearsal-templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive })
      });
      
      if (response.ok) {
        setTemplates(prev => prev.map(t => 
          t.id === templateId ? { ...t, isActive } : t
        ));
        toast.success(isActive ? "Template aktiviert" : "Template deaktiviert");
      } else {
        toast.error("Fehler beim Aktualisieren");
      }
    } catch (error) {
      toast.error("Netzwerkfehler");
    }
  };

  // Delete template
  const deleteTemplate = async (templateId: string) => {
    if (!confirm("Template wirklich löschen?")) return;
    
    try {
      const response = await fetch(`/api/rehearsal-templates/${templateId}`, {
        method: "DELETE"
      });
      
      if (response.ok) {
        setTemplates(prev => prev.filter(t => t.id !== templateId));
        toast.success("Template gelöscht");
      } else {
        toast.error("Fehler beim Löschen");
      }
    } catch (error) {
      toast.error("Netzwerkfehler");
    }
  };

  const upcomingRehearsals = useMemo(() => {
    return rehearsals
      .filter(r => new Date(r.start) >= new Date())
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [rehearsals]);

  const groupedTemplates = useMemo(() => {
    return templates.reduce((acc, template) => {
      if (!acc[template.weekday]) acc[template.weekday] = [];
      acc[template.weekday].push(template);
      return acc;
    }, {} as Record<number, RehearsalTemplate[]>);
  }, [templates]);

  return (
    <div className="space-y-6">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={view === "calendar" ? "default" : "outline"}
            onClick={() => setView("calendar")}
            className="gap-2"
          >
            <Calendar className="w-4 h-4" />
            Kalender
          </Button>
          <Button
            variant={view === "templates" ? "default" : "outline"}
            onClick={() => setView("templates")}
            className="gap-2"
          >
            <Settings className="w-4 h-4" />
            Templates
          </Button>
          <Button
            variant={view === "list" ? "default" : "outline"}
            onClick={() => setView("list")}
            className="gap-2"
          >
            <Users className="w-4 h-4" />
            Übersicht
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={() => generateFromTemplates()}
            className="gap-2"
            variant="outline"
          >
            <PlayCircle className="w-4 h-4" />
            Templates anwenden
          </Button>
          <Button
            onClick={() => setShowTemplateForm(true)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Neues Template
          </Button>
        </div>
      </div>

      {/* Templates View */}
      {view === "templates" && (
        <div className="space-y-6">
          {/* Template Form */}
          {showTemplateForm && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Neues Template erstellen</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTemplateForm(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Name</label>
                  <Input
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="z.B. Samstag Probe"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Wochentag</label>
                  <select
                    className="w-full rounded border bg-background px-3 py-2"
                    value={newTemplate.weekday}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, weekday: parseInt(e.target.value) }))}
                  >
                    {WEEKDAYS.map((day, idx) => (
                      <option key={idx} value={idx}>{day}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Startzeit</label>
                  <Input
                    type="time"
                    value={newTemplate.startTime}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Endzeit</label>
                  <Input
                    type="time"
                    value={newTemplate.endTime}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Ort</label>
                  <Input
                    value={newTemplate.location}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Schlosspark Altroßthal"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Priorität</label>
                  <select
                    className="w-full rounded border bg-background px-3 py-2"
                    value={newTemplate.priority}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, priority: e.target.value as any }))}
                  >
                    <option value="LOW">Niedrig</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">Hoch</option>
                    <option value="CRITICAL">Kritisch</option>
                  </select>
                </div>
                
                <div className="flex items-center">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newTemplate.isActive}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, isActive: e.target.checked }))}
                    />
                    <span className="text-sm">Template aktiv</span>
                  </label>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Beschreibung (optional)</label>
                  <Input
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Beschreibung des Templates"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                <Button onClick={createTemplate} className="gap-2">
                  <Save className="w-4 h-4" />
                  Template erstellen
                </Button>
                <Button variant="outline" onClick={() => setShowTemplateForm(false)}>
                  Abbrechen
                </Button>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Proben-Templates</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Templates definieren wiederkehrende Proben. Sie können automatisch für die kommenden Wochen angewendet werden.
            </p>
            
            <div className="grid gap-4">
              {Object.entries(groupedTemplates).map(([weekday, dayTemplates]) => (
                <div key={weekday} className="space-y-3">
                  <h3 className="font-medium text-base">{WEEKDAYS[Number(weekday)]}</h3>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {dayTemplates.map((template) => (
                      <Card key={template.id} className={`p-4 ${PRIORITY_COLORS[template.priority]} ${!template.isActive ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium">{template.name}</h4>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleTemplate(template.id, !template.isActive)}
                              title={template.isActive ? "Deaktivieren" : "Aktivieren"}
                            >
                              {template.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingTemplate(template)}
                              title="Bearbeiten"
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => deleteTemplate(template.id)}
                              title="Löschen"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            {template.startTime} - {template.endTime}
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3" />
                            {template.location}
                          </div>
                          {template.description && (
                            <p className="text-xs">{template.description}</p>
                          )}
                        </div>
                        
                        <div className="mt-3 flex items-center justify-between">
                          <span className={`text-xs px-2 py-1 rounded ${
                            template.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' :
                            template.priority === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                            template.priority === 'LOW' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {template.priority}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            template.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {template.isActive ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Calendar View */}
      {view === "calendar" && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Kommende Proben</h2>
            <div className="grid gap-4">
              {upcomingRehearsals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Keine Proben geplant</p>
                  <p className="text-sm">Verwende Templates, um Proben zu erstellen</p>
                </div>
              ) : (
                upcomingRehearsals.map((rehearsal) => (
                  <Card key={rehearsal.id} className={`p-4 ${PRIORITY_COLORS[rehearsal.priority]}`}>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {STATUS_ICONS[rehearsal.status]}
                          <h3 className="font-medium">{rehearsal.title}</h3>
                          {rehearsal.show && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              {rehearsal.show.title || `Show ${rehearsal.show.year}`}
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            {new Date(rehearsal.start).toLocaleDateString("de-DE")}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            {new Date(rehearsal.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} - 
                            {new Date(rehearsal.end).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3" />
                            {rehearsal.location}
                          </div>
                        </div>
                        
                        {rehearsal.description && (
                          <p className="text-sm text-muted-foreground">{rehearsal.description}</p>
                        )}
                      </div>
                      
                      <div className="text-right space-y-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">
                            {rehearsal.attendance.length} Zusagen
                          </span>
                        </div>
                        <Button size="sm" variant="outline">
                          <Edit3 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Proben-Übersicht</h2>
            <div className="space-y-4">
              {upcomingRehearsals.map((rehearsal) => (
                <div key={rehearsal.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-4">
                    {STATUS_ICONS[rehearsal.status]}
                    <div>
                      <div className="font-medium">{rehearsal.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(rehearsal.start).toLocaleDateString("de-DE")} • {rehearsal.location}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground">
                      <div>{rehearsal.attendance.filter(a => a.status === "yes").length} Zusagen</div>
                      <div>{rehearsal.attendance.filter(a => a.status === "no").length} Absagen</div>
                    </div>
                    <Button size="sm" variant="outline">
                      Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
