# Skript: Live-Mitlesen und Autoscroll (Plan 2026-10-18)

Teil von Phase 12 aus `skript-plan.md` (Live-Mitlesen). Erweitert die dort geplante
„Führung durch eine Person“ (E11) um eine **automatische Live-Stelle**, die aus dem Verhalten
aller Mitlesenden statistisch geschätzt wird.

## Ziel

Bei Lesungen, Durchlaufproben und Vorstellungen soll der Leser von selbst an der Stelle stehen,
an der gerade gesprochen wird – ohne dass jemand bedienen muss. Wer kurz zurück- oder
vorausblättert (eigene nächste Stelle ansehen, Vergangenes nachlesen), wird nicht gestört und
kommt mit einem Tipp zurück.

Drei Arten zu folgen (im Leser wählbar, pro Person gemerkt):

| Modus             | Quelle der Live-Stelle                                           | Typischer Einsatz                |
| ----------------- | ---------------------------------------------------------------- | -------------------------------- |
| **Aus**           | – (wie heute)                                                    | allein lesen, lernen             |
| **Person folgen** | Position einer bestimmten Person (Souffleuse, Inspizienz, Regie) | Vorstellung, Technik             |
| **Automatisch**   | Schätzung aus allen Mitlesenden + Sprechtempo                    | Lesung, Probe ohne feste Führung |

„Automatisch“ fällt auf „Person folgen“ zurück, wenn eine Führung aktiv ist und man das will;
umgekehrt wird „Person folgen“ zur Schätzung, wenn die geführte Person die Sitzung verlässt.

## Grundidee der statistischen Live-Stelle

Jedes Gerät meldet nur seine **Lesezeile**: den Absatz (`lineageId` + Anteil innerhalb des
Absatzes), der auf ca. 40 % Bildschirmhöhe steht, dazu ein paar Flags. Daraus entsteht pro
Sitzung eine Schätzung:

1. **Wer folgt gerade wirklich?** Eine Meldung zählt nur, wenn die Person
   - in den letzten ~20 s gescrollt hat (nicht eingeschlafen/Gerät liegt weg),
   - nicht gerade schnell blättert (Geschwindigkeit über Schwelle = „sucht etwas“),
   - und sich ungefähr im Sprechtempo vorwärts bewegt (siehe 3).
     Wer weit vor oder hinter der Masse steht, ist mit hoher Wahrscheinlichkeit „am Nachlesen“
     oder „schaut voraus“ und fällt aus der Wertung – ohne dass er etwas tun muss.
2. **Robuster Schwerpunkt statt Mittelwert:** Positionen werden auf eine Achse „Zeichen ab
   Anfang“ abgebildet. Live-Stelle = Mitte des dichtesten Clusters (gewichteter Median im
   Fenster um die letzte Schätzung). Ein paar Leute, die zurückscrollen, ziehen die Stelle nicht
   mit. Gewichte: Souffleuse/Führende ×3, Person mit eigener Rolle in der aktuellen Szene
   leicht höher (die ist erfahrungsgemäß genau dran), Rest ×1.
3. **Vorhersage mit Sprechtempo:** Zwischen den Meldungen läuft die Stelle mit geschätztem
   Tempo (Zeichen/s) weiter. Startwert aus den gemessenen Szenenzeiten (gibt es schon in den
   Auswertungen), sonst ~14 Zeichen/s; Regieanweisungen zählen weniger, Lieder/Pausen
   werden über die Szenenzeit abgedeckt. Das Tempo wird laufend aus der Bewegung des Clusters
   nachgeführt (einfacher α-β-Filter, kein ML). Damit läuft die Stelle auch flüssig, wenn nur
   2–3 Leute mitlesen, und bleibt bei Netzaussetzern nicht stehen.
4. **Sprünge erkennen:** Springt ein Großteil der aktiven Leser gemeinsam (Szene übersprungen,
   „wir machen ab Seite 30 weiter“), übernimmt die Schätzung den Sprung nach ~3 s
   Bestätigung statt langsam hinterherzulaufen.
5. **Konfidenz:** Die Schätzung trägt eine Sicherheit (Anzahl aktiver Leser, Streuung). Bei
   niedriger Sicherheit scrollt der Leser nicht von selbst, sondern zeigt nur die Markierung.

Allein (keine Sitzung, offline) gibt es optional **„Lesetempo“**: Scrollen mit dem
geschätzten Tempo, Anpassung durch Zurückschieben/Vorziehen (Teleprompter-Prinzip). Das ist
ein Nebenprodukt von 3 und kann später kommen.

Die Rechnung läuft **im Realtime-Server pro Raum** (eine Quelle der Wahrheit, alle sehen
dieselbe Stelle, keine Positionen einzelner Personen beim Client nötig). Die Logik selbst ist
eine reine Funktion in `src/lib/skript/live/estimate.ts` und wird von Server und Tests genutzt.

## Verhalten im Leser (wichtigster Teil)

