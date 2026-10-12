# Probenablauf: Medien, bearbeitbare Notizen, Aufgaben für mehrere, mehr Bausteintypen

Stand: 2026-10-12 · Status: **Entwurf, Entscheidungen 2026-10-12 eingearbeitet, nichts umgesetzt** · baut auf
[termin-ansicht-probenprotokoll-plan.md](termin-ansicht-probenprotokoll-plan.md) und
[termineditor-ablauf-plan.md](termineditor-ablauf-plan.md) auf.

## Ausgangslage (Code-Befund)

| Thema      | Heute                                                                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ablauf     | `EventBlock` mit Typ `SCENE` / `DEPARTMENT` / `CUSTOM`, ein Freitext `note`, Ergebnis `outcome`                                                                       |
| Protokoll  | `EventNote` (NOTE / DECISION / TASK), Text bis 4000 Zeichen, optional an einem Block                                                                                  |
| Bearbeiten | Server kennt Op `note-edit` (`protocol-server.ts:539`), ändert aber **nur den Text**; im UI (`notes-panel.tsx`) gibt es **nur Löschen**                               |
| Aufgaben   | genau **eine** Zuständigkeit: `assigneeUserId` **oder** `characterId` **oder** `departmentId`; Gewerk-Aufgabe = 1 Karte (`departmentTaskId @unique`)                  |
| Dateien    | kein Anhang an Termin/Block/Notiz. Andere Bereiche speichern Dateien als `Bytes` in Postgres (`DepartmentDocument`, `FileLibraryItem`, `InventoryPhoto`, Limit 15 MB) |
| Offline    | Ops-Queue in `localStorage` – für Text gut, für Dateien ungeeignet                                                                                                    |
| Rechte     | `getProtocolAccess` → `full` (PROTOCOL.EDIT) / `notes` (Gewerk-Leitung, nur eigene)                                                                                   |

## Ziele

1. Notizen (auch Entscheidungen/Aufgaben) **bearbeiten**: Text, Typ, Zuständige, Frist, Ablaufpunkt.
2. **Anhänge** an Notizen und Ablaufpunkten: Fotos, Sprachmemos (direkt im Browser aufnehmen), Musik/Audiodateien, ggf. PDF.
3. **Mitglieder laden Probenfotos hoch** (Galerie je Termin).
4. Aufgaben an **mehrere** Personen / Figuren / Gewerke.
5. Ablauf um sinnvolle **Bausteintypen** jenseits von Szenen erweitern.

## Entwurf

### 1. Notizen bearbeiten

- Op `note-edit` erweitern: `text`, `noteType`, `assignees[]`, `dueAt`, `blockId` (alle optional, Patch-Semantik).
- UI: Tippen auf Eintrag öffnet denselben Editor wie „Neu“ (BottomSheet mobil, vgl. [[mb-dialoge-einheitlich]]); Hinweis „bearbeitet“ + `editedAt`/`editedById`.
- Rechte unverändert: `full` alles, `notes` nur eigene.
- Bei geänderten Zuständigen: nur **neu hinzugekommene** benachrichtigen; Gewerk-Karten nachziehen.

### 2. Medien-Anhänge

Neues Modell. **Dateien liegen nicht in Postgres**, sondern in einem S3-kompatiblen Objektspeicher (Entscheidung 2026-10-12, siehe unten); die DB hält nur Metadaten und den Schlüssel `storageKey` (statt `data`/`thumb` als Bytes):

```prisma
enum EventMediaKind { IMAGE AUDIO FILE }

model EventMedia {
  id           String         @id @default(cuid())
  eventId      String
  blockId      String?        // am Ablaufpunkt (z. B. Musik zum Song)
  noteId       String?        // an einer Notiz (Sprachmemo, Skizze)
  kind         EventMediaKind
  /// Probenfoto aus der Mitglieder-Galerie (nicht an Notiz/Block)
  gallery      Boolean        @default(false)
  fileName     String
  mimeType     String
  fileSize     Int
  durationSec  Int?           // Audio
  width        Int?
  height       Int?
  data         Bytes
  thumb        Bytes?         // Vorschaubild für Galerie
  caption      String?
  uploadedById String?
  createdAt    DateTime       @default(now())
  // Relationen + @@index([eventId, createdAt]), @@index([blockId]), @@index([noteId])
}
```

