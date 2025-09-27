"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-avatar";
import { PhotoConsentCard } from "@/components/members/photo-consent-card";
import type { ProfileCompletionSummary } from "@/lib/profile-completion";
import type { Role } from "@prisma/client";

import { ProfileCompletionProvider } from "./profile-completion-context";

type ProfileClientProps = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName: string;
    createdAt: string;
    dateOfBirth: string | null;
    avatarSource: string | null;
    avatarUpdatedAt: string | null;
    roles: Role[];
    customRoles: { id: string; name: string }[];
  };
  onboarding: {
    focus: string;
    background: string | null;
    backgroundClass: string | null;
    notes: string | null;
    memberSinceYear: number | null;
    dietaryPreference: string | null;
    dietaryPreferenceStrictness: string | null;
    whatsappLinkVisitedAt: string | null;
    updatedAt: string | null;
    show: { title: string | null; year: number } | null;
  } | null;
  interests: string[];
  allergies: Array<{
    id: string;
    allergen: string;
    level: string;
    symptoms: string | null;
    treatment: string | null;
    note: string | null;
    updatedAt: string | null;
  }>;
  measurements: Array<{
    id: string;
    type: string;
    value: number;
    unit: string;
    note: string | null;
    updatedAt: string | null;
  }>;
  canManageMeasurements: boolean;
  checklist: ProfileCompletionSummary;
  whatsappLink: string | null;
};

export function ProfileClient({
  user,
  onboarding,
  interests,
  allergies,
  measurements,
  canManageMeasurements,
  checklist,
}: ProfileClientProps) {
  return (
    <ProfileCompletionProvider initialSummary={checklist}>
      <div className="space-y-8">
        <Card className="border border-border/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Profilüberblick</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <UserAvatar
              userId={user.id}
              email={user.email}
              firstName={user.firstName}
              lastName={user.lastName}
              name={user.displayName}
              size={72}
              className="h-18 w-18 border border-border/70"
              avatarSource={user.avatarSource}
              avatarUpdatedAt={user.avatarUpdatedAt}
            />
            <div className="space-y-2">
              <div className="text-xl font-semibold text-foreground">{user.displayName}</div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {user.roles.map((role) => (
                  <Badge key={role} variant="outline">
                    {role}
                  </Badge>
                ))}
                {user.customRoles.map((role) => (
                  <Badge key={role.id} variant="secondary">
                    {role.name}
                  </Badge>
                ))}
              </div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex w-full flex-wrap gap-2">
            <TabsTrigger value="overview">Überblick</TabsTrigger>
            <TabsTrigger value="freigaben">Freigaben</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 text-sm text-muted-foreground">
            <p>Stammdaten, Interessen und Allergien werden demnächst bearbeitbar. Aktuelle Werte:</p>
            <div className="grid gap-2">
              <div>Interessen: {interests.length ? interests.join(", ") : "Keine"}</div>
              <div>Allergien: {allergies.length}</div>
              {canManageMeasurements ? (
                <div>Maße: {measurements.length}</div>
              ) : null}
              <div>Ernährungsprofil: {onboarding?.dietaryPreference ?? "Kein Eintrag"}</div>
            </div>
          </TabsContent>

          <TabsContent value="freigaben" className="space-y-4">
            <PhotoConsentCard onSummaryChange={() => undefined} />
          </TabsContent>
        </Tabs>
      </div>
    </ProfileCompletionProvider>
  );
}