- **Live-Markierung:** dünner Balken am Rand am Live-Absatz, auch wenn man nicht folgt.
- **Folgen ohne Kampf mit dem Finger:** Sobald der Nutzer selbst scrollt (Touch, Rad, Taste),
  pausiert das Folgen sofort. Unten erscheint eine Pille „Live ↓ 12 Absätze“ bzw. „Live ↑“;
  Tippen springt zurück und folgt wieder.
- **Automatisch zurückkehren (Einstellung, Standard an):** Ist man nach dem Wegscrollen
  ~8 s untätig _und_ war man in der Nähe der Live-Stelle, folgt der Leser wieder. Wer weit
  vorausgeblättert hat (eigene nächste Stelle), bleibt dort, bis die Live-Stelle ihn
  „einholt“ – dann wird automatisch wieder gefolgt. Genau das deckt „ich schau mir schon mal
  meine nächste Stelle an“ ab.
- **Sanftes Scrollen:** kein Springen pro Meldung, sondern kontinuierliches Nachführen
  (requestAnimationFrame, Geschwindigkeit begrenzt), Lesezeile bleibt ruhig. Große Sprünge
  (> 1 Bildschirm) als einzelner Sprung.
- **Folgen-Menü in der Kopfleiste:** Aus / Automatisch / Person … (Liste der Anwesenden,
  die „Andere dürfen mir folgen“ aktiviert haben; Souffleuse oben).
- Bearbeiten, Notizen und Freihand pausieren das Folgen automatisch.
- Lernmodus bleibt außen vor (eigene Seite).

## Sitzung, Rechte, Datenschutz

- Raum `script_<fassungId>` im bestehenden Socket.io-Realtime-Server (Räume, Presence und
  `fetchSockets` gibt es schon, vgl. `rehearsal_*`). Kein neuer Dienst, kein SSE.
- Mitmachen: Beim Öffnen des Lesers nichts automatisch senden. Positionen werden gesendet,
  wenn man Folgen einschaltet oder „Mitlesen“ aktiv ist (Schalter, Standard an während einer
  laufenden Probe/Vorstellung laut Terminplan, sonst aus).
- Positionen sind **flüchtig** (nur im Speicher des Raums, nichts in der DB). Andere sehen
  einzelne Positionen nur von Personen, die „Andere dürfen mir folgen“ eingeschaltet haben
  (Führende); in die Schätzung fließen alle anonym ein.
- Führung (E11): Souffleuse bzw. Recht `SCRIPT.MANAGE` ist standardmäßig als Führung
  wählbar; „Scrollen übernehmen“ gibt sie weiter.
- Meldungen: höchstens 1/s und nur bei Änderung; Server sendet die Schätzung 2×/s an den Raum.

## Phasen

1. **Lesezeile + Folgen-Steuerung lokal** – Lesezeile messen (vorhandene Messlogik bei
   `scrollToIndex`/Sichtbereich nutzen), Positionsachse „Zeichen ab Anfang“, Controller
   „folgen/pausiert/zurückkehren“ mit sanftem Nachführen, Live-Pille. Testbar mit einer
   simulierten Live-Stelle (Tempo-Modus allein = späteres „Lesetempo“).
2. **Realtime-Raum + Person folgen** – Events `script_position`, `script_live`,
   Presence-Liste, „Andere dürfen mir folgen“, Folgen-Menü. Damit ist der alte Plan (E11) erfüllt.
3. **Statistische Schätzung** – `estimate.ts` (Aktiv-Filter, gewichteter Median im Fenster,
   α-β-Tempo, Sprungerkennung, Konfidenz) mit Unit-Tests auf simulierten Lesungen
   (Mitleser + Nachleser + Vorausblätterer + Aussetzer); Server rechnet pro Raum.
4. **Feinschliff** – automatische Rückkehr/Einholen, Tempo-Start aus Szenenzeiten,
   Kopplung an laufenden Termin, Lesetempo allein/offline.
5. **E2E + Gerätetest** – zwei Browser-Kontexte in einem Raum; echte Leseprobe als Abnahme.

## Offene Fragen

- O1: Soll „Mitlesen“ während eines Probentermins automatisch an sein oder immer bewusst
  eingeschaltet werden?
- O2: Dürfen Führende sehen, _wie viele_ mitlesen bzw. wer abgehängt ist (für die Souffleuse
  evtl. nützlich), oder bleibt das anonym?
- O3: Läuft der Realtime-Server in Prod mit einer Instanz? Sonst Schätzung mit Redis-Adapter
  bzw. sticky Raum-Zuordnung absichern.
- O4: Lesetempo allein (Teleprompter) mit in Phase 4 oder erst bei Bedarf?

## Checkliste

- [ ] Phase 1 Lesezeile + Folgen-Steuerung lokal
- [ ] Phase 2 Realtime-Raum + Person folgen
- [ ] Phase 3 Statistische Schätzung
- [ ] Phase 4 Feinschliff
- [ ] Phase 5 E2E + Gerätetest