- **Fotos**: im Browser auf max. ~2000 px verkleinern und als WebP/JPEG speichern (spart DB), EXIF/GPS entfernen, Vorschaubild serverseitig (sharp ist vorhanden).
- **Sprachmemo**: Aufnahme-Knopf im Notiz-Editor (MediaRecorder; Android liefert `audio/webm;opus`, iPhone `audio/mp4`/AAC – beide speichern, Abspielen klappt jeweils). Limit z. B. 10 min.
- **Musik**: Upload mp3/m4a/wav/ogg, Limit z. B. 25 MB; am Ablaufpunkt abspielbar im Probenmodus (großer Play/Pause-Knopf, Sprung zurück ±10 s).
- **Auslieferung**: Route prüft Rechte und streamt aus S3; `Range` wird an S3 weitergereicht (Spulen auf dem iPhone).
- Upload per `fetch` an eine API-Route, die als Stream nach S3 schreibt (Route Handler, kein Server-Action-Limit); **nur online**, offline zeigt der Knopf „Upload wenn wieder online“ nicht – kein Blob in localStorage. Optional später IndexedDB-Queue.

### 3. Probenfotos von Mitgliedern

- Reiter/Abschnitt „Fotos“ auf der Terminseite (`/mitglieder/termine/[id]`), Mehrfachauswahl + Kamera.
- Hochladen dürfen: Eingeladene des Termins + `full`/`notes`-Zugriff. Löschen: eigene Fotos; `full` alle.
- Sehen dürfen: wer die Terminseite sehen darf (Produktion).
- **Fotoerlaubnis**: Fotos sind intern; beim Upload Hinweis „Nur intern, nicht veröffentlichen“. Bei Personen mit Stufe „keine Fotos“ (siehe [[fotoerlaubnis-ux-analyse]]) sollte der Hinweis die Betroffenen unter den Eingeladenen nennen. Kein Download-Massen-Export in Phase 1.
- Benachrichtigung: keine pro Foto; ggf. gebündelt („5 neue Probenfotos“) – Entscheidung offen.

### 4. Aufgaben an mehrere

```prisma
model EventNoteAssignee {
  id               String   @id @default(cuid())
  noteId           String
  userId           String?
  characterId      String?
  departmentId     String?
  departmentTaskId String?  @unique   // je Gewerk eine Board-Karte
  doneAt           DateTime?
  doneById         String?
  @@index([noteId]) @@index([userId, doneAt]) @@index([characterId, doneAt])
}
```

- Migration: bestehende Einzel-Zuständigkeit in die neue Tabelle kopieren, alte Spalten danach entfernen (zwei Releases nicht nötig, aber **Migration erst auf Staging mit Prod-Kopie** prüfen, vgl. [[website-staging-db-sync]]).
- Picker wird Mehrfachauswahl (Chips, umbrechend – keine horizontal scrollenden Umschalter laut AGENTS.md); Schnellwahl „Besetzung der Szene“ füllt alle Figuren des Blocks.
- „Erledigt“: **je Zuständigem** (Licht erledigt, Ton noch nicht); Aufgabe gilt als erledigt, wenn alle fertig sind. `readMyTasks`, Dashboard „Meine Aufgaben“, `resolveTaskRecipients` und Gewerk-Board anpassen.

### 5. Mehr als Szenen im Ablauf

Vorschlag: `EventBlockType` erweitern statt alles in `CUSTOM` zu packen, weil Typ Icon, Teilnehmende und Probenmodus-Werkzeug bestimmt:

