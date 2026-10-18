# Prüfstatus für Toolkit 1.0.0

Stand: 18.10.2026. Die eingefrorene Referenz und das neu entwickelte Toolkit
sind getrennte Nachweise. Die Referenzdateien und reference-manifest.json
wurden nicht geändert; das Ursprungsprojekt wurde nicht ausgeführt oder migriert.

## Neue Prüfungen auf dem Mac

Die Entwicklung erfolgt nativ auf macOS ARM64 mit Node 26.8.1. `npm test`
führt acht ursprüngliche Referenztests sowie 19 neue Verhaltenstests aus.
Sie decken Pfade/Fehler/Overrides, Sonderzeichen, Grundmodul ohne Node-App,
eigene Skripte und Hooks, idempotente Einrichtung, erhaltende Updates und
Konflikte, Planstabilität, Rollback, zwei gleichnamige Apps in getrennten
Projekten, parallele Builds, Cache-Trennung, Sperren, Quellabgleich,
Dev-Neustartbedarf, Exportfehler, Bootstrapfehler und gezielte Migration mit
Prüfsummen ab. Die Skillinstallation wird einschließlich Wiederholung,
Update, eigener Änderungen und Betrieb ohne Entwicklungskopie getestet.

Die zusätzliche native Abnahme verwendet Vite 8.3.4 mit echten lokalen
Installationen. Sie prüft Tests und Build parallel, Dev und Test parallel,
HTTP-Auslieferung geänderter/gelöschter Dateien, Preview, gestuften Export,
Fehlerrücklauf und einen echten SHA-256-geprüften offiziellen Node-24.22.0-
Download für macOS ARM64. Das ist eine synthetische Toolkit-Abnahme, kein Test
der ursprünglichen fachlichen Anwendungen.

Die maschinenlesbaren Belege sind [native Mac-Abnahme](verification/macos.json),
[27 bestandene Tests](verification/macos-tests.json) und
[geprüfte persönliche Skillinstallation](verification/skill-installation-macos.json).
Die vollständige native Abnahme lief aus der installierten Kopie unter
`/Users/dj/.agents/skills/setup-shared-project` mit Arbeitsverzeichnis im
System-Temp. Die Hashes des Quellpakets, der installierten Kopie und der
nativen Abnahme stimmen überein. `skill-package.json` listet jede Paketdatei mit SHA-256.
Der technische Skill wird zusätzlich mit dem Validator aus `skill-creator`
geprüft. Dessen Python-YAML-Abhängigkeit liegt nur in einer lokalen Test-venv
unter `.runtime/` und gehört nicht zum Skill.

## Native Windows-Prüfung: offen

Der neue generische Stand wurde noch nicht nativ unter Windows ausgeführt.
Windows-Pfadtests auf dem Mac simulieren Pfadregeln und sind keine native
Abnahme. Die historische Abnahme im Referenzprojekt zählt hier nicht als
Ergebnis des Toolkits. Es wurde kein Gast-Shellzugang vorausgesetzt.

Führe im nativen Windows-Gast aus dem gemeinsamen Toolkit-Ordner in PowerShell
aus:

```powershell
node .\skills\setup-shared-project\scripts\install-skill.mjs --platform win32
node "$env:USERPROFILE\.agents\skills\setup-shared-project\scripts\verify-native.mjs" --vite --bootstrap --out .\.runtime\verification-windows.json
```

Bei abweichender persönlicher Skillablage gib `--skills-root` an und verwende
diesen Pfad im zweiten Befehl. Der Installer muss im Gastprozess laufen;
ein Zugriff auf Mac-Home ersetzt keine Windows-Installation.

Die Ergebnisdatei muss `platform: "win32"`, die tatsächliche Prozessarchitektur,
den passenden Paketmanifest-Hash, `passed: true` und die einzelnen Checks
enthalten. Prüfe darüber hinaus den realen gemeinsamen Ordner über beide
nativen Basisanker und einen alternativen Windows-Mount. Untersuche native
Lock-/Export-Wiederherstellung auf der tatsächlichen Parallels-Freigabe,
insbesondere einen noch aktiven Besitzer auf dem anderen Host. Der synthetische
Test im lokalen Temp kann diese Freigabeeigenschaften nicht belegen.

## Bekannte Produktgrenzen

- V1 unterstützt Grundmodul und eigenständige npm-/Vite-Apps mit Lockdatei.
  npm-Workspaces, weitere Paketmanager und vollständige WSL-Laufzeiten fehlen.
- Symlinks in ausgewählten Appquellen und Paket-Dateiabhängigkeiten außerhalb
  der App werden abgewiesen. Befehle mit weiteren externen Build-Eingaben
  brauchen eine ausdrückliche Profilanpassung.
- Node muss zunächst ausführbar sein. Der Bootstrap ergänzt eine ungeeignete
  vorhandene Version lokal; er installiert kein erstes systemweites Node.
- Sperren fremder Hosts werden nicht allein nach Zeitablauf entfernt. Ein
  nach Abbruch verbliebenes Erwerbs-Gate benötigt eine Besitzerprüfung.
- Ein Export hat ein kurzes Umbenennungsfenster. Er erhält den alten Build
  bei Fehlern und ein wiederherstellbares Backup bei hartem Abbruch, bietet
  aber keine Dateisystemtransaktion für gleichzeitig lesende HTTP-Server.

Die erste nutzbare Mac-Version ist damit prüfbar. Eine vollständige
plattformübergreifende Abnahme bleibt bis zur neuen nativen Windows-Prüfung
offen.
