# Betrieb, Updates und Installation

## Projektbetrieb

```text
node .shared-project/tools/cli.mjs info
node .shared-project/tools/cli.mjs resolve api
node .shared-project/tools/cli.mjs run web test
```

Die ergänzten `npm run shared:setup`, `shared:dev`, `shared:test`,
`shared:build`, `shared:preview` und `shared:export` entsprechen den tatsächlich
konfigurierten Aufgaben im App-Manifest. Bestehende Skripte behalten ihre
Bedeutung; nutze für isolierte Ausführung die Wrapper.

Der Cache liegt auf dem Mac in `~/Library/Caches/codex-shared-projects`, auf
Windows unter `%LOCALAPPDATA%\codex-shared-projects`. Für Tests/Diagnose kann
`SHARED_PROJECT_CACHE` einen anderen lokalen Cache wählen, außerhalb der
gemeinsamen Basis. Der Pfad trennt Projektkennung, logischen Projektpfad,
Plattform, Architektur, Node-Hauptversion und ABI, App und Aufgabe. npm-Caches
und Node-Downloads bleiben lokal. Die Quellinstanz wird anhand Realpfad bzw.
Dateiidentität geprüft. Andere Kopien mit gleicher Kennung kollidieren sichtbar.
Mount-Aliase derselben Quelle verwenden dieselbe logische Laufzeit. Liefert
eine Freigabe keine verlässliche Dateiidentität, wird ein unbekannter Alias
konservativ abgewiesen; native Windows-Aliase sind gesondert zu prüfen.

Dev, Test, andere Prüfungen und Setup haben eigene Laufzeiten. Build, Export
und Preview teilen eine gesperrte Build-Laufzeit. Preview baut den aktuellen
Snapshot neu. Dev übernimmt Änderungen und Löschungen alle 500 ms. Paket-,
Lock-, .npmrc-, Projektkonfigurations- und explizite `restart`-Änderungen
stoppen weitere Übernahme und verlangen einen Neustart.

Manuelle npm-Installationen im gemeinsamen Ordner sind weiterhin technisch
möglich. Das Toolkit verweigert Starts bei gemeinsamen node_modules und
verschiebt/löscht sie nicht automatisch. Sichere Altinstallationen im
entsprechenden Auftrag bewusst lokal. Ein preinstall-Hook ist kein vollständiger
Schutz und wird nicht pauschal in eigene Abläufe eingefügt.

## Aktualisierung und Rückweg

Erzeuge mit dem **neuen Skill** einen Plan ohne Spezifikation, um Werkzeuge zu
aktualisieren. Für Konfigurationsänderungen übergib die benötigten `bases`,
`paths` bzw. vollständigen Appdefinitionen. Andere Werte bleiben erhalten;
projectId bleibt stabil. Ein identischer zweiter Lauf verändert keine Datei.
`.shared-project/state.json` speichert Vorlagenversion, Ausgangshashes für
Werkzeuge und Abschnitte sowie Ausgangswerte einzelner npm-Wrapper.

Eigene Änderungen außerhalb verwalteter Teile bleiben bestehen. Angepasste
verwaltete Ressourcen ergeben konkrete Konflikte. Prüfe die Unterschiede und
löse sie im aktuellen Auftrag. Keine erzwungene Neuinstallation durch Löschen
des Zustands oder der Konfliktliste.

`apply` prüft alle Ausgangshashes vor dem ersten Schreibvorgang und legt ein
Journal mit alten und neuen Inhalten unter `.shared-project/transactions` an.
Teilfehler lösen Rücklauf aus. Nach Abbruch oder für bewussten Rückweg:

```text
node <Skill>/scripts/cli.mjs rollback --journal <Journal.json>
```

Auch pending-Journale sind zurückrollbar. Nachträgliche Änderungen ergeben
Konflikte und bleiben erhalten. Ein hart abgebrochener Rücklauf kann mit dem
pending-Journal fortgesetzt werden. Journale enthalten Projektinhalte; prüfe,
ob sie versioniert werden sollen.

## Sperren und Export

