"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  User
} from "lucide-react";
import { toast } from "sonner";

type Rehearsal = {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string;
  description?: string;
  show?: { id: string; title?: string; year: number };
  attendance: Array<{
    id: string;
    status: "yes" | "no" | "maybe";
  }>;
};

type AvailabilityTemplate = {
  id: string;
  weekday: number;
  kind: "FULL_AVAILABLE" | "FULL_UNAVAILABLE" | "PARTIAL";
  availableFromMin?: number;
  availableToMin?: number;
};

type AvailabilityDay = {
  id: string;
  date: string;
  kind: "FULL_AVAILABLE" | "FULL_UNAVAILABLE" | "PARTIAL";
  availableFromMin?: number;
  availableToMin?: number;
  note?: string;
};

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export function RehearsalAvailabilityClient({ 
  rehearsals: initialRehearsals,
  availabilityTemplates,
  availabilityDays: initialAvailabilityDays,
  userId 
}: {
  rehearsals: Rehearsal[];
  availabilityTemplates: AvailabilityTemplate[];
  availabilityDays: AvailabilityDay[];
  userId: string;
}) {
  const [rehearsals, setRehearsals] = useState(initialRehearsals);
  const [availabilityDays, setAvailabilityDays] = useState(
    initialAvailabilityDays.reduce((acc, day) => {
      acc[day.date] = day;
      return acc;
    }, {} as Record<string, AvailabilityDay>)
  );

  const updateAttendance = async (rehearsalId: string, status: "yes" | "no" | "maybe") => {
    try {
      const response = await fetch("/api/rehearsals/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rehearsalId, status })
      });

      if (response.ok) {
        // Update local state
        setRehearsals(prev => prev.map(r => 
          r.id === rehearsalId 
            ? { ...r, attendance: [{ id: "temp", status }] }
            : r
        ));
        toast.success("Zusage aktualisiert");
      } else {
        toast.error("Fehler beim Speichern");
      }
    } catch (error) {
      toast.error("Netzwerkfehler");
    }
  };

  const updateAvailability = async (date: string, kind: AvailabilityDay["kind"], fromMin?: number, toMin?: number, note?: string) => {
    try {
      const response = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          date, 
          kind, 
          availableFromMin: fromMin,
          availableToMin: toMin,
          note 
        })
      });

      if (response.ok) {
        setAvailabilityDays(prev => ({
          ...prev,
          [date]: { id: "temp", date, kind, availableFromMin: fromMin, availableToMin: toMin, note }
        }));
        toast.success("Verfügbarkeit gespeichert");
      } else {
        toast.error("Fehler beim Speichern");
      }
    } catch (error) {
      toast.error("Netzwerkfehler");
    }
  };

  const getAvailabilityForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const specificDay = availabilityDays[dateStr];
    
    if (specificDay) {
      return specificDay;
    }

    // Fallback auf Template
    const weekday = date.getDay();
    const template = availabilityTemplates.find(t => t.weekday === weekday);
    
    return template ? {
      id: "template",
      date: dateStr,
      kind: template.kind,
      availableFromMin: template.availableFromMin,
      availableToMin: template.availableToMin,
      note: "Aus Template"
    } : null;
  };

  const formatTime = (minutes?: number) => {
    if (minutes === undefined) return "";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status?: "yes" | "no" | "maybe") => {
    switch (status) {
      case "yes": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "no": return <XCircle className="w-4 h-4 text-red-500" />;
      case "maybe": return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default: return <User className="w-4 h-4 text-gray-400" />;
    }
  };

  const getAvailabilityIcon = (kind?: "FULL_AVAILABLE" | "FULL_UNAVAILABLE" | "PARTIAL") => {
    switch (kind) {
      case "FULL_AVAILABLE": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "FULL_UNAVAILABLE": return <XCircle className="w-4 h-4 text-red-500" />;
      case "PARTIAL": return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default: return <User className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {rehearsals.length === 0 ? (
          <Card className="p-8 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Keine Proben geplant</h3>
            <p className="text-muted-foreground">
              Es sind noch keine Proben für die kommenden 2 Monate geplant.
            </p>
          </Card>
        ) : (
          rehearsals.map((rehearsal) => {
            const rehearsalDate = new Date(rehearsal.start);
            const availability = getAvailabilityForDate(rehearsalDate);
            const currentAttendance = rehearsal.attendance[0]?.status;

            return (
              <Card key={rehearsal.id} className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Proben-Info */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{rehearsal.title}</h3>
                        {rehearsal.show && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            {rehearsal.show.title || `Show ${rehearsal.show.year}`}
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          {rehearsalDate.toLocaleDateString("de-DE")}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {rehearsalDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} - 
                          {new Date(rehearsal.end).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3" />
                          {rehearsal.location}
                        </div>
                      </div>
                      
                      {rehearsal.description && (
                        <p className="text-sm text-muted-foreground mt-2">{rehearsal.description}</p>
                      )}
                    </div>

                    {/* Zusage-Buttons */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(currentAttendance)}
                        <span className="text-sm font-medium">
                          Deine Zusage: {
                            currentAttendance === "yes" ? "Zusage" :
                            currentAttendance === "no" ? "Absage" :
                            currentAttendance === "maybe" ? "Vielleicht" : "Offen"
                          }
                        </span>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={currentAttendance === "yes" ? "default" : "outline"}
                          onClick={() => updateAttendance(rehearsal.id, "yes")}
                          className="gap-2"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Zusage
                        </Button>
                        <Button
                          size="sm"
                          variant={currentAttendance === "maybe" ? "default" : "outline"}
                          onClick={() => updateAttendance(rehearsal.id, "maybe")}
                          className="gap-2"
                        >
                          <AlertCircle className="w-3 h-3" />
                          Vielleicht
                        </Button>
                        <Button
                          size="sm"
                          variant={currentAttendance === "no" ? "default" : "outline"}
                          onClick={() => updateAttendance(rehearsal.id, "no")}
                          className="gap-2"
                        >
                          <XCircle className="w-3 h-3" />
                          Absage
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Verfügbarkeits-Info */}
                  <div className="space-y-4 border-l md:border-l pl-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {getAvailabilityIcon(availability?.kind)}
                        <span className="text-sm font-medium">
                          Verfügbarkeit am {WEEKDAYS[rehearsalDate.getDay()]}
                        </span>
                      </div>
                      
                      {availability ? (
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>
                            Status: {
                              availability.kind === "FULL_AVAILABLE" ? "Komplett verfügbar" :
                              availability.kind === "FULL_UNAVAILABLE" ? "Nicht verfügbar" :
                              "Teilweise verfügbar"
                            }
                          </div>
                          {availability.kind === "PARTIAL" && availability.availableFromMin && availability.availableToMin && (
                            <div>
                              Zeit: {formatTime(availability.availableFromMin)} - {formatTime(availability.availableToMin)}
                            </div>
                          )}
                          {availability.note && (
                            <div className="italic">
                              Notiz: {availability.note}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          Keine Verfügbarkeit angegeben
                        </div>
                      )}
                    </div>

                    {/* Schnell-Aktionen für Verfügbarkeit */}
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Schnell setzen:</div>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateAvailability(rehearsalDate.toISOString().split('T')[0], "FULL_AVAILABLE")}
                          className="text-xs h-7"
                        >
                          Verfügbar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateAvailability(rehearsalDate.toISOString().split('T')[0], "FULL_UNAVAILABLE")}
                          className="text-xs h-7"
                        >
                          Nicht verfügbar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateAvailability(rehearsalDate.toISOString().split('T')[0], "PARTIAL", 18*60, 21*60)}
                          className="text-xs h-7"
                        >
                          Abends (18-21h)
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
