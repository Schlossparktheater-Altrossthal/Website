# API: Website-Theme-Verwaltung

## Überblick

- Mitglieder mit der Berechtigung `mitglieder.website.settings` können mehrere Website-Themes parallel verwalten.
- Themes lassen sich neu anlegen, aus bestehenden Varianten duplizieren, umbenennen und gezielt aktivieren.
- Die Website-Einstellungen akzeptieren weiterhin den bisherigen Payload, unterstützen jetzt aber optional das direkte Speichern eines Themes samt Aktivierung.

## Voreingestellte Themes

Beim ersten Zugriff werden mehrere Presets automatisch angelegt, falls sie noch nicht vorhanden sind.

| ID | Name | Beschreibung |
| --- | --- | --- |
| `theatre-sunset-glow` | Sommertheater Sonnenuntergang | Warme Orange- und Goldtöne für stimmungsvolle Abendvorstellungen. |
| `theatre-night-sky` | Sommertheater Nachtblau | Kühle Blaunuancen mit hoher Kontrastwirkung für nächtliche Events. |
| `theatre-pastel-dream` | Sommertheater Pastell | Sanfte Pastellfarben für festliche Sommermatineen. |
| `theatre-forest-canopy` | Sommertheater Waldlichtung | Natürliche Grün- und Moostöne für Freilicht-Bühnenbilder. |
| `theatre-velvet-spotlight` | Sommertheater Samt & Scheinwerfer | Dramatische Purpurakzente für Gala-Abende und Premieren. |
| `theatre-festival-lights` | Sommertheater Festivallichter | Strahlende Festivalfarben mit verspieltem Charakter für Sommerfeste. |

Die Presets werden als normale Datenbankeinträge gespeichert und können auf Wunsch dupliziert oder als Basis für eigene Anpassungen verwendet werden.

## Endpunkte

### `GET /api/website/themes`

Liefert alle Themes als kompakte Zusammenfassungen.

```json
{
  "themes": [
    {
      "id": "theatre-night-sky",
      "name": "Sommertheater Nachtblau",
      "description": "…",
      "isDefault": false,
      "updatedAt": "2024-05-01T18:21:00.000Z"
    }
  ]
}
```

### `POST /api/website/themes`

Erstellt ein neues Theme. Der Body ist optional und entspricht dem Schema

```json
{
  "name": "Neues Theme",
  "description": "Optionaler Beschreibungstext",
  "sourceThemeId": "uuid-oder-preset-id"
}
```

- Ohne `sourceThemeId` wird mit den aktuellen Standard-Tokens gestartet.
- Mit `sourceThemeId` wird das angegebene Theme (Preset oder eigenes) dupliziert.
- Die Antwort enthält das vollständige Theme (`theme`) sowie eine verkürzte Zusammenfassung (`summary`).

### `GET /api/website/themes/[themeId]`

Lädt ein einzelnes Theme inklusive aller Tokens.

### `PUT /api/website/themes/[themeId]`

Aktualisiert Name, Beschreibung und Tokens eines bestehenden Themes. Beispiel-Payload:

```json
{
  "name": "Sommernachts-Traum",
  "description": "angepasst",
  "tokens": { "radius": { "base": "0.75rem" } }
}
```

> [!NOTE]
> Das Standard-Theme (`isDefault: true`) bleibt in seiner ursprünglichen Form erhalten und kann nicht umbenannt werden.

### `PUT /api/website/settings`

Dieser Endpunkt bündelt Website- und Theme-Updates. Der Payload besteht aus drei optionalen Objekten:

```json
{
  "settings": {
    "siteTitle": "Sommerbühne 2024",
    "colorMode": "dark",
    "themeId": "uuid"
  },
  "theme": {
    "id": "uuid",
    "name": "Sommernachts-Traum",
    "description": "angepasst",
    "tokens": { "modes": { "light": { "button-primary": "#ffab00" } } }
  },
  "activateTheme": true
}
```

- `settings.themeId` aktiviert ein vorhandenes Theme ohne es zu verändern.
- Wird gleichzeitig ein `theme` übermittelt, speichert die Route zuerst das Theme und verknüpft es anschließend mit den Website-Einstellungen.
- `activateTheme` erzwingt die Aktivierung des übermittelten Themes. Lässt man die Eigenschaft weg, wird automatisch aktiviert, sobald `theme` gesetzt ist oder `settings.themeId` explizit übertragen wurde.

Die Antwort enthält stets die aktuellen Website-Einstellungen (`settings`) und – falls ein Theme gespeichert wurde – das aktualisierte Theme-Objekt (`theme`).

## Berechtigungen & Sicherheit

Alle oben genannten Endpunkte verlangen eine angemeldete Sitzung mit der Berechtigung `mitglieder.website.settings`. Ohne gültige Datenbankverbindung antworten die Routen mit `500`.

## Zusätzliche Hinweise

- Themes werden nach `name` sortiert, das Standard-Theme steht immer an erster Stelle.
- Presets werden automatisch nachgezogen, wenn neue Varianten im Code ergänzt werden.
- Beim Löschen oder Zurücksetzen eines Themes muss anschließend ein anderes Theme aktiv ausgewählt werden, damit die Website konsistente Tokens erhält.