Sperren enthalten PID, Host, Token und Zeit. Tote lokale PIDs werden beim
nächsten Erwerb zurückgenommen. Lebende/wiederverwendete PIDs, fremde Hosts
und beschädigte Sperren werden nicht zeitgesteuert entfernt. Prüfe den
Besitzerprozess vor manueller Entfernung. Ein kurzlebiges `.acquire`-Verzeichnis
serialisiert den Erwerb. Bleibt es nach Abbruch liegen, prüfe den Prozess und
entferne danach das leere Gate. Fremde Hosts brauchen eine Prüfung dort.

Export baut lokal, sperrt separat `<Ziel>.shared-export.lock`, kopiert nach
`<Ziel>.shared-staging` und behält `<Ziel>.shared-previous` bis zum erfolgreichen
Austausch. Fehler erhalten den vorherigen Stand. Nach hartem Abbruch wird beim
nächsten Export das Backup wiederhergestellt, falls das Ziel fehlt. Es gibt
ein kurzes Umbenennungsfenster; kein transaktionales Dateisystem für HTTP-Leser.

## Gezielte Pfadmigration

Der aktuelle Auftrag bestimmt den Umfang. Beispiel für `edits.json`:

```json
[
  {"kind":"config","path":"settings.json","pointer":"/apiRoot","from":"/alter/Anker/API","to":"Source/API"},
  {"kind":"markdown-link","path":"docs/guide.md","from":"/alter/API/readme.md","to":"../../API/readme.md"}
]
```

`config` ist ein exakter JSON-Pointer auf einen String. Prüfe, dass die
konsumierende Anwendung das relative Modell verwendet; Anwendungscode wird
nicht automatisch migriert. `markdown-link` ersetzt ein eindeutiges `](Ziel)`
durch ein existierendes relatives Linkziel. Mehrere Stellen einer Datei werden
in einem gemeinsamen Dateieintrag geplant. Für ein ausdrücklich betroffenenes
Prüfsummenfeld ist außerdem `{"kind":"checksum","path":"manifest.json",
"pointer":"/docSha256","from":"bisheriger Hash","of":"docs/guide.md"}`
möglich; es berechnet den Hash aus dem bereits geplanten neuen Inhalt.
Komplexe Markdown-Syntax gezielt
manuell vorbereiten. Erzeuge die Vorschau mit `migration-plan --root <Projekt>
--edits <edits.json> --out <Plan.json>` und wende sie mit `apply` an. Rohquellen,
Zitate, Logs und fachliche Daten bleiben erhalten. Betroffene Prüfsummenmanifest-
Werte explizit im selben Auftrag aktualisieren und prüfen; Herkunftsbelege
nicht unbemerkt neu signieren.

## Persönlicher Skill auf Mac und Windows

Führe den Installer **im Zielsystem** aus. Er prüft Plattform und Zielkontext,
Dateiliste und SHA-256 des Pakets sowie das Ergebnis. Standardziel ist die
persönliche `.agents/skills`-Ablage gemäß
[offizieller Skill-Dokumentation](https://learn.chatgpt.com/docs/build-skills).
Falls die aktive Umgebung einen anderen persönlichen Skillpfad verwendet,
gib ihn mit `--skills-root` an. Er muss im nativen Home oder bereits gesetzten
CODEX_HOME liegen. Keine dieser Variablen wird geändert; es werden keine
übrigen Codex-Verzeichnisse kopiert.

Mac:

```sh
node skills/setup-shared-project/scripts/install-skill.mjs --platform darwin
```

Windows in **nativer PowerShell**, aus dem gemeinsamen Toolkit-Ordner oder
einer unveränderten Kopie des vollständigen Skillpakets:

```powershell
node .\skills\setup-shared-project\scripts\install-skill.mjs --platform win32
node "$env:USERPROFILE\.agents\skills\setup-shared-project\scripts\verify-native.mjs" --vite --bootstrap --out .\.runtime\verification-windows.json
```

Der Installer verwendet das native Benutzerprofil. Ein Mac-Home-Laufwerk ist
kein Windows-Installationsnachweis. Passe den zweiten Pfad bei abweichendem
Installationsziel an. Eigene Skilländerungen blockieren Updates; identische
Installation ist idempotent. Codex erkennt Skilländerungen laut Dokumentation
automatisch; falls er nicht erscheint, starte Codex neu. Aufruf:

```text
$setup-shared-project Richte dieses Projekt für Mac und Windows in Parallels ein.
```
