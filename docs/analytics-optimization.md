# Ableitung von Optimierungsempfehlungen

Dieses Dokument beschreibt die Heuristiken, mit denen `optimizationInsights` aus den in der Datenbank gespeicherten Metriken erzeugt werden. Die Regeln sind so formuliert, dass sie mit `analytics_page_metrics`, `analytics_session_insights`, `analytics_device_metrics` und `analytics_http_summary` funktionieren und nur dann auf statische Fallback-Daten zurückgreifen, wenn keine aktuellen Messwerte verfügbar sind.

## Grundlagen

* **Page Metrics (`analytics_page_metrics`)** liefern die Rohdaten für Ladezeiten und LCP pro Route. Sie werden mit den statischen Metadaten aus `server-analytics-static.json` angereichert.
* **Device Metrics (`analytics_device_metrics`)** geben Sessions und Ladezeiten je Gerätetyp aus.
* **Session Insights (`analytics_session_insights`)** enthalten Retention, Seiten pro Sitzung und Segment-Anteile.
* **HTTP Summary (`analytics_http_summary`)** stellt Backend-spezifische Kennzahlen (Fehlerquoten, Cache-Hit-Rate, Payload-Größen) bereit.

Alle Grenzwerte sind so gewählt, dass relevante Abweichungen gegenüber den Zielwerten auftauchen, ohne die Empfehlungen zu überfrachten.

## Regelkatalog

1. **Langsame Seiten (Frontend/Mitgliederbereich)**
   * Trigger: `avgPageLoadMs ≥ 1,8 s`.
   * Auswahl: Seite mit der höchsten Ladezeit und Gewichtung über Seitenaufrufe.
   * Wirkung: Titel hebt die betroffene Route hervor, Beschreibung empfiehlt Asset-/JavaScript-Optimierungen.
   * Impact: `≥ 3,2 s → Hoch`, sonst `≥ 1,8 s → Mittel`, darunter `Niedrig`.
   * Bereich: über den Pfad (`/mitglieder` → Mitgliederbereich, sonst Frontend).

2. **LCP-Optimierung**
   * Trigger: `lcpMs ≥ 1,8 s` (LCP aus Page Metrics).
   * Auswahl: Höchster LCP-Wert, wobei die bereits als „langsame Seite“ markierte Route übersprungen wird.
   * Maßnahme: Fokus auf Hero-/Above-the-fold-Elemente, komprimierte Medien, kritische CSS.

3. **Mitglieder-Latenzen**
   * Trigger: `avgPageLoadMs ≥ 1,7 s` für Mitgliederseiten **oder** `membersAvgResponseMs ≥ 1,7 s` aus der HTTP-Summary.
   * Beschreibung: Hinweis auf serverseitige Optimierungen (Caching, Streaming, Query-Tuning).

4. **Segment-Retention**
   * Trigger: `share ≥ 12 %` **und** `retentionRate ≤ 55 %` in den Session Insights.
   * Impact: `≤ 40 % → Hoch`, sonst `Mittel`.
   * Bereich: Segmente mit „Mitglied“ im Namen → Mitgliederbereich, sonst Frontend.

5. **Geräte-Performance**
   * Trigger: `share ≥ 20 %` **und** `avgPageLoadMs ≥ 1,4 s` für einen Device-Typ.
   * Maßnahme: Responsive Bildgrößen, Ressourcensplitting.

6. **API-/Infrastruktur-Hinweise**
   * **API-Fehlerquote**: `apiErrorRate ≥ 5 %` → Infrastruktur-Empfehlung mit Log-/Retry-Hinweis.
   * **Cache-Hit-Rate**: `cacheHitRate ≤ 60 %` → Edge-Caching ausbauen.
   * **Payload-Größe**: `frontendAvgPayloadBytes ≥ 450 KB` → Payload reduzieren (Lazy Loading, Kompression).

Die Heuristiken werden auf maximal sechs Empfehlungen begrenzt. Ergibt sich keine Empfehlung, kommen die drei Fallback-Einträge aus `server-analytics-static.json` zum Einsatz.

## Fallback-Verhalten

* Wird keine Datenbankverbindung hergestellt oder liefert keine der oben genannten Quellen Werte, bleiben die statischen Fallback-Einträge aktiv.
* Sobald mindestens eine der Datenquellen Daten liefert, werden dynamische Insights berechnet. Reicht die Datenlage dennoch nicht für eine Empfehlung, greifen ebenfalls die Fallbacks.

## Anpassung

* Schwellenwerte können bei Bedarf zentral in `src/lib/analytics/derive-optimization-insights.ts` angepasst werden.
* Neue Regeln sollten die bestehende Struktur (`deriveOptimizationInsights`) nutzen und klar dokumentiert werden.