| Typ              | Wofür                                                | Besonderheit                                          |
| ---------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| `SCENE`          | Szenenprobe (wie heute)                              | Besetzung als Teilnehmende                            |
| `RUN` **neu**    | Durchlauf / Akt / Stellprobe mehrerer Szenen         | mehrere Szenen (`EventBlockScene`), Ergebnis je Szene |
| `MUSIC` **neu**  | Song, Musiknummer, Choreo/Tanz                       | Audio-Anhang als Einspieler, Figuren/Personen wählbar |
| `WARMUP` **neu** | Einsingen, Aufwärmen, Körperarbeit                   | `forEveryone` vorbelegt                               |
| `TECH` **neu**   | Licht-/Ton-/Technikprobe, Umbau, Kostüm-/Maskenprobe | Gewerke wählbar (mehrere)                             |
| `BREAK` **neu**  | Pause                                                | keine Teilnehmenden, kein Protokoll                   |
| `TALK` **neu**   | Besprechung, Feedbackrunde, Leseprobe                | Entscheidungen hier bündeln                           |
| `DEPARTMENT`     | Gewerk-Teil (wie heute)                              |                                                       |
| `CUSTOM`         | alles andere                                         |                                                       |

Alternativ schlanker: nur `RUN`, `MUSIC`, `BREAK` neu und Rest über **Vorlagen** (Titel+Icon+Dauer) für `CUSTOM` – Entscheidung offen.

Weitere sinnvolle Kleinigkeiten (optional, eigene Phase):

- Kurze **Vorbereitungs-Checkliste** je Block („Requisiten: Koffer, Brief“) mit Verknüpfung zur Ausstattung ([[ausstattung-plan]]).
- **Fundstelle** im Stück als Freitext (Seite/Takt), da es kein Textbuch im MB gibt.

## Phasen

1. **Notizen bearbeiten** – Op erweitern, Editor wiederverwenden, „bearbeitet“-Hinweis, Tests (`protocol.test.ts`). Klein, sofort nutzbar.
2. **Mehrere Zuständige** – Migration `EventNoteAssignee`, Picker, erledigt je Zuständigem, Board-Karten je Gewerk, Meine Aufgaben, Benachrichtigungen.
3. **Infrastruktur** – Buckets + Zugang in RustFS, Secrets über Vault, zweite Kopie (rclone-CronJob), Monitoring Belegung.
4. **Medien-Grundlage** – **erledigt 2026-10-12** (1992156a): `EventMedia`, `src/lib/storage/s3.ts`, `src/lib/media/event-media.ts`, Routen `/api/termine/[eventId]/media[/id]` (GET Liste/Datei mit Range und `?vorschau=1`, POST Upload durch die App, DELETE). Löschen von Einträgen/Terminen räumt den Speicher auf (Ausnahme: Meilenstein-Spiegeltermin beim Abwählen). Stufe `contribute` für Notizen kommt mit Phase 4 (UI).
5. **Anhänge an Notizen/Blöcken** – Foto + Sprachmemo im Notiz-Editor, Musik am Block, Player im Probenmodus und auf der Terminseite. – **erledigt 2026-10-12**: Foto/Sprachmemo/Datei im Notiz-Editor (Upload sofort, Verknüpfung über `mediaIds` in `note-add`/`note-edit`), Musik/PDF am Ablaufpunkt mit Player (auch beim aktuellen Punkt), Anhänge in der Protokoll-Ansicht; Stufe `contribute` (Eingeladene/Anwesende: nur Notizen, eigene); `Permissions-Policy` erlaubt jetzt `microphone=(self)`.
6. **Probenfotos-Galerie** – Abschnitt Fotos, Mehrfach-Upload, Lightbox (Bild-Betrachter aus v1.14.0 wiederverwenden), Fotoerlaubnis-Hinweis. – **erledigt 2026-10-12**: Reiter „Fotos“ auf der Terminseite (Desktop unter Ablauf/Leute), Mehrfach-Upload nacheinander mit Fortschritt, Betrachter mit Blättern (Pfeile, Tasten, Wischen) und Unterzeile, Hinweis „nur intern“ + Namen mit Fotoerlaubnis „gar nicht“. Dazu eigener Audio-Player (Spulen, ±10 s, Tempo 0,75/1/1,25, immer nur einer spielt).
7. **Neue Bausteintypen** – Enum/Vorlagen, Editor-Auswahl, Icons, Durchlauf mit mehreren Szenen, Planungshilfen (probbare Szenen) berücksichtigen.
   6b. **Saisonende** – Medien der Produktion schreibgeschützt.
