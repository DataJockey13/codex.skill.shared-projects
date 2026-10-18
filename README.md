# Gemeinsame Codex-Projekte auf Mac und Windows

Toolkit und persönlicher Skill `setup-shared-project`, Version 1.0.0. Ein
Quellordner bleibt gemeinsam bearbeitet; Pfade werden über native Basisanker
aufgelöst. npm-Abhängigkeiten, Caches und Builds liegen lokal je Projekt,
Plattform, Architektur, Node-Kompatibilität, Anwendung und Aufgabe.

Die erste nutzbare Version ist implementiert und auf dem Mac geprüft. Native
Windows-Abnahme und separate Windows-Skillinstallation stehen noch aus.

## Aus GitHub installieren

Öffentliches Repository:
[DataJockey13/codex.skill.shared-projects](https://github.com/DataJockey13/codex.skill.shared-projects).

### Direkt in Codex

Wie beim [Maintain-Knowledge-Wiki-Skill](https://github.com/DataJockey13/maintain-knowledge-wiki)
kannst du Codex auf dem jeweiligen Rechner diesen Auftrag geben:

```text
Nutze $skill-installer, um diesen Skill aus dem öffentlichen GitHub-Repository
in meine persönliche lokale Codex-Skillablage zu installieren:
https://github.com/DataJockey13/codex.skill.shared-projects/tree/main/skills/setup-shared-project
Prüfe zuerst, ob setup-shared-project bereits installiert ist, und vermeide
eine zweite Kopie. Erhalte eigene Anpassungen bei einer Aktualisierung.
```

Der Auftrag gilt gleichermaßen für Codex auf dem Mac und **natives Codex unter
Windows**. Führe ihn auf jedem System getrennt aus. Ein Windows-Chat muss in
der nativen Windows-Umgebung arbeiten; eine Installation aus WSL oder in die
Mac-Home-Freigabe ist keine Installation für natives Windows-Codex.

`skill-installer` kopiert einen Stand aus dem angegebenen Unterordner. Er
aktualisiert eine vorhandene Installation nicht automatisch. Sein Standardziel
ist die persönliche Ablage unter CODEX_HOME/skills, sonst `~/.codex/skills`;
`--dest` kann einen anderen tatsächlich verwendeten Skillpfad wählen. Die
aktuelle Codex-Dokumentation beschreibt außerdem `~/.agents/skills` als
persönliche Skillablage. Vermeide doppelte Installationen mit demselben Namen.
Neue Skills stehen im nächsten Chat-Turn bereit; falls der Skill nicht
erscheint, starte Codex neu. Siehe
[offizielle Skill-Dokumentation](https://learn.chatgpt.com/docs/build-skills).

### Über einen lokalen Git-Checkout

Git und ein ausführbares Node mit npm werden vorausgesetzt. Für die Installation
des Skills sind weder `npm install` noch die Projekteinrichtung erforderlich.
Der mitgelieferte Installer prüft Paketdateien, Prüfsummen und Zielkontext.
Er verwendet standardmäßig die persönliche lokale `.agents/skills`-Ablage.

Mac, im Terminal:

```sh
git clone https://github.com/DataJockey13/codex.skill.shared-projects.git
cd codex.skill.shared-projects
node skills/setup-shared-project/scripts/install-skill.mjs --platform darwin
```

Windows, in nativer PowerShell:

```powershell
git clone https://github.com/DataJockey13/codex.skill.shared-projects.git
Set-Location codex.skill.shared-projects
node .\skills\setup-shared-project\scripts\install-skill.mjs --platform win32
```

Auch ein bereits gemeinsamer Checkout genügt als Installationsquelle. Führe
den Installer dann einmal auf dem Mac und einmal nativ im Windows-Gast aus.
Kopiert wird ausschließlich der Skill samt Ressourcen. HOME, USERPROFILE,
CODEX_HOME, Authentisierung und Sessions bleiben unverändert. Bei einem
abweichenden persönlichen Skillpfad gib `--skills-root` ausdrücklich an.

Nach Installation über **diesen mitgelieferten Installer** aktualisierst du
die lokale Skillkopie aus demselben Checkout so:

```sh
git pull --ff-only
node skills/setup-shared-project/scripts/install-skill.mjs --platform darwin
```

Unter Windows lautet der zweite Befehl entsprechend:

```powershell
node .\skills\setup-shared-project\scripts\install-skill.mjs --platform win32
```

Der Installer ist bei identischem Stand idempotent und meldet eigene Änderungen
als Konflikte. Eine bestehende Installation **über skill-installer** besitzt
keinen Beleg unseres Installers; sie wird deshalb nicht blind überschrieben.
Lass Codex in diesem Fall die alte Kopie prüfen und sichern, bevor eine neuere
Kopie installiert wird. Ein `git pull` allein aktualisiert eine kopierte
Skillinstallation nicht.

## Verwendung

Nach der Skillinstallation in einem gewünschten Zielprojekt:

```text
$setup-shared-project Richte dieses Projekt für Mac und Windows in Parallels ein.
```

Der Skill untersucht das Projekt, wählt Grundmodul und gegebenenfalls npm-/Vite,
zeigt einen konkreten Einrichtungsplan und prüft die Einrichtung. Eigene
Anweisungen und Skripte bleiben erhalten. Bestehende Projekte werden durch die
Entwicklung dieses Toolkits nicht automatisch migriert.

Direkter Werkzeugeinstieg:

```sh
node skills/setup-shared-project/scripts/cli.mjs inspect --root /Pfad/zum/Projekt
node skills/setup-shared-project/scripts/cli.mjs plan --root /Pfad/zum/Projekt --spec /Pfad/spec.json --out /Pfad/plan.json
node skills/setup-shared-project/scripts/cli.mjs apply --plan /Pfad/plan.json
```

Eine Spezifikation enthält native `bases`, basisrelative `paths` mit `project`
und `apps: {}` oder passend konfigurierte Apps. Kennung und Version werden
angelegt. Beispiele und genaue Bezüge stehen in der
[Konfigurationsreferenz](skills/setup-shared-project/references/configuration.md).

## Entwicklung und Prüfung

```sh
npm test
npm run pack:skill
npm run verify:native -- --vite --bootstrap --out .runtime/verification-macos.json
```

`npm test` prüft eingefrorene Referenzen, ursprüngliche Infrastrukturtests,
neue Verhaltenstests und das Skillpaket. Das Toolkit hat keine externen
npm-Paketabhängigkeiten. `pack:skill` aktualisiert nach Änderungen am Skill
seine versionierte Dateiliste und Prüfsummen; anschließend `npm test` ausführen.
Die native Abnahme verwendet temporäre synthetische Projekte. `--vite` lädt
npm-Pakete, `--bootstrap` prüft einen echten offiziellen Node-Download.

| Dokument | Zweck |
| --- | --- |
| [ARCHITEKTUR.md](ARCHITEKTUR.md) | Modulgrenzen, Datenmodell und Laufzeitentscheidungen |
| [VERIFIKATION.md](VERIFIKATION.md) | Tatsächliche Ergebnisse und offene Windows-Prüfungen |
| [Skill](skills/setup-shared-project/SKILL.md) | Einrichtungsablauf für Codex |
| [Betrieb und Installation](skills/setup-shared-project/references/operations.md) | Update, Rollback, Migration, Sperren und Windows-Befehle |
| [UEBERGABE.md](UEBERGABE.md) | Übernommene Anforderungen und historische Referenz |
| [STARTPROMPT.md](STARTPROMPT.md) | Ursprünglicher Entwicklungsauftrag |
| [reference-manifest.json](reference-manifest.json) | Herkunft und SHA-256 der 13 eingefrorenen Referenzdateien |

Die CLI-Einstiegspunkte in `reference/vertrag/tools` dürfen hier nicht ausgeführt
werden: Sie adressieren möglicherweise den Ursprung. Nur die isolierten
Referenztests werden mit `npm test` aufgerufen. Das Ursprungsprojekt und seine
fachlichen Daten bleiben unverändert. Commits, Pushes und Veröffentlichung
erfolgen nur auf ausdrücklichen Benutzerauftrag.
