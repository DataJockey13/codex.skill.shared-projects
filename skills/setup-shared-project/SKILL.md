---
name: setup-shared-project
description: Richte neue oder bestehende Projekte für gemeinsame Quellen auf macOS und nativem Windows in Parallels ein, mit relativen logischen Pfaden, erhaltenden Updates und optionalen lokalen npm-/Vite-Laufzeiten. Verwende den Skill auch für Updates dieser Einrichtung; er migriert keine fachlichen Rohquellen pauschal.
---

# Gemeinsame Projekte einrichten

Arbeite im beauftragten Zielprojekt. Die Werkzeuge liegen relativ zu diesem
Skill in `scripts/`; die Installation braucht kein Entwicklungsprojekt oder
früheres Beispielprojekt. Duze den Benutzer.

## Untersuchung und Auswahl

Lies die geltenden Projektanweisungen. Prüfe tatsächliche Umgebung
(`process.platform`, `process.arch`, WSL), erreichbare Freigaben, bestehende
Anweisungen einschließlich Overrides, Git-Grenzen, Paketmanager, Lockdateien,
eigene Skripte, lokale Dateiabhängigkeiten und `engines.node`.

Führe `node <Skill>/scripts/cli.mjs inspect --root <Projekt>` aus. Das ist
eine Untersuchung, keine automatische Konfiguration. Kläre gemeinsame Basis
und native Anker. Nur die Anker sind absolut; Projekt und verwandte Quellen
liegen relativ zur Basis. Ein Windows-Laufwerk ist keine WSL-Basis. Frage
nur fehlende entscheidende Angaben ab.

Wähle das Grundmodul für Projekte ohne npm-App. Wähle für eigenständige
npm-Apps `npm` oder `npm-vite`; passe Quellauswahl, Skripte, Node-Anforderung,
Neustartdateien und Ausgabeziele an. Lies dazu
[Konfiguration und Grenzen](references/configuration.md). Andere Paketmanager,
npm-Workspaces und vollständige WSL-Laufzeiteinrichtung sind nicht implementiert.

## Überprüfbare Einrichtung

Schreibe eine Spezifikation z. B. unter `.runtime/setup-spec.json`:

```text
node <Skill>/scripts/cli.mjs plan --root <Projekt> --spec <Spezifikation> --out <Plan.json>
node <Skill>/scripts/cli.mjs apply --plan <Plan.json>
```

Prüfe vor dem Anwenden `entries`, `changes`, Untersuchung und Konflikte und
zeige die relevanten Änderungen. Wende denselben Plan im Rahmen des aktuellen
Auftrags an. Bei einer reinen Vorschau endet die Arbeit am Plan. Löse Konflikte
konkret, statt vorhandene Anweisungen oder Skripte zu ersetzen. Geänderte
Ausgangsdateien führen zum Abbruch; Konfliktpläne dürfen nicht durch Weglassen
der Konfliktliste erzwungen werden.

Die Kennung entsteht einmal und bleibt bei Updates erhalten. Eine bewusst
unabhängige Kopie bekommt im entsprechenden Auftrag eine neue projectId.
Andere Quellinstanzen mit gleicher Kennung werden beim Laufzeitstart als
Kollision abgewiesen. Git-Worktrees brauchen einen passenden eigenen logischen
Projektpfad oder eine eigene Kennung.

Rohquellen, Zitate, Protokolle und historische Nachweise bleiben erhalten.
Für beauftragte Pfadmigration lies den Abschnitt Migration in
[Betrieb und Aktualisierung](references/operations.md). Konfigurationswerte
und echte relative Markdown-Linkziele lassen sich einzeln planen; URLs,
API-Angaben und Textbeispiele sind keine automatischen Migrationsziele.

## Prüfung und Übergabe

Prüfe `info`, logische Pfade, einen zweiten identischen Plan und den Erhalt
eigener Anweisungen und Skripte. Bei npm-Apps führe konfigurierte Tests und
Builds über die Wrapper aus. Prüfe Dev-Änderungen und Löschungen sowie
Preview/Export, soweit beauftragt. Bearbeite nur die gemeinsame Quelle.

Lies [Betrieb und Aktualisierung](references/operations.md) für Update,
Rollback, Sperren und separate Skillinstallation. Für die native allgemeine
Abnahme:

```text
node <Skill>/scripts/verify-native.mjs --vite --bootstrap --out <Ergebnis.json>
```

Der Test verwendet ausschließlich synthetische Projekte im System-Temp.
`--vite` braucht npm-Netzzugriff; `--bootstrap` lädt die konfigurierte offizielle
Node-Distribution. Melde native Windows-Prüfung nur nach tatsächlicher
Ausführung unter `process.platform === 'win32'` als bestanden. Simulierte
Windows-Pfade auf dem Mac sind davon getrennt.

Installiere nur den Skill samt Ressourcen in die persönliche lokale Ablage
des jeweiligen Systems. HOME, USERPROFILE, CODEX_HOME, Authentisierung,
Sessions und globale Sicherheitseinstellungen werden nicht verändert.