8. **E2E + Screenshots mobil/desktop auf Staging + Release** (iPhone: Aufnahme + Abspielen testen).

## Risiken / Hinweise

- Objektspeicher: Staging-Sync und Demo brauchen eigene Buckets; DB-Dumps enthalten nur Schlüssel. Bucket-Backup separat. Limits + Bildverkleinerung bleiben Pflicht.
- Body-Limit von Next/Ingress (nginx `proxy-body-size`) für 25 MB prüfen.
- iOS: MediaRecorder erst ab iOS 14.3; Aufnahme nur nach Nutzergeste; Bildschirm-Sperre beendet Aufnahme.
- Realtime: neue Anhänge über bestehendes `rehearsal_updated` melden (nur Metadaten, keine Bytes).

## Entscheidungen (2026-10-12)

1. **Speicher (aktualisiert):** Im Cluster läuft bereits **RustFS** (S3, Namespace `rustfs`, 100 Gi local-path auf vmd179361, bisher nur Velero-Ziel). Vorschlag: RustFS mitnutzen statt Garage zusätzlich – eigener Bucket `mb-media` / `mb-media-staging`, eigener Zugangsschlüssel nur für diese Buckets. Achtung: Velero-Backups und Medien lägen auf demselben Node/Volume → Medien-Bucket braucht eine **zweite Kopie woanders** (z. B. nächtlich per rclone auf vmd116756 oder extern). App spricht nur S3 (`src/lib/storage/`), **Kein öffentlicher S3-Endpunkt** (RustFS hält auch die Velero-Backups): die App reicht Up-/Downloads durch (Stream, Range-Header an S3 weitergeben).
2. **Fotos sehen/hochladen:** Eingeladene **und** tatsächlich Anwesende (auch spontan Dazugekommene) + Protokoll-Zugriff.
3. **Memos/Notizen:** dieselben Personen dürfen auch Notizen und Sprachmemos anlegen (eigene bearbeiten/löschen). Damit wird `getProtocolAccess` um eine Stufe `contribute` erweitert: Notizen/Medien ja, Ablauf/Anwesenheit/Aufgaben-Zuweisung nein.
4. **Erledigt:** je Zuständigem, zusätzlich Knopf „Für alle erledigt“ (setzt alle offenen Zuständigen, merkt `doneById`).
5. **Bausteintypen (Empfehlung):** echte neue Typen nur, wo sich Verhalten unterscheidet: `RUN` (mehrere Szenen), `MUSIC` (Einspieler-Player), `BREAK` (keine Teilnehmenden/kein Protokoll). Aufwärmen, Technik-/Kostümprobe, Besprechung als **Vorlagen** für `CUSTOM` (Titel, Icon, Dauer, „für alle“), von Planern erweiterbar. Weniger Code in Editor, Planungshilfen und Probenmodus; neue Arten brauchen kein Release.
6. **Limits:** Foto 2000 px, Sprachmemo 10 min, Musik 25 MB.
7. **Kein Archiv-Umzug, sondern gleich ordentliche Struktur:** Dateien werden beim Upload unter lesbaren Pfaden abgelegt, z. B.
   `produktionen/<jahr>-<stueck-slug>/proben/<YYYY-MM-DD>-<termin-slug>/{fotos,memos,notizen}/<datei>` und Musik/Einspieler unter `produktionen/<…>/musik/`. Am Saisonende wird nur noch schreibgeschützt (Rechte), nichts verschoben. Die DB bleibt maßgeblich (Pfad steht in `storageKey`); verschiebt sich ein Termin, bleibt der Ordner (Pfad = Stand beim Upload) – kein Umbenennen, weil S3 keine echten Ordner kennt (Umbenennen = kopieren + löschen). Später (Nextcloud/immich, zurückgestellt) kann der Bucket **lesend** eingebunden werden; Schreiben von außen nicht, sonst läuft die DB auseinander.

## Noch offen

- RustFS mitnutzen (Vorschlag) oder doch getrennt Garage?
- Wohin geht die zweite Kopie des Medien-Buckets?
- Nextcloud/immich: später.
